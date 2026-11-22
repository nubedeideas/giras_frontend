<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ReportsSummary } from '@/composables/useNotificationReports'
import SummaryDonut from './SummaryDonut.vue'

const props = defineProps<{
  title: string
  totals: ReportsSummary['totals']
  rates: ReportsSummary['rates']
  notificationsTotal: number
  crewPortal?: ReportsSummary['crew_portal']
}>()

const { t } = useI18n()

function pct(v: number | null): string {
  return v === null ? '—' : `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

// `null` = sin envíos por un canal que mida entrega (p. ej. solo email): se muestra "—".
const readRate = computed(() => props.rates.read_rate ?? 0)
const readRateText = computed(() => pct(props.rates.read_rate))
const deliveryRateText = computed(() => pct(props.rates.delivery_rate))
const tracksDelivery = computed(
  () => props.rates.delivery_rate !== null || props.rates.read_rate !== null
)
</script>

<template>
  <div class="relative overflow-hidden rounded-lg bg-bg-3 border border-line shadow-sm p-5">
    <p class="relative text-[11px] font-bold text-ink-2 tracking-[1px] uppercase mb-4">
      {{ title }}
    </p>

    <div class="relative">
      <SummaryDonut
        :percentage="readRate"
        :center-value="readRateText"
        :center-label="t('reports.readRate')"
        color="var(--olive)"
        track-color="var(--line-soft)"
        value-color="var(--ink)"
        label-color="var(--ink-2)"
      />

      <div class="mt-5 space-y-3">
        <div class="flex items-center justify-between text-[14px]">
          <span class="text-ink-2">{{ t('reports.sent') }}</span>
          <span class="font-semibold text-ink">{{ totals.sent.toLocaleString() }}</span>
        </div>
        <div
          class="flex items-center justify-between text-[14px]"
          :title="tracksDelivery ? undefined : t('reports.notTracked')"
        >
          <span class="text-ink-2">{{ t('reports.deliveryRate') }}</span>
          <span class="font-semibold text-ink">{{ deliveryRateText }}</span>
        </div>
        <div
          class="flex items-center justify-between text-[14px]"
          :title="t('reports.confirmationRateHint')"
        >
          <span class="text-ink-2">{{ t('reports.confirmed') }}</span>
          <span class="font-semibold text-ink">
            {{ totals.confirmed.toLocaleString() }}
            <span class="text-ink-2 font-medium">· {{ pct(rates.confirmation_rate) }}</span>
          </span>
        </div>
        <div class="flex items-center justify-between text-[14px]">
          <span class="text-ink-2">{{ t('reports.failed') }}</span>
          <span class="font-semibold text-ink">{{ totals.failed.toLocaleString() }}</span>
        </div>
        <div class="flex items-center justify-between text-[14px]">
          <span class="text-ink-2">{{ t('reports.pending') }}</span>
          <span class="font-semibold text-ink">{{ totals.pending.toLocaleString() }}</span>
        </div>
        <div class="flex items-center justify-between text-[14px] pt-2 border-t border-line">
          <span class="text-ink-2">{{ t('reports.notifications') }}</span>
          <span class="font-semibold text-ink">{{ notificationsTotal.toLocaleString() }}</span>
        </div>
        <p
          v-if="crewPortal && crewPortal.links > 0"
          data-testid="crew-portal-summary"
          class="text-[13px] text-ink-2 leading-snug"
        >
          {{
            t('reports.crewPortal', {
              viewed: crewPortal.viewed.toLocaleString(),
              links: crewPortal.links.toLocaleString(),
              visits: t(
                'reports.crewPortalVisits',
                { n: crewPortal.views.toLocaleString() },
                crewPortal.views
              ),
            })
          }}
        </p>
      </div>
    </div>
  </div>
</template>
