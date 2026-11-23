<script setup lang="ts">
import { computed, ref } from 'vue'
import { Translation as I18nT, useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useToursStore } from '@/stores/tours'
import { useImportsStore } from '@/stores/imports'
import { useInboxStore } from '@/stores/inbox'
import { ApiError } from '@/utils/apiClient'
import {
  deleteIcalSubscription,
  isIcalSyncInProgress,
  syncIcalSubscription,
  takeOverIcalSubscription,
  updateIcalSubscription,
  useIcalSubscriptions,
  type IcalSubscription,
} from '@/composables/useIcalSubscriptions'
import {
  icalApiErrorKey,
  icalErrorKey,
  icalReviewBadge,
  icalStatusBadge,
  pendingJobCount,
} from '@/utils/icalSubscriptions'

// Tarjeta de una suscripción iCal (F3 §4.3): estado, última y próxima sincronización, error,
// freno de retiradas, cambios por revisar y acciones (sincronizar, pausar/reanudar, eliminar).
// Tras "Sincronizar ahora" o "Reanudar" sondea el detalle hasta que acaba (`pollUntilSynced`) y
// emite cada lectura: el estado y "Cambios por revisar (n)" se ven sin recargar. "Volver a leer
// todo el calendario" manda `full: true` (vuelve a proponer lo descartado o mantenido). Con la gira
// terminada o cerrada no hay "Reanudar" (el backend respondería 400) y se explica por qué.
// F5a: si quien la añadió ya no es administrador (`owner_not_admin`), la tarjeta lo explica y
// ofrece "Hacerme responsable" (`take-over/`) y "Eliminar" en lugar de sincronizar o reanudar.
const props = defineProps<{ sub: IcalSubscription }>()
const emit = defineEmits<{
  changed: [sub: IcalSubscription]
  deleted: [uuid: string]
  /** La suscripción ya no existe (404 al actuar): el gestor recarga la lista. */
  stale: []
}>()

const { t, locale } = useI18n()
const toursStore = useToursStore()
const importsStore = useImportsStore()
const inboxStore = useInboxStore()

const { pollUntilSynced } = useIcalSubscriptions()

type Action = 'sync' | 'full' | 'toggle' | 'delete' | 'takeOver'
const busy = ref<Action | null>(null)
/** Mensajes ya traducidos. */
const actionError = ref('')
const notice = ref('')
const confirmDelete = ref(false)

const badge = computed(() => icalStatusBadge(props.sub))
const reviewBadge = computed(() => icalReviewBadge(props.sub))
const tourColor = computed(
  () => toursStore.tours.find((tour) => tour.uuid === props.sub.tour)?.color ?? null
)
const displayName = computed(() => props.sub.name || t('ical.card.unnamed'))

/** Sondeando el final de una sincronización lanzada desde esta tarjeta. */
const polling = ref(false)

/** La gira terminó o se cerró: el backend pausó la suscripción y no deja reanudarla. */
const tourEnded = computed(
  () => props.sub.last_status === 'tour_closed' || props.sub.last_status === 'tour_ended'
)
const canSync = computed(
  () => !busy.value && !polling.value && props.sub.sync_enabled && !tourEnded.value
)

/** Pausada porque quien la añadió ya no es administrador de la gira. */
const ownerNotAdmin = computed(() => props.sub.last_error_code === 'owner_not_admin')

const errorText = computed(() =>
  !ownerNotAdmin.value && props.sub.last_status === 'error' && props.sub.last_error_code
    ? t(icalErrorKey(props.sub.last_error_code))
    : ''
)

const reviewJob = computed(() =>
  props.sub.pending_job?.status === 'ready' ? props.sub.pending_job : null
)
const reviewCount = computed(() => pendingJobCount(props.sub))

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = DateTime.fromISO(iso)
  if (!d.isValid) return ''
  return d
    .setLocale(locale.value === 'en' ? 'en-GB' : 'es-ES')
    .toLocaleString({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const lastSync = computed(() => formatDate(props.sub.last_synced_at))
const nextSync = computed(() =>
  props.sub.sync_enabled ? formatDate(props.sub.next_sync_at) : ''
)

function onError(e: unknown) {
  if (e instanceof ApiError && e.status === 404) {
    emit('stale')
    return
  }
  const { key, named } = icalApiErrorKey(e)
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

/** Sondea hasta que acaba la sincronización; cada lectura actualiza la tarjeta. */
async function follow() {
  polling.value = true
  try {
    const r = await pollUntilSynced(props.sub.uuid, {
      onRead: (sub) => emit('changed', sub),
    })
    if (r.cancelled) return
    // La sincronización puede haber dejado un borrador: el aviso de Mi Gira se recarga.
    importsStore.invalidate(props.sub.tour)
    // Terminada: el estado final ya lo dice la tarjeta. Con el plazo agotado sigue el aviso.
    if (!r.timedOut) notice.value = ''
  } catch (e) {
    onError(e)
    notice.value = ''
  } finally {
    polling.value = false
  }
}

/** "Sincronizar ahora" (`full: false`) o "Volver a leer todo el calendario" (`full: true`). */
async function syncNow(full = false) {
  let queued = false
  await run(full ? 'full' : 'sync', async () => {
    await syncIcalSubscription(props.sub.uuid, { full })
    notice.value = t('ical.card.syncQueued')
    queued = true
  })
  if (queued) await follow()
}

async function toggle() {
  let resumed: IcalSubscription | null = null
  await run('toggle', async () => {
    const sub = await updateIcalSubscription(props.sub.uuid, {
      sync_enabled: !props.sub.sync_enabled,
    })
    emit('changed', sub)
    if (sub.sync_enabled && isIcalSyncInProgress(sub)) resumed = sub
  })
  if (resumed) {
    notice.value = t('ical.card.syncQueued')
    await follow()
  }
}

/** "Hacerme responsable": la suscripción pasa a mi cuenta, se reanuda y se sincroniza. */
async function takeOver() {
  let taken: IcalSubscription | null = null
  await run('takeOver', async () => {
    const sub = await takeOverIcalSubscription(props.sub.uuid)
    emit('changed', sub)
    taken = sub
  })
  if (!taken) return
  notice.value = t('ical.ownerNotAdmin.done')
  // El aviso del inbox se retira en el backend: el contador de la campana se actualiza.
  inboxStore.refreshCount().catch(() => {})
  await follow()
}

function remove() {
  return run('delete', async () => {
    await deleteIcalSubscription(props.sub.uuid)
    confirmDelete.value = false
    emit('deleted', props.sub.uuid)
  })
}

function openReview() {
  if (toursStore.activeTour?.uuid !== props.sub.tour) toursStore.setActiveTourByUuid(props.sub.tour)
}

const actionClass =
  'inline-flex items-center justify-center min-h-[44px] lg:min-h-0 px-3 py-2 rounded-sm text-[14px] font-medium border border-line-2 bg-bg-3 text-ink cursor-pointer hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-60 disabled:cursor-not-allowed'
</script>

<template>
  <article
    class="rounded border border-line bg-bg-3 px-4 py-3.5 flex flex-col gap-2.5"
    data-test="ical-card"
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
            data-test="ical-tour-dot"
          />
          <span class="truncate">{{ sub.tour_name }}</span>
        </p>
        <p
          class="mt-0.5 text-[13px] text-ink-2 break-all"
          data-test="ical-url-display"
        >
          {{ sub.url_display }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          :status="badge.status"
          :label="t(badge.labelKey)"
          size="sm"
          data-test="ical-status"
        />
        <StatusBadge
          v-if="reviewBadge"
          :status="reviewBadge.status"
          :label="t(reviewBadge.labelKey)"
          size="sm"
          data-test="ical-review-badge"
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      <I18nT
        v-if="lastSync"
        keypath="ical.card.lastSync"
        tag="span"
        data-test="ical-last-sync"
      >
        <template #date>
          <span class="font-time tnum text-ink">{{ lastSync }}</span>
        </template>
      </I18nT>
      <span
        v-else
        data-test="ical-last-sync"
      >{{ t('ical.card.never') }}</span>
      <I18nT
        v-if="nextSync"
        keypath="ical.card.nextSync"
        tag="span"
        data-test="ical-next-sync"
      >
        <template #date>
          <span class="font-time tnum text-ink">{{ nextSync }}</span>
        </template>
      </I18nT>
    </div>

    <p
      v-if="errorText"
      class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
      data-test="ical-error"
    >
      {{ errorText }}
    </p>

    <div
      v-if="ownerNotAdmin"
      class="flex flex-col items-start gap-2 rounded-sm bg-failed-bg px-3 py-2.5"
      data-test="ical-owner-not-admin"
    >
      <p class="text-[14px] font-medium text-failed-fg">
        {{ t('ical.ownerNotAdmin.card') }}
      </p>
      <p class="text-[14px] text-ink-2">
        {{ t('ical.ownerNotAdmin.cardHelp') }}
      </p>
      <BtnSecondary
        type="button"
        small
        :disabled="!!busy"
        data-test="ical-take-over"
        @click="takeOver"
      >
        {{ busy === 'takeOver' ? t('ical.ownerNotAdmin.taking') : t('ical.ownerNotAdmin.takeOver') }}
      </BtnSecondary>
    </div>

    <p
      v-if="sub.stats?.removal_guard"
      class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
      data-test="ical-removal-guard"
    >
      {{ t('ical.card.removalGuard') }}
    </p>

    <RouterLink
      v-if="reviewJob"
      :to="{ name: 'tour-import', params: { jobUuid: reviewJob.uuid } }"
      class="self-start inline-flex items-center min-h-[44px] lg:min-h-0 text-[14px] font-semibold text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
      data-test="ical-review-link"
      @click="openReview"
    >
      {{ t('ical.card.pendingReview', { n: reviewCount }) }}
    </RouterLink>

    <p
      v-if="notice"
      class="text-[13px] text-ink-2"
      role="status"
      data-test="ical-notice"
    >
      {{ notice }}
    </p>
    <p
      v-if="actionError && !confirmDelete"
      class="text-[13px] text-failed-fg"
      role="alert"
      data-test="ical-action-error"
    >
      {{ actionError }}
    </p>

    <p
      v-if="tourEnded"
      :id="`ical-ended-${sub.uuid}`"
      class="text-[13px] text-ink-2"
      data-test="ical-ended"
    >
      {{ t('ical.card.tourEnded') }}
    </p>

    <div class="flex flex-wrap gap-2">
      <button
        v-if="!ownerNotAdmin"
        type="button"
        :class="actionClass"
        :disabled="!canSync"
        :aria-describedby="tourEnded ? `ical-ended-${sub.uuid}` : undefined"
        data-test="ical-sync"
        @click="syncNow()"
      >
        {{ busy === 'sync' ? t('ical.card.working') : t('ical.card.syncNow') }}
      </button>
      <button
        v-if="!tourEnded && !ownerNotAdmin"
        type="button"
        :class="actionClass"
        :disabled="!!busy"
        data-test="ical-toggle"
        @click="toggle"
      >
        {{
          busy === 'toggle'
            ? t('ical.card.working')
            : sub.sync_enabled
              ? t('ical.card.pause')
              : t('ical.card.resume')
        }}
      </button>
      <button
        type="button"
        :class="actionClass"
        :disabled="!!busy"
        data-test="ical-delete"
        @click="confirmDelete = true; actionError = ''"
      >
        {{ t('ical.card.delete') }}
      </button>
    </div>

    <div
      v-if="!tourEnded && !ownerNotAdmin"
      class="flex flex-col items-start gap-0.5"
    >
      <button
        type="button"
        class="inline-flex items-center min-h-[44px] lg:min-h-0 p-0 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-60 disabled:cursor-not-allowed"
        :disabled="!canSync"
        :aria-describedby="`ical-full-help-${sub.uuid}`"
        data-test="ical-sync-full"
        @click="syncNow(true)"
      >
        {{ busy === 'full' ? t('ical.card.working') : t('ical.card.syncFull') }}
      </button>
      <p
        :id="`ical-full-help-${sub.uuid}`"
        class="text-[13px] text-ink-2"
      >
        {{ t('ical.card.syncFullHelp') }}
      </p>
    </div>

    <AppModal
      :show="confirmDelete"
      @close="confirmDelete = false"
    >
      <div data-test="ical-delete-confirm">
        <p class="text-[17px] font-bold text-ink break-words">
          {{ t('ical.card.deleteTitle', { name: displayName }) }}
        </p>
        <p class="mt-2 text-[14px] text-ink-2">
          {{ t('ical.card.deleteConfirm') }}
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
            data-test="ical-delete-yes"
            @click="remove"
          >
            {{ busy === 'delete' ? t('ical.card.deleting') : t('ical.card.delete') }}
          </BtnPrimary>
          <BtnSecondary
            type="button"
            data-test="ical-delete-no"
            @click="confirmDelete = false"
          >
            {{ t('common.cancel') }}
          </BtnSecondary>
        </div>
      </div>
    </AppModal>
  </article>
</template>
