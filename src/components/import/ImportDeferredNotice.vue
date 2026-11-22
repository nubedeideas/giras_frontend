<script setup lang="ts">
// Fuentes y tramos de páginas que F1 no procesa (F1 §4.2, §3.5.1): una línea por fuente diferida
// y otra por tramo de páginas de un PDF ("Dossier_MAD.pdf, páginas 3-8: itinerario…").
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImportJob } from '@/composables/useImportJobs'
import { deferredSources, pageRanges } from '@/utils/importReview'

/**
 * `IMPORT_PDF_MAX_SCANNED_PAGES` del backend (§3.3, default 10). Ni `detected` ni
 * `deferred_pages[]` exponen el límite (comprobado en `preprocess.py`, `defer_pages` guarda solo
 * `pages` y `reason`): si en producción se cambia por entorno, este texto quedaría desfasado.
 * Pendiente de que el backend añada `limit` al tramo `scan_pages_limit`; entonces, leerlo de ahí.
 */
const SCANNED_PAGES_LIMIT = 10

const props = defineProps<{ job: Pick<ImportJob, 'detected'> }>()

const { t } = useI18n()

const lines = computed(() =>
  deferredSources(props.job).map((d, i) => {
    const params = {
      file: d.filename || t('importer.pastedText'),
      pages: d.pages ? pageRanges(d.pages) : '',
      limit: SCANNED_PAGES_LIMIT,
    }
    const key = d.pages ? `importer.deferred.pages.${d.reason}` : `importer.deferred.${d.reason}`
    return { key: `${i}-${d.reason}`, text: t(key, params) }
  })
)
</script>

<template>
  <div
    v-if="lines.length"
    class="rounded border border-line bg-bg-2 px-4 py-3"
    data-test="import-deferred"
  >
    <p class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase mb-1.5">
      {{ t('importer.deferred.title') }}
    </p>
    <ul class="flex flex-col gap-1">
      <li
        v-for="line in lines"
        :key="line.key"
        class="text-[14px] text-ink-2"
        data-test="import-deferred-line"
      >
        {{ line.text }}
      </li>
    </ul>
  </div>
</template>
