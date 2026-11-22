<script setup lang="ts">
// Editor de una fila de actividad (F2 §4.3): tipo, título, fecha, horas, todo el día, zona, lugar,
// destino; vuelo (número y localizador), hotel (nombre y confirmación) y notas. Solo manda los
// campos cambiados, en un único PATCH. En móvil va dentro de `MobileDetailOverlay` (la vista).
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import type {
  ImportActivityFields,
  ImportActivityRow,
  ImportActivityRowPatch,
} from '@/composables/useImportJobs'
import type { ActivityTypeOption } from '@/utils/importReview'
import { zoneOptions } from '@/utils/timezones'

const props = withDefaults(
  defineProps<{
    row: ImportActivityRow
    types?: ActivityTypeOption[]
    saving?: boolean
    error?: string
  }>(),
  { types: () => [], saving: false, error: '' }
)
const emit = defineEmits<{ patch: [patch: ImportActivityRowPatch]; close: [] }>()

const { t } = useI18n()

type Form = {
  activity_type_code: string
  title: string
  date: string
  start_time: string
  end_time: string
  all_day: boolean
  timezone: string
  location_name: string
  location_address: string
  destination_name: string
  destination_address: string
  flight_number: string
  booking_reference: string
  hotel_name: string
  confirmation_number: string
  notes: string
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function fromRow(r: ImportActivityRow): Form {
  const m = r.metadata ?? {}
  return {
    activity_type_code: r.activity_type_code,
    title: r.title ?? '',
    date: r.date ?? '',
    start_time: r.start_time ?? '',
    end_time: r.end_time ?? '',
    all_day: !!r.all_day,
    timezone: r.timezone ?? '',
    location_name: r.location_name ?? '',
    location_address: r.location_address ?? '',
    destination_name: r.destination_name ?? '',
    destination_address: r.destination_address ?? '',
    flight_number: str(m.flight_number),
    booking_reference: str(m.booking_reference),
    hotel_name: str(m.hotel_name),
    confirmation_number: str(m.confirmation_number),
    notes: r.notes ?? '',
  }
}

const form = reactive<Form>(fromRow(props.row))

// La respuesta del PATCH sustituye la fila: el formulario vuelve a partir de ella. Por valor, para
// que el PATCH de otra fila (que también sustituye el job) no borre lo que se está escribiendo.
watch(
  () => JSON.stringify([props.row.client_id, fromRow(props.row)]),
  () => Object.assign(form, fromRow(props.row))
)

const isFlight = computed(() => form.activity_type_code === 'flight')
const isHotel = computed(() => ['hotel_checkin', 'hotel_checkout'].includes(form.activity_type_code))

const changed = computed<Partial<ImportActivityFields>>(() => {
  const base = fromRow(props.row)
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(base) as (keyof Form)[]) {
    const raw = form[key]
    const value = typeof raw === 'string' ? raw.trim() : raw
    if (value === base[key]) continue
    if (key === 'start_time' || key === 'end_time') out[key] = value || null
    else if (key === 'date') {
      // La fecha no se puede vaciar (el servidor exige `YYYY-MM-DD`): para eso está Omitir.
      if (value) out[key] = value
    } else if (key === 'title') {
      if (value) out[key] = value
    } else out[key] = value
  }
  return out as Partial<ImportActivityFields>
})
const dirty = computed(() => Object.keys(changed.value).length > 0)
const titleMissing = computed(() => !form.title.trim())

// "Dar por buena" no aplica sin fecha (400 `date_required`).
const showReviewed = computed(
  () => props.row.needs_action && props.row.action !== 'skip' && !!(form.date || props.row.date)
)

function save(reviewed = false) {
  if (titleMissing.value) return
  const patch: ImportActivityRowPatch = { client_id: props.row.client_id }
  if (dirty.value) patch.fields = { ...changed.value }
  if (reviewed) patch.reviewed = true
  if (!patch.fields && !patch.reviewed) return
  emit('patch', patch)
}

const typeOptions = computed(() => {
  const list = [...props.types]
  if (!list.some((o) => o.code === props.row.activity_type_code)) {
    list.unshift({ code: props.row.activity_type_code, name: props.row.type_name, color: null })
  }
  return list
})
const zones = computed(() => zoneOptions(form.timezone || props.row.timezone))

const sourceText = computed(() => {
  const s = props.row.source_ref
  if (!s) return ''
  return t('importer.editor.source', { file: s.filename || t('importer.pastedText'), row: s.row })
})

const INPUT =
  'w-full min-h-[44px] lg:min-h-[36px] rounded-sm border border-line-2 bg-bg-3 px-3 text-[15px] lg:text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50'
const LABEL = 'flex flex-col gap-1 text-[13px] font-medium text-ink-2'
</script>

<template>
  <form
    class="flex flex-col gap-3"
    data-test="import-activity-editor"
    @submit.prevent="save(false)"
  >
    <div class="min-w-0">
      <p class="text-[15px] font-semibold text-ink truncate">
        {{ t('importer.activities.editor.title') }} · {{ row.title }}
      </p>
      <p
        v-if="sourceText"
        class="text-[12px] text-ink-2"
      >
        {{ sourceText }}
      </p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label :class="LABEL">
        {{ t('importer.activities.editor.type') }}
        <select
          v-model="form.activity_type_code"
          :class="INPUT"
          data-test="activity-editor-type"
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
      <label :class="LABEL">
        {{ t('importer.activities.editor.titleField') }}
        <input
          v-model="form.title"
          type="text"
          maxlength="200"
          :class="INPUT"
          autocomplete="off"
          :aria-invalid="titleMissing"
          data-test="activity-editor-title"
        >
      </label>
      <label :class="LABEL">
        {{ t('importer.activities.resolver.date') }}
        <input
          v-model="form.date"
          type="date"
          :class="[INPUT, 'font-time tnum']"
          data-test="activity-editor-date"
        >
      </label>
      <label :class="LABEL">
        {{ t('importer.activities.resolver.zone') }}
        <select
          v-model="form.timezone"
          :class="INPUT"
          data-test="activity-editor-timezone"
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
      <label :class="LABEL">
        {{ t('importer.activities.editor.startTime') }}
        <input
          v-model="form.start_time"
          type="time"
          :class="[INPUT, 'font-time tnum']"
          :disabled="form.all_day"
          data-test="activity-editor-start"
        >
      </label>
      <label :class="LABEL">
        {{ t('importer.activities.editor.endTime') }}
        <input
          v-model="form.end_time"
          type="time"
          :class="[INPUT, 'font-time tnum']"
          :disabled="form.all_day"
          data-test="activity-editor-end"
        >
      </label>
    </div>

    <label class="flex items-center gap-2 min-h-[44px] lg:min-h-0 text-[14px] text-ink cursor-pointer">
      <input
        v-model="form.all_day"
        type="checkbox"
        class="w-4 h-4 accent-[var(--olive)]"
        data-test="activity-editor-all-day"
      >
      {{ t('importer.activities.allDay') }}
    </label>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label :class="LABEL">
        {{ t('importer.activities.editor.locationName') }}
        <input
          v-model="form.location_name"
          type="text"
          maxlength="200"
          :class="INPUT"
          autocomplete="off"
          data-test="activity-editor-location"
        >
      </label>
      <label :class="LABEL">
        {{ t('importer.activities.editor.locationAddress') }}
        <input
          v-model="form.location_address"
          type="text"
          :class="INPUT"
          autocomplete="off"
        >
      </label>
      <label :class="LABEL">
        {{ t('importer.activities.editor.destinationName') }}
        <input
          v-model="form.destination_name"
          type="text"
          maxlength="200"
          :class="INPUT"
          autocomplete="off"
        >
      </label>
      <label :class="LABEL">
        {{ t('importer.activities.editor.destinationAddress') }}
        <input
          v-model="form.destination_address"
          type="text"
          :class="INPUT"
          autocomplete="off"
        >
      </label>
      <template v-if="isFlight">
        <label :class="LABEL">
          {{ t('importer.activities.editor.flightNumber') }}
          <input
            v-model="form.flight_number"
            type="text"
            :class="[INPUT, 'font-time tnum uppercase']"
            autocomplete="off"
            data-test="activity-editor-flight"
          >
        </label>
        <label :class="LABEL">
          {{ t('importer.activities.editor.bookingReference') }}
          <input
            v-model="form.booking_reference"
            type="text"
            :class="[INPUT, 'font-time tnum']"
            autocomplete="off"
          >
        </label>
      </template>
      <template v-if="isHotel">
        <label :class="LABEL">
          {{ t('importer.activities.editor.hotelName') }}
          <input
            v-model="form.hotel_name"
            type="text"
            :class="INPUT"
            autocomplete="off"
            data-test="activity-editor-hotel"
          >
        </label>
        <label :class="LABEL">
          {{ t('importer.activities.editor.confirmationNumber') }}
          <input
            v-model="form.confirmation_number"
            type="text"
            :class="[INPUT, 'font-time tnum']"
            autocomplete="off"
          >
        </label>
      </template>
    </div>

    <label :class="LABEL">
      {{ t('importer.activities.editor.notes') }}
      <textarea
        v-model="form.notes"
        rows="3"
        maxlength="2000"
        class="w-full rounded-sm border border-line-2 bg-bg-3 px-3 py-2 text-[15px] lg:text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
        data-test="activity-editor-notes"
      />
    </label>

    <p
      v-if="error"
      class="text-[13px] text-failed-fg"
      role="alert"
      data-test="activity-editor-error"
    >
      {{ error }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <BtnPrimary
        v-if="showReviewed"
        type="button"
        small
        class="disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="saving || titleMissing"
        data-test="activity-editor-save-reviewed"
        @click="save(true)"
      >
        {{ dirty ? t('importer.activities.editor.saveReviewed') : t('importer.activities.markReviewed') }}
      </BtnPrimary>
      <component
        :is="showReviewed ? BtnSecondary : BtnPrimary"
        type="submit"
        small
        class="disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="saving || !dirty || titleMissing"
        data-test="activity-editor-save"
      >
        {{ t('importer.editor.save') }}
      </component>
      <BtnSecondary
        type="button"
        small
        data-test="activity-editor-close"
        @click="emit('close')"
      >
        {{ t('importer.editor.close') }}
      </BtnSecondary>
      <span
        v-if="saving"
        class="text-[13px] text-ink-2"
        role="status"
      >{{ t('importer.activities.saving') }}</span>
    </div>
  </form>
</template>
