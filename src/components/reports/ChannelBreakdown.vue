<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ReportsChannelRow, ReportChannel } from '@/composables/useNotificationReports'
import GlassBlock from '@/components/ui/GlassBlock.vue'

const props = defineProps<{ channels: ReportsChannelRow[] }>()

const { t } = useI18n()

const DOT_CLASS: Record<ReportChannel, string> = {
  whatsapp: 'bg-wa-green',
  email: 'bg-brand-blue',
}

function barWidth(value: number): string {
  const max = Math.max(...props.channels.map((c) => c.sent), 1)
  return `${Math.round((value / max) * 100)}%`
}

function share(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%'
}
</script>

<template>
  <GlassBlock :title="t('reports.byChannel')">
    <div class="space-y-5">
      <div
        v-for="ch in channels"
        :key="ch.channel"
      >
        <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div class="flex items-center gap-2">
            <div
              class="w-2 h-2 rounded-full"
              :class="DOT_CLASS[ch.channel]"
            />
            <span class="text-[12px] font-semibold text-ink">{{ t(`reports.${ch.channel}`) }}</span>
          </div>
          <div class="flex items-center gap-3 text-[10px] flex-wrap">
            <span class="text-ink-3">{{ t('reports.sent') }} <strong class="text-ink">{{ ch.sent }}</strong></span>
            <span
              class="text-ink-3"
              :title="ch.tracks_delivery ? undefined : t('reports.notTracked')"
            >
              {{ t('reports.delivered') }}
              <strong class="text-wa-green">{{ ch.tracks_delivery ? ch.delivered : '—' }}</strong>
            </span>
            <span
              class="text-ink-3"
              :title="ch.tracks_delivery ? undefined : t('reports.notTracked')"
            >
              {{ t('reports.read') }}
              <strong class="text-brand-blue">{{ ch.tracks_delivery ? ch.read : '—' }}</strong>
            </span>
            <span class="text-ink-3">{{ t('reports.confirmed') }} <strong class="text-acid">{{ ch.confirmed }}</strong></span>
            <span class="text-ink-3">{{ t('reports.failed') }} <strong class="text-red-400">{{ ch.failed }}</strong></span>
          </div>
        </div>
        <!-- Enviados (relativo al canal con más envíos) y, debajo, leídos + entregados sobre enviados -->
        <div class="flex flex-col gap-1">
          <div class="relative h-[5px] bg-glass-2 rounded-full overflow-hidden">
            <div
              class="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              :class="DOT_CLASS[ch.channel]"
              :style="{ width: barWidth(ch.sent) }"
            />
          </div>
          <div class="relative h-[5px] bg-glass-2 rounded-full overflow-hidden flex">
            <div
              v-if="ch.tracks_delivery"
              class="h-full bg-brand-blue transition-all duration-700"
              :style="{ width: share(ch.read, ch.sent) }"
            />
            <div
              v-if="ch.tracks_delivery"
              class="h-full bg-wa-green transition-all duration-700"
              :style="{ width: share(ch.delivered - ch.read, ch.sent) }"
            />
          </div>
        </div>
      </div>
    </div>
  </GlassBlock>
</template>
