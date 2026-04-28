<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  useNotificationTemplates,
  TemplateApiError,
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_CHANNELS,
  TEMPLATE_CHANNEL_LABELS,
  CANONICAL_VAR_GROUPS,
  type NotificationTemplate,
  type TemplatePayload,
  type TemplateType,
  type TemplateChannel,
  type BackendErrors,
} from '@/composables/useNotificationTemplates'

const props = defineProps<{ template: NotificationTemplate | null }>()
const emit = defineEmits<{ cancel: []; saved: [template: NotificationTemplate] }>()

const api = useNotificationTemplates()

// ─── Form state ───────────────────────────────────────────────────────────────

const name = ref('')
const notifType = ref<TemplateType>('event_reminder')
const channel = ref<TemplateChannel>('email')
const isActive = ref(true)

// Non-whatsapp fields
const subject = ref('')
const body = ref('')
const selectedVars = ref<string[]>([])

// WhatsApp fields
interface WAVar { pos: string; varKey: string }
const waVars = ref<WAVar[]>([{ pos: '1', varKey: '' }])
const twilio_sid = ref('')

// Save state
const saving = ref(false)
const fieldErrors = ref<BackendErrors | null>(null)
const globalError = ref('')

const isWhatsApp = computed(() => channel.value === 'whatsapp')
const isEdit = computed(() => !!props.template)

// ─── Initialize from template (edit mode) ────────────────────────────────────

function init() {
  const t = props.template
  if (t) {
    name.value = t.name
    notifType.value = t.notification_type
    channel.value = t.channel
    isActive.value = t.is_active
    subject.value = t.subject ?? ''
    body.value = t.body ?? ''
    twilio_sid.value = t.twilio_template_sid ?? ''

    if (Array.isArray(t.variables)) {
      selectedVars.value = [...(t.variables as string[])]
      waVars.value = [{ pos: '1', varKey: '' }]
    } else {
      const dict = t.variables as Record<string, string>
      waVars.value =
        Object.entries(dict).map(([pos, varKey]) => ({ pos, varKey })) || [
          { pos: '1', varKey: '' },
        ]
      selectedVars.value = []
    }
  } else {
    name.value = ''
    notifType.value = 'event_reminder'
    channel.value = 'email'
    isActive.value = true
    subject.value = ''
    body.value = ''
    twilio_sid.value = ''
    selectedVars.value = []
    waVars.value = [{ pos: '1', varKey: '' }]
  }
  fieldErrors.value = null
  globalError.value = ''
}

init()

// Reset WA vars when switching channel away from whatsapp and back
watch(channel, (newCh, oldCh) => {
  if (newCh === 'whatsapp' && oldCh !== 'whatsapp') {
    if (waVars.value.length === 0) waVars.value = [{ pos: '1', varKey: '' }]
  }
  fieldErrors.value = null
})

// ─── WA vars helpers ──────────────────────────────────────────────────────────

function addWAVar() {
  const nextPos = String(waVars.value.length + 1)
  waVars.value.push({ pos: nextPos, varKey: '' })
}

function removeWAVar(idx: number) {
  waVars.value.splice(idx, 1)
}

// ─── Variables toggle (non-whatsapp) ─────────────────────────────────────────

function toggleVar(key: string) {
  const idx = selectedVars.value.indexOf(key)
  if (idx === -1) selectedVars.value.push(key)
  else selectedVars.value.splice(idx, 1)
}

// ─── Field error helpers ──────────────────────────────────────────────────────

function fe(field: string): string | null {
  const val = fieldErrors.value?.[field]
  if (val == null) return null
  if (Array.isArray(val)) return (val as string[])[0] ?? null
  if (typeof val === 'string') return val
  return null
}

/** Flatten any backend error shape into a list of { field, message } entries. */
const backendErrorEntries = computed<{ field: string; message: string }[]>(() => {
  if (!fieldErrors.value) return []
  const result: { field: string; message: string }[] = []

  for (const [key, val] of Object.entries(fieldErrors.value)) {
    if (val == null) continue

    let msg: string
    if (Array.isArray(val)) {
      const first = val[0]
      msg = typeof first === 'string' ? first
          : first != null ? JSON.stringify(first)
          : ''
    } else if (typeof val === 'string') {
      msg = val
    } else if (typeof val === 'boolean') {
      continue // skip noise like "success: false"
    } else {
      msg = JSON.stringify(val)
    }

    if (!msg) continue

    if (key === 'non_field_errors') {
      result.unshift({ field: '', message: msg })
    } else {
      result.push({ field: key, message: msg })
    }
  }

  return result
})

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(): boolean {
  if (!name.value.trim()) {
    globalError.value = 'El nombre es requerido'
    return false
  }
  if (isWhatsApp.value) {
    if (!twilio_sid.value.trim()) {
      globalError.value = 'El Twilio Template SID es requerido para WhatsApp'
      return false
    }
    if (!/^HX[a-f0-9]{32}$/.test(twilio_sid.value.trim())) {
      globalError.value = 'El SID debe tener el formato HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      return false
    }
  } else {
    if (!body.value.trim()) {
      globalError.value = 'El cuerpo del template es requerido'
      return false
    }
  }
  globalError.value = ''
  return true
}

// ─── Submit ───────────────────────────────────────────────────────────────────

async function submit() {
  if (!validate()) return
  fieldErrors.value = null
  saving.value = true
  globalError.value = ''

  const payload: TemplatePayload = {
    name: name.value.trim(),
    notification_type: notifType.value,
    channel: channel.value,
    is_active: isActive.value,
  }

  if (isWhatsApp.value) {
    payload.twilio_template_sid = twilio_sid.value.trim()
    const vars: Record<string, string> = {}
    for (const v of waVars.value) {
      if (v.pos && v.varKey) vars[v.pos] = v.varKey
    }
    if (Object.keys(vars).length) payload.variables = vars
  } else {
    if (subject.value.trim()) payload.subject = subject.value.trim()
    payload.body = body.value.trim()
    if (selectedVars.value.length) payload.variables = [...selectedVars.value]
  }

  try {
    let saved: NotificationTemplate
    if (isEdit.value && props.template) {
      saved = await api.updateTemplate(props.template.uuid, payload)
    } else {
      saved = await api.createTemplate(payload)
    }
    emit('saved', saved)
  } catch (e) {
    if (e instanceof TemplateApiError) {
      fieldErrors.value = e.fieldErrors
      globalError.value = e.message
    } else {
      globalError.value = e instanceof Error ? e.message : 'Error al guardar'
    }
  } finally {
    saving.value = false
  }
}

const inputClass =
  'w-full bg-glass border border-line rounded-lg px-3 py-2 text-[12px] text-ink placeholder:text-ink-4 outline-none focus:border-line-2 transition-colors'
const inputErrorClass =
  'w-full bg-glass border border-red-500/50 rounded-lg px-3 py-2 text-[12px] text-ink placeholder:text-ink-4 outline-none focus:border-red-400 transition-colors'
const selectClass =
  'w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors cursor-pointer'
const labelClass =
  'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'
</script>

<template>
  <div class="h-full bg-bg-3 overflow-y-auto">
    <div class="max-w-2xl mx-auto px-6 py-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-ink tracking-[-0.3px]">
          {{ isEdit ? 'Editar template' : 'Nuevo template' }}
        </h1>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-glass border border-line text-ink-2 text-[11px] font-medium cursor-pointer hover:bg-glass-hover transition-colors"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
      </div>

      <div class="space-y-4">
        <!-- Name -->
        <div>
          <label :class="labelClass">Nombre *</label>
          <input
            v-model="name"
            :class="fe('name') ? inputErrorClass : inputClass"
            placeholder="ej. Recordatorio de show"
          />
          <p v-if="fe('name')" class="text-[10px] text-red-400 mt-0.5">{{ fe('name') }}</p>
        </div>

        <!-- Type + Channel -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label :class="labelClass">Tipo de notificación *</label>
            <select v-model="notifType" :class="selectClass">
              <option v-for="t in TEMPLATE_TYPES" :key="t" :value="t">
                {{ TEMPLATE_TYPE_LABELS[t] }}
              </option>
            </select>
            <p v-if="fe('notification_type')" class="text-[10px] text-red-400 mt-0.5">
              {{ fe('notification_type') }}
            </p>
          </div>
          <div>
            <label :class="labelClass">Canal *</label>
            <select v-model="channel" :class="selectClass">
              <option v-for="c in TEMPLATE_CHANNELS" :key="c" :value="c">
                {{ TEMPLATE_CHANNEL_LABELS[c] }}
              </option>
            </select>
            <p v-if="fe('channel')" class="text-[10px] text-red-400 mt-0.5">
              {{ fe('channel') }}
            </p>
          </div>
        </div>

        <!-- Active toggle -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer border-none flex-shrink-0"
            :class="isActive ? 'bg-acid' : 'bg-glass-hover'"
            @click="isActive = !isActive"
          >
            <span
              class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
              :class="isActive ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
          <span class="text-[12px] text-ink-2">Activo</span>
        </div>

        <!-- Divider -->
        <div class="w-full h-px bg-line" />

        <!-- ── WhatsApp fields ── -->
        <template v-if="isWhatsApp">
          <div>
            <label :class="labelClass">Twilio Template SID *</label>
            <input
              v-model="twilio_sid"
              :class="fe('twilio_template_sid') ? inputErrorClass : inputClass"
              placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              spellcheck="false"
            />
            <p class="text-[10px] text-ink-4 mt-0.5">Formato: HX seguido de 32 caracteres hex</p>
            <p v-if="fe('twilio_template_sid')" class="text-[10px] text-red-400 mt-0.5">
              {{ fe('twilio_template_sid') }}
            </p>
          </div>

          <!-- WA Variables (position → canonical key) -->
          <div>
            <label :class="labelClass">Variables</label>
            <div class="space-y-2 mb-2">
              <div
                v-for="(v, idx) in waVars"
                :key="idx"
                class="flex items-center gap-2"
              >
                <!-- Position number -->
                <div class="flex-shrink-0 w-[60px]">
                  <input
                    v-model="v.pos"
                    type="number"
                    min="1"
                    :class="inputClass"
                    placeholder="Pos"
                    style="text-align: center"
                  />
                </div>
                <!-- Canonical var select -->
                <select v-model="v.varKey" :class="selectClass" class="flex-1">
                  <option value="">— Variable —</option>
                  <optgroup
                    v-for="group in CANONICAL_VAR_GROUPS"
                    :key="group.label"
                    :label="group.label"
                  >
                    <option v-for="cv in group.vars" :key="cv.key" :value="cv.key">
                      {{ cv.key }}
                    </option>
                  </optgroup>
                </select>
                <!-- Remove row -->
                <button
                  class="w-7 h-7 flex items-center justify-center rounded-lg bg-glass border border-line text-ink-3 cursor-pointer hover:text-red-400 hover:border-red-400/30 transition-colors flex-shrink-0"
                  @click="removeWAVar(idx)"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <button
              class="flex items-center gap-1.5 text-[11px] text-ink-3 hover:text-acid transition-colors border-none bg-transparent cursor-pointer p-0"
              @click="addWAVar"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Añadir variable
            </button>
            <p v-if="fe('variables')" class="text-[10px] text-red-400 mt-1">
              {{ fe('variables') }}
            </p>
          </div>
        </template>

        <!-- ── Non-whatsapp fields ── -->
        <template v-else>
          <!-- Subject -->
          <div>
            <label :class="labelClass">Asunto <span class="text-ink-4 normal-case font-normal">(opcional)</span></label>
            <input
              v-model="subject"
              :class="fe('subject') ? inputErrorClass : inputClass"
              placeholder="Asunto del mensaje"
            />
            <p v-if="fe('subject')" class="text-[10px] text-red-400 mt-0.5">
              {{ fe('subject') }}
            </p>
          </div>

          <!-- Body -->
          <div>
            <label :class="labelClass">Cuerpo *</label>
            <p class="text-[10px] text-ink-4 mb-1">
              Usa <code class="bg-glass px-1 rounded">&#123;&#123;variable&#125;&#125;</code> para insertar variables
            </p>
            <textarea
              v-model="body"
              :class="fe('body') ? inputErrorClass : inputClass"
              rows="6"
              placeholder="Hola {{recipient_name}}, te recordamos que el evento {{event_title}} es el {{event_date}}..."
              style="resize: vertical"
            />
            <p v-if="fe('body')" class="text-[10px] text-red-400 mt-0.5">{{ fe('body') }}</p>
          </div>

          <!-- Variables multi-select -->
          <div>
            <label :class="labelClass">
              Variables disponibles
              <span class="text-ink-4 normal-case font-normal">
                — declara las usadas en el cuerpo
              </span>
            </label>
            <div class="space-y-3">
              <div v-for="group in CANONICAL_VAR_GROUPS" :key="group.label">
                <p class="text-[9px] font-bold text-ink-4 uppercase tracking-[0.5px] mb-1.5">
                  {{ group.label }}
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="cv in group.vars"
                    :key="cv.key"
                    type="button"
                    class="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-all duration-150 cursor-pointer font-mono"
                    :class="
                      selectedVars.includes(cv.key)
                        ? 'bg-acid/15 border-acid/40 text-acid'
                        : 'bg-glass border-line text-ink-3 hover:border-line-2 hover:text-ink-2'
                    "
                    @click="toggleVar(cv.key)"
                  >
                    {{ cv.key }}
                  </button>
                </div>
              </div>
            </div>
            <p v-if="fe('variables')" class="text-[10px] text-red-400 mt-1">
              {{ fe('variables') }}
            </p>
          </div>
        </template>

        <!-- Backend error summary -->
        <div
          v-if="backendErrorEntries.length > 0 || globalError"
          class="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 space-y-1.5"
        >
          <div
            v-for="(entry, i) in backendErrorEntries"
            :key="i"
            class="text-[11px] text-red-400 leading-snug"
          >
            <span v-if="entry.field" class="font-semibold font-mono">{{ entry.field }}:</span>
            {{ entry.message }}
          </div>
          <!-- Fallback when no structured field info was extracted -->
          <p v-if="backendErrorEntries.length === 0 && globalError" class="text-[11px] text-red-400">
            {{ globalError }}
          </p>
        </div>

        <!-- Submit -->
        <div class="flex gap-2 pt-2">
          <button
            class="flex-1 py-2.5 rounded-lg font-semibold text-[12px] border-none cursor-pointer transition-all flex items-center justify-center gap-2"
            :class="saving ? 'bg-glass text-ink-4 cursor-not-allowed' : 'bg-acid text-black'"
            :disabled="saving"
            @click="submit"
          >
            <svg
              v-if="saving"
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
            {{ saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear template' }}
          </button>
          <button
            class="px-5 py-2.5 rounded-lg font-semibold text-[12px] bg-glass border border-line text-ink-2 cursor-pointer hover:bg-glass-hover transition-colors"
            @click="emit('cancel')"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
