<script setup lang="ts">
// Estado `done` de la revisión (F1 §4.2, ampliado en F2 §4.5): recuentos de `result` (equipo y
// actividades), vuelos que se completarán con Cirium, recordatorios programados y primer envío
// (`result.post_import`, que escribe `task_post_import`: mientras está `pending` se sondea el job
// cada 2 s hasta 60 s), "Pausar avisos" (F0), la gira activada con "Volver a borrador" (D-P1), "Ver
// agenda", "Enviar enlaces del portal", "Ver contactos" e "Importar más". Avisos de F1: grupo por
// defecto ajeno al Equipo de la gira (D6) y quien confirma sin contacto en la gira (D10).
// F3: actividades canceladas por el calendario (`activities_cancelled` o `post_import.cancelled`) y,
// en "Volver a borrador", la casilla "Pausar también los avisos" (marcada; pausa de F0 tras el PATCH).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Translation, useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NotificationsPauseToggle from '@/components/tour/NotificationsPauseToggle.vue'
import { BTN_PRIMARY_CLASS } from '@/components/ui/btnClasses'
import {
  getImportJob,
  type ImportJob,
  type ImportPostImport,
  type ImportResult,
} from '@/composables/useImportJobs'
import { useToursStore } from '@/stores/tours'

/** Sondeo de `post_import` (F2 §3.7.1): cada 2 s, como mucho 60 s. */
const POST_IMPORT_POLL_MS = 2000
const POST_IMPORT_POLL_MAX_MS = 60_000

const props = defineProps<{
  job: Pick<ImportJob, 'result' | 'team_group'> & Partial<Pick<ImportJob, 'uuid' | 'tour'>>
}>()
const emit = defineEmits<{ importMore: []; updated: [job: ImportJob] }>()

const { t, locale } = useI18n()
const toursStore = useToursStore()

const result = computed<Partial<ImportResult>>(() => props.job.result ?? {})
const n = (v: number | undefined) => v ?? 0

// ─── Equipo (F1) ──────────────────────────────────────────────────────────────

// `contacts_linked` ya incluye `linked_late` (commit_team): no se suman.
const linked = computed(() => n(result.value.contacts_linked))
const notDefault = computed(() => result.value.team_group_is_default === false)
const defaultGroupName = computed(() => props.job.team_group?.default_group_name ?? '')
// Solo con `false` explícito: los jobs confirmados antes de D10 no traen el campo.
const confirmerOutside = computed(() => result.value.confirmer_in_team === false)

// ─── Actividades (F2) ─────────────────────────────────────────────────────────

/** Job con actividades: los de F1 no traen `activities_created`. */
const hasActivities = computed(() => result.value.activities_created !== undefined)
const activitiesTouched = computed(
  () => n(result.value.activities_created) + n(result.value.activities_replaced)
)
const hasTeam = computed(
  () =>
    !hasActivities.value ||
    n(result.value.contacts_created) +
      linked.value +
      n(result.value.added_to_group) +
      n(result.value.already_in_tour) >
      0
)
const flights = computed(() => n(result.value.flights_to_enrich))
/** F3: canceladas por el calendario (del `confirm` o, si falta, del recuento de `post_import`). */
const cancelled = computed(
  () => result.value.activities_cancelled ?? result.value.post_import?.cancelled ?? 0
)
const cancelSkipped = computed(() => n(result.value.cancel_skipped))

const tour = computed(() =>
  props.job.tour ? (toursStore.tours.find((x) => x.uuid === props.job.tour) ?? null) : null
)

function formatInstant(iso: string | null | undefined): string {
  if (!iso) return ''
  let dt = DateTime.fromISO(iso, { zone: 'utc' })
  const tz = tour.value?.timezone
  dt = tz ? dt.setZone(tz) : dt.toLocal()
  if (!dt.isValid) return ''
  return dt.setLocale(locale.value === 'es' ? 'es-ES' : 'en-GB').toLocaleString({
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── post_import: sondeo ──────────────────────────────────────────────────────

const post = computed<ImportPostImport | null>(() => result.value.post_import ?? null)
const pollExpired = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let pollStartedAt = 0
let pollFor = ''

function stopPolling() {
  if (timer) clearTimeout(timer)
  timer = null
}

function schedulePoll() {
  stopPolling()
  const uuid = props.job.uuid
  if (!uuid) return
  if (Date.now() - pollStartedAt >= POST_IMPORT_POLL_MAX_MS) {
    pollExpired.value = true
    return
  }
  timer = setTimeout(async () => {
    timer = null
    try {
      const j = await getImportJob(uuid)
      // El job puede haber cambiado (otra ruta) mientras se esperaba la respuesta.
      if (uuid !== props.job.uuid) return
      emit('updated', j)
      const status = (j.result as Partial<ImportResult>)?.post_import?.status
      if (status === 'pending') schedulePoll()
    } catch {
      if (uuid === props.job.uuid) schedulePoll()
    }
  }, POST_IMPORT_POLL_MS)
}

watch(
  [() => props.job.uuid, () => post.value?.status],
  ([uuid, status]) => {
    if (status !== 'pending' || !uuid) {
      stopPolling()
      return
    }
    if (pollFor !== uuid) {
      pollFor = uuid
      pollStartedAt = Date.now()
      pollExpired.value = false
    }
    if (!timer && !pollExpired.value) schedulePoll()
  },
  { immediate: true }
)

onBeforeUnmount(stopPolling)

type RemindersState = 'scheduling' | 'later' | 'done' | 'none'

const remindersState = computed<RemindersState | null>(() => {
  const p = post.value
  if (!hasActivities.value || activitiesTouched.value === 0 || !p) return null
  if (p.status === 'pending') return pollExpired.value ? 'later' : 'scheduling'
  if (p.status === 'failed') return 'later'
  if (messages.value) return messagesTotal.value > 0 ? 'done' : 'none'
  return n(p.reminders_created ?? 0) > 0 ? 'done' : 'none'
})
const remindersCount = computed(() => n(post.value?.reminders_created ?? 0))
/**
 * Mensajes por persona y canal (misma unidad que la vista previa). Con ellos se pintan en lugar de
 * los pasos; los jobs confirmados antes de que existieran siguen mostrando `reminders_created`.
 */
const messages = computed(() => post.value?.messages_by_channel ?? null)
const messagesTotal = computed(() => {
  const m = messages.value
  return m ? n(m.whatsapp) + n(m.email) + n(m.in_app) : 0
})
const firstSend = computed(() => formatInstant(post.value?.first_send_at))

// ─── Volver a borrador (D-P1) ─────────────────────────────────────────────────

const backToDraftOpen = ref(false)
const backToDraftSaving = ref(false)
const backToDraftError = ref('')
/** Decisión de Oscar (F3): "Pausar también los avisos", marcada por defecto. */
const pauseToo = ref(true)
const pausedHere = ref(false)
const pauseError = ref('')
const alreadyPaused = computed(() => tour.value?.enable_notifications === false)

function openBackToDraft() {
  pauseToo.value = true
  backToDraftError.value = ''
  backToDraftOpen.value = true
}

const tourActivated = computed(() => result.value.tour_activated === true)
// Tras confirmar, el store sigue con la gira en `draft` hasta que `loadTours()` responde: no se lee
// de ahí. Se fía de `result.tour_activated` hasta que "Volver a borrador" sale bien aquí.
const revertedToDraft = ref(false)
watch(
  () => props.job.uuid,
  () => {
    revertedToDraft.value = false
    pausedHere.value = false
    pauseError.value = ''
  }
)
const tourIsDraft = computed(() => revertedToDraft.value)

async function backToDraft() {
  const uuid = props.job.tour
  if (!uuid || backToDraftSaving.value) return
  const jobUuid = props.job.uuid
  const pause = pauseToo.value && !alreadyPaused.value
  backToDraftSaving.value = true
  backToDraftError.value = ''
  pauseError.value = ''
  try {
    await toursStore.updateTour(uuid, { status: 'draft' })
    if (jobUuid !== props.job.uuid) return
    revertedToDraft.value = true
  } catch {
    if (jobUuid === props.job.uuid) backToDraftError.value = t('importer.result.backToDraftError')
    backToDraftSaving.value = false
    return
  }
  // La gira ya está en borrador: si falla la pausa se dice aparte (el interruptor sigue a mano).
  if (pause) {
    try {
      await toursStore.pauseNotifications(uuid)
      if (jobUuid === props.job.uuid) pausedHere.value = true
    } catch {
      if (jobUuid === props.job.uuid) pauseError.value = t('importer.result.backToDraftPauseError')
    }
  }
  backToDraftSaving.value = false
  backToDraftOpen.value = false
}

const showPausedBadge = computed(
  () => pausedHere.value || (tourIsDraft.value && alreadyPaused.value)
)

// ─── Enlaces ──────────────────────────────────────────────────────────────────

// Misma apariencia que `BtnSecondary` para el enlace a contactos cuando el principal es "Ver agenda".
const BTN_SECONDARY_CLASS =
  'inline-flex items-center gap-1.5 rounded-sm bg-bg-3 text-ink border border-line-2 font-medium transition-colors duration-200 hover:bg-glass-hover cursor-pointer min-h-[44px] lg:min-h-0 px-4 py-2.5 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive'

/** "Ver agenda" también tras una confirmación que solo cancela. */
const showSchedule = computed(() => activitiesTouched.value > 0 || cancelled.value > 0)

const canSendPortal = computed(
  () => activitiesTouched.value > 0 && tour.value?.current_user_is_admin === true
)
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-lg border border-line bg-bg-3 p-5"
    data-test="import-result"
  >
    <div class="flex items-center gap-2">
      <StatusBadge
        status="sent"
        :label="hasActivities ? t('importer.result.titleAll') : t('importer.result.title')"
      />
    </div>

    <p
      v-if="hasActivities"
      class="text-[15px] text-ink"
      data-test="import-result-activities"
    >
      {{
        t('importer.result.activities', {
          created: n(result.activities_created),
          replaced: n(result.activities_replaced),
          skipped: n(result.activities_skipped),
        })
      }}
    </p>
    <p
      v-if="hasTeam"
      class="text-[15px] text-ink"
      data-test="import-result-summary"
    >
      {{
        t('importer.result.summary', {
          created: n(result.contacts_created),
          linked,
          group: n(result.added_to_group),
        })
      }}
    </p>
    <p
      v-if="cancelled > 0"
      class="text-[15px] text-ink"
      data-test="import-result-cancelled"
    >
      {{ t('importer.result.cancelled', { n: cancelled }, cancelled) }}
    </p>
    <ul
      v-if="n(result.already_in_tour) || n(result.skipped) || flights || cancelSkipped"
      class="flex flex-col gap-0.5 text-[14px] text-ink-2"
    >
      <li v-if="n(result.already_in_tour)">
        {{ t('importer.result.alreadyInTour', { n: n(result.already_in_tour) }, n(result.already_in_tour)) }}
      </li>
      <li v-if="n(result.skipped)">
        {{ t('importer.result.skipped', { n: n(result.skipped) }, n(result.skipped)) }}
      </li>
      <li
        v-if="flights"
        data-test="import-result-flights"
      >
        {{ t('importer.result.flights', { n: flights }, flights) }}
      </li>
      <li
        v-if="cancelSkipped"
        data-test="import-result-cancel-skipped"
      >
        {{ t('importer.result.cancelSkipped', { n: cancelSkipped }, cancelSkipped) }}
      </li>
    </ul>

    <!-- Recordatorios (post_import) -->
    <p
      v-if="remindersState === 'scheduling'"
      class="flex items-center gap-2 text-[14px] text-ink-2"
      aria-live="polite"
      data-test="import-result-scheduling"
    >
      <span
        class="w-3.5 h-3.5 rounded-full border-2 border-ink-2 border-t-transparent animate-spin"
        aria-hidden="true"
      />
      {{ t('importer.result.scheduling') }}
    </p>
    <p
      v-else-if="remindersState === 'later'"
      class="text-[14px] text-ink-2 rounded-sm bg-off-bg px-3 py-2"
      data-test="import-result-scheduling-later"
    >
      {{ t('importer.result.schedulingLater') }}
    </p>
    <div
      v-else-if="remindersState === 'done' && messages"
      class="flex flex-col gap-0.5"
      data-test="import-result-messages"
    >
      <Translation
        v-if="firstSend"
        keypath="importer.result.messages"
        :plural="messagesTotal"
        scope="global"
        tag="p"
        class="text-[14px] text-ink"
        data-test="import-result-messages-total"
      >
        <template #n>
          {{ messagesTotal }}
        </template>
        <template #date>
          <span class="font-time tnum">{{ firstSend }}</span>
        </template>
      </Translation>
      <p
        v-else
        class="text-[14px] text-ink"
        data-test="import-result-messages-total"
      >
        {{ t('importer.result.messagesNoDate', { n: messagesTotal }, messagesTotal) }}
      </p>
      <p
        class="text-[14px] text-ink-2"
        data-test="import-result-messages-channels"
      >
        {{
          t('importer.result.messagesByChannel', {
            wa: n(messages.whatsapp),
            email: n(messages.email),
            app: n(messages.in_app),
          })
        }}
      </p>
    </div>
    <template v-else-if="remindersState === 'done'">
      <Translation
        v-if="firstSend"
        keypath="importer.result.reminders"
        :plural="remindersCount"
        scope="global"
        tag="p"
        class="text-[14px] text-ink"
        data-test="import-result-reminders"
      >
        <template #n>
          {{ remindersCount }}
        </template>
        <template #date>
          <span class="font-time tnum">{{ firstSend }}</span>
        </template>
      </Translation>
      <p
        v-else
        class="text-[14px] text-ink"
        data-test="import-result-reminders"
      >
        {{ t('importer.result.remindersNoDate', { n: remindersCount }, remindersCount) }}
      </p>
    </template>
    <p
      v-else-if="remindersState === 'none'"
      class="text-[14px] text-ink-2"
      data-test="import-result-reminders-none"
    >
      {{ messages ? t('importer.result.messagesNone') : t('importer.result.remindersNone') }}
    </p>

    <!-- Pausa (F0) -->
    <NotificationsPauseToggle
      v-if="hasActivities && tour"
      :tour="tour"
    />

    <!-- Gira activada (D-P1) -->
    <div
      v-if="tourActivated"
      class="flex flex-wrap items-center gap-x-3 gap-y-1"
      data-test="import-result-tour-state"
    >
      <p class="text-[14px] text-ink">
        {{ tourIsDraft ? t('importer.result.isDraft') : t('importer.result.tourActivated') }}
      </p>
      <StatusBadge
        v-if="showPausedBadge"
        size="sm"
        status="off"
        :label="t('importer.result.notificationsPaused')"
        data-test="import-result-paused"
      />
      <button
        v-if="!tourIsDraft && job.tour"
        type="button"
        class="min-h-[44px] lg:min-h-0 px-1 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
        data-test="import-result-back-to-draft"
        @click="openBackToDraft"
      >
        {{ t('importer.result.backToDraft') }}
      </button>
    </div>
    <p
      v-if="pauseError"
      class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
      role="alert"
      data-test="import-result-pause-error"
    >
      {{ pauseError }}
    </p>

    <p
      v-if="notDefault && defaultGroupName"
      class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
      data-test="import-result-not-default"
    >
      {{ t('importer.result.notDefaultGroup', { group: defaultGroupName }) }}
    </p>
    <p
      v-if="confirmerOutside"
      class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
      data-test="import-result-confirmer-outside"
    >
      {{ t('importer.result.confirmerOutside') }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <RouterLink
        v-if="showSchedule"
        :to="{ name: 'events' }"
        :class="BTN_PRIMARY_CLASS"
        data-test="import-result-schedule"
      >
        {{ t('importer.result.viewSchedule') }}
      </RouterLink>
      <RouterLink
        v-if="hasTeam"
        :to="{ name: 'contacts' }"
        :class="showSchedule ? BTN_SECONDARY_CLASS : BTN_PRIMARY_CLASS"
        data-test="import-result-contacts"
      >
        {{ t('importer.result.viewContacts') }}
      </RouterLink>
      <RouterLink
        v-if="canSendPortal"
        :to="{ name: 'tour', query: { tab: 'crew' } }"
        class="inline-flex items-center min-h-[44px] lg:min-h-0 px-2 text-[14px] font-medium text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
        data-test="import-result-portal"
      >
        {{ t('importer.result.sendPortal') }}
      </RouterLink>
      <BtnSecondary
        type="button"
        data-test="import-result-more"
        @click="emit('importMore')"
      >
        {{ t('importer.result.importMore') }}
      </BtnSecondary>
    </div>

    <AppModal
      :show="backToDraftOpen"
      @close="backToDraftOpen = false"
    >
      <div
        class="flex flex-col gap-4"
        data-test="import-result-back-to-draft-modal"
      >
        <p class="text-[16px] font-semibold text-ink">
          {{ t('importer.result.backToDraft') }}
        </p>
        <p class="text-[14px] text-ink-2">
          {{ t('importer.result.backToDraftConfirm') }}
        </p>
        <label
          v-if="!alreadyPaused"
          class="flex items-start gap-2 min-h-[44px] lg:min-h-0 text-[14px] text-ink cursor-pointer"
        >
          <input
            v-model="pauseToo"
            type="checkbox"
            class="mt-0.5 w-4 h-4 accent-[var(--olive)]"
            :disabled="backToDraftSaving"
            data-test="import-result-back-to-draft-pause"
          >
          <span>
            {{ t('importer.result.backToDraftPause') }}
            <span class="block text-[13px] text-ink-2">{{ t('importer.result.backToDraftPauseHelp') }}</span>
          </span>
        </label>
        <p
          v-if="backToDraftError"
          class="text-[13px] text-failed-fg"
          role="alert"
          data-test="import-result-back-to-draft-error"
        >
          {{ backToDraftError }}
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <BtnSecondary
            type="button"
            :disabled="backToDraftSaving"
            @click="backToDraftOpen = false"
          >
            {{ t('importer.result.backToDraftCancel') }}
          </BtnSecondary>
          <BtnPrimary
            type="button"
            class="disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="backToDraftSaving"
            data-test="import-result-back-to-draft-confirm"
            @click="backToDraft"
          >
            {{ t('importer.result.backToDraft') }}
          </BtnPrimary>
        </div>
      </div>
    </AppModal>
  </div>
</template>
