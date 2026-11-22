<script setup lang="ts">
// "Qué se va a enviar y a quién" (F2 §4.4): paso `?step=notices` de la revisión, entre el borrador y
// `confirm`. Pide `preview-notifications/` al entrar y cada vez que cambia "Pausar avisos por
// ahora" (con protección frente a respuestas atrasadas) y pinta destinatarios, recordatorios por
// tipo, reglas, alerta del día de show, primer envío y WhatsApp frente al cupo (D-P3: sin bloquear,
// con "Ver planes"). Confirmar lo hace la vista: aquí solo se emite `confirm(pause)`.
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Translation, useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  previewImportNotifications,
  type ImportNotificationChannel,
  type ImportNotificationsPreview,
  type ImportPreviewReminderType,
  type ImportPreviewRule,
  type ImportPreviewWarning,
} from '@/composables/useImportJobs'
import { apiErrorCodes } from '@/utils/notificationErrors'
import { importErrorKey } from '@/utils/importReview'
import { stepsSummary, type ReminderStep } from '@/utils/reminders'

const props = withDefaults(
  defineProps<{
    jobUuid: string
    /** Zona de la gira para el primer envío; sin ella, la del navegador. */
    timezone?: string | null
    /** Confirmando (lo lleva la vista). */
    busy?: boolean
    /** Error de `confirm` ya traducido. */
    confirmError?: string
  }>(),
  { timezone: null, busy: false, confirmError: '' }
)
const emit = defineEmits<{ back: []; confirm: [pause: boolean]; notReady: [] }>()

const { t, te, locale } = useI18n()

const preview = ref<ImportNotificationsPreview | null>(null)
const loading = ref(true)
const loadErrorKey = ref('')
const pause = ref(false)

// ─── Carga (con protección frente a respuestas atrasadas) ─────────────────────

let request = 0

async function load() {
  const id = ++request
  const uuid = props.jobUuid
  loading.value = true
  loadErrorKey.value = ''
  try {
    const p = await previewImportNotifications(uuid, {
      pause_notifications: pause.value,
      activate_tour: true,
    })
    if (id !== request) return
    preview.value = p
  } catch (e) {
    if (id !== request) return
    if (apiErrorCodes(e).includes('job_not_ready')) {
      emit('notReady')
      return
    }
    loadErrorKey.value = importErrorKey(e)
  } finally {
    if (id === request) loading.value = false
  }
}

onMounted(load)
watch(
  () => props.jobUuid,
  () => {
    preview.value = null
    pause.value = false
    void load()
  }
)

function onPauseChange() {
  void load()
}

// ─── Estado derivado ──────────────────────────────────────────────────────────

const alreadyPaused = computed(() => !!preview.value?.paused.current)
// Con la gira ya en pausa la casilla queda marcada y deshabilitada.
const pauseChecked = computed(() => alreadyPaused.value || pause.value)
const willActivate = computed(() => !!preview.value?.tour_will_activate)
const hasWarning = (code: ImportPreviewWarning) => !!preview.value?.warnings.includes(code)

const channelCounts = (c: Record<ImportNotificationChannel, number>) =>
  t('importer.notices.channels', { wa: c.whatsapp, email: c.email, app: c.in_app })

const recipients = computed(() => preview.value?.recipients ?? null)
const recipientsLine = computed(() => {
  const r = recipients.value
  if (!r?.group) return ''
  const group = r.group.is_tour_team ? t('importer.notices.tourTeam') : r.group.name
  return t('importer.notices.recipients', { group, n: r.people }, r.people)
})
const recipientChannels = computed(() => {
  const r = recipients.value
  if (!r) return ''
  return channelCounts({ whatsapp: r.with_mobile, email: r.with_email, in_app: r.with_account })
})
const withoutPhone = computed(() => recipients.value?.without_phone ?? [])

const typeNames = computed(
  () => new Map((preview.value?.reminders_by_type ?? []).map((r) => [r.code, r.name]))
)
const typeGroups = computed(() =>
  (recipients.value?.type_groups ?? []).map((g) => ({
    code: g.code,
    text: t('importer.notices.typeGroup', {
      type: typeNames.value.get(g.code) ?? g.code,
      groups: g.group_names.join(', '),
    }),
  }))
)

/** Pasos con su canal real (`sends_as`): un WhatsApp sin plantilla sale por email. */
function stepsText(r: ImportPreviewReminderType): string {
  if (!r.steps.length) return t('importer.notices.noSteps')
  const steps: ReminderStep[] = r.steps.map((s) => ({
    minutes: s.minutes,
    channel: s.sends_as ?? s.channel,
  }))
  return stepsSummary(steps, t)
}

const remindersByType = computed(() => preview.value?.reminders_by_type ?? [])
const existing = computed(() => preview.value?.existing_activities ?? null)
const replaced = computed(() => preview.value?.replaced ?? 0)
const past = computed(() => preview.value?.past_activities ?? 0)

function ruleEffect(r: ImportPreviewRule): string {
  if (r.effect === 'skipped_on_import') {
    return r.trigger === 'activity_updated'
      ? t('importer.notices.ruleSkippedUpdated')
      : t('importer.notices.ruleSkipped')
  }
  if (r.skip_reason) {
    const key = `rules.skip.${r.skip_reason}`
    return te(key)
      ? t('importer.notices.ruleBlocked', { reason: t(key) })
      : t('importer.notices.ruleBlockedPlain')
  }
  if (r.count === 0) return t('importer.notices.ruleNothing')
  return t('importer.notices.ruleScheduled', { n: r.count }, r.count)
}

const showDay = computed(() => {
  const s = preview.value?.show_day_alert
  if (!s || !s.enabled || s.days <= 0) return ''
  return s.will_activate
    ? t('importer.notices.showDay', { n: s.days }, s.days)
    : t('importer.notices.showDayActive', { n: s.days }, s.days)
})

const firstSend = computed(() => {
  const iso = preview.value?.first_send_at
  if (!iso) return ''
  let dt = DateTime.fromISO(iso, { zone: 'utc' })
  dt = props.timezone ? dt.setZone(props.timezone) : dt.toLocal()
  if (!dt.isValid) return ''
  return dt.setLocale(locale.value === 'es' ? 'es-ES' : 'en-GB').toLocaleString({
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const quotaLine = computed(() => {
  const p = preview.value
  if (!p) return ''
  const total = p.totals.whatsapp
  const parts = [t('importer.notices.quotaTotal', { n: total }, total)]
  const remaining = p.quota.remaining
  if (remaining !== null) parts.push(t('importer.notices.quotaRemaining', { n: remaining }, remaining))
  return parts.join(' · ')
})

const plansLink = { name: 'settings', query: { tab: 'subscription' } }

function onConfirm() {
  if (props.busy || loading.value || !preview.value) return
  emit('confirm', pauseChecked.value)
}
</script>

<template>
  <section
    class="flex flex-col gap-4"
    data-test="import-notices"
  >
    <header class="flex flex-col gap-1">
      <h1 class="text-[20px] font-bold text-ink">
        {{ t('importer.notices.title') }}
      </h1>
      <p class="text-[14px] text-ink-2">
        {{ t('importer.notices.intro') }}
      </p>
    </header>

    <!-- Carga -->
    <div
      v-if="loading && !preview"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-test="import-notices-loading"
    >
      <span class="sr-only">{{ t('importer.notices.loading') }}</span>
      <div class="h-20 w-full rounded bg-bg-4 animate-pulse" />
      <div class="h-32 w-full rounded bg-bg-4 animate-pulse" />
      <div class="h-16 w-full rounded bg-bg-4 animate-pulse" />
    </div>

    <!-- Error -->
    <div
      v-else-if="loadErrorKey"
      class="flex flex-col items-start gap-3"
    >
      <p
        class="w-full text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
        role="alert"
        data-test="import-notices-error"
      >
        {{ t(loadErrorKey) }}
      </p>
      <div class="flex flex-wrap gap-2">
        <BtnSecondary
          type="button"
          data-test="import-notices-back"
          @click="emit('back')"
        >
          {{ t('importer.notices.back') }}
        </BtnSecondary>
        <BtnPrimary
          type="button"
          data-test="import-notices-retry"
          @click="load"
        >
          {{ t('importer.notices.retry') }}
        </BtnPrimary>
      </div>
    </div>

    <template v-else-if="preview">
      <p
        v-if="hasWarning('subscription_cancelled')"
        class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
        data-test="import-notices-cancelled"
      >
        {{ t('importer.notices.subscriptionCancelled') }}
      </p>

      <div
        class="flex flex-col gap-4"
        :aria-busy="loading"
      >
        <!-- Destinatarios -->
        <section
          class="flex flex-col gap-2 rounded-lg border border-line bg-bg-3 p-4"
          data-test="import-notices-recipients"
        >
          <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
            {{ t('importer.notices.recipientsTitle') }}
          </h2>
          <p
            v-if="recipientsLine"
            class="text-[15px] text-ink"
            data-test="import-notices-recipients-line"
          >
            <span class="font-semibold">{{ recipientsLine }}</span>
            <span
              v-if="recipients && recipients.people_from_import > 0"
              class="text-ink-2"
            >
              ({{ t('importer.notices.recipientsFromImport', { n: recipients.people_from_import }) }})
            </span>
          </p>
          <p
            v-else
            class="text-[15px] text-ink"
            data-test="import-notices-no-group"
          >
            {{ t('importer.notices.noGroup') }}
          </p>
          <p
            class="text-[14px] text-ink-2"
            data-test="import-notices-recipients-channels"
          >
            {{ recipientChannels }}
          </p>
          <ul
            v-if="typeGroups.length"
            class="flex flex-col gap-0.5 text-[13px] text-ink-2"
          >
            <li
              v-for="g in typeGroups"
              :key="g.code"
            >
              {{ g.text }}
            </li>
          </ul>
          <div
            v-if="withoutPhone.length"
            class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
            data-test="import-notices-without-phone"
          >
            <p>{{ t('importer.notices.withoutPhone', { n: withoutPhone.length }, withoutPhone.length) }}</p>
            <p class="text-[13px]">
              {{ withoutPhone.join(', ') }}
            </p>
          </div>
          <p
            v-if="hasWarning('default_group_empty')"
            class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
            data-test="import-notices-group-empty"
          >
            {{ t('importer.notices.groupEmpty') }}
          </p>
          <p
            v-if="hasWarning('team_group_not_default')"
            class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
            data-test="import-notices-team-not-default"
          >
            {{ t('importer.notices.teamNotDefault', { group: recipients?.group?.name ?? '' }) }}
          </p>
        </section>

        <!-- Recordatorios por tipo -->
        <section
          class="flex flex-col gap-2 rounded-lg border border-line bg-bg-3 p-4"
          data-test="import-notices-types"
        >
          <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
            {{ t('importer.notices.byType') }}
          </h2>
          <p
            v-if="!remindersByType.length"
            class="text-[14px] text-ink-2"
            data-test="import-notices-no-reminders"
          >
            {{ t('importer.notices.noReminders') }}
          </p>
          <template v-else>
            <!-- Escritorio: tabla -->
            <table class="hidden lg:table w-full text-[14px]">
              <thead>
                <tr class="text-left text-[12px] text-ink-2 border-b border-line">
                  <th class="py-2 pr-3 font-semibold">
                    {{ t('importer.notices.colType') }}
                  </th>
                  <th class="py-2 pr-3 font-semibold">
                    {{ t('importer.notices.colActivities') }}
                  </th>
                  <th class="py-2 pr-3 font-semibold">
                    {{ t('importer.notices.colSteps') }}
                  </th>
                  <th class="py-2 font-semibold">
                    {{ t('importer.notices.colMessages') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in remindersByType"
                  :key="r.code"
                  class="border-b border-line-soft last:border-b-0"
                  :data-type="r.code"
                >
                  <td class="py-2 pr-3 font-semibold text-ink">
                    {{ r.name }}
                  </td>
                  <td class="py-2 pr-3 text-ink font-time tnum">
                    {{ r.activities }}
                  </td>
                  <td class="py-2 pr-3 text-ink-2">
                    {{ stepsText(r) }}
                  </td>
                  <td class="py-2 text-ink-2">
                    {{ channelCounts(r.messages) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <!-- Móvil: tarjetas -->
            <ul class="lg:hidden flex flex-col gap-2">
              <li
                v-for="r in remindersByType"
                :key="r.code"
                class="flex flex-col gap-0.5 rounded border border-line-soft bg-bg-2 px-3 py-2"
                :data-type-card="r.code"
              >
                <p class="text-[15px] font-semibold text-ink">
                  {{ r.name }}
                  <span class="font-normal text-ink-2">· {{ t('importer.notices.activitiesCount', { n: r.activities }, r.activities) }}</span>
                </p>
                <p class="text-[13px] text-ink-2">
                  {{ stepsText(r) }}
                </p>
                <p class="text-[13px] text-ink-2">
                  {{ channelCounts(r.messages) }}
                </p>
              </li>
            </ul>
          </template>
          <p
            v-if="existing && existing.activities > 0"
            class="text-[13px] text-ink-2"
            data-test="import-notices-existing"
          >
            {{ t('importer.notices.existing', { n: existing.activities }, existing.activities) }}
          </p>
          <p
            v-if="past > 0"
            class="text-[13px] text-ink-2"
            data-test="import-notices-past"
          >
            {{ t('importer.notices.past', { n: past }, past) }}
          </p>
          <p
            v-if="replaced > 0"
            class="text-[13px] text-ink-2"
            data-test="import-notices-replaced"
          >
            {{ t('importer.notices.replaced', { n: replaced }, replaced) }}
          </p>
          <p
            v-if="hasWarning('whatsapp_template_missing')"
            class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
            data-test="import-notices-template-missing"
          >
            {{ t('importer.notices.templateMissing') }}
          </p>
        </section>

        <!-- Reglas -->
        <section
          v-if="preview.rules.length"
          class="flex flex-col gap-2 rounded-lg border border-line bg-bg-3 p-4"
          data-test="import-notices-rules"
        >
          <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
            {{ t('importer.notices.rules') }}
          </h2>
          <ul class="flex flex-col gap-1.5">
            <li
              v-for="r in preview.rules"
              :key="r.uuid"
              class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3 text-[14px]"
              :data-rule="r.uuid"
            >
              <span class="font-semibold text-ink">{{ r.name }}</span>
              <span class="text-ink-2">{{ ruleEffect(r) }}</span>
            </li>
          </ul>
        </section>

        <!-- Día de show, primer envío y cupo -->
        <section
          class="flex flex-col gap-3 rounded-lg border border-line bg-bg-3 p-4"
          data-test="import-notices-summary"
        >
          <div
            v-if="showDay"
            class="flex flex-col gap-0.5"
          >
            <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
              {{ t('importer.notices.showDayTitle') }}
            </h2>
            <p
              class="text-[14px] text-ink"
              data-test="import-notices-show-day"
            >
              {{ showDay }}
            </p>
          </div>

          <div class="flex flex-col gap-0.5">
            <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
              {{ t('importer.notices.firstSendTitle') }}
            </h2>
            <Translation
              v-if="firstSend"
              keypath="importer.notices.firstSend"
              scope="global"
              tag="p"
              class="text-[14px] text-ink"
              data-test="import-notices-first-send"
            >
              <template #date>
                <span class="font-time tnum">{{ firstSend }}</span>
              </template>
            </Translation>
            <p
              v-else
              class="text-[14px] text-ink-2"
              data-test="import-notices-no-sends"
            >
              {{ t('importer.notices.noSends') }}
            </p>
            <p
              class="text-[13px] text-ink-2"
              data-test="import-notices-totals"
            >
              {{ channelCounts(preview.totals) }}
            </p>
          </div>

          <div
            class="flex flex-col gap-1.5"
            data-test="import-notices-quota"
          >
            <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
              {{ t('importer.notices.quotaTitle') }}
            </h2>
            <p
              class="text-[14px] text-ink"
              data-test="import-notices-quota-line"
            >
              {{ quotaLine }}
            </p>
            <div
              v-if="preview.quota.exceeds"
              class="flex flex-col items-start gap-1.5"
              data-test="import-notices-quota-exceeds"
            >
              <StatusBadge
                status="pending"
                size="sm"
                :label="t('importer.notices.quotaExceedsBadge')"
              />
              <p class="text-[14px] text-ink-2">
                {{ t('importer.notices.quotaExceeds') }}
              </p>
              <RouterLink
                :to="plansLink"
                class="inline-flex items-center min-h-[44px] lg:min-h-0 text-[14px] font-medium text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
                data-test="import-notices-plans"
              >
                {{ t('importer.notices.viewPlans') }}
              </RouterLink>
            </div>
          </div>
        </section>

        <!-- Pausa y activación -->
        <section class="flex flex-col gap-2">
          <label
            class="flex items-start gap-2 min-h-[44px] lg:min-h-0 text-[15px] text-ink"
            :class="alreadyPaused ? 'cursor-default' : 'cursor-pointer'"
          >
            <input
              v-if="alreadyPaused"
              type="checkbox"
              class="mt-1 w-4 h-4 accent-[var(--olive)] disabled:opacity-50"
              checked
              disabled
              data-test="import-notices-pause"
            >
            <input
              v-else
              v-model="pause"
              type="checkbox"
              class="mt-1 w-4 h-4 accent-[var(--olive)] disabled:opacity-50"
              :disabled="busy"
              data-test="import-notices-pause"
              @change="onPauseChange"
            >
            <span>
              {{ t('importer.notices.pause') }}
              <span
                class="block text-[13px] text-ink-2"
                data-test="import-notices-pause-help"
              >
                {{ alreadyPaused ? t('importer.notices.alreadyPaused') : t('importer.notices.pauseHelp') }}
              </span>
            </span>
          </label>
          <p
            v-if="willActivate"
            class="text-[14px] text-ink rounded-sm bg-scheduled-bg px-3 py-2"
            data-test="import-notices-will-activate"
          >
            {{ t('importer.notices.willActivate') }}
          </p>
        </section>
      </div>

      <p
        v-if="confirmError"
        class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
        role="alert"
        data-test="import-notices-confirm-error"
      >
        {{ confirmError }}
      </p>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <BtnSecondary
          type="button"
          class="disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="busy"
          data-test="import-notices-back"
          @click="emit('back')"
        >
          {{ t('importer.notices.back') }}
        </BtnSecondary>
        <BtnPrimary
          type="button"
          class="flex-1 sm:flex-none justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="busy || loading"
          data-test="import-notices-confirm"
          @click="onConfirm"
        >
          <span
            v-if="busy"
            class="w-3.5 h-3.5 rounded-full border-2 border-night border-t-transparent animate-spin"
            aria-hidden="true"
          />
          {{ willActivate ? t('importer.notices.confirmActivate') : t('importer.notices.confirm') }}
        </BtnPrimary>
      </div>
    </template>
  </section>
</template>
