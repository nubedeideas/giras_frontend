<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCalendarImport, type CalendarSubscription, type GoogleCalendarItem } from '@/composables/useCalendarImport'
import { useToursStore } from '@/stores/tours'

const calImport = useCalendarImport()
const toursStore = useToursStore()

// Map from subscription id → list of tour names using it as default_calendar
const toursByCalendar = computed(() => {
  const map = new Map<number, string[]>()
  for (const tour of toursStore.tours) {
    if (tour.default_calendar_id) {
      if (!map.has(tour.default_calendar_id)) map.set(tour.default_calendar_id, [])
      map.get(tour.default_calendar_id)!.push(tour.name)
    }
  }
  return map
})

const calendars = ref<CalendarSubscription[]>([])
const loading = ref(false)
const error = ref('')

// Connect form
const showForm = ref(false)
const formCalId = ref('')
const formCalName = ref('')
const formLoading = ref(false)
const formError = ref('')

// Available Google calendars for the select
const googleCals = ref<GoogleCalendarItem[]>([])
const loadingGoogleCals = ref(false)
const googleCalsError = ref('')

async function loadGoogleCals() {
  loadingGoogleCals.value = true
  googleCalsError.value = ''
  try {
    googleCals.value = await calImport.listGoogleCalendars()
    // Pre-select primary calendar if available
    const primary = googleCals.value.find((c) => c.primary)
    if (primary && !formCalId.value) {
      formCalId.value = primary.id
      formCalName.value = primary.summary
    }
  } catch (e) {
    googleCalsError.value = e instanceof Error ? e.message : 'Error al cargar calendarios de Google'
  } finally {
    loadingGoogleCals.value = false
  }
}

function onSelectGoogleCal(id: string) {
  formCalId.value = id
  const cal = googleCals.value.find((c) => c.id === id)
  if (cal) formCalName.value = cal.summary
}

// Per-calendar actions
const syncingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)

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

function openForm() {
  showForm.value = true
  formCalId.value = ''
  formCalName.value = ''
  formError.value = ''
  if (googleCals.value.length === 0) loadGoogleCals()
}

async function connectCalendar() {
  if (!formCalId.value) {
    formError.value = 'Selecciona un calendario'
    return
  }
  if (!formCalName.value.trim()) {
    formError.value = 'El nombre es obligatorio'
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    const sub = await calImport.createCalendar(formCalId.value.trim(), formCalName.value.trim())
    calendars.value.push(sub)
    showForm.value = false
    formCalId.value = ''
    formCalName.value = ''
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Error al conectar'
  } finally {
    formLoading.value = false
  }
}

async function syncCalendar(cal: CalendarSubscription) {
  syncingId.value = cal.id
  try {
    await calImport.syncCalendarNow(cal.id)
    await load()
  } catch {
    // silent – user sees no change
  } finally {
    syncingId.value = null
  }
}

async function deleteCalendar(cal: CalendarSubscription) {
  deletingId.value = cal.id
  try {
    await calImport.deleteCalendar(cal.id)
    calendars.value = calendars.value.filter((c) => c.id !== cal.id)
  } catch {
    // silent
  } finally {
    deletingId.value = null
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

onMounted(load)
</script>

<template>
  <!-- Info blurb -->
  <div class="bg-[rgba(168,216,0,0.06)] border border-[rgba(168,216,0,0.15)] rounded-xl px-3.5 py-3 mb-4 space-y-1">
    <p class="text-[11px] font-semibold text-acid">¿Cómo funciona?</p>
    <p class="text-[10px] text-ink-3 leading-relaxed">
      Puedes conectar un <span class="text-ink">calendario general</span> para todas las giras — el sistema asignará automáticamente cada evento a la gira correcta según las fechas.
      También puedes conectar un <span class="text-ink">calendario exclusivo por gira</span> — útil si tienes Google Calendars separados para cada proyecto.
    </p>
  </div>

  <!-- Section label + connect button -->
  <div class="flex items-center justify-between mb-2">
    <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase">
      Calendarios conectados
    </label>
    <button
      class="flex items-center gap-1 text-[10px] font-semibold text-acid bg-[rgba(168,216,0,0.1)] border border-[rgba(168,216,0,0.2)] rounded-md px-2 py-1 cursor-pointer hover:bg-[rgba(168,216,0,0.18)] transition-colors"
      @click="showForm ? (showForm = false) : openForm()"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Conectar
    </button>
  </div>

  <!-- Connect form -->
  <div v-if="showForm" class="bg-glass border border-line rounded-xl px-3.5 py-3 mb-3 space-y-2.5">
    <p class="text-[11px] font-semibold text-ink">Conectar nuevo calendario</p>

    <!-- Google Calendar selector -->
    <div class="space-y-1.5">
      <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block">
        Calendario de Google
      </label>

      <!-- Loading state -->
      <div v-if="loadingGoogleCals" class="flex items-center gap-2 py-2">
        <svg class="animate-spin text-ink-4 flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
        </svg>
        <span class="text-[11px] text-ink-4">Cargando calendarios de Google…</span>
      </div>

      <!-- Error fetching google cals -->
      <div v-else-if="googleCalsError" class="space-y-1.5">
        <p class="text-[10px] text-red-400">{{ googleCalsError }}</p>
        <button
          class="text-[10px] text-acid underline bg-transparent border-none cursor-pointer"
          @click="loadGoogleCals"
        >
          Reintentar
        </button>
      </div>

      <!-- Calendar select -->
      <template v-else>
        <div class="space-y-1">
          <button
            v-for="cal in googleCals"
            :key="cal.id"
            type="button"
            class="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 border cursor-pointer transition-all duration-150 text-left"
            :class="formCalId === cal.id
              ? 'bg-glass-active border-line-acid'
              : 'bg-glass border-line hover:bg-glass-2'"
            @click="onSelectGoogleCal(cal.id)"
          >
            <!-- Google logo -->
            <svg viewBox="0 0 24 24" width="14" height="14" class="flex-shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="text-[12px] font-medium text-ink truncate">{{ cal.summary }}</p>
                <span
                  v-if="cal.primary"
                  class="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgba(26,143,255,0.1)] text-[#1a8fff] border border-[rgba(26,143,255,0.2)]"
                >
                  Principal
                </span>
              </div>
              <p class="text-[9px] text-ink-4 font-mono truncate">{{ cal.id }}</p>
            </div>

            <!-- Radio indicator -->
            <div
              class="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
              :class="formCalId === cal.id ? 'border-acid bg-acid' : 'border-line-2 bg-transparent'"
            >
              <div v-if="formCalId === cal.id" class="w-1 h-1 rounded-full bg-black" />
            </div>
          </button>
        </div>

        <!-- No calendars from Google -->
        <p v-if="googleCals.length === 0" class="text-[10px] text-ink-4 py-1">
          No se encontraron calendarios con acceso de escritura en tu cuenta de Google.
        </p>
      </template>
    </div>

    <div class="space-y-1.5">
      <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block">
        Nombre (para identificarlo)
      </label>
      <input
        v-model="formCalName"
        class="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-[12px] text-ink placeholder-ink-4 outline-none focus:border-line-acid transition-colors"
        placeholder="Ej: Gira Europa 2025"
        @keydown.enter="connectCalendar"
      />
    </div>

    <p v-if="formError" class="text-[10px] text-red-400">{{ formError }}</p>

    <div class="flex gap-2">
      <button
        class="flex-1 py-2 rounded-lg text-[11px] font-semibold border-none cursor-pointer transition-all"
        :class="formLoading ? 'bg-glass text-ink-4 cursor-not-allowed' : 'bg-acid text-black'"
        :disabled="formLoading"
        @click="connectCalendar"
      >
        <span v-if="formLoading" class="flex items-center justify-center gap-1.5">
          <svg class="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
          </svg>
          Conectando…
        </span>
        <span v-else>Conectar calendario</span>
      </button>
      <button
        class="px-3 py-2 rounded-lg text-[11px] text-ink-3 bg-glass border border-line cursor-pointer hover:text-ink transition-colors"
        @click="showForm = false; formError = ''"
      >
        Cancelar
      </button>
    </div>
  </div>

  <!-- Loading -->
  <div v-if="loading" class="flex justify-center py-6">
    <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
    </svg>
  </div>

  <!-- Error -->
  <p v-else-if="error" class="text-[11px] text-red-400 py-2">{{ error }}</p>

  <!-- Empty -->
  <div v-else-if="calendars.length === 0 && !showForm" class="text-center py-6 space-y-1.5">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4 mx-auto">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
    </svg>
    <p class="text-[11px] text-ink-3">No hay calendarios conectados</p>
    <p class="text-[10px] text-ink-4">Pulsa "Conectar" para añadir tu Google Calendar</p>
  </div>

  <!-- Calendar list -->
  <div v-else class="space-y-2">
    <div
      v-for="cal in calendars"
      :key="cal.id"
      class="bg-glass border border-line rounded-xl px-3.5 py-3 space-y-2"
    >
      <!-- Top row -->
      <div class="flex items-start gap-3">
        <!-- Google icon -->
        <div class="w-8 h-8 rounded-lg bg-glass-2 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <p class="text-[12px] font-semibold text-ink truncate">{{ cal.calendar_name }}</p>
            <!-- Webhook status badge -->
            <span
              class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0"
              :class="cal.webhook_status === 'active'
                ? 'bg-[rgba(31,173,90,0.1)] text-[#1fad5a] border-[rgba(31,173,90,0.2)]'
                : cal.webhook_status === 'expired'
                  ? 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border-[rgba(245,158,11,0.2)]'
                  : 'bg-glass border-line text-ink-4'"
            >
              {{ cal.webhook_status === 'active' ? '● Activo' : cal.webhook_status === 'expired' ? '○ Expirado' : '○ Sin webhook' }}
            </span>
          </div>
          <p class="text-[10px] text-ink-4 font-mono mt-0.5 truncate">{{ cal.calendar_id }}</p>
          <p class="text-[10px] text-ink-4 mt-0.5">Últ. sync: {{ formatDate(cal.last_synced_at) }}</p>
        </div>
      </div>

      <!-- Assigned tours -->
      <div v-if="toursByCalendar.get(cal.id)?.length" class="flex flex-wrap gap-1 px-0.5">
        <span
          v-for="tourName in toursByCalendar.get(cal.id)"
          :key="tourName"
          class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgba(168,216,0,0.1)] text-acid border border-[rgba(168,216,0,0.2)]"
        >
          {{ tourName }}
        </span>
      </div>
      <div v-else class="px-0.5">
        <span class="text-[9px] text-ink-4">Sin gira asignada</span>
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-2 pt-1 border-t border-line">
        <button
          class="flex items-center gap-1 text-[10px] font-semibold text-ink-3 hover:text-acid bg-transparent border-none cursor-pointer transition-colors px-0 py-0"
          :class="syncingId === cal.id ? 'opacity-50 cursor-not-allowed' : ''"
          :disabled="syncingId === cal.id"
          @click="syncCalendar(cal)"
        >
          <svg
            class="transition-transform"
            :class="syncingId === cal.id ? 'animate-spin' : ''"
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          >
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {{ syncingId === cal.id ? 'Sincronizando…' : 'Sincronizar ahora' }}
        </button>

        <span class="text-ink-4 text-[10px]">·</span>

        <button
          class="flex items-center gap-1 text-[10px] font-semibold text-ink-4 hover:text-red-400 bg-transparent border-none cursor-pointer transition-colors px-0 py-0"
          :class="deletingId === cal.id ? 'opacity-50 cursor-not-allowed' : ''"
          :disabled="deletingId === cal.id"
          @click="deleteCalendar(cal)"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          {{ deletingId === cal.id ? 'Eliminando…' : 'Desconectar' }}
        </button>
      </div>
    </div>
  </div>
</template>
