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
  <div
    class="relative overflow-hidden rounded-lg shadow-[0_10px_30px_var(--acid-glow)] p-5"
    style="background: linear-gradient(135deg, var(--acid-muted), var(--acid-light))"
  >
    <!-- Glossy diagonal sheen -->
    <div
      class="pointer-events-none absolute inset-0"
      style="background: linear-gradient(120deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 40%)"
    />

    <p class="relative text-[9px] font-bold text-black/70 tracking-[1px] uppercase mb-4">
      {{ title }}
    </p>

    <div class="relative">
      <SummaryDonut
        :percentage="readRate"
        :center-value="readRateText"
        :center-label="t('reports.readRate')"
        color="#000000"
        track-color="rgba(0,0,0,0.15)"
        value-color="#000000"
        label-color="rgba(0,0,0,0.65)"
      />

      <div class="mt-5 space-y-3">
        <div class="flex items-center justify-between text-[12px]">
          <span class="text-black/65">{{ t('reports.sent') }}</span>
          <span class="font-semibold text-black">{{ totals.sent.toLocaleString() }}</span>
        </div>
        <div
          class="flex items-center justify-between text-[12px]"
          :title="tracksDelivery ? undefined : t('reports.notTracked')"
        >
          <span class="text-black/65">{{ t('reports.deliveryRate') }}</span>
          <span class="font-semibold text-black">{{ deliveryRateText }}</span>
        </div>
        <div
          class="flex items-center justify-between text-[12px]"
          :title="t('reports.confirmationRateHint')"
        >
          <span class="text-black/65">{{ t('reports.confirmed') }}</span>
          <span class="font-semibold text-black">
            {{ totals.confirmed.toLocaleString() }}
            <span class="text-black/60 font-medium">· {{ pct(rates.confirmation_rate) }}</span>
          </span>
        </div>
        <div class="flex items-center justify-between text-[12px]">
          <span class="text-black/65">{{ t('reports.failed') }}</span>
          <span class="font-semibold text-black">{{ totals.failed.toLocaleString() }}</span>
        </div>
        <div class="flex items-center justify-between text-[12px]">
          <span class="text-black/65">{{ t('reports.pending') }}</span>
          <span class="font-semibold text-black">{{ totals.pending.toLocaleString() }}</span>
        </div>
        <div class="flex items-center justify-between text-[12px] pt-2 border-t border-black/10">
          <span class="text-black/65">{{ t('reports.notifications') }}</span>
          <span class="font-semibold text-black">{{ notificationsTotal.toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
