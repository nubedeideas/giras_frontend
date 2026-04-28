<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useCalendarImport, type CalendarSubscription } from '@/composables/useCalendarImport'
import { useToursStore } from '@/stores/tours'
import type { Tour } from '@/types'

const props = defineProps<{ show: boolean; tour: Tour | null }>()
const emit = defineEmits<{ close: [] }>()

const calImport = useCalendarImport()
const toursStore = useToursStore()

const calendars = ref<CalendarSubscription[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')

// The subscription ID currently staged for saving (undefined = not changed)
const selectedId = ref<number | null | undefined>(undefined)

// What's currently saved on this tour
const currentId = computed(() => props.tour?.default_calendar_id ?? null)

// What will be submitted — if user hasn't touched it, keep current
const pendingId = computed(() =>
  selectedId.value === undefined ? currentId.value : selectedId.value,
)

const isDirty = computed(() => selectedId.value !== undefined && selectedId.value !== currentId.value)

async function load() {
  loading.value = true
  error.value = ''
  try {
    calendars.value = await calImport.listCalendars()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar calendarios'
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!props.tour || !isDirty.value) return
  saving.value = true
  error.value = ''
  try {
    await toursStore.assignCalendar(props.tour.uuid, pendingId.value ?? null)
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    saving.value = false
  }
}

function close() {
  emit('close')
}

watch(
  () => props.show,
  (v) => {
    if (v) {
      selectedId.value = undefined
      load()
    }
  },
)

function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${d.getDate()} ${months[d.getMonth()]}`
}
</script>

<template>
  <AppModal :show="show" @close="close">
    <!-- Close -->
    <button
      class="absolute top-3.5 right-3.5 flex items-center justify-center w-[26px] h-[26px] rounded-[7px] border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink"
      @click="close"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- Header -->
    <div class="flex items-center gap-2.5 mb-[18px]">
      <div class="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 overflow-hidden"
        :style="tour?.spotify_image_url ? {} : { background: tour?.color ?? '#a8d800' }"
      >
        <img v-if="tour?.spotify_image_url" :src="tour.spotify_image_url" class="w-full h-full object-cover" />
        <span v-else class="text-[13px] font-bold text-black uppercase">{{ tour?.name?.charAt(0) }}</span>
      </div>
      <div>
        <p class="text-[14px] font-bold text-ink">Asignar calendario</p>
        <p class="text-[11px] text-ink-3 mt-px truncate max-w-[220px]">
          {{ tour?.artist_name }} — {{ tour?.name }}
        </p>
      </div>
    </div>

    <!-- Info blurb -->
    <div class="bg-[rgba(168,216,0,0.06)] border border-[rgba(168,216,0,0.15)] rounded-xl px-3 py-2.5 mb-4">
      <p class="text-[10px] text-ink-3 leading-relaxed">
        El calendario asignado se usará como fuente principal de eventos para esta gira.
        Los eventos se enrutarán automáticamente sin depender solo de fechas.
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-8">
      <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
      </svg>
    </div>

    <template v-else>
      <!-- No calendars -->
      <div v-if="calendars.length === 0" class="text-center py-6 space-y-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4 mx-auto">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
        </svg>
        <p class="text-[11px] text-ink-3">No hay calendarios conectados</p>
        <p class="text-[10px] text-ink-4">Conecta un Google Calendar desde Configuración → Calendarios</p>
      </div>

      <div v-else class="space-y-1.5">
        <!-- "Sin calendario" option -->
        <button
          class="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 cursor-pointer transition-all duration-150 text-left border"
          :class="pendingId === null
            ? 'bg-glass-active border-line-acid'
            : 'bg-glass border-line hover:bg-glass-2 hover:border-line-2'"
          @click="selectedId = null"
        >
          <div class="w-8 h-8 rounded-lg bg-glass-2 border border-line flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-medium text-ink-3">Sin calendario asignado</p>
            <p class="text-[10px] text-ink-4">El ruteo se basará solo en rangos de fechas</p>
          </div>
          <!-- Selected indicator -->
          <div
            class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
            :class="pendingId === null ? 'border-acid bg-acid' : 'border-line-2 bg-transparent'"
          >
            <div v-if="pendingId === null" class="w-1.5 h-1.5 rounded-full bg-black" />
          </div>
        </button>

        <!-- Calendar options -->
        <button
          v-for="cal in calendars"
          :key="cal.id"
          class="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 cursor-pointer transition-all duration-150 text-left border"
          :class="pendingId === cal.id
            ? 'bg-glass-active border-line-acid'
            : 'bg-glass border-line hover:bg-glass-2 hover:border-line-2'"
          @click="selectedId = cal.id"
        >
          <!-- Google icon -->
          <div class="w-8 h-8 rounded-lg bg-glass-2 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="text-[12px] font-semibold text-ink truncate">{{ cal.calendar_name }}</p>
              <!-- Current badge -->
              <span
                v-if="cal.id === currentId"
                class="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgba(168,216,0,0.1)] text-acid border border-[rgba(168,216,0,0.2)]"
              >
                Actual
              </span>
            </div>
            <p class="text-[10px] text-ink-4 font-mono truncate">{{ cal.calendar_id }}</p>
            <p class="text-[10px] text-ink-4 mt-0.5">
              Sync: {{ formatDate(cal.last_synced_at) }}
              <span
                class="ml-1 font-medium"
                :class="cal.webhook_status === 'active' ? 'text-[#1fad5a]' : 'text-ink-4'"
              >
                {{ cal.webhook_status === 'active' ? '● Activo' : '○ Sin webhook' }}
              </span>
            </p>
          </div>

          <!-- Radio indicator -->
          <div
            class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
            :class="pendingId === cal.id ? 'border-acid bg-acid' : 'border-line-2 bg-transparent'"
          >
            <div v-if="pendingId === cal.id" class="w-1.5 h-1.5 rounded-full bg-black" />
          </div>
        </button>
      </div>

      <p v-if="error" class="text-[10px] text-red-400 mt-3">{{ error }}</p>

      <!-- Actions -->
      <div class="flex gap-2 mt-4">
        <button
          class="flex-1 py-2.5 rounded-lg text-[12px] font-semibold border-none cursor-pointer transition-all"
          :class="isDirty && !saving
            ? 'bg-acid text-black'
            : 'bg-glass border border-line text-ink-4 cursor-not-allowed'"
          :disabled="!isDirty || saving"
          @click="save"
        >
          <span v-if="saving" class="flex items-center justify-center gap-1.5">
            <svg class="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
            </svg>
            Guardando…
          </span>
          <span v-else>Guardar asignación</span>
        </button>
        <button
          class="px-4 py-2.5 rounded-lg text-[12px] text-ink-3 bg-glass border border-line cursor-pointer hover:text-ink transition-colors"
          @click="close"
        >
          Cancelar
        </button>
      </div>
    </template>
  </AppModal>
</template>
