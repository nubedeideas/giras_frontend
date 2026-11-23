<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import { useToursStore } from '@/stores/tours'
import {
  createIcalSubscription,
  useIcalSubscriptions,
  type IcalSubscription,
} from '@/composables/useIcalSubscriptions'
import {
  icalApiErrorKey,
  icalErrorKey,
  icalUrlProblem,
  pendingJobCount,
} from '@/utils/icalSubscriptions'
import { apiErrorCodes } from '@/utils/notificationErrors'

// Alta de una suscripción iCal (F3 §4.3): dirección, nombre opcional y gira (selector si no viene
// fijada). Tras crear, sondea la primera lectura y ofrece "Revisar ahora" si deja un borrador.
const props = withDefaults(
  defineProps<{
    tourUuid: string | null
    /** Giras entre las que elegir cuando `tourUuid` es null (solo las que el usuario administra). */
    tours?: { uuid: string; name: string }[]
    /** Dentro del modal Importar: sin título propio y "Volver" en vez de "Cancelar". */
    compact?: boolean
  }>(),
  { tours: () => [], compact: false }
)
const emit = defineEmits<{
  created: [sub: IcalSubscription]
  cancel: []
  review: [jobUuid: string]
}>()

const { t } = useI18n()
const router = useRouter()
const toursStore = useToursStore()
const { pollUntilSynced } = useIcalSubscriptions()

const NAME_MAX = 120
const CAN_CLOSE_AFTER_MS = 10_000

type Phase = 'form' | 'reading' | 'done'
const phase = ref<Phase>('form')

const url = ref('')
const name = ref('')
const selectedTour = ref<string>(
  props.tourUuid ?? (props.tours.length === 1 ? props.tours[0].uuid : '')
)
const showHelp = ref(false)
const submitting = ref(false)
/** Mensajes ya traducidos (nunca un código crudo). */
const urlError = ref('')
const tourError = ref('')
const formError = ref('')

const result = ref<IcalSubscription | null>(null)
const timedOut = ref(false)
const showCanClose = ref(false)
let canCloseTimer: ReturnType<typeof setTimeout> | null = null

const needsTourPicker = computed(() => props.tourUuid === null)
const tourId = computed(() => props.tourUuid ?? selectedTour.value)

function clearCanClose() {
  if (canCloseTimer) clearTimeout(canCloseTimer)
  canCloseTimer = null
}
onBeforeUnmount(clearCanClose)

async function submit() {
  if (submitting.value) return
  urlError.value = ''
  tourError.value = ''
  formError.value = ''
  const problem = icalUrlProblem(url.value)
  if (problem) {
    urlError.value = t(icalErrorKey(problem))
    return
  }
  if (!tourId.value) {
    tourError.value = t('ical.form.tourRequired')
    return
  }
  submitting.value = true
  let sub: IcalSubscription
  try {
    sub = await createIcalSubscription({
      tour: tourId.value,
      url: url.value,
      name: name.value.slice(0, NAME_MAX),
    })
  } catch (e) {
    const { key, named } = icalApiErrorKey(e)
    const text = named ? t(key, named) : t(key)
    if (apiErrorCodes(e).includes('invalid_url')) urlError.value = text
    else formError.value = text
    return
  } finally {
    submitting.value = false
  }
  emit('created', sub)
  await read(sub)
}

async function read(sub: IcalSubscription) {
  result.value = sub
  timedOut.value = false
  showCanClose.value = false
  phase.value = 'reading'
  clearCanClose()
  canCloseTimer = setTimeout(() => {
    showCanClose.value = true
  }, CAN_CLOSE_AFTER_MS)
  try {
    const r = await pollUntilSynced(sub.uuid, { intervalMs: 3000, timeoutMs: 60000 })
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
}

const readyJob = computed(() => {
  const j = result.value?.pending_job
  return j && j.status === 'ready' ? j : null
})
const foundCount = computed(() => (result.value ? pendingJobCount(result.value) : 0))

/** Texto del final de la primera lectura: error, gira cerrada o "sin eventos". */
const doneText = computed(() => {
  const s = result.value
  if (!s || readyJob.value) return ''
  if (timedOut.value) return t('ical.form.stillReading')
  if (s.last_status === 'error') return t(icalErrorKey(s.last_error_code))
  if (s.last_status === 'tour_closed' || s.last_status === 'tour_ended') {
    return t('ical.errors.tour_closed')
  }
  return t('ical.form.nothingNew')
})
const doneIsError = computed(
  () => !timedOut.value && !readyJob.value && result.value?.last_status === 'error'
)

async function reviewNow() {
  const job = readyJob.value
  const sub = result.value
  if (!job || !sub) return
  // La revisión es de la gira de la suscripción: se activa antes de navegar.
  if (toursStore.activeTour?.uuid !== sub.tour) toursStore.setActiveTourByUuid(sub.tour)
  emit('review', job.uuid)
  await router.push({ name: 'tour-import', params: { jobUuid: job.uuid } })
}

const inputClass =
  'w-full min-h-[44px] lg:min-h-0 rounded-sm border bg-bg-3 px-3 py-2 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-olive'
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-test="ical-form"
  >
    <!-- `pr-12`: deja sitio al botón de cerrar del modal. -->
    <div
      v-if="!compact"
      class="pr-12"
    >
      <p class="text-[17px] font-bold text-ink">
        {{ t('ical.form.title') }}
      </p>
    </div>

    <!-- ── Formulario ────────────────────────────────────────────────────── -->
    <form
      v-if="phase === 'form'"
      class="flex flex-col gap-4"
      novalidate
      @submit.prevent="submit"
    >
      <p class="text-[14px] text-ink-2">
        {{ t('ical.form.sub') }}
      </p>

      <div
        v-if="needsTourPicker"
        class="flex flex-col gap-1.5"
      >
        <label
          for="ical-tour"
          class="text-[13px] font-semibold text-ink"
        >{{ t('ical.form.tour') }}</label>
        <p
          v-if="tours.length === 0"
          class="text-[14px] text-ink-2"
          data-test="ical-no-tours"
        >
          {{ t('ical.form.noTours') }}
        </p>
        <select
          v-else
          id="ical-tour"
          v-model="selectedTour"
          data-test="ical-tour"
          :class="[inputClass, tourError ? 'border-failed-fg' : 'border-line']"
          :aria-invalid="!!tourError || undefined"
        >
          <option
            value=""
            disabled
          >
            {{ t('ical.form.tourPlaceholder') }}
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
          data-test="ical-tour-error"
        >
          {{ tourError }}
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="ical-url"
          class="text-[13px] font-semibold text-ink"
        >{{ t('ical.form.url') }}</label>
        <input
          id="ical-url"
          v-model="url"
          type="url"
          inputmode="url"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          data-test="ical-url"
          :placeholder="t('ical.form.urlPlaceholder')"
          :class="[inputClass, urlError ? 'border-failed-fg' : 'border-line']"
          :aria-invalid="!!urlError || undefined"
          :aria-describedby="urlError ? 'ical-url-error' : undefined"
        >
        <p
          v-if="urlError"
          id="ical-url-error"
          class="text-[13px] text-failed-fg"
          role="alert"
          data-test="ical-url-error"
        >
          {{ urlError }}
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="ical-name"
          class="text-[13px] font-semibold text-ink"
        >{{ t('ical.form.name') }}</label>
        <input
          id="ical-name"
          v-model="name"
          type="text"
          autocomplete="off"
          data-test="ical-name"
          :maxlength="NAME_MAX"
          :placeholder="t('ical.form.namePlaceholder')"
          :class="[inputClass, 'border-line']"
        >
      </div>

      <div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-0 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
          :aria-expanded="showHelp"
          aria-controls="ical-help"
          data-test="ical-help-toggle"
          @click="showHelp = !showHelp"
        >
          {{ t('ical.form.help') }}
        </button>
        <ol
          v-if="showHelp"
          id="ical-help"
          class="mt-2 flex flex-col gap-1.5 list-decimal pl-5 text-[14px] text-ink-2"
          data-test="ical-help"
        >
          <li>{{ t('ical.form.helpApple') }}</li>
          <li>{{ t('ical.form.helpGoogle') }}</li>
          <li>{{ t('ical.form.helpOutlook') }}</li>
        </ol>
      </div>

      <p class="text-[13px] text-ink-2">
        {{ t('ical.form.privacy') }}
      </p>

      <p
        v-if="formError"
        class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
        role="alert"
        data-test="ical-form-error"
      >
        {{ formError }}
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <BtnPrimary
          type="submit"
          data-test="ical-submit"
          :disabled="submitting || (needsTourPicker && tours.length === 0)"
          :class="submitting ? 'opacity-60 cursor-not-allowed' : ''"
        >
          {{ submitting ? t('ical.form.submitting') : t('ical.form.submit') }}
        </BtnPrimary>
        <BtnSecondary
          type="button"
          data-test="ical-cancel"
          @click="emit('cancel')"
        >
          {{ compact ? t('ical.form.back') : t('common.cancel') }}
        </BtnSecondary>
      </div>
    </form>

    <!-- ── Primera lectura ──────────────────────────────────────────────── -->
    <div
      v-else-if="phase === 'reading'"
      class="flex flex-col gap-3"
      role="status"
      aria-live="polite"
      data-test="ical-reading"
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
          {{ t('ical.form.reading') }}
        </p>
      </div>
      <p
        v-if="showCanClose"
        class="text-[13px] text-ink-2"
        data-test="ical-can-close"
      >
        {{ t('ical.form.canClose') }}
      </p>
    </div>

    <!-- ── Resultado ────────────────────────────────────────────────────── -->
    <div
      v-else
      class="flex flex-col items-start gap-3"
      data-test="ical-done"
    >
      <p
        v-if="readyJob"
        class="text-[15px] text-ink"
        data-test="ical-found"
      >
        {{ t('ical.form.found', { n: foundCount }, foundCount) }}
      </p>
      <p
        v-else
        :class="doneIsError
          ? 'text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2 w-full'
          : 'text-[14px] text-ink-2'"
        :role="doneIsError ? 'alert' : undefined"
        data-test="ical-done-text"
      >
        {{ doneText }}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <BtnPrimary
          v-if="readyJob"
          type="button"
          data-test="ical-review"
          @click="reviewNow"
        >
          {{ t('ical.form.reviewNow') }}
        </BtnPrimary>
        <BtnSecondary
          type="button"
          data-test="ical-close"
          @click="emit('cancel')"
        >
          {{ compact ? t('ical.form.back') : t('ical.form.close') }}
        </BtnSecondary>
      </div>
    </div>
  </div>
</template>
