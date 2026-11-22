<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import type { ReportsSeriesPoint } from '@/composables/useNotificationReports'
import GlassBlock from '@/components/ui/GlassBlock.vue'

const props = defineProps<{ series: ReportsSeriesPoint[] }>()

const { t, locale } = useI18n()

const hovered = ref<number | null>(null)

/**
 * Tramo "enviados" de la columna: salieron pero ni consta la entrega ni fallaron después.
 * Quien salió y luego falló tiene `sent_at` y cuenta en `failed`: se resta para no contarlo dos
 * veces.
 */
function sentOnly(p: ReportsSeriesPoint): number {
  return Math.max(p.sent - p.delivered - p.failed, 0)
}

// Altura de cada columna: entregados + enviados sin entrega + fallidos.
const max = computed(() =>
  Math.max(...props.series.map((p) => p.delivered + sentOnly(p) + p.failed), 1)
)

// Con muchos días (gira completa, 90 días) el hueco de 1px desborda a 375px.
const dense = computed(() => props.series.length > 60)

function h(value: number): string {
  return `${(Math.max(value, 0) / max.value) * 100}%`
}

function shortDate(iso: string): string {
  return DateTime.fromISO(iso).setLocale(locale.value).toFormat('d LLL')
}

function longDate(iso: string): string {
  return DateTime.fromISO(iso).setLocale(locale.value).toFormat('ccc d LLL yyyy')
}

// ~6 etiquetas en el eje X, siempre la primera y la última.
const labelIdx = computed(() => {
  const n = props.series.length
  if (n <= 7) return new Set(props.series.map((_, i) => i))
  const step = Math.ceil(n / 6)
  const s = new Set<number>([0, n - 1])
  for (let i = step; i < n - 1; i += step) s.add(i)
  return s
})

// Línea de confirmados: viewBox de ancho N (una unidad por día) y alto 100.
const confirmedPoints = computed(() =>
  props.series
    .map((p, i) => `${i + 0.5},${100 - (p.confirmed / max.value) * 100}`)
    .join(' ')
)
const hasConfirmed = computed(() => props.series.some((p) => p.confirmed > 0))
const singlePointY = computed(() =>
  props.series.length === 1 ? 100 - (props.series[0].confirmed / max.value) * 100 : 0
)

function tooltip(p: ReportsSeriesPoint): string {
  return [
    longDate(p.date),
    `${t('reports.sent')}: ${p.sent}`,
    `${t('reports.delivered')}: ${p.delivered}`,
    `${t('reports.read')}: ${p.read}`,
    `${t('reports.confirmed')}: ${p.confirmed}`,
    `${t('reports.failed')}: ${p.failed}`,
  ].join('\n')
}

const hoveredPoint = computed(() =>
  hovered.value === null ? null : (props.series[hovered.value] ?? null)
)
</script>

<template>
  <GlassBlock :title="t('reports.daily')">
    <!-- Leyenda / detalle del día bajo el cursor -->
    <div class="flex items-center gap-3 flex-wrap text-[12px] text-ink-2 mb-3 min-h-[16px]">
      <template v-if="hoveredPoint">
        <span class="font-semibold text-ink font-time tnum">{{ longDate(hoveredPoint.date) }}</span>
        <span>{{ t('reports.sent') }} <strong class="text-ink">{{ hoveredPoint.sent }}</strong></span>
        <span>{{ t('reports.delivered') }} <strong class="text-wa-fg">{{ hoveredPoint.delivered }}</strong></span>
        <span>{{ t('reports.confirmed') }} <strong class="text-olive">{{ hoveredPoint.confirmed }}</strong></span>
        <span>{{ t('reports.failed') }} <strong class="text-failed-fg">{{ hoveredPoint.failed }}</strong></span>
      </template>
      <template v-else>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-wa-fg" />{{ t('reports.delivered') }}</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-line-2" />{{ t('reports.sent') }}</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-failed-fg" />{{ t('reports.failed') }}</span>
        <span class="flex items-center gap-1"><span class="w-3 h-[2px] bg-olive" />{{ t('reports.confirmed') }}</span>
      </template>
    </div>

    <div class="relative h-[140px]">
      <!-- Columnas apiladas -->
      <div
        class="absolute inset-0 flex items-end overflow-hidden"
        :class="dense ? '' : 'gap-px'"
      >
        <div
          v-for="(p, i) in series"
          :key="p.date"
          class="flex-1 h-full flex flex-col justify-end rounded-t-sm cursor-default transition-colors"
          :class="hovered === i ? 'bg-glass-hover' : ''"
          :title="tooltip(p)"
          @mouseenter="hovered = i"
          @mouseleave="hovered = null"
        >
          <div
            class="w-full bg-failed-fg"
            :style="{ height: h(p.failed) }"
          />
          <div
            class="w-full bg-line-2"
            :style="{ height: h(sentOnly(p)) }"
          />
          <div
            class="w-full bg-wa-fg"
            :style="{ height: h(p.delivered) }"
          />
        </div>
      </div>
      <!-- Línea de confirmados -->
      <svg
        v-if="hasConfirmed && series.length > 1"
        class="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        :viewBox="`0 0 ${series.length} 100`"
        preserveAspectRatio="none"
      >
        <polyline
          v-if="series.length > 1"
          :points="confirmedPoints"
          fill="none"
          stroke="var(--olive)"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
        />
      </svg>
      <!-- Un solo día: un punto (en el SVG estirado un círculo saldría deformado) -->
      <span
        v-if="hasConfirmed && series.length === 1"
        class="absolute left-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-olive pointer-events-none"
        :style="{ top: `${singlePointY}%` }"
      />
    </div>

    <!-- Eje X -->
    <div
      class="flex mt-1.5"
      :class="dense ? '' : 'gap-px'"
    >
      <div
        v-for="(p, i) in series"
        :key="p.date"
        class="flex-1 min-w-0 relative h-4"
      >
        <span
          v-if="labelIdx.has(i)"
          class="absolute top-0 text-[12px] text-ink-2 font-time tnum whitespace-nowrap"
          :class="i === 0 ? 'left-0' : i === series.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'"
        >
          {{ shortDate(p.date) }}
        </span>
      </div>
    </div>
  </GlassBlock>
</template>
