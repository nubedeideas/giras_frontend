<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import {
  useAdminTwilioCosts,
  type AdminTwilioCostsSummary,
  type TwilioDiscrepancy,
} from '@/composables/useAdminTwilioCosts'
import { useAuthStore } from '@/stores/auth'
import { formatMoney, formatMoneyDelta } from '@/utils/money'
import { formatRelativeTime } from '@/utils/relativeTime'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import TwilioCostsTourTable from '@/components/admin/TwilioCostsTourTable.vue'
import TwilioDiscrepanciesPanel from '@/components/admin/TwilioDiscrepanciesPanel.vue'

/** `tour`: uuid de `?tour=` (enlace desde Informes), filtro inicial de discrepancias. */
const props = defineProps<{ tour?: string | null }>()
const emit = defineEmits<{ clearTour: [] }>()

const { t, locale } = useI18n()
const api = useAdminTwilioCosts()
const auth = useAuthStore()
const discrepanciesPanel = ref<InstanceType<typeof TwilioDiscrepanciesPanel> | null>(null)

const tourName = computed(() => {
  if (!props.tour) return null
  const row = summary.value?.tours.find((x) => x.tour_uuid === props.tour)
  return row ? [row.artist_name, row.tour_name].filter(Boolean).join(' — ') : null
})

/** Recarga del resumen después de encolar una sincronización. */
const RELOAD_AFTER_SYNC_MS = 30_000

// ─── Mes (UTC, como la factura de Twilio) ─────────────────────────────────────

const currentMonth = DateTime.utc().startOf('month')
const month = ref<DateTime>(currentMonth)
const monthParam = computed(() => month.value.toFormat('yyyy-MM'))
const canGoNext = computed(() => month.value < DateTime.utc().startOf('month'))
const monthLabel = computed(() => month.value.setLocale(locale.value).toFormat('LLLL yyyy'))

function prevMonth() {
  month.value = month.value.minus({ months: 1 })
  load()
}

function nextMonth() {
  if (!canGoNext.value) return
  month.value = month.value.plus({ months: 1 })
  load()
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

const summary = ref<AdminTwilioCostsSummary | null>(null)
const loading = ref(false)
const loadError = ref('')
let requestId = 0

async function load() {
  const id = ++requestId
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.getSummary(monthParam.value)
    if (id !== requestId) return
    summary.value = data
  } catch (e) {
    if (id !== requestId) return
    summary.value = null
    loadError.value = e instanceof Error && e.message ? e.message : t('admin.costs.error')
  } finally {
    if (id === requestId) loading.value = false
  }
}

onMounted(load)

const currency = computed(() => summary.value?.currency ?? 'USD')

function money(amount: string | null): string {
  return formatMoney(amount, currency.value, locale.value)
}

const cards = computed(() => {
  const s = summary.value
  if (!s) return []
  return [
    {
      key: 'totalMonth',
      value: money(s.totals.amount),
      sub: t('admin.costs.vsPrevious', {
        delta: formatMoneyDelta(s.totals.amount, s.previous_month_amount, s.currency, locale.value),
      }),
    },
    { key: 'messages', value: String(s.totals.messages), sub: '' },
    {
      key: 'unattributed',
      value: String(s.totals.unattributed_messages),
      sub: money(s.totals.unattributed_amount),
    },
    {
      key: 'inbound',
      value: String(s.totals.inbound_messages),
      sub: money(s.totals.inbound_amount),
    },
    { key: 'pendingPrice', value: String(s.totals.pending_price_messages), sub: '' },
    { key: 'openDiscrepancies', value: String(s.open_discrepancies.total), sub: '' },
  ]
})

// ─── Última sincronización ────────────────────────────────────────────────────

function utcShort(iso: string): string {
  const d = DateTime.fromISO(iso, { zone: 'utc' })
  return d.isValid ? `${d.setLocale(locale.value).toFormat('d LLL HH:mm')} UTC` : iso
}

const lastSync = computed(() => {
  const ls = summary.value?.last_sync
  if (!ls) return null
  const statusKey = `admin.costs.syncStatus.${ls.status}`
  return {
    text: t('admin.costs.lastSync', {
      status: t(statusKey),
      when: formatRelativeTime(ls.finished_at ?? ls.started_at, locale.value, t('admin.costs.now')),
    }),
    window: t('admin.costs.syncWindow', {
      from: utcShort(ls.window_start),
      to: utcShort(ls.window_end),
    }),
    error:
      ls.error && ls.status !== 'success' ? t('admin.costs.syncError', { error: ls.error }) : '',
    failed: ls.status === 'failed',
  }
})

const syncing = ref(false)
const syncNotice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)
let reloadTimer: ReturnType<typeof setTimeout> | null = null

async function syncNow() {
  if (syncing.value) return
  syncing.value = true
  syncNotice.value = null
  try {
    await api.triggerSync()
    syncNotice.value = { kind: 'ok', text: t('admin.costs.syncQueued') }
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => {
      reloadTimer = null
      load()
      discrepanciesPanel.value?.reload()
    }, RELOAD_AFTER_SYNC_MS)
  } catch (e) {
    // 409 y 503 llegan con su mensaje (`statusMessages` del composable).
    syncNotice.value = {
      kind: 'error',
      text: e instanceof Error && e.message ? e.message : t('admin.costs.error'),
    }
  } finally {
    syncing.value = false
  }
}

onBeforeUnmount(() => {
  if (reloadTimer) clearTimeout(reloadTimer)
  requestId++
})

/**
 * Al revisar una discrepancia que estaba abierta, baja el contador sin recargar. Si la revisó
 * otro superusuario antes (la respuesta trae otro email), el contador puede estar desfasado:
 * se recarga el resumen.
 */
function onAcknowledged(item: TwilioDiscrepancy, previousStatus: TwilioDiscrepancy['status']) {
  const byOther =
    !!item.acknowledged_by_email &&
    !!auth.user?.email &&
    item.acknowledged_by_email !== auth.user.email
  if (byOther) {
    load()
    return
  }
  const s = summary.value
  if (previousStatus === 'open' && s && s.open_discrepancies.total > 0) {
    s.open_discrepancies.total--
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="px-4 py-4 space-y-4 max-w-6xl">
      <!-- Cabecera: título, mes y sincronización -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <p class="text-base font-bold text-ink tracking-[-0.2px]">
          {{ t('admin.costs.title') }}
        </p>
        <div
          class="flex items-center gap-1 bg-bg-2 border border-line rounded-full p-1"
          role="group"
          :aria-label="t('admin.costs.month')"
        >
          <button
            data-testid="month-prev"
            class="w-7 h-7 rounded-full border-none bg-transparent text-ink-2 hover:text-ink hover:bg-glass-hover cursor-pointer"
            :aria-label="t('admin.costs.prevMonth')"
            @click="prevMonth"
          >
            ‹
          </button>
          <span
            data-testid="month-label"
            class="text-[14px] font-medium text-ink px-2 min-w-[120px] text-center"
          >{{ monthLabel }}</span>
          <button
            data-testid="month-next"
            class="w-7 h-7 rounded-full border-none bg-transparent text-ink-2 hover:text-ink hover:bg-glass-hover cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            :aria-label="t('admin.costs.nextMonth')"
            :disabled="!canGoNext"
            @click="nextMonth"
          >
            ›
          </button>
        </div>
      </div>

      <!-- Carga -->
      <div
        v-if="loading && !summary"
        class="grid grid-cols-2 sm:grid-cols-3 gap-2"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="h-20 rounded-lg bg-bg-2 border border-line animate-pulse"
        />
      </div>

      <!-- Error -->
      <div
        v-else-if="loadError"
        data-testid="summary-error"
        class="bg-bg-3 border border-line rounded-lg p-6 flex flex-col items-center gap-3 text-center"
      >
        <p class="text-[14px] text-failed-fg whitespace-pre-line">
          {{ loadError }}
        </p>
        <BtnSecondary @click="load">
          {{ t('admin.costs.retry') }}
        </BtnSecondary>
      </div>

      <template v-else-if="summary">
        <div
          class="space-y-4 transition-opacity"
          :class="loading ? 'opacity-60' : ''"
        >
          <!-- Tarjetas -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div
              v-for="c in cards"
              :key="c.key"
              :data-testid="`card-${c.key}`"
              class="bg-glass border border-line rounded-lg p-3 min-w-0"
            >
              <p class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase truncate">
                {{ t(`admin.costs.${c.key}`) }}
              </p>
              <p class="text-[18px] font-bold text-ink mt-1 truncate">
                {{ c.value }}
              </p>
              <p
                v-if="c.sub"
                class="text-[12px] text-ink-4 truncate"
                :title="c.sub"
              >
                {{ c.sub }}
              </p>
            </div>
          </div>

          <!-- Sincronización -->
          <div
            class="bg-bg-3 border border-line rounded-lg p-[14px_16px] flex items-start justify-between gap-3 flex-wrap"
          >
            <div
              data-testid="last-sync"
              class="min-w-0 flex flex-col gap-0.5"
            >
              <template v-if="lastSync">
                <p
                  class="text-[14px] font-semibold"
                  :class="lastSync.failed ? 'text-failed-fg' : 'text-ink'"
                >
                  {{ lastSync.text }}
                </p>
                <p class="text-[12px] text-ink-4">
                  {{ lastSync.window }}
                </p>
                <p
                  v-if="lastSync.error"
                  class="text-[12px] text-failed-fg break-words"
                >
                  {{ lastSync.error }}
                </p>
              </template>
              <p
                v-else
                class="text-[14px] text-ink-3"
              >
                {{ t('admin.costs.neverSynced') }}
              </p>
              <p
                v-if="syncNotice"
                data-testid="sync-notice"
                role="status"
                class="text-[13px] mt-1"
                :class="syncNotice.kind === 'ok' ? 'text-olive' : 'text-brand-orange'"
              >
                {{ syncNotice.text }}
              </p>
            </div>
            <BtnPrimary
              data-testid="sync-now"
              :disabled="syncing"
              :class="syncing ? 'opacity-60 pointer-events-none' : ''"
              @click="syncNow"
            >
              {{ t('admin.costs.syncNow') }}
            </BtnPrimary>
          </div>

          <TwilioCostsTourTable
            :tours="summary.tours"
            :currency="summary.currency"
            :truncated="summary.tours_truncated"
          />
        </div>
      </template>

      <TwilioDiscrepanciesPanel
        ref="discrepanciesPanel"
        :currency="currency"
        :tour="props.tour"
        :tour-name="tourName"
        @acknowledged="onAcknowledged"
        @clear-tour="emit('clearTour')"
      />
    </div>
  </div>
</template>
