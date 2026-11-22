<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { RouterLink } from 'vue-router'
import DashboardBlock from './DashboardBlock.vue'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import {
  rangeForPreset,
  useNotificationReports,
  type ReportsSummary,
} from '@/composables/useNotificationReports'
import { sendsBars, sendsFigures } from '@/utils/dashboard'

/**
 * "Envíos · 7 días": una llamada a `reports/summary` por gira (miembro), con el rango y los días
 * en la zona de la gira (`zone`, la calcula la vista; `null` = aún no se sabe, se espera).
 */
const props = defineProps<{ zone: string | null }>()

const { t, locale } = useI18n()
const tours = useToursStore()
const auth = useAuthStore()
const api = useNotificationReports()

const summary = ref<ReportsSummary | null>(null)
const loading = ref(false)
const error = ref(false)

let request = 0

async function load(uuid: string | null, zone: string | null) {
  const req = ++request
  summary.value = null
  error.value = false
  if (!uuid || auth.isDemoMode) {
    loading.value = false
    return
  }
  loading.value = true
  if (!zone) return
  try {
    const range = rangeForPreset('last7', zone)!
    const data = await api.getSummary({ tour: uuid, ...range, tz: zone })
    if (req !== request) return
    summary.value = data
  } catch {
    if (req !== request) return
    error.value = true
  } finally {
    if (req === request) loading.value = false
  }
}

watch(
  () => [tours.activeTour?.uuid ?? null, props.zone] as const,
  ([uuid, zone]) => void load(uuid, zone),
  { immediate: true }
)

const figures = computed(() => (summary.value ? sendsFigures(summary.value) : null))
const bars = computed(() => (summary.value ? sendsBars(summary.value.series ?? []) : []))
const empty = computed(() => !summary.value || summary.value.notifications.total === 0)

function weekday(date: string): string {
  const d = DateTime.fromISO(date).setLocale(locale.value === 'es' ? 'es-ES' : 'en-GB')
  return d.isValid ? d.toFormat('ccccc') : ''
}

function longDate(date: string): string {
  const d = DateTime.fromISO(date).setLocale(locale.value === 'es' ? 'es-ES' : 'en-GB')
  return d.isValid ? d.toFormat('d LLL') : date
}
</script>

<template>
  <DashboardBlock
    :title="t('dashboard.sends.title')"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && empty"
    data-testid="dashboard-sends"
    @retry="load(tours.activeTour?.uuid ?? null, zone)"
  >
    <template #action>
      <RouterLink
        to="/reports"
        class="inline-flex items-center min-h-[44px] lg:min-h-0 px-1 text-[14px] font-semibold text-olive hover:text-olive-strong no-underline"
      >
        {{ t('dashboard.sends.viewReports') }}
      </RouterLink>
    </template>

    <template #empty>
      <p class="min-h-[44px] flex items-center text-[15px] text-ink-2">
        {{ t('dashboard.sends.empty') }}
      </p>
    </template>

    <div v-if="figures">
      <dl class="grid grid-cols-3 gap-2 mb-4">
        <div class="min-w-0">
          <dt class="text-[12px] text-ink-2 truncate">
            {{ t('dashboard.sends.sent') }}
          </dt>
          <dd
            class="font-time tnum text-[22px] font-bold text-ink"
            data-testid="sends-sent"
          >
            {{ figures.sent }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="text-[12px] text-ink-2 truncate">
            {{ t('dashboard.sends.delivered') }}
          </dt>
          <dd class="font-time tnum text-[22px] font-bold text-ink">
            {{ figures.delivered }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="text-[12px] text-ink-2 truncate">
            {{ t('dashboard.sends.failed') }}
          </dt>
          <dd
            class="font-time tnum text-[22px] font-bold"
            :class="figures.failed > 0 ? 'text-failed-fg' : 'text-ink'"
          >
            {{ figures.failed }}
          </dd>
        </div>
      </dl>
      <ul
        class="flex items-end gap-1.5 h-[72px]"
        data-testid="sends-bars"
      >
        <li
          v-for="b in bars"
          :key="b.date"
          class="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1"
          :title="t('dashboard.sends.barTitle', { date: longDate(b.date), n: b.sent }, b.sent)"
        >
          <span class="w-full flex-1 flex items-end">
            <span
              class="block w-full rounded-t-sm"
              :class="b.sent > 0 ? 'bg-olive' : 'bg-bg-4'"
              :style="{ height: `${Math.max(b.height, 4)}%` }"
            />
          </span>
          <span class="font-time text-[11px] text-ink-2 uppercase leading-none">{{ weekday(b.date) }}</span>
        </li>
      </ul>
    </div>
  </DashboardBlock>
</template>
