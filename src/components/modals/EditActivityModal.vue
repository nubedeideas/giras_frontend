<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import {
  useActivities,
  type Activity,
  type ActivityTypeListItem,
  type ActivityStatus,
  type ActivityPriority,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/composables/useActivities'
import { useActivitiesStore } from '@/stores/activities'

const props = defineProps<{ show: boolean; activity: Activity | null }>()
const emit = defineEmits<{ close: []; saved: [activity: Activity] }>()

const api = useActivities()
const store = useActivitiesStore()

// ─── Form state ──────────────────────────────────────────────────────────────

const title = ref('')
const activityTypeUuid = ref('')
const status = ref<ActivityStatus>('scheduled')
const priority = ref<ActivityPriority>('normal')
const scheduledAt = ref('')   // "YYYY-MM-DDTHH:MM" local input value
const endAt = ref('')
const allDay = ref(false)
const locationName = ref('')
const destinationName = ref('')
const notes = ref('')
const description = ref('')

const activityTypes = ref<ActivityTypeListItem[]>([])
const loadingTypes = ref(false)
const saving = ref(false)
const saveError = ref('')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  // Convert UTC ISO to YYYY-MM-DDTHH:MM for datetime-local input
  return iso.replace('Z', '').slice(0, 16)
}

function fromInputValue(val: string): string | null {
  if (!val) return null
  // Treat input as UTC and add Z
  return val + ':00Z'
}

const STATUSES: ActivityStatus[] = ['draft', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'delayed']
const PRIORITIES: ActivityPriority[] = ['low', 'normal', 'high', 'urgent']

const CATEGORY_LABELS: Record<string, string> = {
  logistics: 'Logística', production: 'Producción', media: 'Medios',
  meetings: 'Reuniones', fan: 'Fan', personal: 'Personal', other: 'Otro',
}

const typesByCategory = computed(() => {
  const map = new Map<string, ActivityTypeListItem[]>()
  for (const t of activityTypes.value) {
    if (!map.has(t.category)) map.set(t.category, [])
    map.get(t.category)!.push(t)
  }
  return map
})

// ─── Init / sync ──────────────────────────────────────────────────────────────

async function loadTypes() {
  if (activityTypes.value.length > 0) return
  loadingTypes.value = true
  try {
    activityTypes.value = await api.listActivityTypes()
  } catch {
    // ignore, types will be empty
  } finally {
    loadingTypes.value = false
  }
}

function populateForm(act: Activity) {
  title.value = act.title
  activityTypeUuid.value = act.activity_type?.uuid ?? ''
  status.value = act.status
  priority.value = act.priority
  scheduledAt.value = toInputValue(act.scheduled_at)
  endAt.value = toInputValue(act.end_at)
  allDay.value = act.all_day
  locationName.value = act.location_name
  destinationName.value = act.destination_name
  notes.value = act.notes
  description.value = act.description
  saveError.value = ''
}

watch(() => props.show, async (v) => {
  if (v && props.activity) {
    populateForm(props.activity)
    await loadTypes()
  }
})

watch(() => props.activity, (act) => {
  if (act && props.show) populateForm(act)
})

// ─── Save ─────────────────────────────────────────────────────────────────────

async function save() {
  if (!props.activity || !title.value.trim()) return
  saving.value = true
  saveError.value = ''
  try {
    const updated = await api.updateActivity(props.activity.uuid, {
      title: title.value.trim(),
      activity_type: activityTypeUuid.value || undefined,
      status: status.value,
      priority: priority.value,
      scheduled_at: allDay.value
        ? (scheduledAt.value ? scheduledAt.value.slice(0, 10) + 'T00:00:00Z' : undefined)
        : fromInputValue(scheduledAt.value) ?? undefined,
      end_at: allDay.value ? null : fromInputValue(endAt.value),
      all_day: allDay.value,
      location_name: locationName.value,
      destination_name: destinationName.value,
      notes: notes.value,
      description: description.value,
    })

    // Refresh list item
    store.replaceActivity({
      uuid: updated.uuid,
      title: updated.title,
      scheduled_at: updated.scheduled_at,
      end_at: updated.end_at,
      timezone: updated.timezone,
      local_start_time: null,
      status: updated.status,
      priority: updated.priority,
      all_day: updated.all_day,
      location_name: updated.location_name,
      destination_name: updated.destination_name,
      activity_type_name: updated.activity_type?.name ?? '',
      activity_type_code: updated.activity_type?.code ?? '',
      activity_type_icon: updated.activity_type?.icon ?? '',
      activity_type_color: updated.activity_type?.color ?? '#64748b',
      category: updated.activity_type?.category ?? 'other',
    })

    emit('saved', updated)
    emit('close')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    saving.value = false
  }
}

// input style class
const inputClass = 'w-full bg-glass border border-line rounded-lg px-3 py-2 text-[12px] text-ink placeholder:text-ink-4 outline-none focus:border-line-2 transition-colors'
const labelClass = 'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <!-- Header -->
    <div class="flex items-start justify-between mb-4">
      <div>
        <p class="text-base font-bold text-ink tracking-[-0.2px]">Editar Actividad</p>
        <p v-if="activity?.status === 'draft'" class="text-[10px] text-[#f59e0b] mt-0.5">
          ⚠ Borrador — importada sin tipo asignado por IA
        </p>
      </div>
      <button
        class="w-7 h-7 flex items-center justify-center rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover flex-shrink-0"
        @click="emit('close')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">

      <!-- Title -->
      <div>
        <label :class="labelClass">Título *</label>
        <input v-model="title" :class="inputClass" placeholder="Título de la actividad" />
      </div>

      <!-- Activity Type -->
      <div>
        <label :class="labelClass">Tipo de Actividad</label>
        <div v-if="loadingTypes" class="text-[11px] text-ink-4 py-2">Cargando tipos…</div>
        <select v-else v-model="activityTypeUuid" class="w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors cursor-pointer">
          <option value="">— Sin asignar —</option>
          <template v-for="[cat, types] in typesByCategory" :key="cat">
            <optgroup :label="CATEGORY_LABELS[cat] ?? cat">
              <option v-for="t in types" :key="t.uuid" :value="t.uuid">
                {{ t.name }}
              </option>
            </optgroup>
          </template>
        </select>
      </div>

      <!-- Status + Priority row -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label :class="labelClass">Estado</label>
          <select v-model="status" class="w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors cursor-pointer">
            <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
          </select>
        </div>
        <div>
          <label :class="labelClass">Prioridad</label>
          <select v-model="priority" class="w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors cursor-pointer">
            <option v-for="p in PRIORITIES" :key="p" :value="p">{{ PRIORITY_LABELS[p] }}</option>
          </select>
        </div>
      </div>

      <!-- All day toggle -->
      <div class="flex items-center gap-2">
        <button
          class="w-8 h-4 rounded-full transition-colors relative flex-shrink-0 border-none cursor-pointer"
          :class="allDay ? 'bg-acid' : 'bg-glass-2'"
          @click="allDay = !allDay"
        >
          <span
            class="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
            :class="allDay ? 'left-4' : 'left-0.5'"
          />
        </button>
        <span class="text-[11px] text-ink-2">Todo el día</span>
      </div>

      <!-- Dates -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label :class="labelClass">{{ allDay ? 'Fecha inicio' : 'Inicio (UTC)' }}</label>
          <input
            v-model="scheduledAt"
            :type="allDay ? 'date' : 'datetime-local'"
            :class="inputClass"
          />
        </div>
        <div v-if="!allDay">
          <label :class="labelClass">Fin (UTC)</label>
          <input v-model="endAt" type="datetime-local" :class="inputClass" />
        </div>
      </div>

      <!-- Location + Destination -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label :class="labelClass">Ubicación</label>
          <input v-model="locationName" :class="inputClass" placeholder="Nombre del lugar" />
        </div>
        <div>
          <label :class="labelClass">Destino</label>
          <input v-model="destinationName" :class="inputClass" placeholder="Destino (vuelos…)" />
        </div>
      </div>

      <!-- Notes -->
      <div>
        <label :class="labelClass">Notas</label>
        <textarea v-model="notes" :class="inputClass" rows="3" placeholder="Notas adicionales…" style="resize: vertical;" />
      </div>

      <!-- Description -->
      <div>
        <label :class="labelClass">Descripción</label>
        <textarea v-model="description" :class="inputClass" rows="2" placeholder="Descripción…" style="resize: vertical;" />
      </div>

    </div>

    <!-- Error -->
    <p v-if="saveError" class="text-[11px] text-red-400 mt-2">{{ saveError }}</p>

    <!-- Actions -->
    <div class="flex gap-2 mt-4">
      <button
        class="flex-1 py-2.5 rounded-lg font-semibold text-[12px] border-none cursor-pointer transition-all"
        :class="saving || !title.trim() ? 'bg-glass text-ink-4 cursor-not-allowed' : 'bg-acid text-black'"
        :disabled="saving || !title.trim()"
        @click="save"
      >
        {{ saving ? 'Guardando…' : 'Guardar cambios' }}
      </button>
      <button
        class="px-4 py-2.5 rounded-lg font-semibold text-[12px] bg-glass border border-line text-ink-2 cursor-pointer hover:bg-glass-hover transition-colors"
        @click="emit('close')"
      >
        Cancelar
      </button>
    </div>
  </AppModal>
</template>
