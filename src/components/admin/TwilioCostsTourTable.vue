<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TwilioCostsTourRow } from '@/composables/useAdminTwilioCosts'
import { formatMoney } from '@/utils/money'
import Pill from '@/components/ui/Pill.vue'

const props = defineProps<{
  tours: TwilioCostsTourRow[]
  currency: string
  truncated: boolean
}>()

const { t, locale } = useI18n()

type SortKey = 'amount_month' | 'amount_total' | 'margin_total'
const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: 'amount_month', label: 'admin.costs.table.costMonth' },
  { key: 'amount_total', label: 'admin.costs.table.costTotal' },
  { key: 'margin_total', label: 'admin.costs.table.margin' },
]
const sortKey = ref<SortKey>('amount_month')

/** Orden descendente; los márgenes `null` van al final. */
const sorted = computed(() =>
  [...props.tours].sort((a, b) => {
    const av = a[sortKey.value]
    const bv = b[sortKey.value]
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return Number(bv) - Number(av)
  })
)

function money(amount: string | null, currency?: string | null): string {
  return formatMoney(amount, currency || props.currency, locale.value)
}

/** Sin pagos `paid_currency` es `null`: se usa la del plan. `MIXED` suma monedas distintas. */
function paid(row: TwilioCostsTourRow): string {
  if (row.paid_currency === 'MIXED') return '—'
  return money(row.paid_amount, row.paid_currency ?? row.plan_currency)
}

function isNegative(amount: string | number | null): boolean {
  return amount !== null && Number(amount) < 0
}

function usage(row: TwilioCostsTourRow): string {
  if (row.notifications_used === null) return '—'
  if (row.notification_limit === null) return String(row.notifications_used)
  const limit =
    row.notification_limit === 0 ? t('admin.costs.table.unlimited') : row.notification_limit
  return `${row.notifications_used} / ${limit}`
}

function pct(value: number | null): string {
  if (value === null) return '—'
  return `${new Intl.NumberFormat(locale.value, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} %`
}

const th = 'font-semibold py-1.5 px-2 whitespace-nowrap'
</script>

<template>
  <div class="bg-bg-3 border border-line rounded-lg p-[14px_16px]">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-2.5">
      <p class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
        {{ t('admin.costs.table.title') }}
      </p>
      <div
        class="flex items-center gap-1 bg-bg-2 border border-line rounded-full p-1"
        role="group"
        :aria-label="t('admin.costs.table.sortBy')"
      >
        <button
          v-for="s in SORT_KEYS"
          :key="s.key"
          :data-testid="`sort-${s.key}`"
          class="px-2.5 py-0.5 rounded-full text-[12px] font-medium border-none cursor-pointer transition-colors"
          :class="sortKey === s.key ? 'bg-acid text-ink' : 'bg-transparent text-ink-3 hover:text-ink'"
          :aria-pressed="sortKey === s.key"
          @click="sortKey = s.key"
        >
          {{ t(s.label) }}
        </button>
      </div>
    </div>

    <p
      v-if="!tours.length"
      class="text-[14px] text-ink-4 text-center py-4"
    >
      {{ t('admin.costs.table.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto -mx-2"
    >
      <table class="w-full text-[13px] min-w-[880px]">
        <thead>
          <tr class="text-[11px] text-ink-2 uppercase tracking-[0.5px]">
            <th :class="[th, 'text-left']">
              {{ t('admin.costs.table.tour') }}
            </th>
            <th :class="[th, 'text-left']">
              {{ t('admin.costs.table.owner') }}
            </th>
            <th :class="[th, 'text-left']">
              {{ t('admin.costs.table.plan') }}
            </th>
            <th :class="[th, 'text-right']">
              {{ t('admin.costs.table.paid') }}
            </th>
            <th :class="[th, 'text-right']">
              {{ t('admin.costs.table.usage') }}
            </th>
            <th :class="[th, 'text-right']">
              {{ t('admin.costs.table.messagesMonth') }}
            </th>
            <th :class="[th, 'text-right']">
              {{ t('admin.costs.table.costMonth') }}
            </th>
            <th :class="[th, 'text-right']">
              {{ t('admin.costs.table.costTotal') }}
            </th>
            <th :class="[th, 'text-right']">
              {{ t('admin.costs.table.margin') }}
            </th>
            <th :class="[th, 'text-right']">
              {{ t('admin.costs.table.marginPct') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr
            v-for="row in sorted"
            :key="row.tour_uuid"
            data-testid="tour-row"
          >
            <td class="py-1.5 px-2 text-ink">
              <span class="font-semibold">{{ row.artist_name || row.tour_name }}</span>
              <span
                v-if="row.artist_name"
                class="text-ink-3"
              > — {{ row.tour_name }}</span>
              <Pill
                v-if="row.is_deleted"
                variant="o"
                class="ml-1.5"
              >
                {{ t('admin.costs.table.deleted') }}
              </Pill>
            </td>
            <td class="py-1.5 px-2 text-ink-3 truncate max-w-[180px]">
              {{ row.owner_email ?? '—' }}
            </td>
            <td class="py-1.5 px-2 text-ink-2">
              {{ row.plan_name ?? '—' }}
            </td>
            <td
              class="py-1.5 px-2 text-right text-ink-2"
              data-testid="paid"
              :title="row.paid_currency === 'MIXED' ? t('admin.costs.table.paidMixed') : undefined"
            >
              {{ paid(row) }}
            </td>
            <td class="py-1.5 px-2 text-right text-ink-2">
              {{ usage(row) }}
            </td>
            <td class="py-1.5 px-2 text-right text-ink-2">
              {{ row.messages_month }}
            </td>
            <td
              class="py-1.5 px-2 text-right font-semibold text-ink"
              data-testid="cost-month"
            >
              {{ money(row.amount_month) }}
            </td>
            <td class="py-1.5 px-2 text-right text-ink-2">
              {{ money(row.amount_total) }}
            </td>
            <td
              class="py-1.5 px-2 text-right font-semibold"
              data-testid="margin"
              :class="isNegative(row.margin_total) ? 'text-brand-orange' : 'text-ink'"
              :title="row.margin_total === null ? t('admin.costs.table.marginUnavailable') : undefined"
            >
              {{ money(row.margin_total) }}
            </td>
            <td
              class="py-1.5 px-2 text-right"
              data-testid="margin-pct"
              :class="isNegative(row.margin_pct) ? 'text-brand-orange' : 'text-ink-2'"
              :title="row.margin_pct === null ? t('admin.costs.table.marginUnavailable') : undefined"
            >
              {{ pct(row.margin_pct) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p
      v-if="truncated"
      data-testid="truncated"
      class="text-[12px] text-ink-4 mt-2"
    >
      {{ t('admin.costs.table.truncated', { n: tours.length }) }}
    </p>
  </div>
</template>
