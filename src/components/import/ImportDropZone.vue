<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  createImportJob,
  type ImportEntryPoint,
  type ImportJob,
} from '@/composables/useImportJobs'
import {
  hasIcs,
  importErrorKey,
  importFileKind,
  IMPORT_MAX_TEXT_CHARS,
  validateImportFiles,
} from '@/utils/importReview'
import { downscaleImage, ImageDecodeError } from '@/utils/imageResize'

const props = defineProps<{
  tourUuid: string
  entryPoint: ImportEntryPoint
  compact?: boolean
}>()
const emit = defineEmits<{ created: [job: ImportJob] }>()

const { t } = useI18n()
const { isMobile } = useIsMobile()

// Sin `capture`: en móvil impediría elegir archivos. La cámara va en un input aparte.
const ACCEPT = '.xlsx,.xls,.csv,.pdf,.ics,image/jpeg,image/png,image/webp'

const files = ref<File[]>([])
const text = ref('')
const showPaste = ref(false)
const dragging = ref(false)
const preparing = ref(false)
const submitting = ref(false)
/** Mensaje ya traducido (nunca un código crudo). */
const errorMsg = ref('')

const fileInput = ref<HTMLInputElement | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)

const busy = computed(() => preparing.value || submitting.value)
const showIcsNotice = computed(() => hasIcs(files.value))
const canSubmit = computed(
  () => !busy.value && (files.value.length > 0 || text.value.trim().length > 0)
)

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Reduce las fotos y valida el lote entero; si algo falla, no se añade nada de este lote. */
async function addFiles(list: FileList | File[] | null | undefined) {
  const incoming = Array.from(list ?? [])
  if (!incoming.length) return
  errorMsg.value = ''
  preparing.value = true
  try {
    const prepared: File[] = []
    for (const f of incoming) {
      const kind = importFileKind(f)
      if (!kind) {
        errorMsg.value = t('importer.errors.fileType', { file: f.name })
        return
      }
      if (kind !== 'image') {
        prepared.push(f)
        continue
      }
      try {
        prepared.push(await downscaleImage(f))
      } catch (e) {
        if (e instanceof ImageDecodeError) {
          errorMsg.value = t('importer.errors.heic')
          return
        }
        throw e
      }
    }
    const next = [...files.value, ...prepared]
    const problem = validateImportFiles(next)
    if (problem) {
      if (problem.code === 'fileType') errorMsg.value = t('importer.errors.fileType', { file: problem.file })
      else if (problem.code === 'fileTooLarge') {
        errorMsg.value = t('importer.errors.fileTooLarge', { file: problem.file, mb: problem.mb })
      } else if (problem.code === 'tooManyFiles') errorMsg.value = t('importer.errors.tooManyFiles')
      else errorMsg.value = t('importer.errors.too_large')
      return
    }
    files.value = next
  } catch {
    errorMsg.value = t('importer.errors.generic')
  } finally {
    preparing.value = false
  }
}

function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  void addFiles(input.files)
  // Permite volver a elegir el mismo archivo tras quitarlo.
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  void addFiles(e.dataTransfer?.files)
}

function removeFile(i: number) {
  files.value = files.value.filter((_, j) => j !== i)
  errorMsg.value = ''
}

async function submit() {
  errorMsg.value = ''
  if (!files.value.length && !text.value.trim()) {
    errorMsg.value = t('importer.errors.empty_import')
    return
  }
  if (text.value.length > IMPORT_MAX_TEXT_CHARS) {
    errorMsg.value = t('importer.errors.textTooLong')
    return
  }
  submitting.value = true
  try {
    const job = await createImportJob({
      tourUuid: props.tourUuid,
      files: files.value,
      text: text.value,
      entryPoint: props.entryPoint,
    })
    emit('created', job)
  } catch (e) {
    errorMsg.value = t(importErrorKey(e))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    class="flex flex-col"
    :class="compact ? 'gap-3' : 'gap-4'"
  >
    <!-- Zona de arrastre -->
    <div
      data-test="import-dropzone"
      class="rounded border-2 border-dashed text-center transition-colors"
      :class="[
        dragging ? 'border-olive bg-acid-dim' : 'border-line-2 bg-bg-2',
        compact ? 'px-4 py-4' : 'px-5 py-6',
      ]"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <div
        v-if="!compact"
        class="flex items-center justify-center gap-4 mb-3 text-ink-2"
        aria-hidden="true"
      >
        <span class="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {{ t('importer.drop.kindPdf') }}
        </span>
        <span class="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
            />
            <line
              x1="3"
              y1="9"
              x2="21"
              y2="9"
            />
            <line
              x1="3"
              y1="15"
              x2="21"
              y2="15"
            />
            <line
              x1="9"
              y1="3"
              x2="9"
              y2="21"
            />
          </svg>
          {{ t('importer.drop.kindExcel') }}
        </span>
        <span class="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle
              cx="12"
              cy="13"
              r="4"
            />
          </svg>
          {{ t('importer.drop.kindPhoto') }}
        </span>
      </div>

      <p class="text-[14px] font-semibold text-ink">
        {{ t('importer.drop.title') }}
      </p>
      <p class="text-[13px] text-ink-2 mt-1">
        {{ t('importer.drop.limits') }}
      </p>

      <div class="flex flex-wrap items-center justify-center gap-2 mt-3">
        <BtnSecondary
          small
          type="button"
          data-test="import-choose"
          :disabled="busy"
          @click="fileInput?.click()"
        >
          {{ t('importer.drop.choose') }}
        </BtnSecondary>
        <BtnSecondary
          v-if="isMobile"
          small
          type="button"
          data-test="import-photo"
          :disabled="busy"
          @click="photoInput?.click()"
        >
          {{ t('importer.drop.photo') }}
        </BtnSecondary>
      </div>

      <input
        ref="fileInput"
        type="file"
        class="hidden"
        data-test="import-file-input"
        :accept="ACCEPT"
        multiple
        @change="onInputChange"
      >
      <input
        v-if="isMobile"
        ref="photoInput"
        type="file"
        class="hidden"
        data-test="import-photo-input"
        accept="image/*"
        capture="environment"
        multiple
        @change="onInputChange"
      >
    </div>

    <!-- Archivos elegidos -->
    <ul
      v-if="files.length"
      class="flex flex-col gap-1.5"
      data-test="import-file-list"
    >
      <li
        v-for="(f, i) in files"
        :key="`${f.name}-${i}`"
        class="flex items-center gap-2 rounded-sm border border-line bg-bg-3 pl-3 pr-1 py-1"
      >
        <span class="flex-1 min-w-0 truncate text-[14px] text-ink">{{ f.name }}</span>
        <span class="font-time tnum text-[12px] text-ink-2 flex-shrink-0">{{ formatSize(f.size) }}</span>
        <button
          type="button"
          class="flex items-center justify-center w-[44px] h-[44px] lg:w-8 lg:h-8 rounded-sm text-ink-2 hover:text-ink hover:bg-glass-hover bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
          :aria-label="t('importer.drop.remove', { file: f.name })"
          :disabled="busy"
          @click="removeFile(i)"
        >
          <svg
            width="12"
            height="12"
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
      </li>
    </ul>

    <p
      v-if="showIcsNotice"
      class="text-[13px] text-ink-2 rounded-sm bg-scheduled-bg px-3 py-2"
      data-test="import-ics-notice"
    >
      {{ t('importer.drop.icsLater') }}
    </p>

    <!-- Pegar texto -->
    <div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-0 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
        data-test="import-paste-toggle"
        :aria-expanded="showPaste"
        @click="showPaste = !showPaste"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform"
          :class="showPaste ? 'rotate-90' : 'rotate-0'"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {{ t('importer.drop.pasteToggle') }}
      </button>
      <div
        v-if="showPaste"
        class="mt-2"
      >
        <textarea
          v-model="text"
          data-test="import-text"
          :rows="compact ? 4 : 6"
          :maxlength="IMPORT_MAX_TEXT_CHARS"
          :placeholder="t('importer.drop.pastePlaceholder')"
          class="w-full rounded-sm border border-line bg-bg-3 px-3 py-2 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-olive resize-y"
        />
        <p class="text-right font-time tnum text-[12px] text-ink-2">
          {{ t('importer.drop.pasteCount', { n: text.length, max: IMPORT_MAX_TEXT_CHARS }) }}
        </p>
      </div>
    </div>

    <p class="text-[13px] text-ink-2">
      {{ t('importer.drop.privacyNote') }}
    </p>

    <p
      v-if="errorMsg"
      class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
      role="alert"
      data-test="import-error"
    >
      {{ errorMsg }}
    </p>

    <div class="flex items-center gap-3">
      <BtnPrimary
        type="button"
        data-test="import-submit"
        :full="compact"
        :disabled="!canSubmit"
        :class="canSubmit ? 'opacity-100' : 'opacity-50 cursor-not-allowed'"
        @click="submit"
      >
        {{ preparing ? t('importer.drop.preparing') : submitting ? t('importer.drop.sending') : t('importer.drop.submit') }}
      </BtnPrimary>
    </div>
  </div>
</template>
