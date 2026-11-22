<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ReportChannel, ReportsRecentNotification } from '@/composables/useNotificationReports'
import { browserZone, formatInZoneShort } from '@/utils/datetime'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { notificationBadge } from '@/utils/statusBadge'

defineProps<{ notifications: ReportsRecentNotification[] }>()

const { t, te } = useI18n()

const CHANNEL_CLASS: Record<ReportChannel, string> = {
  whatsapp: 'bg-wa-bg text-wa-fg',
  email: 'bg-scheduled-bg text-scheduled-fg',
}
const CHANNEL_SHORT: Record<ReportChannel, string> = { whatsapp: 'WA', email: 'EM' }

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
      <p class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
        {{ t('reports.recentNotifications') }}
      </p>
      <div class="hidden sm:flex gap-4 text-[12px] text-ink-3">
        <span class="w-12 text-right">{{ t('reports.sent') }}</span>
        <span class="w-12 text-right">{{ t('reports.read') }}</span>
        <span class="w-14 text-right">{{ t('reports.confirmed') }}</span>
      </div>
    </div>
    <p
      v-if="!notifications.length"
      class="text-[14px] text-ink-3 text-center py-4"
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
          class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[12px] font-bold"
          :class="CHANNEL_CLASS[n.channel]"
          :title="t(`reports.${n.channel}`)"
        >
          {{ CHANNEL_SHORT[n.channel] }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-semibold text-ink truncate">
            {{ n.title }}
          </p>
          <p class="text-[12px] text-ink-3 truncate">
            <span class="font-time tnum">{{ when(n.reference_at) }}</span> · {{ n.tour_name }}
          </p>
        </div>
        <StatusBadge
          :status="notificationBadge(n.status)"
          :label="statusLabel(n.status)"
          size="sm"
        />
        <div class="flex gap-4 text-right flex-shrink-0 ml-10 sm:ml-0">
          <p
            class="w-12 text-[14px] font-bold text-ink"
            :title="t('reports.sent')"
          >
            {{ n.sent_count }}
          </p>
          <p
            class="w-12 text-[14px] font-bold text-brand-blue"
            :title="n.channel === 'email' ? t('reports.notTracked') : t('reports.read')"
          >
            {{ n.channel === 'email' ? '—' : n.read_count }}
          </p>
          <p
            class="w-14 text-[14px] font-bold text-olive"
            :title="t('reports.confirmed')"
          >
            {{ n.confirmable ? `${n.confirmed_count}/${n.recipient_count}` : '—' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
