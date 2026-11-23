<script setup lang="ts">
// Bloque Actividades de la revisión (F2 §4.3): primero "Por resolver (n)" y después "Listas (n)",
// las dos agrupadas por día (`ImportActivityDay`). En móvil las listas van plegadas mientras quede
// algo por resolver. Mientras se recalculan los supuestos, la lista queda bloqueada.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ImportActivityDay from '@/components/import/ImportActivityDay.vue'
import type {
  ImportActivityRow,
  ImportActivityRowPatch,
  ImportCityTz,
} from '@/composables/useImportJobs'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  activityNeedsAction,
  groupActivitiesByDay,
  type ActivityTypeOption,
  type ImportSourceDocument,
} from '@/utils/importReview'

const props = withDefaults(
  defineProps<{
    rows: ImportActivityRow[]
    tourTimezone: string
    types?: ActivityTypeOption[]
    cities?: Record<string, ImportCityTz>
    saving: Set<string>
    rowErrors?: Record<string, string>
    onlyPending?: boolean
    selectedId?: string | null
    /** Documento de origen por `document_uuid` (para "Abrir documento"). */
    sourceDocuments?: Record<string, ImportSourceDocument>
    /** Un PATCH de supuestos en curso: la lista se bloquea con "Recalculando…". */
    recalculating?: boolean
    /** F3: `activity_uuid` de las actividades que ya no están en el feed (`detected.ical.removed`). */
    removedUuids?: string[]
  }>(),
  {
    types: () => [],
    cities: () => ({}),
    rowErrors: () => ({}),
    onlyPending: false,
    selectedId: null,
    sourceDocuments: () => ({}),
    recalculating: false,
    removedUuids: () => [],
  }
)
const emit = defineEmits<{
  patch: [patch: ImportActivityRowPatch]
  city: [payload: { key: string; timezone: string }]
  edit: [row: ImportActivityRow]
}>()
defineSlots<{ expanded?: (props: { row: ImportActivityRow }) => unknown }>()

const { t } = useI18n()
const { isMobile } = useIsMobile()

const titles = computed(() => Object.fromEntries(props.rows.map((r) => [r.client_id, r.title])))
const pendingRows = computed(() => props.rows.filter(activityNeedsAction))
const readyRows = computed(() =>
  props.onlyPending ? [] : props.rows.filter((r) => !activityNeedsAction(r))
)
const pendingDays = computed(() => groupActivitiesByDay(pendingRows.value, props.tourTimezone))
const readyDays = computed(() => groupActivitiesByDay(readyRows.value, props.tourTimezone))

// Móvil: plegadas mientras quede algo por resolver; el usuario puede abrirlas. Escritorio: abiertas.
const readyOpenChoice = ref<boolean | null>(null)
const readyOpen = computed(
  () => readyOpenChoice.value ?? (!isMobile.value || pendingRows.value.length === 0)
)
</script>

<template>
  <div
    class="relative flex flex-col gap-4"
    :aria-busy="recalculating"
    data-test="import-activity-list"
  >
    <div
      v-if="recalculating"
      class="absolute inset-0 z-10 flex items-start justify-center pt-6"
      data-test="import-activities-recalculating"
    >
      <span
        class="inline-flex items-center gap-2 rounded-full border border-line bg-bg-3 px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_4px_16px_var(--shadow-sm)]"
        role="status"
      >
        <span
          class="w-3.5 h-3.5 rounded-full border-2 border-line-2 border-t-olive animate-spin"
          aria-hidden="true"
        />
        {{ t('importer.assumptions.recalculating') }}
      </span>
    </div>

    <div
      class="flex flex-col gap-4"
      :class="recalculating ? 'pointer-events-none select-none' : ''"
      :inert="recalculating || undefined"
    >
      <p
        v-if="!rows.length || (onlyPending && !pendingRows.length)"
        class="text-[14px] text-ink-2 py-4"
        data-test="import-activities-empty"
      >
        {{ onlyPending ? t('importer.activities.emptyFilter') : t('importer.activities.empty') }}
      </p>

      <!-- Por resolver -->
      <div
        v-if="pendingRows.length"
        class="flex flex-col gap-3"
        data-test="import-activities-pending"
      >
        <p class="text-[14px] font-semibold text-failed-fg">
          {{ t('importer.activities.pending', { n: pendingRows.length }) }}
        </p>
        <ImportActivityDay
          v-for="d in pendingDays"
          :key="`p-${d.date ?? 'none'}`"
          :date="d.date"
          :rows="d.rows"
          :tour-timezone="tourTimezone"
          :types="types"
          :cities="cities"
          :saving="saving"
          :row-errors="rowErrors"
          :selected-id="selectedId"
          :source-documents="sourceDocuments"
          :titles="titles"
          :removed-uuids="removedUuids"
          @patch="emit('patch', $event)"
          @city="emit('city', $event)"
          @edit="emit('edit', $event)"
        >
          <template
            v-if="$slots.expanded"
            #expanded="{ row }"
          >
            <slot
              name="expanded"
              :row="row"
            />
          </template>
        </ImportActivityDay>
      </div>

      <!-- Listas -->
      <div
        v-if="readyRows.length"
        class="flex flex-col gap-3"
        data-test="import-activities-ready"
      >
        <button
          type="button"
          class="flex items-center justify-between gap-2 min-h-[44px] lg:min-h-[36px] text-left text-[14px] font-semibold text-ink bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
          :aria-expanded="readyOpen"
          data-test="import-activities-ready-toggle"
          @click="readyOpenChoice = !readyOpen"
        >
          <span>{{ t('importer.activities.ready', { n: readyRows.length }) }}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-transform text-ink-2"
            :class="readyOpen ? 'rotate-180' : 'rotate-0'"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <template v-if="readyOpen">
          <ImportActivityDay
            v-for="d in readyDays"
            :key="`r-${d.date ?? 'none'}`"
            :date="d.date"
            :rows="d.rows"
            :tour-timezone="tourTimezone"
            :types="types"
            :cities="cities"
            :saving="saving"
            :row-errors="rowErrors"
            :selected-id="selectedId"
            :source-documents="sourceDocuments"
            :titles="titles"
            :removed-uuids="removedUuids"
            @patch="emit('patch', $event)"
            @city="emit('city', $event)"
            @edit="emit('edit', $event)"
          >
            <template
              v-if="$slots.expanded"
              #expanded="{ row }"
            >
              <slot
                name="expanded"
                :row="row"
              />
            </template>
          </ImportActivityDay>
        </template>
      </div>
    </div>
  </div>
</template>
