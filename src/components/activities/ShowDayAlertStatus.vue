<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NotificationListItem } from '@/composables/useNotifications'
import { isActivityPast } from '@/utils/confirmations'
import { showDayAlertState, showDayAlertView, type ShowDayAlertState } from '@/utils/showDayAlert'
import { formatInZoneLocalized } from '@/utils/datetime'

// Solo el estado y los confirmados: el botón de recordar vive en el NotificationCard de la alerta.
// Default explícito: sin él, Vue convierte una prop booleana ausente en `false`.
const props = withDefaults(
  defineProps<{
    notifications: NotificationListItem[]
    /** `scheduled_at` del show: si ya pasó y no hubo alerta, el bloque no se pinta. */
    activityScheduledAt?: string | null
    /** `Tour.show_day_alert_enabled`; `undefined` si no se ha podido cargar. */
    showDayAlertEnabled?: boolean
  }>(),
  { activityScheduledAt: null, showDayAlertEnabled: undefined }
)

const { t, locale } = useI18n()

const state = computed<ShowDayAlertState>(() => showDayAlertState(props.notifications))
const view = computed(() =>
  showDayAlertView(state.value, {
    activityPast: isActivityPast(props.activityScheduledAt),
    tourEnabled: props.showDayAlertEnabled,
  })
)

const label = computed(() => {
  const s = state.value
  if (s.kind === 'scheduled') {
    return t('showDayAlert.state.scheduled', {
      at: formatInZoneLocalized(s.at, s.timezone, locale.value),
    })
  }
  if (s.kind === 'sent') {
    return t('showDayAlert.state.sent', { confirmed: s.confirmed, total: s.total })
  }
  return t(`showDayAlert.state.${view.value}`)
})

// Mismos colores que los chips de confirmación de la 3.1.
const chipClass = computed(() => {
  const s = state.value
  switch (s.kind) {
    case 'scheduled':
      return 'bg-brand-blue-dim text-brand-blue'
    case 'sending':
      return 'bg-glass-2 text-ink-2'
    case 'sent':
      return s.total > 0 && s.confirmed >= s.total
        ? 'bg-acid-dim text-olive'
        : 'bg-glass-2 text-ink-2'
    case 'failed':
      return 'bg-failed-bg text-failed-fg'
    default:
      return 'bg-glass text-ink-4'
  }
})
</script>

<template>
  <div
    v-if="view !== 'hidden'"
    class="rounded-xl border border-line bg-glass px-3 py-2.5"
    data-testid="show-day-alert-status"
  >
    <div class="flex items-start gap-2 min-w-0">
      <svg
        class="flex-shrink-0 mt-0.5 text-wa-green"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M9 18V5l12-2v13" />
        <circle
          cx="6"
          cy="18"
          r="3"
        />
        <circle
          cx="18"
          cy="16"
          r="3"
        />
      </svg>
      <span
        class="text-[13px] font-semibold px-2 py-0.5 rounded-full leading-snug break-words min-w-0"
        :class="chipClass"
      >
        {{ label }}
      </span>
    </div>
  </div>
</template>
