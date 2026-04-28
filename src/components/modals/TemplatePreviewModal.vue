<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import {
  useNotificationTemplates,
  ALL_CANONICAL_VARS,
  type NotificationTemplate,
} from '@/composables/useNotificationTemplates'

const props = defineProps<{
  show: boolean
  template: NotificationTemplate | null
}>()
const emit = defineEmits<{ close: [] }>()

const api = useNotificationTemplates()

const contextValues = ref<Record<string, string>>({})
const loading = ref(false)
const error = ref('')
const previewResult = ref<{ subject?: string; body: string } | null>(null)

// Canonical variable keys used by this template
const usedVarKeys = computed<string[]>(() => {
  if (!props.template) return []
  const vars = props.template.variables
  if (Array.isArray(vars)) return vars as string[]
  // WhatsApp dict: values are canonical keys
  return Object.values(vars as Record<string, string>)
})

const varInputs = computed(() =>
  usedVarKeys.value.map((key) => ({
    key,
    label: ALL_CANONICAL_VARS.find((v) => v.key === key)?.label ?? key,
  })),
)

watch(
  () => props.show,
  (v) => {
    if (v) {
      contextValues.value = Object.fromEntries(usedVarKeys.value.map((k) => [k, '']))
      previewResult.value = null
      error.value = ''
    }
  },
)

async function generate() {
  if (!props.template) return
  loading.value = true
  error.value = ''
  previewResult.value = null
  try {
    const res = await api.previewTemplate(props.template.uuid, { ...contextValues.value })
    previewResult.value = res.preview
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al generar preview'
  } finally {
    loading.value = false
  }
}

const inputClass =
  'w-full bg-glass border border-line rounded-lg px-3 py-2 text-[12px] text-ink placeholder:text-ink-4 outline-none focus:border-line-2 transition-colors'
const labelClass =
  'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <!-- Header -->
    <div class="flex items-start justify-between mb-4">
      <div>
        <p class="text-base font-bold text-ink tracking-[-0.2px]">Preview</p>
        <p class="text-[10px] text-ink-3 mt-0.5 truncate max-w-[260px]">
          {{ template?.name }}
        </p>
      </div>
      <button
        class="w-7 h-7 flex items-center justify-center rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover flex-shrink-0"
        @click="emit('close')"
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
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
      <!-- Variable inputs -->
      <div v-if="varInputs.length > 0">
        <p class="text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-2">
          Variables de contexto
        </p>
        <div class="space-y-2">
          <div v-for="v in varInputs" :key="v.key">
            <label :class="labelClass">{{ v.label }}</label>
            <input
              v-model="contextValues[v.key]"
              :class="inputClass"
              :placeholder="`ej. valor para ${v.key}`"
            />
          </div>
        </div>
      </div>
      <p v-else class="text-[11px] text-ink-3">
        Este template no tiene variables — el preview mostrará el cuerpo tal cual.
      </p>

      <!-- Generate button -->
      <button
        class="w-full py-2.5 rounded-lg font-semibold text-[12px] border-none cursor-pointer transition-all flex items-center justify-center gap-2"
        :class="loading ? 'bg-glass text-ink-4 cursor-not-allowed' : 'bg-acid text-black'"
        :disabled="loading"
        @click="generate"
      >
        <svg
          v-if="loading"
          class="animate-spin"
          width="13"
          height="13"
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
        {{ loading ? 'Generando…' : 'Generar preview' }}
      </button>

      <!-- Error -->
      <p v-if="error" class="text-[11px] text-red-400">{{ error }}</p>

      <!-- Preview result -->
      <div v-if="previewResult" class="space-y-2">
        <div class="w-full h-px bg-line" />
        <p class="text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase">
          Resultado
        </p>
        <div
          v-if="previewResult.subject"
          class="bg-glass border border-line rounded-lg px-3 py-2.5"
        >
          <p class="text-[9px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-1">
            Asunto
          </p>
          <p class="text-[12px] text-ink">{{ previewResult.subject }}</p>
        </div>
        <div class="bg-glass border border-line rounded-lg px-3 py-2.5">
          <p class="text-[9px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-1">
            Cuerpo
          </p>
          <pre class="text-[12px] text-ink whitespace-pre-wrap font-sans leading-relaxed">{{
            previewResult.body
          }}</pre>
        </div>
      </div>
    </div>
  </AppModal>
</template>
