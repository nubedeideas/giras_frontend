<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TemplateListPanel from '@/components/templates/TemplateListPanel.vue'
import TemplateDetail from '@/components/templates/TemplateDetail.vue'
import TemplateForm from '@/components/templates/TemplateForm.vue'
import {
  useNotificationTemplates,
  type NotificationTemplateListItem,
  type NotificationTemplate,
} from '@/composables/useNotificationTemplates'

const api = useNotificationTemplates()

const templates = ref<NotificationTemplateListItem[]>([])
const loading = ref(false)
const selectedId = ref<string | null>(null)
const selectedTemplate = ref<NotificationTemplate | null>(null)
const loadingDetail = ref(false)
const mode = ref<'idle' | 'detail' | 'create' | 'edit'>('idle')

async function loadTemplates() {
  loading.value = true
  try {
    templates.value = await api.listTemplates()
  } finally {
    loading.value = false
  }
}

async function selectTemplate(uuid: string) {
  selectedId.value = uuid
  mode.value = 'detail'
  loadingDetail.value = true
  selectedTemplate.value = null
  try {
    selectedTemplate.value = await api.getTemplate(uuid)
  } finally {
    loadingDetail.value = false
  }
}

function openCreate() {
  selectedId.value = null
  selectedTemplate.value = null
  mode.value = 'create'
}

async function onSaved(template: NotificationTemplate) {
  await loadTemplates()
  selectedId.value = template.uuid
  selectedTemplate.value = template
  mode.value = 'detail'
}

async function onDeleted() {
  await loadTemplates()
  selectedId.value = null
  selectedTemplate.value = null
  mode.value = 'idle'
}

async function onSetDefault(updated: NotificationTemplate) {
  // Refresh list so default indicator updates across rows
  await loadTemplates()
  if (selectedTemplate.value?.uuid === updated.uuid) {
    selectedTemplate.value = { ...selectedTemplate.value, is_default: true }
  }
}

function cancelForm() {
  if (selectedTemplate.value) {
    mode.value = 'detail'
  } else {
    mode.value = 'idle'
  }
}

onMounted(loadTemplates)
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <TemplateListPanel
      :templates="templates"
      :loading="loading"
      :selected-id="selectedId"
      @select="selectTemplate"
      @create="openCreate"
    />

    <!-- Right panel -->
    <div class="flex-1 overflow-hidden">
      <Transition name="fade">
        <!-- Create / Edit form -->
        <TemplateForm
          v-if="mode === 'create' || mode === 'edit'"
          :key="mode === 'edit' ? (selectedTemplate?.uuid ?? 'edit') : 'create'"
          :template="mode === 'edit' ? selectedTemplate : null"
          @cancel="cancelForm"
          @saved="onSaved"
        />

        <!-- Loading detail -->
        <div
          v-else-if="loadingDetail"
          class="h-full bg-bg-3 flex items-center justify-center"
        >
          <svg
            class="animate-spin text-ink-4"
            width="18"
            height="18"
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

        <!-- Detail panel -->
        <TemplateDetail
          v-else-if="selectedTemplate && mode === 'detail'"
          :key="selectedTemplate.uuid"
          :template="selectedTemplate"
          @edit="mode = 'edit'"
          @deleted="onDeleted"
          @set-default="onSetDefault"
        />

        <!-- Empty state -->
        <div
          v-else
          class="h-full bg-bg-3 flex flex-col items-center justify-center gap-2.5 text-ink-3"
        >
          <div
            class="w-12 h-12 rounded-[15px] bg-glass border border-line flex items-center justify-center"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink-4"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <p class="text-[12px]">Selecciona un template o crea uno nuevo</p>
        </div>
      </Transition>
    </div>
  </div>
</template>
