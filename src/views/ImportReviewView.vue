<script setup lang="ts">
// STUB del lote 1 de F1: existe solo para que la ruta `tour-import` compile y se pueda navegar
// desde el modal. El lote 2 (gvue, rama f1-import-review) lo sustituye entero por la revisión
// completa de la spec §4.3.
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ImportProgress from '@/components/import/ImportProgress.vue'
import { getImportJob, type ImportJob } from '@/composables/useImportJobs'
import { isImportProcessing } from '@/composables/useImportJobPolling'
import { importErrorKey } from '@/utils/importReview'

const { t } = useI18n()
const route = useRoute()
const jobUuid = String(route.params.jobUuid ?? '')
const job = ref<ImportJob | null>(null)
const loading = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  try {
    job.value = await getImportJob(jobUuid)
  } catch (e) {
    errorMsg.value = t(importErrorKey(e))
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <p
        v-if="loading"
        class="text-[14px] text-ink-2"
      >
        {{ t('common.loading') }}
      </p>
      <p
        v-else-if="errorMsg"
        class="text-[14px] text-failed-fg"
        role="alert"
      >
        {{ errorMsg }}
      </p>
      <ImportProgress
        v-else-if="isImportProcessing(job)"
        :job-uuid="jobUuid"
        @ready="job = $event"
        @failed="job = $event"
      />
      <p
        v-else-if="job"
        class="text-[14px] text-ink-2"
      >
        {{ t('importer.toResolve', { n: job.summary?.needs_action ?? 0 }, job.summary?.needs_action ?? 0) }}
      </p>
    </div>
  </div>
</template>
