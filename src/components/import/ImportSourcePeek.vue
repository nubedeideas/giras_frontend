<script setup lang="ts">
// "Ver origen" de una fila de actividad (F2 §4.3): archivo, hoja/página/fila, la cabecera de día
// que se usó como contexto y el texto original de la fila (`snippet`, sin enmascarar). En fotos y
// PDF escaneados no hay texto: botón "Abrir documento" y página. `download_url` exige JWT (en una
// pestaña nueva da 401): el documento se descarga con `apiClient`, como en Documentos de Mi Gira.
// F3 §4.4: en filas de calendario (`kind === 'ics'`), "{archivo} · evento {row}", el calendario
// (`context`, X-WR-CALNAME), el texto del evento, el UID (truncado, completo en `title`), la
// repetición (`recurrence_id`) y la versión (`sequence` > 0).
import { computed, ref } from 'vue'
import { Translation, useI18n } from 'vue-i18n'
import type { ImportActivitySourceRef } from '@/composables/useImportJobs'
import { useTourDocuments } from '@/composables/useTourDocuments'
import { formatRecurrenceId, type ImportSourceDocument } from '@/utils/importReview'

const props = withDefaults(
  defineProps<{
    sourceRef: ImportActivitySourceRef
    sourceDocument?: ImportSourceDocument | null
    /** Zona en la que se pinta la repetición de un evento de calendario. */
    timezone?: string
  }>(),
  { sourceDocument: null, timezone: 'Europe/Madrid' }
)

const { t, locale } = useI18n()

const downloading = ref(false)
const downloadError = ref(false)

async function openDocument() {
  const doc = props.sourceDocument
  if (!doc || downloading.value) return
  downloading.value = true
  downloadError.value = false
  try {
    await useTourDocuments().downloadDocument(doc.tourUuid, doc.uuid, doc.filename)
  } catch {
    downloadError.value = true
  } finally {
    downloading.value = false
  }
}

const file = computed(() => props.sourceRef.filename || t('importer.pastedText'))
const isVisual = computed(() => ['image', 'pdf_scan'].includes(props.sourceRef.kind))

const isCalendar = computed(() => props.sourceRef.kind === 'ics')

/** UID muy largos (Google, Outlook) se recortan; el completo va en `title`. */
const UID_MAX = 48
const uid = computed(() => props.sourceRef.uid ?? '')
const uidShort = computed(() =>
  uid.value.length > UID_MAX ? `${uid.value.slice(0, UID_MAX)}…` : uid.value
)
const recurrence = computed(() =>
  formatRecurrenceId(props.sourceRef.recurrence_id, props.timezone, locale.value)
)
const version = computed(() => props.sourceRef.sequence ?? 0)

const where = computed(() => {
  const s = props.sourceRef
  if (isCalendar.value) {
    return t('importer.activities.sourceEvent', {
      file: s.filename || t('importer.activities.fromCalendar'),
      row: s.row,
    })
  }
  if (s.page) return t('importer.activities.sourcePage', { file: file.value, page: s.page })
  return t('importer.activities.sourceRow', { file: file.value, row: s.sheet ? `${s.sheet} · ${s.row}` : s.row })
})
</script>

<template>
  <div
    class="flex flex-col gap-1.5 rounded-sm border border-line bg-bg-2 px-3 py-2 text-[13px]"
    data-test="import-source-peek"
  >
    <p
      class="font-semibold text-ink break-words"
      data-test="import-source-where"
    >
      {{ where }}
    </p>
    <p
      v-if="sourceRef.context"
      class="text-ink-2 break-words"
      data-test="import-source-context"
    >
      <span class="font-medium">{{
        isCalendar ? t('importer.activities.sourceCalendar') : t('importer.activities.sourceContext')
      }}</span>
      {{ sourceRef.context }}
    </p>
    <p
      v-if="sourceRef.snippet"
      class="whitespace-pre-wrap break-words rounded-sm bg-bg-3 border border-line-soft px-2 py-1.5 text-ink"
      data-test="import-source-snippet"
    >
      {{ sourceRef.snippet }}
    </p>
    <p
      v-else-if="isVisual"
      class="text-ink-2"
    >
      {{ t('importer.activities.noSnippet') }}
    </p>
    <template v-if="isCalendar">
      <p
        v-if="uid"
        class="text-ink-2 break-all"
        :title="uid"
        data-test="import-source-uid"
      >
        {{ t('importer.activities.uid', { uid: uidShort }) }}
      </p>
      <Translation
        v-if="recurrence"
        keypath="importer.activities.recurrence"
        scope="global"
        tag="p"
        class="text-ink-2"
        data-test="import-source-recurrence"
      >
        <template #date>
          <span class="font-time tnum">{{ recurrence }}</span>
        </template>
      </Translation>
      <p
        v-if="version > 0"
        class="text-ink-2"
        data-test="import-source-version"
      >
        {{ t('importer.activities.version', { n: version }) }}
      </p>
    </template>
    <button
      v-if="sourceDocument && (isVisual || !sourceRef.snippet)"
      type="button"
      class="self-start inline-flex items-center min-h-[44px] lg:min-h-0 p-0 font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="downloading"
      :aria-busy="downloading"
      data-test="import-source-open"
      @click="openDocument"
    >
      {{ downloading ? t('importer.activities.openingDocument') : t('importer.activities.openDocument') }}
      <template v-if="sourceRef.page">
        · {{ t('importer.activities.pageN', { page: sourceRef.page }) }}
      </template>
    </button>
    <p
      v-if="downloadError"
      class="text-failed-fg"
      role="alert"
      data-test="import-source-open-error"
    >
      {{ t('importer.activities.openDocumentError') }}
    </p>
  </div>
</template>
