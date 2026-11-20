<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type {
  ReportChannel,
  ReportNotificationStatus,
  ReportsRecentNotification,
} from '@/composables/useNotificationReports'
import { browserZone, formatInZoneShort } from '@/utils/datetime'
import Pill from '@/components/ui/Pill.vue'
import type { PillVariant } from '@/types'

defineProps<{ notifications: ReportsRecentNotification[] }>()

const { t, te } = useI18n()

const CHANNEL_CLASS: Record<ReportChannel, string> = {
  whatsapp: 'bg-wa-green-dim text-wa-green',
  email: 'bg-brand-blue-dim text-brand-blue',
}
const CHANNEL_SHORT: Record<ReportChannel, string> = { whatsapp: 'WA', email: 'EM' }

const STATUS_PILL: Record<ReportNotificationStatus, PillVariant> = {
  draft: 'n',
  pending: 'n',
  scheduled: 'b',
  sending: 'g',
  sent: 'g',
  failed: 'o',
  cancelled: 'n',
}

function statusLabel(status: string): string {
  const key = `reports.status.${status}`
  return te(key) ? t(key) : status
}

function when(iso: string): string {
  return formatInZoneShort(iso, browserZone())
}
</script>

<template>
  <div class="bg-bg-3 border border-line rounded-lg overflow-hidden shadow-[0_1px_3px_var(--shadow-sm)] mb-3">
    <div class="px-4 sm:px-5 py-3 border-b border-line flex items-center justify-between gap-3">
      <p class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase">
        {{ t('reports.recentNotifications') }}
      </p>
      <div class="hidden sm:flex gap-4 text-[10px] text-ink-3">
        <span class="w-12 text-right">{{ t('reports.sent') }}</span>
        <span class="w-12 text-right">{{ t('reports.read') }}</span>
        <span class="w-14 text-right">{{ t('reports.confirmed') }}</span>
      </div>
    </div>
    <p
      v-if="!notifications.length"
      class="text-[12px] text-ink-3 text-center py-4"
    >
      {{ t('reports.noRecent') }}
    </p>
    <div
      v-else
      class="divide-y divide-line"
    >
      <div
        v-for="n in notifications"
        :key="n.uuid"
        class="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 px-4 sm:px-5 py-3 hover:bg-glass-hover transition-colors duration-150"
      >
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[8px] font-bold"
          :class="CHANNEL_CLASS[n.channel]"
          :title="t(`reports.${n.channel}`)"
        >
          {{ CHANNEL_SHORT[n.channel] }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[12px] font-semibold text-ink truncate">
            {{ n.title }}
          </p>
          <p class="text-[10px] text-ink-3 truncate">
            {{ when(n.reference_at) }} · {{ n.tour_name }}
          </p>
        </div>
        <Pill :variant="STATUS_PILL[n.status] ?? 'n'">
          {{ statusLabel(n.status) }}
        </Pill>
        <div class="flex gap-4 text-right flex-shrink-0 ml-10 sm:ml-0">
          <p
            class="w-12 text-[12px] font-bold text-ink"
            :title="t('reports.sent')"
          >
            {{ n.sent_count }}
          </p>
          <p
            class="w-12 text-[12px] font-bold text-brand-blue"
            :title="n.channel === 'email' ? t('reports.notTracked') : t('reports.read')"
          >
            {{ n.channel === 'email' ? '—' : n.read_count }}
          </p>
          <p
            class="w-14 text-[12px] font-bold text-acid"
            :title="t('reports.confirmed')"
          >
            {{ n.confirmable ? `${n.confirmed_count}/${n.recipient_count}` : '—' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
