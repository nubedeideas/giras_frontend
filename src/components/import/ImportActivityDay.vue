<script setup lang="ts">
// Un día del bloque Actividades (F2 §4.3): cabecera con la fecha local (`font-time tnum`), la
// ciudad y el recuento, y sus filas. Bajo cada fila, el editor desplegado (slot `expanded`, en
// escritorio) o el resolutor si le queda algo por decidir.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ImportActivityResolver from '@/components/import/ImportActivityResolver.vue'
import ImportActivityRow from '@/components/import/ImportActivityRow.vue'
import type {
  ImportActivityRow as Row,
  ImportActivityRowPatch,
  ImportCityTz,
} from '@/composables/useImportJobs'
import {
  activityNeedsAction,
  activityStatus,
  formatDayLabel,
  type ActivityTypeOption,
} from '@/utils/importReview'

const props = withDefaults(
  defineProps<{
    date: string | null
    rows: Row[]
    tourTimezone: string
    types?: ActivityTypeOption[]
    cities?: Record<string, ImportCityTz>
    saving: Set<string>
    rowErrors?: Record<string, string>
    selectedId?: string | null
    /** `download_url` por `document_uuid` (para "Abrir documento"). */
    documentUrls?: Record<string, string>
  }>(),
  {
    types: () => [],
    cities: () => ({}),
    rowErrors: () => ({}),
    selectedId: null,
    documentUrls: () => ({}),
  }
)
const emit = defineEmits<{
  patch: [patch: ImportActivityRowPatch]
  city: [payload: { key: string; timezone: string }]
  edit: [row: Row]
}>()
defineSlots<{ expanded?: (props: { row: Row }) => unknown }>()

const { t, locale } = useI18n()

const label = computed(() =>
  props.date ? formatDayLabel(props.date, locale.value) : t('importer.activities.noDate')
)

/** La ciudad que más se repite en el día (las filas sin ciudad no cuentan). */
const city = computed(() => {
  const counts = new Map<string, number>()
  for (const r of props.rows) {
    const c = (r.city_key && props.cities[r.city_key]?.label) || r.city
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  let best = ''
  let max = 0
  for (const [c, n] of counts) {
    if (n > max) {
      best = c
      max = n
    }
  }
  return best
})

const colorByCode = computed(() => new Map(props.types.map((o) => [o.code, o.color])))

function hasResolver(r: Row): boolean {
  const s = activityStatus(r)
  return activityNeedsAction(r) || s === 'replace' || (s === 'new' && r.match?.status === 'possible_duplicate')
}

function docUrl(r: Row): string | null {
  const uuid = r.source_ref?.document_uuid
  return (uuid && props.documentUrls[uuid]) || null
}
</script>

<template>
  <section
    class="flex flex-col gap-2"
    :data-day="date ?? 'none'"
    data-test="import-activity-day"
  >
    <header class="flex items-baseline justify-between gap-2 border-b border-line pb-1">
      <h3 class="flex items-baseline gap-2 min-w-0">
        <span
          class="text-[15px] font-semibold text-ink"
          :class="date ? 'font-time tnum' : ''"
          data-test="import-day-label"
        >{{ label }}</span>
        <span
          v-if="city"
          class="text-[13px] text-ink-2 truncate"
          data-test="import-day-city"
        >{{ city }}</span>
      </h3>
      <span
        class="shrink-0 text-[13px] text-ink-2"
        data-test="import-day-count"
      >{{ t('importer.activities.dayCount', { n: rows.length }, rows.length) }}</span>
    </header>

    <ul class="flex flex-col gap-2">
      <ImportActivityRow
        v-for="r in rows"
        :key="r.client_id"
        :row="r"
        :tour-timezone="tourTimezone"
        :type-color="colorByCode.get(r.activity_type_code) ?? null"
        :saving="saving.has(r.client_id)"
        :error="rowErrors[r.client_id]"
        :selected="selectedId === r.client_id"
        :document-url="docUrl(r)"
        @patch="emit('patch', $event)"
        @edit="emit('edit', $event)"
      >
        <div
          v-if="selectedId === r.client_id && $slots.expanded"
          class="mt-2 rounded-sm border border-line bg-bg-2 p-3"
          data-test="import-activity-expanded"
        >
          <slot
            name="expanded"
            :row="r"
          />
        </div>
        <template v-else-if="hasResolver(r)">
          <ImportActivityResolver
            class="mt-2"
            :row="r"
            :types="types"
            :cities="cities"
            :saving="saving.has(r.client_id)"
            @patch="emit('patch', $event)"
            @city="emit('city', $event)"
          />
        </template>
      </ImportActivityRow>
    </ul>
  </section>
</template>
