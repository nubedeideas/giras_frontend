<script setup lang="ts">
// Ambigüedades de una fila de actividad, en línea (F2 §4.3): posible duplicado (Omitir · Crear
// igualmente · Sustituir), tipo dudoso, fecha que falta o fuera de la gira, sin hora (hora o "Todo
// el día"), zona heredada (de la fila o "Aplicar a todas las de {ciudad}" → supuestos) y "Dar por
// buena". Cada decisión emite un PATCH; la vista lo encola.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  ImportActivityRow,
  ImportActivityRowPatch,
  ImportCityTz,
} from '@/composables/useImportJobs'
import {
  activityNeedsAction,
  activityStatus,
  formatLocalDate,
  formatLocalTime,
  type ActivityTypeOption,
} from '@/utils/importReview'
import { zoneOptions } from '@/utils/timezones'

const props = withDefaults(
  defineProps<{
    row: ImportActivityRow
    types?: ActivityTypeOption[]
    cities?: Record<string, ImportCityTz>
    saving?: boolean
    /** Título de la fila de la que esta es repetida (`duplicate_of`), si se conoce. */
    duplicateOfTitle?: string | null
  }>(),
  { types: () => [], cities: () => ({}), saving: false, duplicateOfTitle: null }
)
const emit = defineEmits<{
  patch: [patch: ImportActivityRowPatch]
  city: [payload: { key: string; timezone: string }]
}>()

const { t, locale } = useI18n()

const id = computed(() => props.row.client_id)
const issues = computed(() => new Set<string>(props.row.issues))
const status = computed(() => activityStatus(props.row))
const skipped = computed(() => props.row.action === 'skip')

// Posible duplicado, sustitución o duplicado seguro recuperado ("Recuperar" → `create`).
const showDuplicate = computed(
  () =>
    ['possible_duplicate', 'replace', 'duplicate_kept', 'duplicate_in_draft_kept'].includes(
      status.value
    ) ||
    (props.row.match?.status === 'possible_duplicate' && props.row.reviewed && !skipped.value)
)
const existingText = computed(() => {
  const m = props.row.match
  // Repetida de otra fila del borrador: no hay actividad existente que nombrar.
  if (!m?.activity_uuid && (props.row.duplicate_of || m?.status === 'duplicate_in_draft')) {
    return props.duplicateOfTitle
      ? t('importer.duplicate.repeatedOf', { title: props.duplicateOfTitle })
      : t('importer.duplicate.repeated')
  }
  const when = m?.activity_scheduled_at
  const title = m?.activity_title ?? ''
  if (!when) return t('importer.duplicate.sameAsNoTime', { title })
  const tz = props.row.timezone
  const time = `${formatLocalDate(when, tz, locale.value)} ${formatLocalTime(when, tz)}`
  return t('importer.activityStatus.possible_duplicate', { title, time })
})
const canReplace = computed(() => !!props.row.match?.activity_uuid)

const showType = computed(() => !skipped.value && issues.value.has('type_uncertain'))
const showDate = computed(
  () =>
    !skipped.value &&
    (!props.row.date ||
      [
        'outside_tour',
        'date_unverified',
        'weekday_mismatch',
        'date_ambiguous_dmy',
        'month_inferred',
      ].some((i) => issues.value.has(i)))
)
const showTime = computed(
  () =>
    !skipped.value &&
    !props.row.all_day &&
    (!props.row.start_time || issues.value.has('time_missing') || issues.value.has('time_unverified'))
)
const showZone = computed(() => !skipped.value && issues.value.has('timezone_inherited'))

const cityKnown = computed(() => !!props.row.city_key && props.row.city_key in props.cities)
const cityLabel = computed(() => {
  const key = props.row.city_key
  return (key && props.cities[key]?.label) || props.row.city || ''
})
const applyToCity = ref(true)
watch(id, () => (applyToCity.value = true))

// "Dar por buena": no con fecha o instante pendientes (el servidor no la daría por resuelta) ni
// con un posible duplicado (se decide con sus botones).
const showReviewed = computed(
  () =>
    !skipped.value &&
    props.row.needs_action &&
    !props.row.reviewed &&
    status.value !== 'possible_duplicate'
)
const canReview = computed(() => !!props.row.date && !!props.row.scheduled_at)

const typeOptions = computed(() => {
  const list = [...props.types]
  if (!list.some((o) => o.code === props.row.activity_type_code)) {
    list.unshift({ code: props.row.activity_type_code, name: props.row.type_name, color: null })
  }
  return list
})
const zones = computed(() => zoneOptions(props.row.timezone))

function patch(p: Omit<ImportActivityRowPatch, 'client_id'>) {
  emit('patch', { client_id: id.value, ...p })
}

function onType(e: Event) {
  const code = (e.target as HTMLSelectElement).value
  if (code && code !== props.row.activity_type_code) patch({ fields: { activity_type_code: code } })
}

function onDate(e: Event) {
  const date = (e.target as HTMLInputElement).value
  if (date && date !== props.row.date) patch({ fields: { date } })
}

function onTime(e: Event) {
  const time = (e.target as HTMLInputElement).value
  if (time && time !== props.row.start_time) patch({ fields: { start_time: time, all_day: false } })
}

function onZone(e: Event) {
  const tz = (e.target as HTMLSelectElement).value
  if (!tz) return
  if (applyToCity.value && cityKnown.value && props.row.city_key) {
    emit('city', { key: props.row.city_key, timezone: tz })
  } else if (tz !== props.row.timezone) {
    patch({ fields: { timezone: tz } })
  }
}

const pending = computed(() => activityNeedsAction(props.row))

const CHOICE =
  'min-h-[44px] lg:min-h-[32px] px-3 rounded-sm border text-[13px] font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50 disabled:cursor-not-allowed'
const INPUT =
  'min-h-[44px] lg:min-h-[32px] rounded-sm border border-line-2 bg-bg-3 px-2 text-[15px] lg:text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50'
const LABEL = 'flex flex-col gap-1 text-[13px] font-medium text-ink-2'
</script>

<template>
  <div
    v-if="showDuplicate || showType || showDate || showTime || showZone || showReviewed"
    class="flex flex-col gap-3 rounded-sm border px-3 py-2.5"
    :class="pending ? 'border-failed-fg bg-bg-3' : 'border-line bg-bg-2'"
    data-test="import-activity-resolver"
  >
    <!-- Posible duplicado -->
    <div
      v-if="showDuplicate"
      class="flex flex-col gap-2"
      data-test="resolver-duplicate"
    >
      <p class="text-[13px] font-semibold text-ink">
        {{ existingText }}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :class="[CHOICE, 'border-line-2 bg-bg-3 text-ink hover:bg-glass-hover']"
          :disabled="saving"
          data-test="resolver-dup-skip"
          @click="patch({ action: 'skip' })"
        >
          {{ t('importer.duplicate.skip') }}
        </button>
        <button
          type="button"
          :class="[
            CHOICE,
            row.action === 'create' && row.reviewed
              ? 'border-olive bg-glass-active text-ink'
              : 'border-line-2 bg-bg-3 text-ink hover:bg-glass-hover',
          ]"
          :aria-pressed="row.action === 'create' && row.reviewed"
          :disabled="saving"
          data-test="resolver-dup-create"
          @click="patch({ action: 'create', reviewed: true })"
        >
          {{ t('importer.duplicate.create') }}
        </button>
        <button
          v-if="canReplace"
          type="button"
          :class="[
            CHOICE,
            row.action === 'replace'
              ? 'border-olive bg-glass-active text-ink'
              : 'border-line-2 bg-bg-3 text-ink hover:bg-glass-hover',
          ]"
          :aria-pressed="row.action === 'replace'"
          :disabled="saving"
          data-test="resolver-dup-replace"
          @click="patch({ action: 'replace', reviewed: true })"
        >
          {{ t('importer.duplicate.replace') }}
        </button>
      </div>
    </div>

    <div
      v-if="showType || showDate || showTime || showZone"
      class="flex flex-wrap items-end gap-3"
    >
      <!-- Tipo dudoso -->
      <label
        v-if="showType"
        :class="LABEL"
      >
        {{ t('importer.activities.resolver.type') }}
        <select
          :class="INPUT"
          :value="row.activity_type_code"
          :disabled="saving"
          data-test="resolver-type"
          @change="onType"
        >
          <option
            v-for="o in typeOptions"
            :key="o.code"
            :value="o.code"
          >
            {{ o.name }}
          </option>
        </select>
      </label>

      <!-- Fecha -->
      <label
        v-if="showDate"
        :class="LABEL"
      >
        {{ t('importer.activities.resolver.date') }}
        <input
          type="date"
          :class="[INPUT, 'font-time tnum']"
          :value="row.date ?? ''"
          :disabled="saving"
          data-test="resolver-date"
          @change="onDate"
        >
      </label>

      <!-- Hora -->
      <div
        v-if="showTime"
        class="flex items-end gap-2"
      >
        <label :class="LABEL">
          {{ t('importer.activities.resolver.time') }}
          <input
            type="time"
            :class="[INPUT, 'font-time tnum']"
            :value="row.start_time ?? ''"
            :disabled="saving"
            data-test="resolver-time"
            @change="onTime"
          >
        </label>
        <button
          type="button"
          :class="[CHOICE, 'border-line-2 bg-bg-3 text-ink hover:bg-glass-hover']"
          :disabled="saving"
          data-test="resolver-all-day"
          @click="patch({ fields: { all_day: true, start_time: null, end_time: null } })"
        >
          {{ t('importer.activities.allDay') }}
        </button>
      </div>

      <!-- Zona heredada -->
      <div
        v-if="showZone"
        class="flex flex-col gap-1"
      >
        <label :class="LABEL">
          {{ t('importer.activities.resolver.zone') }}
          <select
            :class="INPUT"
            :value="row.timezone"
            :disabled="saving"
            data-test="resolver-zone"
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
        <label
          v-if="cityKnown"
          class="flex items-center gap-2 min-h-[44px] lg:min-h-0 text-[13px] text-ink cursor-pointer"
        >
          <input
            v-model="applyToCity"
            type="checkbox"
            class="w-4 h-4 accent-[var(--olive)]"
            data-test="resolver-zone-city"
          >
          {{ t('importer.assumptions.applyCity', { city: cityLabel }) }}
        </label>
      </div>
    </div>

    <div
      v-if="showReviewed"
      class="flex flex-wrap items-center gap-2"
    >
      <button
        v-if="canReview"
        type="button"
        :class="[CHOICE, 'border-line-2 bg-bg-3 text-ink hover:bg-glass-hover']"
        :disabled="saving"
        data-test="resolver-reviewed"
        @click="patch({ reviewed: true })"
      >
        {{ t('importer.activities.markReviewed') }}
      </button>
      <p
        v-else
        class="text-[13px] text-ink-2"
        data-test="resolver-reviewed-blocked"
      >
        {{ row.date ? t('importer.activities.needsTime') : t('importer.activityIssues.date_missing') }}
      </p>
    </div>
  </div>
</template>
