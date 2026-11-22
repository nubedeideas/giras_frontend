<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { useTwilioCosts, type TourCostsReport } from '@/composables/useTwilioCosts'
import { ApiError } from '@/utils/apiClient'
import { formatMoney } from '@/utils/money'
import { formatRelativeTime } from '@/utils/relativeTime'
import GlassBlock from '@/components/ui/GlassBlock.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

/**
 * Coste de WhatsApp de una gira (bloque 3.5). Solo lo monta `ReportsView` para superusuarios;
 * si el backend responde 403 o 404 (rol cambiado a mitad de sesión, gira borrada) el panel no
 * se pinta y no enseña error.
 */
const props = defineProps<{
  tour: string
  from?: string
  to?: string
  tz: string
}>()

const { t, te, locale } = useI18n()
const api = useTwilioCosts()

const report = ref<TourCostsReport | null>(null)
const loading = ref(false)
const error = ref('')
const hidden = ref(false)
let requestId = 0

async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const data = await api.getTourCosts({
      tour: props.tour,
      from: props.from,
      to: props.to,
      tz: props.tz,
    })
    if (id !== requestId) return
    report.value = data
    hidden.value = false
  } catch (e) {
    if (id !== requestId) return
    report.value = null
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
      hidden.value = true
      return
    }
    error.value = e instanceof Error && e.message ? e.message : t('reports.costs.error')
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(() => [props.tour, props.from, props.to, props.tz], load, { immediate: true })

onBeforeUnmount(() => {
  requestId++
})

const currency = computed(() => report.value?.currency ?? 'USD')

function money(amount: string | null): string {
  return formatMoney(amount, currency.value, locale.value)
}

const isEmpty = computed(
  () =>
    !!report.value &&
    report.value.totals.whatsapp_messages === 0 &&
    report.value.totals.email_messages === 0
)

function monthLabel(month: string): string {
  const d = DateTime.fromFormat(month, 'yyyy-MM', { locale: locale.value })
  return d.isValid ? d.toFormat('LLL yyyy') : month
}

const maxMonthAmount = computed(() =>
  Math.max(...(report.value?.by_month ?? []).map((m) => Number(m.amount) || 0), 0)
)

function barWidth(amount: string): string {
  const max = maxMonthAmount.value
  if (max <= 0) return '0%'
  return `${Math.round(((Number(amount) || 0) / max) * 100)}%`
}

const topTypes = computed(() => (report.value?.by_type ?? []).slice(0, 5))

function typeLabel(type: string | null): string {
  if (!type) return t('reports.costs.unknownType')
  const key = `reports.types.${type}`
  return te(key) ? t(key) : type
}

const messagesLine = computed(() => {
  const totals = report.value?.totals
  if (!totals) return ''
  const n = totals.whatsapp_messages
  const parts = [t('reports.costs.messages', { n }, n)]
  if (totals.avg_amount !== null) {
    parts.push(t('reports.costs.average', { amount: money(totals.avg_amount) }))
  }
  return parts.join(' · ')
})

const updatedLabel = computed(() => {
  const at = report.value?.synced_at
  if (!at) return t('reports.costs.neverSynced')
  const when = formatRelativeTime(at, locale.value, t('reports.costs.now'))
  return t('reports.costs.updated', { when })
})
</script>

<template>
  <template v-if="!hidden">
    <div
      v-if="loading && !report"
      data-testid="cost-skeleton"
      class="h-40 rounded-lg bg-bg-2 border border-line animate-pulse"
    />

    <GlassBlock
      v-else-if="error"
      :title="t('reports.costs.title')"
    >
      <div
        data-testid="cost-error"
        class="flex flex-col items-center gap-2 text-center py-1"
      >
        <p class="text-[14px] text-failed-fg whitespace-pre-line">
          {{ error }}
        </p>
        <BtnSecondary @click="load">
          {{ t('reports.retry') }}
        </BtnSecondary>
      </div>
    </GlassBlock>

    <GlassBlock
      v-else-if="report"
      :title="t('reports.costs.title')"
    >
      <div
        data-testid="cost-panel"
        class="transition-opacity"
        :class="loading ? 'opacity-60' : ''"
      >
        <p
          v-if="isEmpty"
          data-testid="cost-empty"
          class="text-[14px] text-ink-3 text-center py-2"
        >
          {{ t('reports.costs.empty') }}
        </p>

        <template v-else>
          <p
            data-testid="cost-total"
            class="text-[24px] font-bold text-ink tracking-[-0.5px] leading-tight"
          >
            {{ money(report.totals.amount) }}
          </p>
          <p
            data-testid="cost-messages"
            class="text-[13px] text-ink-3 mt-0.5"
          >
            {{ messagesLine }}
          </p>
          <p
            data-testid="cost-email"
            class="text-[13px] text-ink-4 mt-0.5"
          >
            {{ t('reports.costs.email', { n: report.totals.email_messages }, report.totals.email_messages) }}
          </p>
          <p
            v-if="report.totals.pending_price_messages > 0"
            data-testid="cost-pending"
            class="text-[13px] text-brand-orange mt-1"
          >
            {{
              t(
                'reports.costs.pendingPrice',
                { n: report.totals.pending_price_messages },
                report.totals.pending_price_messages
              )
            }}
          </p>

          <!-- Por mes -->
          <template v-if="report.by_month.length">
            <p class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] mt-4 mb-2">
              {{ t('reports.costs.byMonth') }}
            </p>
            <div class="flex flex-col gap-2">
              <div
                v-for="m in report.by_month"
                :key="m.month"
                data-testid="cost-month"
              >
                <div class="flex items-center justify-between gap-2 text-[13px] mb-1">
                  <span class="text-ink-2 capitalize">{{ monthLabel(m.month) }}</span>
                  <span class="text-ink font-semibold">{{ money(m.amount) }}</span>
                </div>
                <div class="relative h-[5px] bg-glass-2 rounded-full overflow-hidden">
                  <div
                    class="absolute left-0 top-0 h-full rounded-full bg-wa-green transition-all duration-700"
                    :style="{ width: barWidth(m.amount) }"
                  />
                </div>
              </div>
            </div>
          </template>

          <!-- Por tipo (top 5) -->
          <template v-if="topTypes.length">
            <p class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] mt-4 mb-2">
              {{ t('reports.costs.byType') }}
            </p>
            <div class="flex flex-col gap-1">
              <div
                v-for="row in topTypes"
                :key="row.notification_type ?? '__none__'"
                data-testid="cost-type"
                class="flex items-start justify-between gap-3 text-[13px]"
              >
                <span class="text-ink-2 break-words min-w-0">{{ typeLabel(row.notification_type) }}</span>
                <span class="font-semibold text-ink flex-shrink-0">{{ money(row.amount) }}</span>
              </div>
            </div>
          </template>
        </template>

        <!-- Pie -->
        <div class="mt-4 pt-3 border-t border-line flex flex-col gap-1">
          <p
            data-testid="cost-updated"
            class="text-[12px] text-ink-4"
          >
            {{ updatedLabel }}
          </p>
          <p
            v-if="report.last_sync_status === 'failed'"
            data-testid="cost-sync-failed"
            class="text-[12px] text-failed-fg"
          >
            {{ t('reports.costs.syncFailed') }}
          </p>
          <RouterLink
            v-if="typeof report.open_discrepancies === 'number' && report.open_discrepancies > 0"
            data-testid="cost-discrepancies"
            :to="{ path: '/admin', query: { tab: 'costs', tour: props.tour } }"
            class="text-[13px] font-semibold text-olive no-underline hover:underline"
          >
            {{ t('reports.costs.discrepancies', { n: report.open_discrepancies }, report.open_discrepancies) }}
          </RouterLink>
        </div>
      </div>
    </GlassBlock>
  </template>
</template>
