<script setup lang="ts">
// Supuestos en bloque de las actividades (F2 §4.3): año, orden de las fechas (con aviso si hay dos
// formatos), zona por defecto, zona de cada ciudad, "Día 1" (solo con días numerados) y horas de
// hotel (solo si hay hoteles). Cada cambio emite un PATCH de `assumptions`; el servidor recalcula
// todas las filas sin IA ni llamadas externas y la vista sustituye el job.
import { computed, ref, watch } from 'vue'
import { DateTime } from 'luxon'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type {
  ImportAssumptions,
  ImportAssumptionsPatch,
  ImportDateOrder,
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
  }>(),
  { saving: false, baseYear: null, showDayOne: false, showHotels: false, error: '' }
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
      <StatusBadge
        v-if="conflict"
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
