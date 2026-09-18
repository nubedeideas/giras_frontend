<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Pill from '@/components/ui/Pill.vue'
import {
  useTourDocuments,
  validateDocumentFile,
  type TourDocument,
  type TourDocumentType,
} from '@/composables/useTourDocuments'

const props = defineProps<{ tourUuid: string; isAdmin: boolean }>()
const { t } = useI18n()
const api = useTourDocuments()

const documents = ref<TourDocument[]>([])
const loading = ref(false)
const error = ref('')

const DOCUMENT_TYPES: { value: TourDocumentType; labelKey: string }[] = [
  { value: 'rider', labelKey: 'tourHub.documents.typeRider' },
  { value: 'visa', labelKey: 'tourHub.documents.typeVisa' },
  { value: 'insurance', labelKey: 'tourHub.documents.typeInsurance' },
  { value: 'contract', labelKey: 'tourHub.documents.typeContract' },
  { value: 'other', labelKey: 'tourHub.documents.typeOther' },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    documents.value = await api.listDocuments(props.tourUuid)
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('tourHub.documents.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.tourUuid, load)

// ─── Upload ─────────────────────────────────────────────────────────────────

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const documentType = ref<TourDocumentType>('other')
const description = ref('')
const uploading = ref(false)
const uploadError = ref('')

function pickFile() {
  fileInputRef.value?.click()
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null
  uploadError.value = file ? validateDocumentFile(file) ?? '' : ''
  selectedFile.value = file
}

async function submitUpload() {
  if (!selectedFile.value || uploading.value) return
  const validationError = validateDocumentFile(selectedFile.value)
  if (validationError) {
    uploadError.value = validationError
    return
  }
  uploading.value = true
  uploadError.value = ''
  try {
    const doc = await api.uploadDocument(props.tourUuid, {
      file: selectedFile.value,
      description: description.value.trim() || undefined,
      document_type: documentType.value,
    })
    documents.value.unshift(doc)
    selectedFile.value = null
    description.value = ''
    documentType.value = 'other'
    if (fileInputRef.value) fileInputRef.value.value = ''
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : t('tourHub.documents.loadError')
  } finally {
    uploading.value = false
  }
}

// ─── Download / delete ───────────────────────────────────────────────────────

async function download(doc: TourDocument) {
  const filename = doc.file.split('/').pop() || `${doc.document_type}-${doc.uuid}`
  try {
    await api.downloadDocument(props.tourUuid, doc.uuid, filename)
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('tourHub.documents.loadError')
  }
}

const deletingUuid = ref<string | null>(null)
const deleting = ref(false)

async function confirmDelete(doc: TourDocument) {
  deleting.value = true
  try {
    await api.deleteDocument(props.tourUuid, doc.uuid)
    documents.value = documents.value.filter((d) => d.uuid !== doc.uuid)
    deletingUuid.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('tourHub.documents.loadError')
  } finally {
    deleting.value = false
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div>
    <!-- Upload form (admin only) -->
    <div
      v-if="isAdmin"
      class="bg-bg-3 border border-line rounded-lg shadow-[0_1px_3px_var(--shadow-sm)] p-5 mb-4"
    >
      <p class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase mb-3">
        {{ t('tourHub.documents.upload') }}
      </p>
      <div class="flex flex-col sm:flex-row gap-2.5">
        <select
          v-model="documentType"
          class="bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid cursor-pointer transition-colors"
        >
          <option
            v-for="dt in DOCUMENT_TYPES"
            :key="dt.value"
            :value="dt.value"
          >
            {{ t(dt.labelKey) }}
          </option>
        </select>
        <input
          v-model="description"
          :placeholder="t('tourHub.documents.descriptionPh')"
          class="flex-1 bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        >
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp"
          @change="onFileChange"
        >
        <button
          class="flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover transition-colors cursor-pointer whitespace-nowrap"
          @click="pickFile"
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
          ><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          {{ selectedFile ? selectedFile.name : t('tourHub.documents.chooseFile') }}
        </button>
        <button
          class="px-3.5 py-2 rounded text-[12px] font-bold bg-acid text-black hover:opacity-90 transition-opacity cursor-pointer border-none disabled:opacity-40 whitespace-nowrap"
          :disabled="!selectedFile || uploading || !!uploadError"
          @click="submitUpload"
        >
          {{ uploading ? t('tourHub.documents.uploading') : t('tourHub.documents.upload') }}
        </button>
      </div>
      <p
        v-if="uploadError"
        class="text-[10px] text-red-400 mt-2"
      >
        {{ uploadError }}
      </p>
    </div>
    <p
      v-else
      class="text-[11px] text-ink-4 mb-4"
    >
      {{ t('tourHub.documents.adminOnly') }}
    </p>

    <!-- List -->
    <div
      v-if="loading"
      class="flex items-center justify-center py-16"
    >
      <svg
        class="animate-spin text-ink-4"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="3"
          stroke-dasharray="40 22"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <div
      v-else-if="error"
      class="py-10 text-center"
    >
      <p class="text-[12px] text-red-400 mb-2">
        {{ error }}
      </p>
      <button
        class="text-[11px] text-ink-3 hover:text-ink cursor-pointer border-none bg-transparent underline"
        @click="load"
      >
        Reintentar
      </button>
    </div>

    <div
      v-else-if="!documents.length"
      class="py-10 text-center"
    >
      <p class="text-[12px] text-ink-3">
        {{ t('tourHub.documents.empty') }}
      </p>
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <div
        v-for="doc in documents"
        :key="doc.uuid"
        class="bg-bg-3 border border-line rounded-lg p-3.5 flex items-center gap-3"
      >
        <div class="w-8 h-8 rounded-md bg-glass flex items-center justify-center flex-shrink-0 text-ink-3">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <Pill variant="n">
              {{ doc.document_type_display }}
            </Pill>
            <p
              v-if="doc.description"
              class="text-[12px] text-ink truncate"
            >
              {{ doc.description }}
            </p>
          </div>
          <p class="text-[10px] text-ink-4">
            {{ t('tourHub.documents.uploadedBy') }} {{ doc.uploaded_by_name }} · {{ formatSize(doc.file_size) }} · {{ formatDate(doc.created_at) }}
          </p>
        </div>

        <!-- Delete confirm -->
        <div
          v-if="deletingUuid === doc.uuid"
          class="flex items-center gap-1.5 flex-shrink-0"
        >
          <button
            class="px-2 py-1 rounded text-[10px] font-medium cursor-pointer border-none"
            style="background: rgba(239,68,68,0.2); color: #f87171"
            :disabled="deleting"
            @click="confirmDelete(doc)"
          >
            {{ deleting ? '…' : t('tourHub.documents.deleteYes') }}
          </button>
          <button
            class="px-2 py-1 rounded text-[10px] font-medium bg-glass text-ink-2 hover:bg-glass-hover transition-colors cursor-pointer border border-line"
            @click="deletingUuid = null"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
        <div
          v-else
          class="flex items-center gap-1 flex-shrink-0"
        >
          <button
            class="flex items-center justify-center w-7 h-7 rounded-md text-ink-3 hover:text-ink hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent"
            :title="t('tourHub.documents.download')"
            @click="download(doc)"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line
              x1="12"
              y1="15"
              x2="12"
              y2="3"
            /></svg>
          </button>
          <button
            v-if="isAdmin"
            class="flex items-center justify-center w-7 h-7 rounded-md text-ink-3 hover:text-red-400 hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent"
            :title="t('tourHub.documents.delete')"
            @click="deletingUuid = doc.uuid"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
