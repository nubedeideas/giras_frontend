<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import {
  DISCREPANCIES_PAGE_SIZE,
  useAdminTwilioCosts,
  type DiscrepancyFilters,
  type DiscrepancyStatusFilter,
  type TwilioDiscrepancy,
} from '@/composables/useAdminTwilioCosts'
import { DISCREPANCY_KINDS, type DiscrepancyKind } from '@/composables/useTwilioCosts'
import { formatMoney } from '@/utils/money'
import Pill from '@/components/ui/Pill.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

const props = defineProps<{
  currency: string
  /** uuid de gira como filtro (llega de `/admin?tab=costs&tour=` desde Informes). */
  tour?: string | null
  /** Nombre de esa gira, si se conoce, para el chip del filtro. */
  tourName?: string | null
}>()
const emit = defineEmits<{
  acknowledged: [item: TwilioDiscrepancy, previousStatus: TwilioDiscrepancy['status']]
  clearTour: []
}>()

const { t, te, locale } = useI18n()
const api = useAdminTwilioCosts()

const STATUSES: DiscrepancyStatusFilter[] = ['open', 'acknowledged', 'resolved', 'all']

/** Claves de `details` que se enseñan por tipo (§5.3), en este orden. */
const DETAIL_KEYS: Record<DiscrepancyKind, string[]> = {
  billed_without_recipient: [
    'billing_at',
    'direction',
    'twilio_status',
    'counterpart_masked',
    'amount',
  ],
  missing_in_twilio: ['sent_at', 'notification_type', 'recipient_status'],
  recipient_without_sid: ['sent_at', 'recipient_status', 'notification_type'],
  status_mismatch: ['twilio_status', 'error_code', 'recipient_status'],
  price_missing: ['billing_at', 'hours_waiting'],
  currency_mismatch: ['price_unit', 'amount'],
}

const status = ref<DiscrepancyStatusFilter>('open')
const kind = ref<DiscrepancyKind | ''>('')
const items = ref<TwilioDiscrepancy[]>([])
const next = ref<string | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const actionError = ref('')
const pending = ref<Set<string>>(new Set())
/**
 * Con el filtro `open`, revisar una discrepancia la saca del conjunto del servidor y las páginas
 * siguientes se desplazan: el `next` guardado se saltaría filas. Si está a `true`, "Cargar más"
 * vuelve a recorrer desde la página 1 conservando lo ya cargado.
 */
let shifted = false
let requestId = 0

/** Tope de páginas al recorrer desde la 1 tras un desplazamiento. */
const MAX_RESYNC_PAGES = 50

function filters(): DiscrepancyFilters {
  return {
    status: status.value,
    kind: kind.value ? [kind.value] : undefined,
    tour: props.tour || undefined,
    pageSize: DISCREPANCIES_PAGE_SIZE,
  }
}

async function load() {
  const id = ++requestId
  shifted = false
  loading.value = true
  loadError.value = ''
  actionError.value = ''
  try {
    const data = await api.listDiscrepancies(filters())
    if (id !== requestId) return
    items.value = data.results
    next.value = data.next
  } catch (e) {
    if (id !== requestId) return
    items.value = []
    next.value = null
    loadError.value = e instanceof Error && e.message ? e.message : t('admin.costs.error')
  } finally {
    if (id === requestId) loading.value = false
  }
}

async function loadMore() {
  if (!next.value || loadingMore.value) return
  const id = requestId
  loadingMore.value = true
  actionError.value = ''
  try {
    if (shifted) {
      await resyncFromFirstPage(id)
      return
    }
    const data = await api.listDiscrepancies(next.value)
    if (id !== requestId) return
    const seen = new Set(items.value.map((i) => i.uuid))
    items.value = [...items.value, ...data.results.filter((i) => !seen.has(i.uuid))]
    next.value = data.next
  } catch (e) {
    if (id !== requestId) return
    actionError.value = e instanceof Error && e.message ? e.message : t('admin.costs.error')
  } finally {
    loadingMore.value = false
  }
}

/**
 * Recorre desde la página 1 con los mismos filtros hasta añadir una página de filas nuevas (o
 * llegar al final). Las filas ya cargadas se conservan, también las revisadas.
 */
async function resyncFromFirstPage(id: number) {
  const seen = new Set(items.value.map((i) => i.uuid))
  const added: TwilioDiscrepancy[] = []
  let url: string | DiscrepancyFilters = filters()
  let nextUrl: string | null = null
  for (let pages = 0; pages < MAX_RESYNC_PAGES; pages++) {
    const data = await api.listDiscrepancies(url)
    if (id !== requestId) return
    for (const item of data.results) {
      if (!seen.has(item.uuid)) {
        seen.add(item.uuid)
        added.push(item)
      }
    }
    nextUrl = data.next
    if (!nextUrl || added.length >= DISCREPANCIES_PAGE_SIZE) break
    url = nextUrl
  }
  items.value = [...items.value, ...added]
  next.value = nextUrl
  shifted = false
}

/** Optimista: la fila pasa a "Revisada" al momento y vuelve a su estado si el POST falla. */
async function acknowledge(item: TwilioDiscrepancy) {
  if (pending.value.has(item.uuid)) return
  const previous = { ...item }
  actionError.value = ''
  pending.value = new Set(pending.value).add(item.uuid)
  replace(item.uuid, { ...item, status: 'acknowledged' })
  try {
    const updated = await api.acknowledge(item.uuid)
    replace(item.uuid, updated)
    if (status.value === 'open') shifted = true
    emit('acknowledged', updated, previous.status)
  } catch (e) {
    replace(item.uuid, previous)
    const msg = e instanceof Error && e.message ? e.message : ''
    actionError.value = msg
      ? `${t('admin.costs.discrepancies.acknowledgeError')}: ${msg}`
      : t('admin.costs.discrepancies.acknowledgeError')
  } finally {
    const s = new Set(pending.value)
    s.delete(item.uuid)
    pending.value = s
  }
}

function replace(uuid: string, value: TwilioDiscrepancy) {
  items.value = items.value.map((i) => (i.uuid === uuid ? value : i))
}

watch([status, kind, () => props.tour], load)
onMounted(load)

defineExpose({ reload: load })

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = DateTime.fromISO(iso)
  return d.isValid ? d.setLocale(locale.value).toLocaleString(DateTime.DATETIME_MED) : iso
}

/** `SM…ab12`; el SID completo va en el `title`. */
function shortSid(sid: string): string {
  return sid.length > 8 ? `${sid.slice(0, 2)}…${sid.slice(-4)}` : sid
}

function detailValue(item: TwilioDiscrepancy, key: string): string {
  const raw = item.details?.[key]
  if (raw === null || raw === undefined || raw === '') return ''
  if (key.endsWith('_at')) return formatDate(String(raw))
  if (key === 'amount') {
    // `price_unit` si la discrepancia lo trae (currency_mismatch y, según gnotif,
    // billed_without_recipient); si no, la moneda de facturación.
    const unit = item.details.price_unit ? String(item.details.price_unit) : props.currency
    return formatMoney(String(raw), unit, locale.value)
  }
  if (key === 'notification_type') {
    const k = `reports.types.${raw}`
    return te(k) ? t(k) : String(raw)
  }
  return String(raw)
}

function details(item: TwilioDiscrepancy): { key: string; label: string; value: string }[] {
  return (DETAIL_KEYS[item.kind] ?? Object.keys(item.details ?? {}))
    .map((key) => ({
      key,
      label: t(`admin.costs.discrepancies.details.${key}`),
      value: detailValue(item, key),
    }))
    .filter((d) => d.value !== '')
}

function kindLabel(k: string): string {
  const key = `admin.costs.discrepancies.kinds.${k}`
  return te(key) ? t(key) : k
}

const tourChipName = computed(() => {
  if (!props.tour) return ''
  if (props.tourName) return props.tourName
  return items.value.find((i) => i.tour?.uuid === props.tour)?.tour?.name ?? props.tour.slice(0, 8)
})

const STATUS_VARIANT = { open: 'o', acknowledged: 'b', resolved: 'g' } as const

const selectClass =
  'bg-glass border border-line rounded-sm px-3 py-1.5 text-[13px] text-ink-2 outline-none cursor-pointer max-w-full'
</script>

<template>
  <div class="bg-bg-3 border border-line rounded-lg p-[14px_16px]">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-3">
      <p class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
        {{ t('admin.costs.discrepancies.title') }}
      </p>
      <div class="flex items-center gap-2 flex-wrap">
        <select
          v-model="status"
          data-testid="filter-status"
          :class="selectClass"
          :aria-label="t('admin.costs.discrepancies.filterStatus')"
        >
          <option
            v-for="s in STATUSES"
            :key="s"
            :value="s"
          >
            {{ t(`admin.costs.discrepancies.status.${s}`) }}
          </option>
        </select>
        <select
          v-model="kind"
          data-testid="filter-kind"
          :class="selectClass"
          :aria-label="t('admin.costs.discrepancies.filterKind')"
        >
          <option value="">
            {{ t('admin.costs.discrepancies.allKinds') }}
          </option>
          <option
            v-for="k in DISCREPANCY_KINDS"
            :key="k"
            :value="k"
          >
            {{ kindLabel(k) }}
          </option>
        </select>
      </div>
    </div>

    <div
      v-if="tour"
      data-testid="tour-filter"
      class="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-full bg-glass-active border border-line-acid text-[13px] text-ink-2"
    >
      {{ t('admin.costs.discrepancies.tourFilter', { name: tourChipName }) }}
      <button
        data-testid="clear-tour"
        class="border-none bg-transparent text-ink-3 hover:text-ink cursor-pointer p-0 leading-none"
        :aria-label="t('admin.costs.discrepancies.clearTour')"
        :title="t('admin.costs.discrepancies.clearTour')"
        @click="emit('clearTour')"
      >
        ×
      </button>
    </div>

    <p
      v-if="actionError"
      data-testid="action-error"
      class="text-[13px] text-failed-fg mb-2"
      role="alert"
    >
      {{ actionError }}
    </p>

    <div
      v-if="loading"
      class="space-y-1.5"
    >
      <div
        v-for="i in 3"
        :key="i"
        class="h-14 rounded-lg bg-bg-2 border border-line animate-pulse"
      />
    </div>

    <div
      v-else-if="loadError"
      class="flex flex-col items-center gap-2 py-4 text-center"
    >
      <p class="text-[14px] text-failed-fg">
        {{ loadError }}
      </p>
      <BtnSecondary @click="load">
        {{ t('admin.costs.retry') }}
      </BtnSecondary>
    </div>

    <p
      v-else-if="!items.length"
      data-testid="discrepancies-empty"
      class="text-[14px] text-ink-4 text-center py-4"
    >
      {{ t('admin.costs.discrepancies.empty') }}
    </p>

    <div
      v-else
      class="flex flex-col gap-1.5"
    >
      <div
        v-for="item in items"
        :key="item.uuid"
        data-testid="discrepancy-row"
        :data-uuid="item.uuid"
        class="p-2.5 rounded-lg bg-bg-2 border border-line"
      >
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <p class="text-[14px] font-semibold text-ink">
                {{ kindLabel(item.kind) }}
              </p>
              <Pill
                :variant="STATUS_VARIANT[item.status] ?? 'n'"
                data-testid="discrepancy-status"
              >
                {{ t(`admin.costs.discrepancies.statusOne.${item.status}`) }}
              </Pill>
            </div>
            <p class="text-[12px] text-ink-4 mt-0.5">
              <span class="font-time tnum">{{ formatDate(item.last_seen_at) }}</span> ·
              {{ item.tour?.name ?? t('admin.costs.discrepancies.noTour') }}
              <template v-if="item.sid">
                ·
                <span
                  data-testid="discrepancy-sid"
                  class="font-mono"
                  :title="item.sid"
                >{{ shortSid(item.sid) }}</span>
              </template>
            </p>
          </div>
          <button
            v-if="item.status === 'open'"
            data-testid="acknowledge"
            class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-2 cursor-pointer transition-colors hover:bg-glass-hover disabled:opacity-40"
            :disabled="pending.has(item.uuid)"
            @click="acknowledge(item)"
          >
            {{ t('admin.costs.discrepancies.acknowledge') }}
          </button>
        </div>
        <dl
          v-if="details(item).length"
          data-testid="discrepancy-details"
          class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[12px]"
        >
          <div
            v-for="d in details(item)"
            :key="d.key"
            class="flex gap-1"
          >
            <dt class="text-ink-4">
              {{ d.label }}:
            </dt>
            <dd class="text-ink-2 break-all">
              {{ d.value }}
            </dd>
          </div>
        </dl>
      </div>

      <div
        v-if="next"
        class="flex justify-center pt-1"
      >
        <BtnSecondary
          data-testid="load-more"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ t('admin.costs.discrepancies.loadMore') }}
        </BtnSecondary>
      </div>
    </div>
  </div>
</template>
