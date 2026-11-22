<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SummaryDonut from '@/components/reports/SummaryDonut.vue'
import type { SubscriptionStats } from '@/composables/useAdminSubscriptions'

const { t } = useI18n()
const props = defineProps<{ stats: SubscriptionStats }>()

function activePct() {
  if (!props.stats.total_tours) return 0
  return Math.round((props.stats.active_subscriptions / props.stats.total_tours) * 100)
}
</script>

<template>
  <div class="relative overflow-hidden rounded-lg bg-bg-3 border border-line shadow-sm p-5 mb-4">
    <p class="relative text-[11px] font-bold text-ink-2 tracking-[1px] uppercase mb-4">
      {{ t('admin.stats.overview') }}
    </p>

    <div class="relative grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
      <SummaryDonut
        :percentage="activePct()"
        :center-value="`${activePct()}%`"
        :center-label="t('admin.stats.activeTours')"
        color="var(--olive)"
        track-color="var(--line-soft)"
        value-color="var(--ink)"
        label-color="var(--ink-2)"
      />

      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <p class="text-[11px] text-ink-2 uppercase tracking-[0.5px]">
            {{ t('admin.stats.totalTours') }}
          </p>
          <p class="text-[16px] font-bold text-ink">
            {{ stats.total_tours.toLocaleString() }}
          </p>
        </div>
        <div>
          <p class="text-[11px] text-ink-2 uppercase tracking-[0.5px]">
            {{ t('admin.stats.activeSubscriptions') }}
          </p>
          <p class="text-[16px] font-bold text-ink">
            {{ stats.active_subscriptions.toLocaleString() }}
          </p>
        </div>
        <div>
          <p class="text-[11px] text-ink-2 uppercase tracking-[0.5px]">
            {{ t('admin.stats.notificationsSent') }}
          </p>
          <p class="text-[16px] font-bold text-ink">
            {{ stats.total_notifications_sent.toLocaleString() }}
          </p>
        </div>
        <div>
          <p class="text-[11px] text-ink-2 uppercase tracking-[0.5px]">
            {{ t('admin.stats.totalRevenue') }}
          </p>
          <p class="text-[16px] font-bold text-ink">
            {{ stats.total_revenue }}
          </p>
        </div>
        <div class="col-span-2 md:col-span-1">
          <p class="text-[11px] text-ink-2 uppercase tracking-[0.5px] mb-1">
            {{ t('admin.stats.byPlan') }}
          </p>
          <p class="text-[13px] text-ink">
            <span
              v-for="(n, code) in stats.subscriptions_by_plan"
              :key="code"
              class="mr-2"
            >{{ code }}: {{ n }}</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
