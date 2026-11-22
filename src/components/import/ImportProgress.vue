<script setup lang="ts">
import { computed, toRef, watch } from 'vue'
import { Translation as I18nT, useI18n } from 'vue-i18n'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import { useImportJobPolling } from '@/composables/useImportJobPolling'
import type { ImportJob } from '@/composables/useImportJobs'
import { IMPORT_PHASES, importErrorKey, phaseIndex, type ImportPhase } from '@/utils/importReview'

const props = defineProps<{ jobUuid: string | null }>()
const emit = defineEmits<{ ready: [job: ImportJob]; failed: [job: ImportJob] }>()

const { t } = useI18n()
const { job, error, slow, start } = useImportJobPolling(toRef(props, 'jobUuid'))

const current = computed(() => (job.value ? phaseIndex(job.value.status) : 0))

const progress = computed(() => {
  const p = job.value?.progress
  return p && 'calls_total' in p && p.calls_total > 0 ? p : null
})

function phaseLabel(phase: ImportPhase): string {
  if (phase === 'extracting') return t('importer.progress.extractingShort')
  return t(`importer.progress.${phase}`)
}

// Un solo aviso por job: el padre decide qué hacer (navegar a la revisión o reintentar).
let notified: string | null = null
watch(job, (j) => {
  if (!j || notified === j.uuid) return
  if (j.status === 'ready' || j.status === 'done') {
    notified = j.uuid
    emit('ready', j)
  } else if (j.status === 'failed' || j.status === 'discarded') {
    notified = j.uuid
    emit('failed', j)
  }
})

const errorText = computed(() => (error.value ? t(importErrorKey(error.value)) : ''))
</script>

<template>
  <div
    class="flex flex-col gap-3"
    data-test="import-progress"
  >
    <p class="text-[15px] font-semibold text-ink">
      {{ t('importer.progress.title') }}
    </p>
    <ol
      class="flex flex-col gap-2"
      aria-live="polite"
    >
      <li
        v-for="(phase, i) in IMPORT_PHASES"
        :key="phase"
        class="flex items-center gap-2.5 text-[14px]"
        :class="i <= current ? 'text-ink' : 'text-ink-2'"
        :data-phase="phase"
        :data-state="i < current ? 'done' : i === current ? 'current' : 'todo'"
      >
        <span
          class="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
          :class="i < current ? 'bg-sent-bg text-sent-fg' : i === current ? 'bg-acid' : 'bg-bg-4'"
          aria-hidden="true"
        >
          <svg
            v-if="i < current"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span
            v-else-if="i === current"
            class="w-2 h-2 rounded-full bg-night animate-pulse"
          />
        </span>
        <I18nT
          v-if="phase === 'extracting' && progress"
          keypath="importer.progress.extracting"
          tag="span"
        >
          <template #done>
            <span class="font-time tnum">{{ progress.calls_done }}</span>
          </template>
          <template #total>
            <span class="font-time tnum">{{ progress.calls_total }}</span>
          </template>
        </I18nT>
        <span v-else>{{ phaseLabel(phase) }}</span>
      </li>
    </ol>

    <p
      v-if="slow"
      class="text-[13px] text-ink-2 rounded-sm bg-pending-bg px-3 py-2"
      data-test="import-slow"
    >
      {{ t('importer.progress.slow') }}
    </p>

    <div
      v-if="error"
      class="flex flex-col items-start gap-2"
    >
      <p
        class="text-[14px] text-failed-fg"
        role="alert"
        data-test="import-progress-error"
      >
        {{ errorText }}
      </p>
      <BtnSecondary
        small
        type="button"
        @click="start"
      >
        {{ t('importer.retry') }}
      </BtnSecondary>
    </div>
  </div>
</template>
