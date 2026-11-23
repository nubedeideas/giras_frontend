<script setup lang="ts">
// Supuestos en bloque de las actividades (F2 §4.3): año, orden de las fechas (con aviso si hay dos
// formatos), zona por defecto, zona de cada ciudad, "Día 1" (solo con días numerados) y horas de
// hotel (solo si hay hoteles). Cada cambio emite un PATCH de `assumptions`; el servidor recalcula
// todas las filas sin IA ni llamadas externas y la vista sustituye el job.
// F5a (§4.1): el orden de las fechas va por documento (`date_orders`), con su origen en texto
// secundario, un select por documento si no coinciden, la casilla "Recordar para esta gira/hoja",
// el aviso de fechas que contradicen lo elegido y "Aplicar a esta revisión" si la gira cambia.
import { computed, ref, watch } from 'vue'
import { DateTime } from 'luxon'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type {
  DateOrderSetting,
  ImportAssumptions,
  ImportAssumptionsPatch,
  ImportDateOrder,
  ImportDateOrderSource,
  ImportWarning,
} from '@/composables/useImportJobs'
import { formatDayLabel, timezoneSourceKey } from '@/utils/importReview'
import { zoneOptions } from '@/utils/timezones'

const props = withDefaults(
  defineProps<{
    assumptions: ImportAssumptions
    saving?: boolean
    /** Año de inicio de la gira: el servidor admite ese ± 1. Sin él, el de los supuestos. */
    baseYear?: number | null
    showDayOne?: boolean
    showHotels?: boolean
    /** Mensaje ya traducido si el último cambio no se ha guardado. */
    error?: string
    /** F5a: job de una hoja vinculada ("Recordar para esta hoja"). */
    sheetJob?: boolean
    /** F5a: avisos del borrador (`date_order_contradicted`). */
    warnings?: ImportWarning[]
    /**
     * F5a: orden guardado ahora mismo en la gira (si el front lo conoce). Si ha cambiado desde que
     * se leyó el job, la barra ofrece "Aplicar a esta revisión".
     */
    liveOrder?: DateOrderSetting | null
  }>(),
  {
    saving: false,
    baseYear: null,
    showDayOne: false,
    showHotels: false,
    error: '',
    sheetJob: false,
    warnings: () => [],
    liveOrder: null,
  }
)
const emit = defineEmits<{ patch: [patch: ImportAssumptionsPatch] }>()

const { t, locale } = useI18n()

// Si el PATCH falla, el job no cambia y los controles vuelven a su valor (con solo `:value` Vue no
// tocaría el DOM): se rehacen al terminar cada guardado.
const version = ref(0)
watch(
  () => props.saving,
  (now, before) => {
    if (before && !now) version.value++
  }
)

const year = computed(() => props.assumptions.year ?? props.baseYear ?? DateTime.now().year)
const yearOptions = computed(() => {
  const own = props.assumptions.year_source === 'user' ? null : props.assumptions.year
  const base = props.baseYear ?? own ?? year.value
  const list = [base - 1, base, base + 1]
  if (!list.includes(year.value)) list.push(year.value)
  return list.sort((a, b) => a - b)
})

const ORDERS: ImportDateOrder[] = ['dmy', 'mdy', 'ymd']
const dateOrder = computed<ImportDateOrder>(() => props.assumptions.date_order ?? 'dmy')
const conflict = computed(() => !!props.assumptions.date_order_conflict)

// ─── F5a: orden por documento ────────────────────────────────────────────────

const ORDER_SOURCES: ImportDateOrderSource[] = [
  'user',
  'subscription',
  'detected',
  'tour',
  'inferred',
  'locale',
  'language',
]

/** "(del documento)"; vacío si el backend manda un origen que no conocemos. */
function orderSourceText(source: string | null | undefined): string {
  if (!source || !ORDER_SOURCES.includes(source as ImportDateOrderSource)) return ''
  return t('importer.dateOrder.sourceText', { source: t(`importer.dateOrder.source.${source}`) })
}

function orderName(order: string | null | undefined): string {
  return order && ORDERS.includes(order as ImportDateOrder)
    ? t(`importer.dateOrder.orderNames.${order}`)
    : ''
}

const sources = computed(() =>
  Object.entries(props.assumptions.date_orders ?? {})
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => a.label.localeCompare(b.label))
)
/** Un select por documento solo si sus órdenes no coinciden. */
const mixed = computed(() => !!props.assumptions.date_order_mixed && sources.value.length > 1)
const mainSourceText = computed(() => orderSourceText(props.assumptions.date_order_source))

function onSourceOrder(key: string, e: Event) {
  const value = (e.target as HTMLSelectElement).value as ImportDateOrder
  const current = props.assumptions.date_orders?.[key]
  if (!ORDERS.includes(value) || !current) return
  if (value !== current.order || current.conflict) emit('patch', { date_orders: { [key]: value } })
}

/** "Recordar": solo si el backend manda `date_order_saved` (F5a). */
const saved = computed(() => props.assumptions.date_order_saved ?? null)
const rememberScope = computed(
  () => saved.value?.scope ?? (props.sheetJob ? 'subscription' : 'tour')
)
const rememberLabel = computed(() =>
  rememberScope.value === 'subscription'
    ? t('importer.dateOrder.rememberSheet')
    : t('importer.dateOrder.rememberTour')
)
const rememberChecked = computed(
  () => !!saved.value && saved.value.value !== 'auto' && saved.value.value === dateOrder.value
)
const rememberBlocked = computed(() => {
  if (mixed.value) return t('importer.dateOrder.rememberDisabledMixed')
  if (dateOrder.value === 'ymd') return t('importer.dateOrder.rememberDisabledYmd')
  return ''
})

function onRemember(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) emit('patch', { date_order: dateOrder.value, remember_date_order: true })
  else emit('patch', { remember_date_order: false })
}

/** Fuentes cuyo orden choca con sus fechas (conflicto o `date_order_contradicted`). */
const contradictions = computed(() => {
  const orders = props.assumptions.date_orders ?? {}
  const seen = new Set<string>()
  const list: { key: string; text: string }[] = []
  const add = (key: string, order: string | null | undefined) => {
    const doc = orders[key]?.label
    const name = orderName(order ?? orders[key]?.order)
    if (!doc || !name || seen.has(key)) return
    seen.add(key)
    list.push({ key, text: t('importer.dateOrder.contradicted', { document: doc, order: name }) })
  }
  for (const w of props.warnings) {
    if (w.code === 'date_order_contradicted' && w.source) add(w.source, w.chosen)
  }
  for (const s of sources.value) if (s.conflict) add(s.key, s.order)
  return list
})

/** La gira se ha cambiado (p. ej. desde el menú de giras) después de leer este job. */
const tourChangedTo = computed<ImportDateOrder | null>(() => {
  const live = props.liveOrder
  if (rememberScope.value !== 'tour' || !saved.value) return null
  if (live !== 'dmy' && live !== 'mdy') return null
  if (live === saved.value.value || (live === dateOrder.value && !mixed.value)) return null
  return live
})

function applyTourOrder() {
  if (tourChangedTo.value) emit('patch', { date_order: tourChangedTo.value })
}

const defaultZone = computed(() => props.assumptions.default_timezone ?? '')
const zones = computed(() => zoneOptions(defaultZone.value))

const cities = computed(() =>
  Object.entries(props.assumptions.cities ?? {})
    .map(([key, c]) => ({ key, ...c }))
    .sort((a, b) => a.label.localeCompare(b.label))
)
const citiesOpen = ref(false)

function cityZones(c: { timezone: string; candidates: string[] }): string[] {
  const list = zoneOptions(c.timezone)
  for (const z of c.candidates ?? []) if (!list.includes(z)) list.unshift(z)
  return list
}

function sourceText(source: string): string {
  const key = timezoneSourceKey(source)
  return key ? t(key) : ''
}

const dayOne = computed(() => props.assumptions.day_one_date ?? '')
const dayOneText = computed(() =>
  dayOne.value
    ? t('importer.assumptions.dayOne', { date: formatDayLabel(dayOne.value, locale.value) })
    : t('importer.assumptions.dayOneLabel')
)

const checkin = computed(() => props.assumptions.hotel_checkin_time ?? '')
const checkout = computed(() => props.assumptions.hotel_checkout_time ?? '')

function onYear(e: Event) {
  const value = Number((e.target as HTMLSelectElement).value)
  if (value && value !== props.assumptions.year) emit('patch', { year: value })
}

function onOrder(e: Event) {
  const value = (e.target as HTMLSelectElement).value as ImportDateOrder
  if (ORDERS.includes(value) && (value !== props.assumptions.date_order || conflict.value)) {
    emit('patch', { date_order: value })
  }
}

function onZone(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  if (value && value !== defaultZone.value) emit('patch', { default_timezone: value })
}

function onCity(key: string, e: Event) {
  const value = (e.target as HTMLSelectElement).value
  if (value && value !== props.assumptions.cities?.[key]?.timezone) {
    emit('patch', { cities: { [key]: value } })
  }
}

function onDayOne(e: Event) {
  const value = (e.target as HTMLInputElement).value
  if (value && value !== dayOne.value) emit('patch', { day_one_date: value })
}

function clearDayOne() {
  if (dayOne.value) emit('patch', { day_one_date: null })
}

function onHotel(which: 'in' | 'out', e: Event) {
  const value = (e.target as HTMLInputElement).value
  if (!value) return
  if (which === 'in' && value !== checkin.value) emit('patch', { hotel_checkin_time: value })
  if (which === 'out' && value !== checkout.value) emit('patch', { hotel_checkout_time: value })
}

const CHIP =
  'min-h-[44px] lg:min-h-[32px] rounded-full border border-line-2 bg-bg-3 px-3 text-[14px] lg:text-[13px] font-medium text-ink cursor-pointer hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50 disabled:cursor-not-allowed'
const INPUT =
  'min-h-[44px] lg:min-h-[32px] rounded-sm border border-line-2 bg-bg-3 px-2 text-[15px] lg:text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50'
</script>

<template>
  <section
    class="flex flex-col gap-2 rounded border border-line bg-bg-3 px-3 py-3"
    :aria-busy="saving"
    data-test="import-assumptions"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
        {{ t('importer.assumptions.title') }}
      </h2>
      <p
        class="text-[13px] text-ink-2"
        :role="saving ? 'status' : undefined"
        data-test="import-assumptions-help"
      >
        {{ saving ? t('importer.assumptions.recalculating') : t('importer.assumptions.recalc') }}
      </p>
    </div>

    <div
      :key="version"
      class="flex flex-wrap items-center gap-2"
    >
      <select
        :class="CHIP"
        :value="year"
        :disabled="saving"
        :aria-label="t('importer.assumptions.yearLabel')"
        data-test="assumption-year"
        @change="onYear"
      >
        <option
          v-for="y in yearOptions"
          :key="y"
          :value="y"
        >
          {{ t('importer.assumptions.year', { year: y }) }}
        </option>
      </select>

      <span
        v-if="!mixed"
        class="inline-flex flex-wrap items-center gap-x-1.5"
      >
        <select
          :class="CHIP"
          :value="dateOrder"
          :disabled="saving"
          :aria-label="t('importer.assumptions.dateOrderLabel')"
          data-test="assumption-date-order"
          @change="onOrder"
        >
          <option
            v-for="o in ORDERS"
            :key="o"
            :value="o"
          >
            {{ t('importer.assumptions.dateOrder', { order: t(`importer.assumptions.orders.${o}`) }) }}
          </option>
        </select>
        <span
          v-if="mainSourceText"
          class="text-[13px] text-ink-2"
          data-test="assumption-date-order-source"
        >{{ mainSourceText }}</span>
      </span>
      <span
        v-else
        class="inline-flex flex-wrap items-center gap-2 max-w-full"
        role="group"
        :aria-label="t('importer.dateOrder.bySource')"
        data-test="assumption-date-orders"
      >
        <span
          v-for="src in sources"
          :key="src.key"
          class="inline-flex flex-wrap items-center gap-x-1.5 max-w-full"
          :data-source="src.key"
        >
          <select
            :class="[CHIP, 'max-w-full truncate']"
            :value="src.order"
            :disabled="saving"
            :aria-label="t('importer.dateOrder.perSourceLabel', { document: src.label })"
            data-test="assumption-source-order"
            @change="onSourceOrder(src.key, $event)"
          >
            <option
              v-for="o in ORDERS"
              :key="o"
              :value="o"
            >
              {{
                t('importer.dateOrder.perSource', {
                  document: src.label,
                  order: t(`importer.assumptions.orders.${o}`),
                })
              }}
            </option>
          </select>
          <span
            v-if="orderSourceText(src.source)"
            class="text-[13px] text-ink-2"
          >{{ orderSourceText(src.source) }}</span>
        </span>
      </span>
      <StatusBadge
        v-if="conflict && !contradictions.length"
        size="sm"
        status="pending"
        :label="t('importer.assumptions.dateOrderConflict')"
        data-test="assumption-date-order-conflict"
      />

      <label class="inline-flex items-center gap-2 text-[13px] font-medium text-ink-2">
        {{ t('importer.assumptions.defaultTimezone') }}
        <select
          :class="CHIP"
          :value="defaultZone"
          :disabled="saving"
          data-test="assumption-timezone"
          @change="onZone"
        >
          <option
            v-for="z in zones"
            :key="z"
            :value="z"
          >
            {{ z }}
          </option>
        </select>
      </label>

      <button
        v-if="cities.length"
        type="button"
        :class="CHIP"
        :aria-expanded="citiesOpen"
        data-test="assumption-cities-toggle"
        @click="citiesOpen = !citiesOpen"
      >
        {{ t('importer.assumptions.cities', { n: cities.length }) }}
      </button>

      <label
        v-if="showDayOne"
        class="inline-flex items-center gap-2 text-[13px] font-medium text-ink-2"
      >
        <span data-test="assumption-day-one-text">{{ dayOneText }}</span>
        <input
          type="date"
          :class="[INPUT, 'font-time tnum']"
          :value="dayOne"
          :disabled="saving"
          data-test="assumption-day-one"
          @change="onDayOne"
        >
      </label>
      <button
        v-if="showDayOne && dayOne"
        type="button"
        class="min-h-[44px] lg:min-h-0 px-2 text-[13px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm disabled:opacity-50"
        :disabled="saving"
        data-test="assumption-day-one-clear"
        @click="clearDayOne"
      >
        {{ t('importer.assumptions.dayOneClear') }}
      </button>

      <div
        v-if="showHotels"
        class="inline-flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink-2"
        role="group"
        :aria-label="t('importer.assumptions.hotelTimes', { in: checkin, out: checkout })"
        data-test="assumption-hotels"
      >
        <label class="inline-flex items-center gap-1.5">
          {{ t('importer.assumptions.checkin') }}
          <input
            type="time"
            :class="[INPUT, 'font-time tnum']"
            :value="checkin"
            :disabled="saving"
            data-test="assumption-checkin"
            @change="onHotel('in', $event)"
          >
        </label>
        <label class="inline-flex items-center gap-1.5">
          {{ t('importer.assumptions.checkout') }}
          <input
            type="time"
            :class="[INPUT, 'font-time tnum']"
            :value="checkout"
            :disabled="saving"
            data-test="assumption-checkout"
            @change="onHotel('out', $event)"
          >
        </label>
      </div>
    </div>

    <div
      v-if="saved || contradictions.length || tourChangedTo"
      :key="`o-${version}`"
      class="flex flex-col gap-1.5"
      data-test="assumption-date-order-extra"
    >
      <div
        v-if="saved"
        class="flex flex-wrap items-center gap-x-3 gap-y-0.5"
      >
        <label
          class="inline-flex items-center gap-2 min-h-[44px] lg:min-h-0 text-[14px] lg:text-[13px] font-medium text-ink"
          :class="saving || rememberBlocked ? 'cursor-not-allowed' : 'cursor-pointer'"
        >
          <input
            type="checkbox"
            class="w-4 h-4 accent-[var(--olive)]"
            :checked="rememberChecked"
            :disabled="saving || !!rememberBlocked"
            :aria-describedby="rememberBlocked ? 'assumption-remember-why' : undefined"
            data-test="assumption-remember"
            @change="onRemember"
          >
          {{ rememberLabel }}
        </label>
        <span
          v-if="rememberBlocked"
          id="assumption-remember-why"
          class="text-[13px] text-ink-2"
          data-test="assumption-remember-why"
        >{{ rememberBlocked }}</span>
      </div>

      <ul
        v-if="contradictions.length"
        class="flex flex-wrap gap-1.5"
        data-test="assumption-contradictions"
      >
        <li
          v-for="c in contradictions"
          :key="c.key"
        >
          <StatusBadge
            size="sm"
            status="pending"
            :label="c.text"
            data-test="assumption-contradiction"
          />
        </li>
      </ul>

      <div
        v-if="tourChangedTo"
        class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm bg-bg-2 border border-line px-3 py-2"
        role="status"
        data-test="assumption-tour-changed"
      >
        <span class="text-[14px] lg:text-[13px] text-ink">
          {{ t('importer.dateOrder.tourChanged', { order: orderName(tourChangedTo) }) }}
        </span>
        <button
          type="button"
          class="min-h-[44px] lg:min-h-0 px-1 text-[14px] lg:text-[13px] font-semibold text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="saving"
          data-test="assumption-apply-tour-order"
          @click="applyTourOrder"
        >
          {{ t('importer.dateOrder.applyHere') }}
        </button>
      </div>
    </div>

    <ul
      v-if="citiesOpen && cities.length"
      :key="`c-${version}`"
      class="flex flex-col gap-1.5 border-t border-line-soft pt-2"
      data-test="assumption-cities"
    >
      <li
        v-for="c in cities"
        :key="c.key"
        class="flex flex-wrap items-center gap-x-3 gap-y-1"
        :data-city="c.key"
      >
        <span class="min-w-[120px] text-[14px] font-medium text-ink">{{ c.label }}</span>
        <select
          :class="INPUT"
          :value="c.timezone"
          :disabled="saving"
          :aria-label="t('importer.assumptions.cityZone', { city: c.label })"
          data-test="assumption-city-zone"
          @change="onCity(c.key, $event)"
        >
          <option
            v-for="z in cityZones(c)"
            :key="z"
            :value="z"
          >
            {{ z }}
          </option>
        </select>
        <span
          v-if="sourceText(c.source)"
          class="text-[13px] text-ink-2"
        >{{ sourceText(c.source) }}</span>
      </li>
    </ul>

    <p
      v-if="error"
      class="text-[13px] text-failed-fg"
      role="alert"
      data-test="assumption-error"
    >
      {{ error }}
    </p>
  </section>
</template>
