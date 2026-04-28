<script setup lang="ts">
import { ref } from 'vue'
import TemplatePreviewModal from '@/components/modals/TemplatePreviewModal.vue'
import {
  useNotificationTemplates,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_CHANNEL_LABELS,
  TEMPLATE_CHANNEL_COLORS,
  ALL_CANONICAL_VARS,
  type NotificationTemplate,
} from '@/composables/useNotificationTemplates'

const props = defineProps<{ template: NotificationTemplate }>()
const emit = defineEmits<{
  edit: []
  deleted: []
  setDefault: [template: NotificationTemplate]
}>()

const api = useNotificationTemplates()

const settingDefault = ref(false)
const defaultFeedback = ref('')
const deleting = ref(false)
const deleteConfirm = ref(false)
const deleteError = ref('')
const showPreview = ref(false)

function varLabel(key: string) {
  return ALL_CANONICAL_VARS.find((v) => v.key === key)?.label ?? key
}

async function setDefault() {
  settingDefault.value = true
  defaultFeedback.value = ''
  try {
    const res = await api.setAsDefault(props.template.uuid)
    defaultFeedback.value = res.message
    emit('setDefault', { ...props.template, is_default: true })
  } catch (e) {
    defaultFeedback.value = e instanceof Error ? e.message : 'Error'
  } finally {
    settingDefault.value = false
  }
}

async function confirmDelete() {
  deleting.value = true
  deleteError.value = ''
  try {
    await api.deleteTemplate(props.template.uuid)
    emit('deleted')
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Error al eliminar'
    deleting.value = false
    deleteConfirm.value = false
  }
}

const channelColor = TEMPLATE_CHANNEL_COLORS[props.template.channel]
</script>

<template>
  <div class="h-full bg-bg-3 overflow-y-auto">
    <div class="max-w-2xl mx-auto px-6 py-6">
      <!-- Top actions bar -->
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <!-- Channel pill -->
          <span
            class="text-[10px] font-bold px-2.5 py-1 rounded-full"
            :style="{ background: channelColor.bg, color: channelColor.text }"
          >
            {{ TEMPLATE_CHANNEL_LABELS[template.channel] }}
          </span>
          <!-- Active badge -->
          <span
            class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            :class="
              template.is_active
                ? 'bg-[rgba(52,211,153,0.12)] text-[#34d399]'
                : 'bg-glass text-ink-4'
            "
          >
            {{ template.is_active ? 'Activo' : 'Inactivo' }}
          </span>
          <!-- Default badge -->
          <span
            v-if="template.is_default"
            class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-acid/15 text-acid"
          >
            ★ Predeterminado
          </span>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-glass border border-line text-ink-2 text-[11px] font-medium cursor-pointer hover:bg-glass-hover transition-colors"
            @click="showPreview = true"
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
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Preview
          </button>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-glass border border-line text-ink-2 text-[11px] font-medium cursor-pointer hover:bg-glass-hover transition-colors"
            @click="emit('edit')"
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
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar
          </button>
        </div>
      </div>

      <!-- Name + slug -->
      <h1 class="text-xl font-bold text-ink tracking-[-0.3px] mb-1">{{ template.name }}</h1>
      <p class="text-[11px] text-ink-4 font-mono mb-4">{{ template.slug }}</p>

      <!-- Type -->
      <div class="mb-5">
        <p class="text-[10px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-1">Tipo</p>
        <p class="text-[13px] text-ink">{{ TEMPLATE_TYPE_LABELS[template.notification_type] }}</p>
      </div>

      <!-- Divider -->
      <div class="w-full h-px bg-line mb-5" />

      <!-- WhatsApp fields -->
      <template v-if="template.channel === 'whatsapp'">
        <div class="mb-5">
          <p class="text-[10px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-1">
            Twilio Template SID
          </p>
          <p class="text-[12px] text-ink font-mono break-all">
            {{ template.twilio_template_sid || '—' }}
          </p>
        </div>
        <div v-if="template.variables && Object.keys(template.variables).length" class="mb-5">
          <p class="text-[10px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-2">
            Variables
          </p>
          <div class="bg-glass border border-line rounded-lg overflow-hidden">
            <div
              v-for="(varKey, pos) in (template.variables as Record<string, string>)"
              :key="pos"
              class="flex items-center gap-3 px-3 py-2 border-b border-line last:border-b-0"
            >
              <span
                class="w-6 h-6 rounded-full bg-acid/15 text-acid text-[10px] font-bold flex items-center justify-center flex-shrink-0"
              >
                {{ pos }}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-[11px] font-mono text-ink-2">{{ varKey }}</p>
                <p class="text-[10px] text-ink-4">{{ varLabel(varKey) }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Non-whatsapp fields -->
      <template v-else>
        <div v-if="template.subject" class="mb-5">
          <p class="text-[10px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-1">
            Asunto
          </p>
          <p class="text-[13px] text-ink">{{ template.subject }}</p>
        </div>
        <div v-if="template.body" class="mb-5">
          <p class="text-[10px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-2">
            Cuerpo
          </p>
          <div class="bg-glass border border-line rounded-lg px-3 py-3">
            <pre class="text-[12px] text-ink whitespace-pre-wrap font-sans leading-relaxed">{{
              template.body
            }}</pre>
          </div>
        </div>
        <div
          v-if="Array.isArray(template.variables) && (template.variables as string[]).length"
          class="mb-5"
        >
          <p class="text-[10px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-2">
            Variables
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="varKey in (template.variables as string[])"
              :key="varKey"
              class="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-glass border border-line text-ink-2 font-mono"
            >
              <span class="text-acid">&#123;&#123;</span>{{ varKey
              }}<span class="text-acid">&#125;&#125;</span>
            </span>
          </div>
        </div>
      </template>

      <!-- Divider -->
      <div class="w-full h-px bg-line mb-5" />

      <!-- Set as default -->
      <div class="mb-5">
        <template v-if="!template.is_default">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-lg border text-[12px] font-semibold cursor-pointer transition-all"
            :class="
              settingDefault
                ? 'bg-glass border-line text-ink-4 cursor-not-allowed'
                : 'bg-glass border-line-acid text-acid hover:bg-acid/10'
            "
            :disabled="settingDefault"
            @click="setDefault"
          >
            <svg
              v-if="settingDefault"
              class="animate-spin"
              width="12"
              height="12"
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
            <svg
              v-else
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              />
            </svg>
            Establecer como predeterminado
          </button>
          <p v-if="defaultFeedback" class="text-[11px] text-[#34d399] mt-2">
            {{ defaultFeedback }}
          </p>
        </template>
        <div
          v-else
          class="flex items-center gap-2 text-[12px] text-acid font-semibold"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Template predeterminado para esta combinación
        </div>
      </div>

      <!-- Delete -->
      <div class="pt-2 border-t border-line">
        <template v-if="!deleteConfirm">
          <button
            class="text-[11px] text-ink-4 hover:text-red-400 transition-colors border-none bg-transparent cursor-pointer p-0"
            @click="deleteConfirm = true"
          >
            Eliminar template
          </button>
        </template>
        <template v-else>
          <p class="text-[12px] text-ink-2 mb-2">¿Eliminar este template? Esta acción no se puede deshacer.</p>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-[12px] font-semibold border-none cursor-pointer hover:bg-red-500/25 transition-colors"
              :disabled="deleting"
              @click="confirmDelete"
            >
              {{ deleting ? 'Eliminando…' : 'Sí, eliminar' }}
            </button>
            <button
              class="px-4 py-2 rounded-lg bg-glass border border-line text-ink-2 text-[12px] font-semibold cursor-pointer hover:bg-glass-hover transition-colors"
              @click="deleteConfirm = false"
            >
              Cancelar
            </button>
          </div>
          <p v-if="deleteError" class="text-[11px] text-red-400 mt-1.5">{{ deleteError }}</p>
        </template>
      </div>
    </div>
  </div>

  <TemplatePreviewModal :show="showPreview" :template="template" @close="showPreview = false" />
</template>
