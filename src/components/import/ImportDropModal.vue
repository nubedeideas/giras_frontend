<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import ImportDropZone from '@/components/import/ImportDropZone.vue'
import ImportProgress from '@/components/import/ImportProgress.vue'
import type { ImportEntryPoint, ImportJob } from '@/composables/useImportJobs'
import { errorKey } from '@/utils/importReview'

const props = withDefaults(
  defineProps<{ show: boolean; tourUuid: string; entryPoint?: ImportEntryPoint }>(),
  { entryPoint: 'tour' }
)
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const router = useRouter()

/** Job en curso: con valor se pinta el progreso en vez de la zona de subida. */
const jobUuid = ref<string | null>(null)
const failedJob = ref<ImportJob | null>(null)

const failedText = computed(() => {
  const j = failedJob.value
  if (!j) return ''
  return t(j.status === 'discarded' && j.error_code !== 'expired' ? 'importer.errors.generic' : errorKey(j.error_code))
})

function reset() {
  jobUuid.value = null
  failedJob.value = null
}

// Cerrar mientras procesa no cancela nada: el job sigue y aparece en el aviso de `TourView`.
watch(
  () => props.show,
  (open) => {
    if (!open) reset()
  }
)

function onCreated(job: ImportJob) {
  failedJob.value = null
  jobUuid.value = job.uuid
}

function onReady(job: ImportJob) {
  emit('close')
  reset()
  void router.push({ name: 'tour-import', params: { jobUuid: job.uuid } })
}

function onFailed(job: ImportJob) {
  failedJob.value = job
}
</script>

<template>
  <AppModal
    :show="show"
    persistent
    @close="emit('close')"
  >
    <button
      type="button"
      class="absolute top-3 right-3 flex items-center justify-center w-[44px] h-[44px] lg:w-8 lg:h-8 rounded-sm border border-line bg-bg-2 text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
      :aria-label="t('importer.close')"
      data-test="import-modal-close"
      @click="emit('close')"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <line
          x1="18"
          y1="6"
          x2="6"
          y2="18"
        /><line
          x1="6"
          y1="6"
          x2="18"
          y2="18"
        />
      </svg>
    </button>

    <div class="pr-12 mb-4">
      <p class="text-[17px] font-bold text-ink">
        {{ t('importer.modalTitle') }}
      </p>
      <p class="text-[14px] text-ink-2 mt-0.5">
        {{ t('importer.modalSub') }}
      </p>
    </div>

    <ImportDropZone
      v-if="!jobUuid"
      :tour-uuid="tourUuid"
      :entry-point="entryPoint"
      @created="onCreated"
    />

    <div
      v-else-if="failedJob"
      class="flex flex-col items-start gap-3"
    >
      <p
        class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2 w-full"
        role="alert"
        data-test="import-failed"
      >
        {{ failedText }}
      </p>
      <BtnSecondary
        type="button"
        data-test="import-retry"
        @click="reset"
      >
        {{ t('importer.retry') }}
      </BtnSecondary>
    </div>

    <div
      v-else
      class="flex flex-col gap-3"
    >
      <ImportProgress
        :job-uuid="jobUuid"
        @ready="onReady"
        @failed="onFailed"
      />
      <p class="text-[13px] text-ink-2">
        {{ t('importer.progress.background') }}
      </p>
    </div>
  </AppModal>
</template>
