<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Translation as I18nT, useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import GoogleConnectCta from '@/components/settings/GoogleConnectCta.vue'
import SheetTabsEditor from '@/components/sheets/SheetTabsEditor.vue'
import { useToursStore } from '@/stores/tours'
import { useImportsStore } from '@/stores/imports'
import { useGoogleStore } from '@/stores/google'
import { ApiError } from '@/utils/apiClient'
import { isGoogleScopeMissing } from '@/composables/useGoogleIntegration'
import { isPickerConfigured, isPickerError, pickSpreadsheet } from '@/composables/useGooglePicker'
import {
  deleteSheetSubscription,
  isSheetSyncInProgress,
  syncSheetSubscription,
  updateSheetSubscription,
  useMyAccount,
  useSheetSubscriptions,
  type SheetSubscription,
} from '@/composables/useSheetSubscriptions'
import {
  SHEET_ACCESS_ERRORS,
  pickerErrorKey,
  sheetApiErrorKey,
  sheetDisplayName,
  sheetErrorKey,
  sheetPendingCount,
  sheetReviewBadge,
  sheetStatusBadge,
} from '@/utils/sheetSubscriptions'

// Tarjeta de una hoja de Google vinculada (F4 §4.3): estado, pestañas, última y próxima lectura,
// quién lee la hoja, error, freno de retiradas, cambios por revisar y acciones (sincronizar, volver
// a leer todo con confirmación, pestañas, pausar/reanudar, abrir, eliminar). Si quien la lee ya no
// puede (`reader.has_access=false` o un error de acceso), ofrece "Usar mi cuenta" (otro admin) o
// "Volver a elegir la hoja" (el propio lector): selector de Google + `use-my-account`.
const props = defineProps<{ sub: SheetSubscription }>()
const emit = defineEmits<{
  changed: [sub: SheetSubscription]
  deleted: [uuid: string]
  /** La vinculación ya no existe (404 al actuar): el gestor recarga la lista. */
  stale: []
}>()

const RETURN_TO = '/settings?tab=calendars'

const { t, locale } = useI18n()
const toursStore = useToursStore()
const importsStore = useImportsStore()
const googleStore = useGoogleStore()
const { pollUntilSynced } = useSheetSubscriptions()

const pickerReady = isPickerConfigured()

onMounted(() => {
  void googleStore.load()
})

type Action = 'sync' | 'full' | 'toggle' | 'delete' | 'account'
const busy = ref<Action | null>(null)
/** Mensajes ya traducidos. */
const actionError = ref('')
const notice = ref('')
const confirm = ref<'full' | 'delete' | null>(null)
const showTabs = ref(false)
/** Un 403 `google_scope_missing` (o `scope_missing` del selector) al actuar. */
const scopeMissing = ref(false)

const badge = computed(() => sheetStatusBadge(props.sub))
const reviewBadge = computed(() => sheetReviewBadge(props.sub))
const tourColor = computed(
  () => toursStore.tours.find((tour) => tour.uuid === props.sub.tour)?.color ?? null
)
const displayName = computed(() => sheetDisplayName(props.sub) ?? t('sheets.card.unnamed'))
const showTitle = computed(
  () => !!props.sub.spreadsheet_title && props.sub.spreadsheet_title !== props.sub.name
)

/** Sondeando el final de una lectura lanzada desde esta tarjeta. */
const polling = ref(false)

const tourEnded = computed(
  () => props.sub.last_status === 'tour_closed' || props.sub.last_status === 'tour_ended'
)
const canSync = computed(
  () => !busy.value && !polling.value && props.sub.sync_enabled && !tourEnded.value
)

const errorText = computed(() =>
  props.sub.last_status === 'error' && props.sub.last_error_code
    ? t(sheetErrorKey(props.sub.last_error_code))
    : ''
)

const isReader = computed(() => props.sub.reader?.is_me === true)
const readerText = computed(() => {
  const r = props.sub.reader
  if (!r) return t('sheets.card.readerGone')
  return r.is_me ? t('sheets.card.readerMe') : t('sheets.card.reader', { name: r.name })
})

/** La hoja no se puede leer con la cuenta actual: hace falta otra cuenta o elegirla otra vez. */
const needsAccount = computed(() => {
  if (tourEnded.value) return false
  const r = props.sub.reader
  if (!r || r.has_access === false) return true
  return SHEET_ACCESS_ERRORS.includes(props.sub.last_error_code)
})
/** Sin el permiso `sheets` en mi cuenta: primero hay que conectar Google Sheets. */
const needsConnect = computed(() => scopeMissing.value || googleStore.knownMissing('sheets'))

const reviewJob = computed(() =>
  props.sub.pending_job?.status === 'ready' ? props.sub.pending_job : null
)
const reviewCount = computed(() => sheetPendingCount(props.sub))

/** "Pestañas…" necesita el ID (en `open_url`, solo del lector) o el selector de Google. */
const canEditTabs = computed(() => !tourEnded.value && (!!props.sub.open_url || pickerReady))

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = DateTime.fromISO(iso)
  if (!d.isValid) return ''
  return d
    .setLocale(locale.value === 'en' ? 'en-GB' : 'es-ES')
    .toLocaleString({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const lastSync = computed(() => formatDate(props.sub.last_synced_at))
const nextSync = computed(() => (props.sub.sync_enabled ? formatDate(props.sub.next_sync_at) : ''))

function onError(e: unknown) {
  if (e instanceof ApiError && e.status === 404) {
    emit('stale')
    return
  }
  if (isGoogleScopeMissing(e)) {
    scopeMissing.value = true
    return
  }
  const { key, named } = sheetApiErrorKey(e, 'manage', props.sub.spreadsheet_title || displayName.value)
  actionError.value = named ? t(key, named) : t(key)
}

async function run(action: Action, fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = action
  actionError.value = ''
  notice.value = ''
  try {
    await fn()
  } catch (e) {
    onError(e)
  } finally {
    busy.value = null
  }
}

/** Sondea hasta que acaba la lectura; cada lectura actualiza la tarjeta. */
async function follow() {
  polling.value = true
  try {
    const r = await pollUntilSynced(props.sub.uuid, {
      onRead: (sub) => emit('changed', sub),
    })
    if (r.cancelled) return
    // La lectura puede haber dejado un borrador: el aviso de Mi Gira se recarga.
    importsStore.invalidate(props.sub.tour)
    if (!r.timedOut) notice.value = ''
  } catch (e) {
    onError(e)
    notice.value = ''
  } finally {
    polling.value = false
  }
}

/** "Sincronizar ahora" (`full: false`) o "Volver a leer toda la hoja" (`full: true`). */
async function syncNow(full = false) {
  confirm.value = null
  let queued = false
  await run(full ? 'full' : 'sync', async () => {
    await syncSheetSubscription(props.sub.uuid, { full })
    notice.value = t('sheets.card.syncQueued')
    queued = true
  })
  if (queued) await follow()
}

async function toggle() {
  let resumed: SheetSubscription | null = null
  await run('toggle', async () => {
    const sub = await updateSheetSubscription(props.sub.uuid, {
      sync_enabled: !props.sub.sync_enabled,
    })
    emit('changed', sub)
    if (sub.sync_enabled && isSheetSyncInProgress(sub)) resumed = sub
  })
  if (resumed) {
    notice.value = t('sheets.card.syncQueued')
    await follow()
  }
}

function remove() {
  return run('delete', async () => {
    await deleteSheetSubscription(props.sub.uuid)
    confirm.value = null
    emit('deleted', props.sub.uuid)
  })
}

/** "Usar mi cuenta" / "Volver a elegir la hoja": selector de Google + `use-my-account`. */
async function reassign() {
  let switched = false
  await run('account', async () => {
    let id: string
    try {
      const sheet = await pickSpreadsheet({
        title: t('sheets.picker.chooseSame', { name: props.sub.spreadsheet_title || displayName.value }),
      })
      id = sheet.id
    } catch (e) {
      if (!isPickerError(e)) throw e
      if (e.code === 'scope_missing') {
        scopeMissing.value = true
        return
      }
      const key = pickerErrorKey(e.code)
      if (key) actionError.value = t(key)
      return
    }
    const sub = await useMyAccount(props.sub.uuid, { spreadsheet_id: id })
    scopeMissing.value = false
    emit('changed', sub)
    notice.value = t('sheets.card.accountSwitched')
    switched = true
  })
  if (switched) await follow()
}

function onTabsSaved(sub: SheetSubscription) {
  showTabs.value = false
  emit('changed', sub)
  notice.value = t('sheets.card.tabsSaved')
}

function onTabsStale() {
  showTabs.value = false
  emit('stale')
}

function openReview() {
  if (toursStore.activeTour?.uuid !== props.sub.tour) toursStore.setActiveTourByUuid(props.sub.tour)
}

function askDelete() {
  actionError.value = ''
  confirm.value = 'delete'
}

const actionClass =
  'inline-flex items-center justify-center min-h-[44px] lg:min-h-0 px-3 py-2 rounded-sm text-[14px] font-medium border border-line-2 bg-bg-3 text-ink cursor-pointer hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-60 disabled:cursor-not-allowed'
const linkClass =
  'inline-flex items-center min-h-[44px] lg:min-h-0 p-0 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-60 disabled:cursor-not-allowed'
</script>

<template>
  <article
    class="rounded border border-line bg-bg-3 px-4 py-3.5 flex flex-col gap-2.5"
    data-test="sheet-card"
  >
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <p class="text-[15px] font-semibold text-ink break-words">
          {{ displayName }}
        </p>
        <p class="mt-0.5 flex items-center gap-1.5 text-[14px] text-ink-2 min-w-0">
          <span
            v-if="tourColor"
            class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            :style="{ background: tourColor }"
            aria-hidden="true"
            data-test="sheet-tour-dot"
          />
          <span class="truncate">{{ sub.tour_name }}</span>
        </p>
        <p
          v-if="showTitle"
          class="mt-0.5 text-[13px] text-ink-2 break-words"
          data-test="sheet-spreadsheet-title"
        >
          {{ sub.spreadsheet_title }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          :status="badge.status"
          :label="t(badge.labelKey)"
          size="sm"
          data-test="sheet-status"
        />
        <StatusBadge
          v-if="reviewBadge"
          :status="reviewBadge.status"
          :label="t(reviewBadge.labelKey)"
          size="sm"
          data-test="sheet-review-badge"
        />
      </div>
    </div>

    <ul
      v-if="sub.tabs.length"
      class="flex flex-wrap gap-1.5"
      data-test="sheet-tabs-chips"
    >
      <li
        v-for="tab in sub.tabs"
        :key="tab.gid"
      >
        <StatusBadge
          v-if="tab.missing"
          status="failed"
          size="sm"
          :label="t('sheets.card.tabMissing', { tab: tab.title || `#${tab.gid}` })"
          data-test="sheet-tab-missing"
        />
        <span
          v-else
          class="inline-flex items-center rounded-sm border border-line bg-bg-2 px-2 py-0.5 text-[13px] text-ink-2"
          data-test="sheet-tab-chip"
        >{{ tab.title || `#${tab.gid}` }}</span>
      </li>
    </ul>

    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      <I18nT
        v-if="lastSync"
        keypath="sheets.card.lastSync"
        tag="span"
        data-test="sheet-last-sync"
      >
        <template #date>
          <span class="font-time tnum text-ink">{{ lastSync }}</span>
        </template>
      </I18nT>
      <span
        v-else
        data-test="sheet-last-sync"
      >{{ t('sheets.card.never') }}</span>
      <I18nT
        v-if="nextSync"
        keypath="sheets.card.nextSync"
        tag="span"
        data-test="sheet-next-sync"
      >
        <template #date>
          <span class="font-time tnum text-ink">{{ nextSync }}</span>
        </template>
      </I18nT>
      <span data-test="sheet-reader">{{ readerText }}</span>
    </div>

    <p
      v-if="errorText"
      class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
      data-test="sheet-error"
    >
      {{ errorText }}
    </p>

    <div
      v-if="needsAccount || scopeMissing"
      class="flex flex-col items-start gap-2 rounded-sm border border-line bg-bg-2 px-3 py-2.5"
      data-test="sheet-account"
    >
      <GoogleConnectCta
        v-if="needsConnect"
        purpose="sheets"
        compact
        :return-to="RETURN_TO"
        :intro="t('googleIntegration.missing.sheets')"
      />
      <template v-else-if="pickerReady">
        <p class="text-[14px] text-ink-2">
          {{ isReader ? t('sheets.card.chooseAgainHint') : t('sheets.card.useMyAccountHint') }}
        </p>
        <BtnSecondary
          type="button"
          small
          :disabled="!!busy"
          data-test="sheet-use-account"
          @click="reassign"
        >
          {{
            busy === 'account'
              ? t('sheets.card.working')
              : isReader
                ? t('sheets.card.chooseAgain')
                : t('sheets.card.useMyAccount')
          }}
        </BtnSecondary>
      </template>
    </div>

    <p
      v-if="sub.stats?.removal_guard"
      class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
      data-test="sheet-removal-guard"
    >
      {{ t('sheets.card.removalGuard') }}
    </p>

    <RouterLink
      v-if="reviewJob"
      :to="{ name: 'tour-import', params: { jobUuid: reviewJob.uuid } }"
      class="self-start inline-flex items-center min-h-[44px] lg:min-h-0 text-[14px] font-semibold text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
      data-test="sheet-review-link"
      @click="openReview"
    >
      {{ t('sheets.card.pendingReview', { n: reviewCount }) }}
    </RouterLink>

    <p
      v-if="notice"
      class="text-[13px] text-ink-2"
      role="status"
      data-test="sheet-notice"
    >
      {{ notice }}
    </p>
    <p
      v-if="actionError && !confirm"
      class="text-[13px] text-failed-fg"
      role="alert"
      data-test="sheet-action-error"
    >
      {{ actionError }}
    </p>

    <p
      v-if="tourEnded"
      :id="`sheet-ended-${sub.uuid}`"
      class="text-[13px] text-ink-2"
      data-test="sheet-ended"
    >
      {{ t('sheets.card.tourEnded') }}
    </p>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :class="actionClass"
        :disabled="!canSync"
        :aria-describedby="tourEnded ? `sheet-ended-${sub.uuid}` : undefined"
        data-test="sheet-sync"
        @click="syncNow()"
      >
        {{ busy === 'sync' ? t('sheets.card.working') : t('sheets.card.syncNow') }}
      </button>
      <button
        v-if="!tourEnded"
        type="button"
        :class="actionClass"
        :disabled="!!busy"
        data-test="sheet-toggle"
        @click="toggle"
      >
        {{
          busy === 'toggle'
            ? t('sheets.card.working')
            : sub.sync_enabled
              ? t('sheets.card.pause')
              : t('sheets.card.resume')
        }}
      </button>
      <button
        type="button"
        :class="actionClass"
        :disabled="!!busy"
        data-test="sheet-delete"
        @click="askDelete"
      >
        {{ t('sheets.card.delete') }}
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-0.5">
      <button
        v-if="!tourEnded"
        type="button"
        :class="linkClass"
        :disabled="!canSync"
        data-test="sheet-sync-full"
        @click="confirm = 'full'"
      >
        {{ busy === 'full' ? t('sheets.card.working') : t('sheets.card.fullSync') }}
      </button>
      <button
        v-if="canEditTabs"
        type="button"
        :class="linkClass"
        :disabled="!!busy"
        data-test="sheet-edit-tabs"
        @click="showTabs = true"
      >
        {{ t('sheets.card.tabs') }}
      </button>
      <a
        v-if="sub.open_url"
        :href="sub.open_url"
        target="_blank"
        rel="noopener noreferrer"
        :class="linkClass"
        data-test="sheet-open"
      >
        {{ t('sheets.card.open') }}
      </a>
    </div>

    <AppModal
      :show="confirm !== null"
      @close="confirm = null"
    >
      <div
        v-if="confirm === 'full'"
        data-test="sheet-full-confirm"
      >
        <p class="text-[17px] font-bold text-ink">
          {{ t('sheets.card.fullSyncTitle') }}
        </p>
        <p class="mt-2 text-[14px] text-ink-2">
          {{ t('sheets.card.fullSyncConfirm') }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <BtnPrimary
            type="button"
            data-test="sheet-full-yes"
            @click="syncNow(true)"
          >
            {{ t('sheets.card.confirm') }}
          </BtnPrimary>
          <BtnSecondary
            type="button"
            data-test="sheet-full-no"
            @click="confirm = null"
          >
            {{ t('common.cancel') }}
          </BtnSecondary>
        </div>
      </div>
      <div
        v-else-if="confirm === 'delete'"
        data-test="sheet-delete-confirm"
      >
        <p class="text-[17px] font-bold text-ink break-words">
          {{ t('sheets.card.deleteTitle', { name: displayName }) }}
        </p>
        <p class="mt-2 text-[14px] text-ink-2">
          {{ t('sheets.card.deleteConfirm') }}
        </p>
        <p
          v-if="actionError"
          class="mt-3 text-[13px] text-failed-fg"
          role="alert"
        >
          {{ actionError }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <BtnPrimary
            type="button"
            :disabled="busy === 'delete'"
            data-test="sheet-delete-yes"
            @click="remove"
          >
            {{ busy === 'delete' ? t('sheets.card.deleting') : t('sheets.card.delete') }}
          </BtnPrimary>
          <BtnSecondary
            type="button"
            data-test="sheet-delete-no"
            @click="confirm = null"
          >
            {{ t('common.cancel') }}
          </BtnSecondary>
        </div>
      </div>
    </AppModal>

    <AppModal
      :show="showTabs"
      persistent
      @close="showTabs = false"
    >
      <SheetTabsEditor
        v-if="showTabs"
        :sub="sub"
        :display-name="displayName"
        @saved="onTabsSaved"
        @cancel="showTabs = false"
        @stale="onTabsStale"
      />
    </AppModal>
  </article>
</template>
