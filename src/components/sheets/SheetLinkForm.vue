<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import GoogleConnectCta from '@/components/settings/GoogleConnectCta.vue'
import GoogleConnectNotice from '@/components/settings/GoogleConnectNotice.vue'
import SheetTabsChooser from '@/components/sheets/SheetTabsChooser.vue'
import { useGoogleStore } from '@/stores/google'
import { useToursStore } from '@/stores/tours'
import { useImportsStore } from '@/stores/imports'
import { isGoogleDisconnected, isGoogleScopeMissing } from '@/composables/useGoogleIntegration'
import { isPickerError, pickSpreadsheet, type PickedSheet } from '@/composables/useGooglePicker'
import {
  createSheetSubscription,
  inspectSheet,
  useSheetSubscriptions,
  type SheetInspectResult,
  type SheetSubscription,
  type SheetTabInput,
} from '@/composables/useSheetSubscriptions'
import {
  pickerErrorKey,
  sheetApiErrorCode,
  sheetApiErrorKey,
  sheetErrorKey,
  sheetPendingCount,
} from '@/utils/sheetSubscriptions'
import { apiErrorDetail } from '@/utils/icalSubscriptions'

// Alta de una hoja de Google (F4 §4.3, §4.7): 0) sin el permiso `sheets`, `GoogleConnectCta`;
// 1) "Elegir hoja en Google Drive" abre el selector de Google y lee las pestañas (`inspect`);
// 2) pestañas (1..5, rango opcional), nombre y "Vincular hoja"; 3) sondea la primera lectura y
// ofrece "Revisar ahora" si deja un borrador. No hay campo para pegar un enlace (D-F4-14).
const props = withDefaults(
  defineProps<{
    tourUuid: string | null
    /** Giras entre las que elegir cuando `tourUuid` es null (solo las que el usuario administra). */
    tours?: { uuid: string; name: string }[]
    /** Dentro del modal Importar: sin título propio y "Volver" en vez de "Cancelar". */
    compact?: boolean
    /** Ruta a la que vuelve el OAuth de "Conectar Google Sheets" (reabre este formulario). */
    returnTo: string
  }>(),
  { tours: () => [], compact: false }
)
const emit = defineEmits<{
  created: [sub: SheetSubscription]
  cancel: []
  review: [jobUuid: string]
}>()

const { t } = useI18n()
const router = useRouter()
const googleStore = useGoogleStore()
const toursStore = useToursStore()
const importsStore = useImportsStore()
const { pollUntilSynced } = useSheetSubscriptions()

const NAME_MAX = 120
const CAN_CLOSE_AFTER_MS = 10_000
const READ_TIMEOUT_MS = 90_000

type Phase = 'choose' | 'tabs' | 'reading' | 'done'
const phase = ref<Phase>('choose')

/** Un 403 `google_scope_missing` (o `scope_missing` del selector) obliga a conectar de nuevo. */
const forceConnect = ref(false)
const needsConnect = computed(() => forceConnect.value || googleStore.knownMissing('sheets'))
const statusLoading = computed(() => googleStore.loading && !googleStore.status)

const selectedTour = ref<string>(
  props.tourUuid ?? (props.tours.length === 1 ? props.tours[0].uuid : '')
)
const needsTourPicker = computed(() => props.tourUuid === null)
const tourId = computed(() => props.tourUuid ?? selectedTour.value)

const picking = ref(false)
const submitting = ref(false)
const picked = ref<PickedSheet | null>(null)
const inspected = ref<SheetInspectResult | null>(null)
const selectedTabs = ref<SheetTabInput[]>([])
const name = ref('')
/** Mensajes ya traducidos (nunca un código crudo). */
const chooseError = ref('')
const showMobileHint = ref(false)
const tourError = ref('')
const formError = ref('')
/** uuid de la vinculación que ya existe (`already_subscribed`). */
const existingUuid = ref<string | null>(null)

const result = ref<SheetSubscription | null>(null)
const timedOut = ref(false)
const showCanClose = ref(false)
let canCloseTimer: ReturnType<typeof setTimeout> | null = null

function clearCanClose() {
  if (canCloseTimer) clearTimeout(canCloseTimer)
  canCloseTimer = null
}
onBeforeUnmount(clearCanClose)

onMounted(() => {
  void googleStore.load()
})

/**
 * Falta el permiso de Google: vuelve al paso de conectar. Si además la cuenta ya no está conectada
 * (`connected: false`), recarga el estado de Google para toda la app.
 */
function onScopeMissing(disconnected: boolean) {
  forceConnect.value = true
  if (disconnected) void googleStore.load(true)
}

function apiErrorText(e: unknown): string {
  const { key, named } = sheetApiErrorKey(e, 'create')
  return named ? t(key, named) : t(key)
}

/** Paso 1: selector de Google → `inspect` con el `id` elegido. */
async function choose() {
  if (picking.value) return
  chooseError.value = ''
  tourError.value = ''
  showMobileHint.value = false
  if (!tourId.value) {
    tourError.value = t('sheets.form.tourRequired')
    return
  }
  picking.value = true
  try {
    let sheet: PickedSheet
    try {
      sheet = await pickSpreadsheet({ title: t('sheets.picker.title') })
    } catch (e) {
      if (!isPickerError(e)) throw e
      if (e.code === 'scope_missing') {
        onScopeMissing(e.connected === false)
        return
      }
      const key = pickerErrorKey(e.code)
      // `cancelled`: el usuario cerró el selector; el paso 1 sigue igual, sin error.
      if (key) chooseError.value = t(key)
      showMobileHint.value = e.code === 'script_failed'
      return
    }
    const info = await inspectSheet({ tour: tourId.value, spreadsheet_id: sheet.id })
    picked.value = sheet
    inspected.value = info
    existingUuid.value = info.already_subscribed
    // Preseleccionada la primera pestaña visible (o la primera, si todas están ocultas).
    const ordered = [...info.tabs].sort((a, b) => a.index - b.index)
    const first = ordered.find((tab) => !tab.hidden) ?? ordered[0]
    selectedTabs.value = first ? [{ gid: first.gid, range: '' }] : []
    formError.value = ''
    phase.value = 'tabs'
  } catch (e) {
    if (isGoogleScopeMissing(e)) {
      onScopeMissing(isGoogleDisconnected(e))
      return
    }
    chooseError.value = apiErrorText(e)
  } finally {
    picking.value = false
  }
}

/** "Elegir otra": vuelve a abrir el selector desde el paso 1. */
function chooseOther() {
  phase.value = 'choose'
  picked.value = null
  inspected.value = null
  existingUuid.value = null
  formError.value = ''
  void choose()
}

async function submit() {
  if (submitting.value || !picked.value || existingUuid.value) return
  formError.value = ''
  if (!tourId.value) {
    formError.value = t('sheets.form.tourRequired')
    return
  }
  if (selectedTabs.value.length === 0) {
    formError.value = t('sheets.form.tabsRequired')
    return
  }
  submitting.value = true
  let sub: SheetSubscription
  try {
    sub = await createSheetSubscription({
      tour: tourId.value,
      spreadsheet_id: picked.value.id,
      tabs: selectedTabs.value,
      name: name.value.slice(0, NAME_MAX),
    })
  } catch (e) {
    if (isGoogleScopeMissing(e)) {
      onScopeMissing(isGoogleDisconnected(e))
      phase.value = 'choose'
      return
    }
    if (sheetApiErrorCode(e) === 'already_subscribed') {
      const uuid = apiErrorDetail(e, 'subscription_uuid')
      existingUuid.value = typeof uuid === 'string' && uuid ? uuid : 'unknown'
      return
    }
    formError.value = apiErrorText(e)
    return
  } finally {
    submitting.value = false
  }
  emit('created', sub)
  await read(sub)
}

async function read(sub: SheetSubscription) {
  result.value = sub
  timedOut.value = false
  showCanClose.value = false
  phase.value = 'reading'
  clearCanClose()
  canCloseTimer = setTimeout(() => {
    showCanClose.value = true
  }, CAN_CLOSE_AFTER_MS)
  try {
    const r = await pollUntilSynced(sub.uuid, { intervalMs: 3000, timeoutMs: READ_TIMEOUT_MS })
    if (r.cancelled) return
    if (r.sub) result.value = r.sub
    timedOut.value = r.timedOut
  } catch {
    // 4xx al leer el estado (borrada o sin permiso): se trata como "sigue en segundo plano".
    timedOut.value = true
  } finally {
    clearCanClose()
  }
  phase.value = 'done'
  // La primera lectura puede haber dejado un borrador: el aviso de Mi Gira se recarga.
  importsStore.invalidate(sub.tour)
}

const readyJob = computed(() => {
  const j = result.value?.pending_job
  return j && j.status === 'ready' ? j : null
})
const foundCount = computed(() => (result.value ? sheetPendingCount(result.value) : 0))

const doneText = computed(() => {
  const s = result.value
  if (!s || readyJob.value) return ''
  if (timedOut.value) return t('sheets.form.stillReading')
  if (s.last_status === 'error') return t(sheetErrorKey(s.last_error_code))
  if (s.last_status === 'tour_closed' || s.last_status === 'tour_ended') {
    return t('sheets.errors.tour_closed')
  }
  const st = s.stats ?? {}
  if ((st.last_new ?? 0) + (st.last_changed ?? 0) + (st.last_removed ?? 0) > 0) {
    return t('sheets.form.readNoDraft')
  }
  return t('sheets.form.nothingNew')
})
const doneIsError = computed(
  () => !timedOut.value && !readyJob.value && result.value?.last_status === 'error'
)

async function reviewNow() {
  const job = readyJob.value
  const sub = result.value
  if (!job || !sub) return
  // La revisión es de la gira de la vinculación: se activa antes de navegar.
  if (toursStore.activeTour?.uuid !== sub.tour) toursStore.setActiveTourByUuid(sub.tour)
  emit('review', job.uuid)
  await router.push({ name: 'tour-import', params: { jobUuid: job.uuid } })
}

const inputClass =
  'w-full min-h-[44px] lg:min-h-0 rounded-sm border bg-bg-3 px-3 py-2 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-olive'
const linkClass =
  'inline-flex items-center min-h-[44px] lg:min-h-0 p-0 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive'
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-test="sheet-form"
  >
    <!-- `pr-12`: deja sitio al botón de cerrar del modal. -->
    <div
      v-if="!compact"
      class="pr-12"
    >
      <p class="text-[17px] font-bold text-ink">
        {{ t('sheets.form.title') }}
      </p>
    </div>

    <GoogleConnectNotice purpose="sheets" />

    <!-- ── Paso 0: conectar Google Sheets ───────────────────────────────── -->
    <template v-if="phase === 'choose' && statusLoading && !forceConnect">
      <div
        class="flex flex-col gap-2"
        role="status"
        data-test="sheet-status-loading"
      >
        <div class="h-3 w-2/3 rounded bg-bg-2 animate-pulse" />
        <div class="h-3 w-1/2 rounded bg-bg-2 animate-pulse" />
      </div>
    </template>
    <template v-else-if="phase === 'choose' && needsConnect">
      <GoogleConnectCta
        purpose="sheets"
        :return-to="returnTo"
        :intro="t('googleIntegration.missing.sheets')"
      />
      <div>
        <BtnSecondary
          type="button"
          data-test="sheet-cancel"
          @click="emit('cancel')"
        >
          {{ compact ? t('sheets.form.back') : t('common.cancel') }}
        </BtnSecondary>
      </div>
    </template>

    <!-- ── Paso 1: elegir la hoja ───────────────────────────────────────── -->
    <div
      v-else-if="phase === 'choose'"
      class="flex flex-col gap-4"
      data-test="sheet-choose"
    >
      <p class="text-[14px] text-ink-2">
        {{ t('sheets.form.sub') }}
      </p>

      <div
        v-if="needsTourPicker"
        class="flex flex-col gap-1.5"
      >
        <label
          for="sheet-tour"
          class="text-[13px] font-semibold text-ink"
        >{{ t('sheets.form.tour') }}</label>
        <p
          v-if="tours.length === 0"
          class="text-[14px] text-ink-2"
          data-test="sheet-no-tours"
        >
          {{ t('sheets.form.noTours') }}
        </p>
        <select
          v-else
          id="sheet-tour"
          v-model="selectedTour"
          data-test="sheet-tour"
          :class="[inputClass, tourError ? 'border-failed-fg' : 'border-line']"
          :aria-invalid="!!tourError || undefined"
        >
          <option
            value=""
            disabled
          >
            {{ t('sheets.form.tourPlaceholder') }}
          </option>
          <option
            v-for="tour in tours"
            :key="tour.uuid"
            :value="tour.uuid"
          >
            {{ tour.name }}
          </option>
        </select>
        <p
          v-if="tourError"
          class="text-[13px] text-failed-fg"
          role="alert"
          data-test="sheet-tour-error"
        >
          {{ tourError }}
        </p>
      </div>

      <p
        v-if="chooseError"
        class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
        role="alert"
        data-test="sheet-choose-error"
      >
        {{ chooseError }}
      </p>
      <p
        v-if="showMobileHint"
        class="text-[13px] text-ink-2"
        data-test="sheet-mobile-hint"
      >
        {{ t('sheets.picker.mobileHint') }}
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <BtnPrimary
          type="button"
          data-test="sheet-choose-btn"
          :disabled="picking || (needsTourPicker && tours.length === 0)"
          :class="picking ? 'opacity-60 cursor-not-allowed' : ''"
          @click="choose"
        >
          {{ picking ? t('sheets.form.choosing') : t('sheets.form.choose') }}
        </BtnPrimary>
        <BtnSecondary
          type="button"
          data-test="sheet-cancel"
          @click="emit('cancel')"
        >
          {{ compact ? t('sheets.form.back') : t('common.cancel') }}
        </BtnSecondary>
      </div>
    </div>

    <!-- ── Paso 2: pestañas y nombre ────────────────────────────────────── -->
    <form
      v-else-if="phase === 'tabs' && inspected"
      class="flex flex-col gap-4"
      novalidate
      data-test="sheet-tabs-step"
      @submit.prevent="submit"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p
          class="min-w-0 text-[15px] font-semibold text-ink break-words"
          data-test="sheet-title"
        >
          {{ inspected.spreadsheet_title }}
        </p>
        <button
          type="button"
          :class="linkClass"
          :disabled="picking"
          data-test="sheet-choose-other"
          @click="chooseOther"
        >
          {{ t('sheets.form.chooseOther') }}
        </button>
      </div>

      <div
        v-if="existingUuid"
        class="flex flex-col items-start gap-2 rounded-sm bg-pending-bg px-3 py-2"
        data-test="sheet-already"
      >
        <p class="text-[14px] text-pending-fg">
          {{ t('sheets.form.alreadyLinked') }}
        </p>
        <RouterLink
          :to="{ path: '/settings', query: { tab: 'calendars' } }"
          :class="linkClass"
          data-test="sheet-already-link"
          @click="emit('cancel')"
        >
          {{ t('sheets.form.viewExisting') }}
        </RouterLink>
      </div>

      <template v-else>
        <SheetTabsChooser
          v-model:selected="selectedTabs"
          :tabs="inspected.tabs"
          id-prefix="sheet-new"
        />

        <div class="flex flex-col gap-1.5">
          <label
            for="sheet-name"
            class="text-[13px] font-semibold text-ink"
          >{{ t('sheets.form.name') }}</label>
          <input
            id="sheet-name"
            v-model="name"
            type="text"
            autocomplete="off"
            data-test="sheet-name"
            :maxlength="NAME_MAX"
            :placeholder="t('sheets.form.namePlaceholder')"
            :class="[inputClass, 'border-line']"
          >
        </div>

        <p class="text-[13px] text-ink-2">
          {{ t('sheets.form.privacy') }}
        </p>
      </template>

      <p
        v-if="formError"
        class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
        role="alert"
        data-test="sheet-form-error"
      >
        {{ formError }}
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <BtnPrimary
          v-if="!existingUuid"
          type="submit"
          data-test="sheet-submit"
          :disabled="submitting || selectedTabs.length === 0"
          :class="submitting ? 'opacity-60 cursor-not-allowed' : ''"
        >
          {{ submitting ? t('sheets.form.submitting') : t('sheets.form.submit') }}
        </BtnPrimary>
        <BtnSecondary
          type="button"
          data-test="sheet-cancel"
          @click="emit('cancel')"
        >
          {{ compact ? t('sheets.form.back') : t('common.cancel') }}
        </BtnSecondary>
      </div>
    </form>

    <!-- ── Paso 3: primera lectura ──────────────────────────────────────── -->
    <div
      v-else-if="phase === 'reading'"
      class="flex flex-col gap-3"
      role="status"
      aria-live="polite"
      data-test="sheet-reading"
    >
      <div class="flex items-center gap-2.5">
        <svg
          class="animate-spin text-olive flex-shrink-0"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="3"
            stroke-dasharray="40 22"
            stroke-linecap="round"
          />
        </svg>
        <p class="text-[15px] text-ink">
          {{ t('sheets.form.reading') }}
        </p>
      </div>
      <p
        v-if="showCanClose"
        class="text-[13px] text-ink-2"
        data-test="sheet-can-close"
      >
        {{ t('sheets.form.canClose') }}
      </p>
    </div>

    <!-- ── Resultado ────────────────────────────────────────────────────── -->
    <div
      v-else-if="phase === 'done'"
      class="flex flex-col items-start gap-3"
      data-test="sheet-done"
    >
      <p
        v-if="readyJob"
        class="text-[15px] text-ink"
        data-test="sheet-found"
      >
        {{ t('sheets.form.found', { n: foundCount }, foundCount) }}
      </p>
      <p
        v-else
        :class="doneIsError
          ? 'text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2 w-full'
          : 'text-[14px] text-ink-2'"
        :role="doneIsError ? 'alert' : undefined"
        data-test="sheet-done-text"
      >
        {{ doneText }}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <BtnPrimary
          v-if="readyJob"
          type="button"
          data-test="sheet-review"
          @click="reviewNow"
        >
          {{ t('sheets.form.reviewNow') }}
        </BtnPrimary>
        <BtnSecondary
          type="button"
          data-test="sheet-close"
          @click="emit('cancel')"
        >
          {{ compact ? t('sheets.form.back') : t('sheets.form.close') }}
        </BtnSecondary>
      </div>
    </div>
  </div>
</template>
