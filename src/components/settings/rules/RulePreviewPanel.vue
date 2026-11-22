<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import {
  useNotificationRules,
  type RulePreview,
  type RulePreviewDraft,
} from '@/composables/useNotificationRules'
import type { ActivityListItem } from '@/composables/useActivities'
import { skipReasonLabel } from '@/utils/notificationRules'

/**
 * Vista previa de una regla: con `draft` (borrador del editor, POST rules/preview/) o con
 * `ruleUuid` (regla guardada, POST rules/{uuid}/preview/). No escribe nada en el backend.
 */
const props = defineProps<{
  tourUuid: string
  draft?: RulePreviewDraft | null
  ruleUuid?: string | null
  /** Disparador y tipos, para el selector de actividad (no aplica a `unconfirmed`). */
  trigger: string
  activityTypeCodes?: string[]
}>()

const MAX_ACTIVITIES = 20

const { t, locale } = useI18n()
const api = useNotificationRules()

const preview = ref<RulePreview | null>(null)
const loading = ref(false)
const error = ref('')
const activityUuid = ref('')
const activities = ref<ActivityListItem[]>([])
let requestId = 0

const isUnconfirmed = computed(() => props.trigger === 'notification_unconfirmed')

async function run() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const result = props.ruleUuid
      ? await api.previewRule(props.ruleUuid, activityUuid.value || undefined)
      : await api.previewDraft({
          ...(props.draft as RulePreviewDraft),
          ...(activityUuid.value ? { activity: activityUuid.value } : {}),
        })
    if (id !== requestId) return
    preview.value = result
  } catch (e) {
    if (id !== requestId) return
    preview.value = null
    error.value = e instanceof Error ? e.message : t('rules.preview.error')
  } finally {
    if (id === requestId) loading.value = false
  }
}

let activitiesRequestId = 0

async function loadActivities() {
  const id = ++activitiesRequestId
  if (isUnconfirmed.value) {
    activities.value = []
    return
  }
  try {
    const items = await api.listPreviewActivities(
      props.tourUuid,
      props.activityTypeCodes ?? [],
      MAX_ACTIVITIES
    )
    if (id !== activitiesRequestId) return
    activities.value = items
    // La actividad elegida ya no encaja con los tipos del borrador: vuelve a "la próxima".
    if (activityUuid.value && !items.some((a) => a.uuid === activityUuid.value)) {
      activityUuid.value = ''
    }
  } catch {
    // El selector es opcional: sin lista, el backend elige la próxima que encaje.
    if (id === activitiesRequestId) activities.value = []
  }
}

onMounted(() => {
  run()
  loadActivities()
})

watch(activityUuid, run)
watch(
  () => [props.tourUuid, props.trigger, [...(props.activityTypeCodes ?? [])].sort().join(',')],
  (next, prev) => {
    if (next.join('|') !== prev.join('|')) loadActivities()
  }
)
watch(
  () => [props.draft, props.ruleUuid],
  () => run(),
  { deep: true }
)

function fmtDate(iso: string | null | undefined, zone?: string): string {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso, { zone: 'utc' })
  if (!dt.isValid) return ''
  return dt
    .setZone(zone || 'local')
    .setLocale(locale.value)
    .toLocaleString(DateTime.DATETIME_MED)
}

const sendDate = computed(() =>
  fmtDate(preview.value?.scheduled_for, preview.value?.activity?.timezone)
)

const notSendReason = computed(() => {
  const p = preview.value
  if (!p || p.would_fire) return ''
  return skipReasonLabel(p.skip_reason ?? '', t)
})

const whatsappVars = computed(() =>
  Object.entries(preview.value?.whatsapp_variables ?? {}).sort(
    ([a], [b]) => Number(a) - Number(b)
  )
)

const STATUS_CLASS: Record<string, string> = {
  ok: 'text-olive',
  no_phone: 'text-brand-orange',
  no_email: 'text-brand-orange',
  no_account: 'text-brand-orange',
  overlap: 'text-ink-3',
}

function statusLabel(status: string) {
  const key = `rules.preview.status.${status}`
  const s = t(key)
  return s === key ? status : s
}

function varLabel(position: string) {
  return `{{${position}}}`
}

function excludedLabel(reason: string) {
  const key = `rules.preview.excluded.${reason}`
  const s = t(key)
  return s === key ? reason : s
}
</script>

<template>
  <div
    class="bg-glass border border-line rounded-sm px-3 py-3 space-y-3"
    data-test="rule-preview"
  >
    <p class="text-[12px] font-bold text-ink-2 tracking-[0.5px] uppercase">
      {{ t('rules.preview.title') }}
    </p>

    <!-- Selector de actividad -->
    <label
      v-if="!isUnconfirmed"
      class="block"
    >
      <span class="text-[13px] text-ink-3">{{ t('rules.preview.pickActivity') }}</span>
      <select
        v-model="activityUuid"
        class="mt-1 w-full bg-bg-4 border border-line rounded-sm px-2 py-1.5 text-[14px] text-ink"
        data-test="preview-activity"
      >
        <option value="">
          {{ t('rules.preview.nextActivity') }}
        </option>
        <option
          v-for="a in activities"
          :key="a.uuid"
          :value="a.uuid"
        >
          {{ a.title }} · {{ fmtDate(a.scheduled_at, a.timezone) }}
        </option>
      </select>
    </label>

    <p
      v-if="loading"
      class="text-[14px] text-ink-3"
    >
      {{ t('rules.preview.loading') }}
    </p>

    <div
      v-else-if="error"
      class="text-[14px] text-failed-fg"
      data-test="preview-error"
    >
      {{ error }}
      <button
        class="ml-2 text-ink-2 underline bg-transparent border-none cursor-pointer text-[13px]"
        @click="run"
      >
        {{ t('rules.preview.retry') }}
      </button>
    </div>

    <template v-else-if="preview">
      <!-- Resultado -->
      <p
        v-if="preview.would_fire && preview.scheduled_for"
        class="text-[14px] font-semibold text-olive"
        data-test="preview-would-send"
      >
        {{ t('rules.preview.wouldSend', { date: sendDate }) }}
      </p>
      <p
        v-else-if="!isUnconfirmed && !preview.activity && preview.skip_reason === 'no_matching_activity'"
        class="text-[14px] text-ink-3"
        data-test="preview-no-activity"
      >
        {{ t('rules.preview.noActivity') }}
      </p>
      <p
        v-else-if="!isUnconfirmed && !preview.would_fire"
        class="text-[14px] font-semibold text-brand-orange"
        data-test="preview-would-not-send"
      >
        {{ t('rules.preview.wouldNotSend', { reason: notSendReason }) }}
      </p>

      <p
        v-if="preview.activity"
        class="text-[13px] text-ink-3"
      >
        {{ preview.activity.title }} ·
        {{ fmtDate(preview.activity.scheduled_at, preview.activity.timezone) }}
      </p>

      <!-- Destinatarios -->
      <div v-if="!isUnconfirmed">
        <p class="text-[13px] font-semibold text-ink-2 mb-1">
          {{ t('rules.preview.recipients') }}
          <span
            v-if="preview.recipients.length"
            class="font-normal text-ink-4"
          >
            · {{ t('rules.preview.counts', preview.counts) }}
          </span>
        </p>
        <p
          v-if="!preview.recipients.length"
          class="text-[13px] text-ink-4"
        >
          {{ t('rules.preview.noRecipients') }}
        </p>
        <ul
          v-else
          class="space-y-0.5"
        >
          <li
            v-for="(r, i) in preview.recipients"
            :key="`${r.contact ?? r.name}-${i}`"
            class="flex flex-wrap items-baseline justify-between gap-x-2 text-[13px]"
            data-test="preview-recipient"
          >
            <span class="text-ink truncate min-w-0">
              {{ r.name }}
              <span
                v-if="r.destination"
                class="text-ink-4"
              >· {{ r.destination }}</span>
            </span>
            <span :class="STATUS_CLASS[r.status] ?? 'text-ink-3'">{{ statusLabel(r.status) }}</span>
          </li>
        </ul>
      </div>

      <!-- Texto -->
      <div
        v-if="preview.rendered"
        class="bg-bg-4 rounded-sm px-2.5 py-2"
      >
        <p class="text-[12px] text-ink-4 mb-1">
          {{ t('rules.preview.message') }}
        </p>
        <p class="text-[14px] font-semibold text-ink">
          {{ preview.rendered.title }}
        </p>
        <p class="text-[13px] text-ink-2 whitespace-pre-line mt-0.5">
          {{ preview.rendered.message }}
        </p>
      </div>
      <div
        v-else-if="whatsappVars.length"
        class="bg-bg-4 rounded-sm px-2.5 py-2"
      >
        <p class="text-[12px] text-ink-4 mb-1">
          {{ t('rules.preview.variables') }}
        </p>
        <p
          v-for="[k, v] in whatsappVars"
          :key="k"
          class="text-[13px] text-ink-2"
        >
          <span class="text-ink-4">{{ varLabel(k) }}</span> {{ v }}
        </p>
      </div>

      <!-- Solapes -->
      <div v-if="preview.overlaps.length">
        <p class="text-[13px] font-semibold text-ink-2 mb-1">
          {{ t('rules.preview.overlaps') }}
        </p>
        <p
          v-for="o in preview.overlaps"
          :key="o.rule"
          class="text-[13px] text-ink-3"
        >
          {{ o.name }} · {{ fmtDate(o.scheduled_for, preview.activity?.timezone) }}
        </p>
      </div>

      <!-- Recordatorios por defecto -->
      <p
        v-if="!isUnconfirmed && preview.default_reminders.count > 0"
        class="text-[13px] text-ink-3"
        data-test="preview-default-reminders"
      >
        {{ t('rules.preview.defaultReminders', { count: preview.default_reminders.count }) }}
        {{
          preview.default_reminders.replaced
            ? t('rules.preview.defaultRemindersReplaced')
            : t('rules.preview.defaultRemindersKept')
        }}
      </p>

      <!-- Sin confirmar: candidatas -->
      <div v-if="isUnconfirmed">
        <p class="text-[13px] font-semibold text-ink-2 mb-1">
          {{ t('rules.preview.candidates') }}
        </p>
        <p
          v-if="!preview.candidates?.length"
          class="text-[13px] text-ink-4"
        >
          {{ t('rules.preview.noCandidates') }}
        </p>
        <ul
          v-else
          class="space-y-1.5"
        >
          <li
            v-for="c in preview.candidates"
            :key="c.notification"
            class="text-[13px]"
            data-test="preview-candidate"
          >
            <p class="text-ink">
              {{ c.title }}
              <span class="text-ink-4">· {{ fmtDate(c.sent_at) }}</span>
            </p>
            <p class="text-olive">
              {{ t('rules.preview.eligible', { n: c.eligible }) }}
            </p>
            <p
              v-for="(n, reason) in c.excluded"
              :key="reason"
              class="text-ink-3"
            >
              {{ excludedLabel(String(reason)) }}: {{ n }}
            </p>
          </li>
        </ul>
        <p
          v-if="preview.plan"
          class="text-[13px] text-ink-3 mt-2"
          data-test="preview-plan"
        >
          {{
            preview.plan.remaining < 0
              ? t('rules.preview.planUnlimited')
              : t('rules.preview.planRemaining', { n: preview.plan.remaining })
          }}
          <span v-if="preview.plan.counts"> · {{ t('rules.preview.planCounts') }}</span>
        </p>
      </div>
    </template>
  </div>
</template>
