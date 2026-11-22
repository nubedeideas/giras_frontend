<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import {
  useNotificationReports,
  rangeForPreset,
  REPORTS_MAX_RANGE_DAYS,
  type ReportChannel,
  type ReportRangePreset,
  type ReportsSummary,
} from '@/composables/useNotificationReports'
import { browserZone } from '@/utils/datetime'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import ChannelBreakdown from '@/components/reports/ChannelBreakdown.vue'
import RecentNotifications from '@/components/reports/RecentNotifications.vue'
import ReportsSummaryPanel from '@/components/reports/ReportsSummaryPanel.vue'
import DailySeriesChart from '@/components/reports/DailySeriesChart.vue'
import TypeBreakdown from '@/components/reports/TypeBreakdown.vue'
import FailuresPanel from '@/components/reports/FailuresPanel.vue'
import CostPanel from '@/components/reports/CostPanel.vue'

const { t } = useI18n()
const toursStore = useToursStore()
const auth = useAuthStore()
const reportsApi = useNotificationReports()
const zone = browserZone()

// ─── Filtros ──────────────────────────────────────────────────────────────────

const selectedTour = ref<string>(toursStore.activeTour?.uuid ?? '')
const rangePreset = ref<ReportRangePreset>('last30')
const channel = ref<ReportChannel | ''>('')

const RANGE_PRESETS: ReportRangePreset[] = ['last7', 'last30', 'last90', 'fullTour']
const CHANNELS: Array<ReportChannel | ''> = ['', 'whatsapp', 'email']

const tourObj = computed(() =>
  selectedTour.value ? (toursStore.tours.find((x) => x.uuid === selectedTour.value) ?? null) : null
)

/** Motivo por el que "Gira completa" no está disponible ('' si lo está). */
const fullTourDisabledReason = computed(() => {
  if (!tourObj.value) return t('reports.ranges.fullTourNeedsTour')
  const start = DateTime.fromISO(tourObj.value.start_date)
  const end = DateTime.fromISO(tourObj.value.end_date)
  if (!start.isValid || !end.isValid || start > end) return t('reports.ranges.fullTourNeedsTour')
  if (Math.round(end.diff(start, 'days').days) + 1 > REPORTS_MAX_RANGE_DAYS) {
    return t('reports.ranges.fullTourTooLong')
  }
  return ''
})

// Si se quita la gira (o deja de caber), "Gira completa" vuelve al preset por defecto.
watch(fullTourDisabledReason, (reason) => {
  if (reason && rangePreset.value === 'fullTour') rangePreset.value = 'last30'
})

// Los tours se cargan en AppLayout: si al entrar aún no estaban, se adopta la gira activa
// mientras el usuario no haya tocado el filtro.
let tourTouched = false
watch(
  () => toursStore.activeTour?.uuid,
  (uuid) => {
    if (uuid && !tourTouched) selectedTour.value = uuid
  }
)

// ─── Carga ────────────────────────────────────────────────────────────────────

const summary = ref<ReportsSummary | null>(null)
/** Filtros con los que carga `CostPanel`: se fijan en `load()`, así comparte el debounce. */
const costParams = ref<{ tour: string; from?: string; to?: string } | null>(null)

// Decisión de Oscar (2026-11-21): el coste solo lo ve el superusuario (`current_user_is_admin`
// no cuenta) y solo con una gira seleccionada.
const showCosts = computed(() => !!selectedTour.value && auth.user?.is_superuser === true)
const loading = ref(false)
const error = ref('')
let requestId = 0
let debounce: ReturnType<typeof setTimeout> | null = null

async function load() {
  const id = ++requestId
  const range = rangeForPreset(rangePreset.value, zone, tourObj.value)
  loading.value = true
  error.value = ''
  costParams.value = selectedTour.value
    ? { tour: selectedTour.value, from: range?.from, to: range?.to }
    : null
  try {
    const data = await reportsApi.getSummary({
      tour: selectedTour.value || undefined,
      channel: channel.value || undefined,
      from: range?.from,
      to: range?.to,
      tz: zone,
    })
    if (id !== requestId) return
    summary.value = data
  } catch (e) {
    if (id !== requestId) return
    summary.value = null
    error.value = e instanceof Error && e.message ? e.message : t('reports.error')
  } finally {
    if (id === requestId) loading.value = false
  }
}

function scheduleLoad() {
  if (debounce) clearTimeout(debounce)
  // Invalida ya la petición en vuelo: su respuesta es de filtros anteriores.
  requestId++
  loading.value = true
  debounce = setTimeout(() => {
    debounce = null
    load()
  }, 250)
}

watch([selectedTour, rangePreset, channel], scheduleLoad, { immediate: true })

onBeforeUnmount(() => {
  if (debounce) clearTimeout(debounce)
  requestId++
})

function markTourTouched() {
  tourTouched = true
}

function toggleTour(uuid: string) {
  markTourTouched()
  selectedTour.value = selectedTour.value === uuid ? '' : uuid
}

const isEmpty = computed(() => !!summary.value && summary.value.totals.recipients === 0)

const selectClass =
  'min-h-[44px] lg:min-h-0 bg-bg-3 border border-line rounded-full px-4 py-2 text-[14px] font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-olive cursor-pointer max-w-full'
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <!-- Subtítulo + filtros -->
      <div class="flex flex-col gap-3 mb-6">
        <p class="text-[14px] text-ink-3">
          {{ t('reports.subtitle') }}
        </p>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Gira -->
          <select
            v-model="selectedTour"
            :class="selectClass"
            :aria-label="t('reports.filters.tour')"
            @change="markTourTouched"
          >
            <option value="">
              {{ t('reports.allTours') }}
            </option>
            <option
              v-for="tour in toursStore.tours"
              :key="tour.uuid"
              :value="tour.uuid"
            >
              {{ tour.artist_name }} — {{ tour.name }}
            </option>
          </select>

          <!-- Periodo -->
          <select
            v-model="rangePreset"
            :class="selectClass"
            :aria-label="t('reports.filters.range')"
          >
            <option
              v-for="p in RANGE_PRESETS"
              :key="p"
              :value="p"
              :disabled="p === 'fullTour' && !!fullTourDisabledReason"
              :title="p === 'fullTour' && fullTourDisabledReason ? fullTourDisabledReason : undefined"
            >
              {{ t(`reports.ranges.${p}`) }}
            </option>
          </select>

          <!-- Canal -->
          <div
            class="flex items-center gap-1 bg-glass-hover rounded-[10px] p-1"
            role="group"
            :aria-label="t('reports.filters.channel')"
          >
            <button
              v-for="c in CHANNELS"
              :key="c || 'all'"
              class="min-h-[44px] lg:min-h-[32px] px-3 py-1 rounded-[7px] text-[13px] border-none cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
              :class="channel === c ? 'bg-bg-3 text-ink shadow-sm font-semibold' : 'bg-transparent text-ink-2 font-medium hover:text-ink'"
              @click="channel = c"
            >
              {{ c ? t(`reports.${c}`) : t('reports.filters.allChannels') }}
            </button>
          </div>
        </div>
        <p
          v-if="rangePreset !== 'fullTour' && fullTourDisabledReason && selectedTour"
          class="text-[12px] text-ink-4"
        >
          {{ fullTourDisabledReason }}
        </p>
      </div>

      <!-- Error -->
      <div
        v-if="error && !loading"
        class="bg-bg-3 border border-line rounded-lg p-6 flex flex-col items-center gap-3 text-center"
      >
        <p class="text-[15px] font-semibold text-ink">
          {{ t('reports.error') }}
        </p>
        <p class="text-[14px] text-failed-fg whitespace-pre-line">
          {{ error }}
        </p>
        <BtnSecondary @click="load">
          {{ t('reports.retry') }}
        </BtnSecondary>
      </div>

      <!-- Carga (esqueletos) -->
      <div
        v-else-if="loading && !summary"
        class="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        <div class="lg:col-span-2 space-y-4">
          <div
            v-for="i in 3"
            :key="i"
            class="h-40 rounded-lg bg-bg-2 border border-line animate-pulse"
          />
        </div>
        <div class="h-80 rounded-lg bg-bg-2 border border-line animate-pulse" />
      </div>

      <template v-else-if="summary">
        <!-- Vacío -->
        <div
          v-if="isEmpty"
          class="bg-bg-3 border border-line rounded-lg p-8 text-center transition-opacity"
          :class="loading ? 'opacity-60' : ''"
        >
          <p class="text-[15px] text-ink-2">
            {{ t('reports.empty') }}
          </p>
        </div>

        <div
          v-else
          class="grid grid-cols-1 lg:grid-cols-3 gap-4 transition-opacity"
          :class="loading ? 'opacity-60 pointer-events-none' : ''"
        >
          <!-- Columna principal -->
          <div class="lg:col-span-2 min-w-0">
            <DailySeriesChart :series="summary.series" />
            <ChannelBreakdown :channels="summary.by_channel" />
            <TypeBreakdown
              v-if="summary.by_type.length"
              :types="summary.by_type"
            />

            <!-- Por gira -->
            <div
              v-if="summary.by_tour.length"
              class="bg-bg-3 border border-line rounded-lg shadow-[0_1px_3px_var(--shadow-sm)] p-[14px_16px] mb-3"
            >
              <p class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase mb-2.5">
                {{ t('reports.byTour') }}
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="row in summary.by_tour"
                  :key="row.tour_uuid"
                  class="text-left p-3 min-h-[44px] rounded-lg bg-bg-2 border cursor-pointer transition-all hover:border-line-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
                  :class="selectedTour === row.tour_uuid ? 'border-line-acid bg-glass-active' : 'border-line'"
                  :title="t('reports.filterByTour')"
                  @click="toggleTour(row.tour_uuid)"
                >
                  <p class="text-[14px] font-semibold text-ink truncate">
                    {{ row.artist_name || row.tour_name }}
                  </p>
                  <p
                    v-if="row.artist_name"
                    class="text-[12px] text-ink-3 truncate mb-2"
                  >
                    {{ row.tour_name }}
                  </p>
                  <div class="flex gap-3 text-[12px] flex-wrap">
                    <span class="text-ink-3">{{ t('reports.notificationsCount', row.notifications) }}</span>
                    <span class="text-ink-2 font-semibold">{{ t('reports.sentCount', row.sent) }}</span>
                    <span class="text-olive font-semibold">{{ t('reports.confirmedCount', row.confirmed) }}</span>
                  </div>
                </button>
              </div>
            </div>

            <RecentNotifications :notifications="summary.recent_notifications" />
          </div>

          <!-- Columna lateral -->
          <div class="min-w-0 space-y-4">
            <ReportsSummaryPanel
              :title="t('reports.title')"
              :totals="summary.totals"
              :rates="summary.rates"
              :notifications-total="summary.notifications.total"
              :crew-portal="summary.crew_portal"
            />
            <FailuresPanel
              :contacts="summary.top_failed_contacts"
              :reasons="summary.failure_reasons"
            />
          </div>
        </div>
      </template>

      <!-- Coste de WhatsApp (solo superusuario): independiente del resumen, para que no
           desaparezca si el resumen está vacío (p. ej. filtro de canal) o falla. -->
      <div
        v-if="showCosts && costParams"
        data-testid="cost-zone"
        class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4"
      >
        <div class="min-w-0 lg:col-start-3">
          <CostPanel
            :tour="costParams.tour"
            :from="costParams.from"
            :to="costParams.to"
            :tz="zone"
          />
        </div>
      </div>
    </div>
  </div>
</template>
