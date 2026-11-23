<script setup lang="ts">
// Fila de actividad de la revisión (F2 §4.3): hora local (`font-time tnum`, "—" sin hora o "Todo
// el día"), punto del color del tipo (solo punto), título, tipo, zona abreviada si no es la de la
// gira (con su origen en `title`), página u hoja de origen, confianza y estado con `StatusBadge`,
// issues y acciones Ver origen · Editar · Omitir/Recuperar. El slot por defecto recibe el resolutor
// o el editor desplegado. F3: en filas de calendario el origen es "Calendario"; las canceladas en el
// calendario se deciden solo en su resolutor (sin Editar ni Omitir) y una cambiada omitida se
// recupera como "Actualizar" (`replace`). Una cancelación cuya actividad ya no existe no tiene
// acciones: solo "La actividad ya no existe en la gira".
// F4 §4.4: en filas de hoja el origen es "Hoja de Google · {pestaña} · fila {n}" y los textos de
// cambio y retirada son de la hoja. Una fila "Se vinculará" (`match.link` con `skip`) no se tacha ni
// se edita: se decide en su resolutor (Vincular · No vincular).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ImportSourcePeek from '@/components/import/ImportSourcePeek.vue'
import type {
  ImportActivityRow,
  ImportActivityRowPatch,
  ImportJobSheet,
} from '@/composables/useImportJobs'
import {
  activityIssueKey,
  activityNeedsAction,
  activityStatus,
  activityStatusKey,
  activityTime,
  confidenceTone,
  formatLocalTime,
  isCalendarCancelGone,
  isCalendarCancelRow,
  isCalendarChangeRow,
  isCalendarRow,
  isPairedCheckout,
  isSheetLinkRow,
  isSheetRow,
  sheetRowNumber,
  timezoneSourceKey,
  zoneShortName,
  type ImportSourceDocument,
} from '@/utils/importReview'
import { importActivityBadge, importConfidenceBadge } from '@/utils/statusBadge'

const props = withDefaults(
  defineProps<{
    row: ImportActivityRow
    tourTimezone: string
    typeColor?: string | null
    saving?: boolean
    error?: string
    selected?: boolean
    sourceDocument?: ImportSourceDocument | null
    /** F3: la actividad ya no está en el feed (`detected.ical.removed`), no "cancelada". */
    removed?: boolean
    /** F4: hoja vinculada del job ("Ver origen" con su nombre y el enlace a la celda). */
    sheet?: ImportJobSheet | null
  }>(),
  {
    typeColor: null,
    saving: false,
    error: '',
    selected: false,
    sourceDocument: null,
    removed: false,
    sheet: null,
  }
)
const emit = defineEmits<{ patch: [patch: ImportActivityRowPatch]; edit: [row: ImportActivityRow] }>()

const { t, locale } = useI18n()

const peekOpen = ref(false)
const skipped = computed(() => props.row.action === 'skip')
const pending = computed(() => activityNeedsAction(props.row))
const status = computed(() => activityStatus(props.row))
const time = computed(() => activityTime(props.row))

const endTime = computed(() => {
  const r = props.row
  if (r.all_day || !time.value) return ''
  return r.end_time || (r.end_at ? formatLocalTime(r.end_at, r.destination_timezone || r.timezone) : '')
})

const otherZone = computed(() => !!props.row.timezone && props.row.timezone !== props.tourTimezone)
const zoneLabel = computed(() => zoneShortName(props.row.timezone, props.row.scheduled_at, locale.value))
const zoneTitle = computed(() => {
  const key = timezoneSourceKey(props.row.timezone_source)
  return key ? `${props.row.timezone} · ${t(key)}` : props.row.timezone
})

const cancelRow = computed(() => isCalendarCancelRow(props.row))
/** Cancelación sin actividad que cancelar: ni se crea ni se cancela nada. */
const goneRow = computed(() => isCalendarCancelGone(props.row))
/** Sin Editar ni Omitir/Recuperar: se decide en el resolutor o no hay nada que decidir. */
const noActions = computed(() => cancelRow.value || goneRow.value)
/** F4: duplicado que se vinculará a la hoja (o, con "No vincular", se crea como nueva). */
const linkRow = computed(() => isSheetLinkRow(props.row))
/**
 * Tachada si no entra (omitida) o si se va a cancelar. En una cancelada en el calendario, `skip` es
 * "Mantener": la actividad sigue y no se tacha; en una que se vinculará, la actividad se queda.
 */
const struck = computed(
  () => (skipped.value && !noActions.value && !linkRow.value) || props.row.action === 'cancel'
)

const sourceLabel = computed(() => {
  const s = props.row.source_ref
  if (!s) return ''
  if (isCalendarRow(props.row)) return t('importer.activities.fromCalendar')
  if (isSheetRow(props.row)) {
    const row = sheetRowNumber(s)
    if (s.sheet && row) return t('importer.activities.fromSheet', { tab: s.sheet, row })
    return s.sheet
      ? `${t('importer.activities.fromSheetOnly')} · ${s.sheet}`
      : t('importer.activities.fromSheetOnly')
  }
  if (s.page) return t('importer.activities.pageN', { page: s.page })
  return s.sheet || ''
})

const checkoutOf = computed(() =>
  isPairedCheckout(props.row)
    ? t('importer.activities.checkoutOf', {
        hotel: (props.row.metadata?.hotel_name as string | undefined) || props.row.location_name || '',
      })
    : ''
)

const issueTexts = computed(() => {
  if (skipped.value || goneRow.value) return []
  const out: { key: string; text: string }[] = []
  for (const code of props.row.issues) {
    const key = activityIssueKey(code)
    if (key) out.push({ key: code, text: t(key) })
  }
  if (props.row.in_past) out.push({ key: 'in_past', text: t('importer.activityIssues.in_past') })
  return out
})

// El posible duplicado se pregunta entero en el resolutor; aquí, la etiqueta corta.
const statusText = computed(() => {
  if (status.value === 'possible_duplicate') return t('importer.activities.possibleDuplicateShort')
  if (status.value === 'cancelled_in_source' && props.removed) {
    return t('importer.calendarCancel.removed')
  }
  return t(activityStatusKey(props.row))
})

/**
 * Recuperar una fila omitida la vuelve a `create` (el servidor recalcula `needs_action`); una
 * cambiada en el calendario, a `replace` ("Actualizar").
 */
function toggleSkip() {
  const id = props.row.client_id
  if (!skipped.value) emit('patch', { client_id: id, action: 'skip' })
  else if (isCalendarChangeRow(props.row) && props.row.match.activity_uuid) {
    emit('patch', { client_id: id, action: 'replace', reviewed: true })
  } else emit('patch', { client_id: id, action: 'create' })
}

const LINK_BTN =
  'min-h-[44px] lg:min-h-[32px] px-2 text-[13px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm disabled:opacity-50 disabled:cursor-not-allowed'
</script>

<template>
  <li
    class="rounded border px-3 py-2.5"
    :class="[
      pending ? 'border-failed-fg' : 'border-line',
      selected ? 'bg-glass-active' : 'bg-bg-3',
    ]"
    :data-row="row.client_id"
    :data-needs-action="pending ? 'true' : 'false'"
    data-test="import-activity-row"
  >
    <div class="flex items-start gap-3">
      <div
        class="w-[52px] shrink-0 pt-0.5 font-time tnum text-[14px] leading-tight"
        :class="struck ? 'text-ink-2' : 'text-ink'"
        data-test="import-activity-time"
      >
        <template v-if="row.all_day">
          <span class="font-sans text-[12px] text-ink-2">{{ t('importer.activities.allDay') }}</span>
        </template>
        <template v-else>
          <span class="block">{{ time || '—' }}</span>
          <span
            v-if="endTime"
            class="block text-[12px] text-ink-2"
          >{{ endTime }}</span>
        </template>
      </div>

      <div class="flex-1 min-w-0">
        <p class="flex items-center gap-2 min-w-0">
          <span
            class="w-2.5 h-2.5 shrink-0 rounded-full"
            :class="typeColor ? '' : 'bg-line-2'"
            :style="typeColor ? { background: typeColor } : undefined"
            aria-hidden="true"
            data-test="import-activity-dot"
          />
          <span
            class="text-[15px] font-semibold truncate"
            :class="struck ? 'text-ink-2 line-through' : 'text-ink'"
            data-test="import-activity-title"
          >{{ row.title }}</span>
        </p>
        <p class="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[13px] text-ink-2">
          <span>{{ row.type_name }}</span>
          <span
            v-if="checkoutOf"
            class="text-ink"
            data-test="import-activity-checkout"
          >{{ checkoutOf }}</span>
          <span
            v-if="otherZone"
            class="font-time tnum"
            :title="zoneTitle"
            data-test="import-activity-zone"
          >{{ zoneLabel }}</span>
          <span v-if="sourceLabel">{{ sourceLabel }}</span>
        </p>
      </div>

      <div class="flex flex-col items-end gap-1 shrink-0">
        <StatusBadge
          v-if="!skipped && !noActions"
          size="sm"
          :status="importConfidenceBadge(row.confidence)"
          :label="t(`importer.confidence.${confidenceTone(row.confidence)}`)"
          data-test="import-activity-confidence"
        />
        <StatusBadge
          v-if="status !== 'new' && !goneRow"
          size="sm"
          :status="importActivityBadge(status)"
          :label="statusText"
          data-test="import-activity-status"
        />
      </div>
    </div>

    <p
      v-if="goneRow"
      class="mt-1 pl-[64px] text-[13px] text-ink-2"
      data-test="import-activity-gone"
    >
      {{ t('importer.calendarCancel.gone') }}
    </p>

    <ul
      v-if="issueTexts.length"
      class="mt-1 flex flex-col gap-0.5 pl-[64px]"
    >
      <li
        v-for="i in issueTexts"
        :key="i.key"
        class="text-[13px] text-ink-2"
      >
        {{ i.text }}
      </li>
    </ul>

    <div class="flex flex-wrap items-center gap-1 mt-1 pl-[56px]">
      <button
        type="button"
        :class="LINK_BTN"
        :aria-expanded="peekOpen"
        data-test="import-activity-peek"
        @click="peekOpen = !peekOpen"
      >
        {{ peekOpen ? t('importer.activities.hideSource') : t('importer.activities.viewSource') }}
      </button>
      <button
        v-if="!skipped && !noActions"
        type="button"
        :class="LINK_BTN"
        :disabled="saving"
        data-test="import-activity-edit"
        @click="emit('edit', row)"
      >
        {{ t('importer.activities.edit') }}
      </button>
      <button
        v-if="!noActions && !linkRow"
        type="button"
        :class="LINK_BTN"
        :disabled="saving"
        :data-test="skipped ? 'import-activity-restore' : 'import-activity-skip'"
        @click="toggleSkip"
      >
        {{ skipped ? t('importer.activities.restore') : t('importer.activities.skip') }}
      </button>
      <span
        v-if="saving"
        class="w-3.5 h-3.5 rounded-full border-2 border-line-2 border-t-olive animate-spin"
        role="status"
        :aria-label="t('importer.activities.saving')"
      />
    </div>

    <ImportSourcePeek
      v-if="peekOpen"
      class="mt-2"
      :source-ref="row.source_ref"
      :source-document="sourceDocument"
      :timezone="row.timezone || tourTimezone"
      :sheet="sheet"
    />

    <p
      v-if="error"
      class="text-[13px] text-failed-fg mt-1"
      role="alert"
      data-test="import-activity-error"
    >
      {{ error }}
    </p>

    <slot />
  </li>
</template>
