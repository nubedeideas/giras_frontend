<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useActivities, type CreateActivityPayload, type ActivityStatus, type ActivityPriority } from '@/composables/useActivities'
import { useActivityTypes, type ActivityType } from '@/composables/useActivityTypes'
import { useActivitiesStore } from '@/stores/activities'
import { useToursStore } from '@/stores/tours'
import { useI18n } from 'vue-i18n'
import UrgentNoticeModal from '@/components/activities/UrgentNoticeModal.vue'
import { activitySaveErrorMessage } from '@/utils/aiReview'
import { inputValueToIso } from '@/utils/datetime'
import { defaultTourZone, zoneOptions } from '@/utils/timezones'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const api = useActivities()
const actTypesApi = useActivityTypes()
const store = useActivitiesStore()
const toursStore = useToursStore()
// `t` ya se usa como variable de `v-for` en la plantilla.
const { t: tr } = useI18n()

// ─── Reunión urgente: ofrecer el aviso al guardar (R2, C2.4) ──────────────────
// Vive fuera del modal de alta (que se cierra al crear) para poder seguir abierto después.

interface UrgentOffer {
  uuid: string
  tour: string
  title: string
  typeName: string
}
const URGENT_MEETING_CODE = 'urgent_meeting'
const urgentOffer = ref<UrgentOffer | null>(null)
const showUrgentNotice = ref(false)

function acceptUrgentOffer() {
  showUrgentNotice.value = true
}

function closeUrgent() {
  showUrgentNotice.value = false
  urgentOffer.value = null
}

// ─── Activity types ───────────────────────────────────────────────────────────

const activityTypes = ref<ActivityType[]>([])
const loadingTypes = ref(false)

/** Gira de la que son los tipos cargados: cada gira ofrece los de su owner (`?tour=`). */
let typesTour: string | null = null
let typesError = false

watch(() => props.show, async (v) => {
  const tour = toursStore.activeTour?.uuid ?? ''
  if (v && (activityTypes.value.length === 0 || typesTour !== tour)) {
    loadingTypes.value = true
    try {
      activityTypes.value = await actTypesApi.listActivityTypes(tour || undefined)
      typesTour = tour
    } catch {
      // Gira activa obsoleta (404) o red caída: lista vacía y aviso, sin romper el formulario.
      activityTypes.value = []
      typesTour = null
      typesError = true
    } finally { loadingTypes.value = false }
  }
  if (v) {
    resetForm()
    if (typesError) error.value = tr('reminders.errors.activity_types_load')
    typesError = false
  }
})

const CATEGORY_LABELS: Record<string, string> = {
  logistics: 'Logística', production: 'Producción', media: 'Medios',
  meetings: 'Reuniones', fan: 'Fan', personal: 'Personal', other: 'Otro',
}

const groupedTypes = computed(() => {
  const map = new Map<string, ActivityType[]>()
  activityTypes.value.filter((t) => t.is_active).forEach((t) => {
    if (!map.has(t.category)) map.set(t.category, [])
    map.get(t.category)!.push(t)
  })
  return Array.from(map.entries()).map(([cat, types]) => ({
    label: CATEGORY_LABELS[cat] ?? cat,
    types,
  }))
})

const selectedType = computed(() =>
  activityTypes.value.find((t) => t.uuid === form.value.activity_type) ?? null,
)

// ─── Form ─────────────────────────────────────────────────────────────────────

/** Zona por defecto: la de la gira activa (o la propuesta para giras nuevas). */
function initialZone(): string {
  return toursStore.activeTour?.timezone || defaultTourZone()
}

const STATUSES: { value: ActivityStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programada' },
  { value: 'confirmed', label: 'Confirmada' },
]

const PRIORITIES: { value: ActivityPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const form = ref({
  activity_type: '',
  title: '',
  date: todayStr(),
  time_start: '10:00',
  time_end: '11:00',
  all_day: false,
  timezone: initialZone(),
  status: 'scheduled' as ActivityStatus,
  priority: 'normal' as ActivityPriority,
  location_name: '',
  destination_name: '',
  notes: '',
})

function resetForm() {
  form.value = {
    activity_type: '',
    title: '',
    date: todayStr(),
    time_start: '10:00',
    time_end: '11:00',
    all_day: false,
    timezone: initialZone(),
    status: 'scheduled',
    priority: 'normal',
    location_name: '',
    destination_name: '',
    notes: '',
  }
  saving.value = false
  error.value = ''
}

// Auto-fill title from type if empty
watch(() => form.value.activity_type, (uuid) => {
  if (!form.value.title) {
    const t = activityTypes.value.find((t) => t.uuid === uuid)
    if (t) form.value.title = t.name
  }
})

// ─── Submit ───────────────────────────────────────────────────────────────────

const saving = ref(false)
const error = ref('')

const timezoneOptions = computed(() => zoneOptions(form.value.timezone))

/**
 * Fecha y hora "de pared" en la zona elegida → ISO UTC con su offset aplicado (10:00 en Madrid en
 * invierno → 09:00Z). El backend interpreta un ISO sin offset como UTC.
 */
function toISO(date: string, time: string): string | null {
  return inputValueToIso(`${date}T${time}`, form.value.timezone)
}

async function submit() {
  const tourUuid = toursStore.activeTour?.uuid
  if (!tourUuid || !form.value.activity_type || !form.value.title.trim() || !form.value.date) return

  const allDay = form.value.all_day
  const hasEnd = selectedType.value?.has_duration !== false
  const start = allDay ? `${form.value.date}T00:00:00` : toISO(form.value.date, form.value.time_start)
  const end = allDay
    ? `${form.value.date}T23:59:59`
    : hasEnd
      ? toISO(form.value.date, form.value.time_end)
      : null
  if (!start || (!allDay && hasEnd && !end)) {
    error.value = tr('activityForm.invalidTime')
    return
  }

  saving.value = true
  error.value = ''
  try {
    const payload: CreateActivityPayload = {
      tour: tourUuid,
      activity_type: form.value.activity_type,
      title: form.value.title.trim(),
      scheduled_at: start,
      end_at: end,
      all_day: form.value.all_day,
      timezone: form.value.timezone,
      status: form.value.status,
      priority: form.value.priority,
      location_name: form.value.location_name.trim() || undefined,
      destination_name: form.value.destination_name.trim() || undefined,
      notes: form.value.notes.trim() || undefined,
    }

    const created = await api.createActivity(payload)

    // Build a list item to add to store
    store.addActivity({
      uuid: created.uuid,
      title: created.title,
      scheduled_at: created.scheduled_at,
      end_at: created.end_at,
      timezone: created.timezone,
      local_start_time: null,
      status: created.status,
      priority: created.priority,
      all_day: created.all_day,
      location_name: created.location_name,
      destination_name: created.destination_name,
      activity_type_name: created.activity_type?.name ?? '',
      activity_type_code: created.activity_type?.code ?? '',
      activity_type_icon: created.activity_type?.icon ?? '',
      activity_type_color: created.activity_type?.color ?? '#64748b',
      category: created.activity_type?.category ?? 'other',
      ai_review: created.ai_review ?? null,
    })

    // Solo admins de la gira (el backend da 403 al resto) y solo si la reunión queda activa.
    const isAdmin = !!toursStore.activeTour?.current_user_is_admin
    if (
      isAdmin &&
      created.activity_type?.code === URGENT_MEETING_CODE &&
      (created.status === 'scheduled' || created.status === 'confirmed')
    ) {
      urgentOffer.value = {
        uuid: created.uuid,
        tour: tourUuid,
        title: created.title,
        typeName: created.activity_type?.name ?? '',
      }
      showUrgentNotice.value = false
    }

    emit('close')
  } catch (e) {
    error.value = activitySaveErrorMessage(e, tr, 'Error al crear actividad')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- Oferta de aviso urgente tras crear una reunión urgente -->
  <AppModal
    :show="!!urgentOffer && !showUrgentNotice"
    @close="closeUrgent"
  >
    <div data-test="urgent-offer">
      <p class="text-[15px] font-semibold text-ink mb-4">
        {{ tr('notices.urgent.offerAfterCreate') }}
      </p>
      <div class="flex flex-col sm:flex-row-reverse gap-2">
        <button
          type="button"
          class="flex-1 min-h-[48px] sm:min-h-[38px] rounded-sm bg-brand-orange text-white text-[15px] font-bold border-none cursor-pointer"
          data-test="urgent-offer-accept"
          @click="acceptUrgentOffer"
        >
          {{ tr('notices.urgent.offerAccept') }}
        </button>
        <button
          type="button"
          class="flex-1 min-h-[44px] sm:min-h-[38px] rounded-sm bg-glass border border-line text-ink-2 text-[15px] font-medium cursor-pointer"
          data-test="urgent-offer-decline"
          @click="closeUrgent"
        >
          {{ tr('notices.urgent.offerDecline') }}
        </button>
      </div>
    </div>
  </AppModal>
  <UrgentNoticeModal
    v-if="urgentOffer"
    :show="showUrgentNotice"
    :activity-uuid="urgentOffer.uuid"
    :tour-uuid="urgentOffer.tour"
    :activity-title="urgentOffer.title"
    :activity-type-name="urgentOffer.typeName"
    @close="closeUrgent"
  />

  <AppModal
    :show="show"
    @close="emit('close')"
  >
    <!-- Header -->
    <div class="flex items-start justify-between mb-5">
      <div>
        <p class="text-base font-bold text-ink tracking-[-0.2px]">
          Nueva Actividad
        </p>
        <p class="text-[13px] text-ink-3 mt-0.5">
          Registra una actividad para esta gira
        </p>
      </div>
      <button
        class="w-7 h-7 flex items-center justify-center rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink flex-shrink-0"
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
    </div>

    <div
      v-if="loadingTypes"
      class="flex justify-center py-6"
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

    <div
      v-else
      class="space-y-3"
    >
      <!-- Activity type -->
      <div>
        <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">
          Tipo de Actividad *
        </label>
        <select
          v-model="form.activity_type"
          class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors cursor-pointer"
        >
          <option
            value=""
            disabled
          >
            Seleccionar tipo…
          </option>
          <optgroup
            v-for="grp in groupedTypes"
            :key="grp.label"
            :label="grp.label"
          >
            <option
              v-for="t in grp.types"
              :key="t.uuid"
              :value="t.uuid"
            >
              {{ t.name }}
            </option>
          </optgroup>
        </select>
        <!-- Selected type preview -->
        <div
          v-if="selectedType"
          class="flex items-center gap-1.5 mt-1.5"
        >
          <div
            class="w-2 h-2 rounded-full"
            :style="{ background: selectedType.color }"
          />
          <span class="text-[12px] text-ink-3">
            {{ CATEGORY_LABELS[selectedType.category] ?? selectedType.category }}
            <span v-if="selectedType.has_destination"> · Con destino</span>
            <span v-if="!selectedType.has_duration"> · Sin hora fin</span>
          </span>
        </div>
      </div>

      <!-- Title -->
      <div>
        <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Título *</label>
        <input
          v-model="form.title"
          class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
          placeholder="Ej: Vuelo CDMX → MAD"
        >
      </div>

      <!-- Date + all_day -->
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Fecha *</label>
          <input
            v-model="form.date"
            type="date"
            class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors"
          >
        </div>
        <div class="flex flex-col justify-end pb-0.5">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <div
              class="w-8 h-4 rounded-full transition-colors relative flex-shrink-0"
              :style="{ background: form.all_day ? 'var(--acid)' : 'var(--glass-2)' }"
              @click="form.all_day = !form.all_day"
            >
              <div
                class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all duration-200"
                :style="{ left: form.all_day ? '18px' : '2px' }"
              />
            </div>
            <span class="text-[13px] text-ink-2">Todo el día</span>
          </label>
        </div>
      </div>

      <!-- Time range (hidden if all_day) -->
      <div
        v-if="!form.all_day"
        class="grid grid-cols-2 gap-2"
      >
        <div>
          <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Hora inicio</label>
          <input
            v-model="form.time_start"
            type="time"
            class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors"
          >
        </div>
        <div v-if="selectedType?.has_duration !== false">
          <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Hora fin</label>
          <input
            v-model="form.time_end"
            type="time"
            class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors"
          >
        </div>
      </div>

      <!-- Timezone -->
      <div>
        <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Zona horaria</label>
        <select
          v-model="form.timezone"
          data-testid="activity-timezone"
          class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors cursor-pointer"
        >
          <option
            v-for="tz in timezoneOptions"
            :key="tz"
            :value="tz"
          >
            {{ tz }}
          </option>
        </select>
      </div>

      <!-- Status + Priority -->
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Estado</label>
          <select
            v-model="form.status"
            class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors cursor-pointer"
          >
            <option
              v-for="s in STATUSES"
              :key="s.value"
              :value="s.value"
            >
              {{ s.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Prioridad</label>
          <select
            v-model="form.priority"
            class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors cursor-pointer"
          >
            <option
              v-for="p in PRIORITIES"
              :key="p.value"
              :value="p.value"
            >
              {{ p.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Location -->
      <div :class="selectedType?.has_destination ? 'grid grid-cols-2 gap-2' : ''">
        <div>
          <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Ubicación</label>
          <input
            v-model="form.location_name"
            class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            placeholder="Nombre del lugar"
          >
        </div>
        <div v-if="selectedType?.has_destination">
          <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Destino</label>
          <input
            v-model="form.destination_name"
            class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            placeholder="Destino"
          >
        </div>
      </div>

      <!-- Notes -->
      <div>
        <label class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] block mb-1">Notas</label>
        <textarea
          v-model="form.notes"
          rows="2"
          class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4 resize-none"
          placeholder="Notas internas…"
        />
      </div>

      <p
        v-if="error"
        class="text-[13px] text-failed-fg"
      >
        {{ error }}
      </p>

      <!-- Actions -->
      <div class="flex gap-2 pt-1">
        <button
          class="flex-1 py-2.5 rounded-lg font-semibold text-[14px] bg-acid text-ink cursor-pointer border-none transition-opacity"
          :class="saving || !form.activity_type || !form.title.trim() ? 'opacity-50' : ''"
          :disabled="saving || !form.activity_type || !form.title.trim()"
          @click="submit"
        >
          {{ saving ? 'Creando…' : 'Crear Actividad' }}
        </button>
        <button
          class="px-4 py-2.5 rounded-lg font-medium text-[14px] bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
          @click="emit('close')"
        >
          Cancelar
        </button>
      </div>
    </div>
  </AppModal>
</template>
