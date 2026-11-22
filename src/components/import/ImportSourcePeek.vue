<script setup lang="ts">
// "Ver origen" de una fila de actividad (F2 §4.3): archivo, hoja/página/fila, la cabecera de día
// que se usó como contexto y el texto original de la fila (`snippet`, sin enmascarar). En fotos y
// PDF escaneados no hay texto: enlace "Abrir documento" (`documents[].download_url`) y página.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImportActivitySourceRef } from '@/composables/useImportJobs'

const props = withDefaults(
  defineProps<{ sourceRef: ImportActivitySourceRef; documentUrl?: string | null }>(),
  { documentUrl: null }
)

const { t } = useI18n()

const file = computed(() => props.sourceRef.filename || t('importer.pastedText'))
const isVisual = computed(() => ['image', 'pdf_scan'].includes(props.sourceRef.kind))

const where = computed(() => {
  const s = props.sourceRef
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
      <span class="font-medium">{{ t('importer.activities.sourceContext') }}</span>
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
    <a
      v-if="documentUrl && (isVisual || !sourceRef.snippet)"
      :href="documentUrl"
      target="_blank"
      rel="noopener"
      class="self-start inline-flex items-center min-h-[44px] lg:min-h-0 font-medium text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
      data-test="import-source-open"
    >
      {{ t('importer.activities.openDocument') }}
      <template v-if="sourceRef.page">
        · {{ t('importer.activities.pageN', { page: sourceRef.page }) }}
      </template>
    </a>
  </div>
</template>
