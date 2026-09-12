<script setup lang="ts">
import SummaryDonut from '@/components/reports/SummaryDonut.vue'
import type { SubscriptionStats } from '@/composables/useAdminSubscriptions'

const props = defineProps<{ stats: SubscriptionStats }>()

function activePct() {
  if (!props.stats.total_tours) return 0
  return Math.round((props.stats.active_subscriptions / props.stats.total_tours) * 100)
}
</script>

<template>
  <div
    class="relative overflow-hidden rounded-lg shadow-[0_10px_30px_var(--acid-glow)] p-5 mb-4"
    style="background: linear-gradient(135deg, var(--acid-muted), var(--acid-light))"
  >
    <div
      class="pointer-events-none absolute inset-0"
      style="background: linear-gradient(120deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 40%)"
    />

    <p class="relative text-[9px] font-bold text-black/70 tracking-[1px] uppercase mb-4">Resumen general</p>

    <div class="relative grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
      <SummaryDonut
        :percentage="activePct()"
        :center-value="`${activePct()}%`"
        center-label="Giras activas"
        color="#000000"
        track-color="rgba(0,0,0,0.15)"
        value-color="#000000"
        label-color="rgba(0,0,0,0.65)"
      />

      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <p class="text-[9px] text-black/60 uppercase tracking-[0.5px]">Giras totales</p>
          <p class="text-[16px] font-bold text-black">{{ stats.total_tours.toLocaleString() }}</p>
        </div>
        <div>
          <p class="text-[9px] text-black/60 uppercase tracking-[0.5px]">Suscripciones activas</p>
          <p class="text-[16px] font-bold text-black">{{ stats.active_subscriptions.toLocaleString() }}</p>
        </div>
        <div>
          <p class="text-[9px] text-black/60 uppercase tracking-[0.5px]">Notifs. enviadas</p>
          <p class="text-[16px] font-bold text-black">{{ stats.total_notifications_sent.toLocaleString() }}</p>
        </div>
        <div>
          <p class="text-[9px] text-black/60 uppercase tracking-[0.5px]">Ingresos totales</p>
          <p class="text-[16px] font-bold text-black">{{ stats.total_revenue }}</p>
        </div>
        <div class="col-span-2 md:col-span-1">
          <p class="text-[9px] text-black/60 uppercase tracking-[0.5px] mb-1">Por plan</p>
          <p class="text-[11px] text-black/80">
            <span v-for="(n, code) in stats.subscriptions_by_plan" :key="code" class="mr-2">{{ code }}: {{ n }}</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
