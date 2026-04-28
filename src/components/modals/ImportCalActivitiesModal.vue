<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import {
  useCalendarImport,
  type CalendarSubscription,
  type ImportedEvent,
  type BulkImportResultItem,
} from '@/composables/useCalendarImport'
import { useActivitiesStore } from '@/stores/activities'
import { useUIState } from '@/composables/useUIState'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const calImport = useCalendarImport()
const store = useActivitiesStore()
const uiState = useUIState()

// ─── Step machine ─────────────────────────────────────────────────────────────
// select-cal → select-events → importing → done

type Step = 'select-cal' | 'select-events' | 'importing' | 'done'
const step = ref<Step>('select-cal')

// ─── Step 1 — Select calendar ─────────────────────────────────────────────────

const calendars = ref<CalendarSubscription[]>([])
const loadingCals = ref(false)
const calError = ref('')
const selectedCal = ref<CalendarSubscription | null>(null)
const syncing = ref(false)
const syncStats = ref<{ created: number; routed: number } | null>(null)
const syncError = ref('')

async function loadCalendars() {
  loadingCals.value = true
  calError.value = ''
  try {
    calendars.value = await calImport.listCalendars()
  } catch (e) {
    calError.value = e instanceof Error ? e.message : 'Error al cargar calendarios'
  } finally {
    loadingCals.value = false
  }
}

async function syncCalendar(cal: CalendarSubscription) {
  syncing.value = true
  syncError.value = ''
  syncStats.value = null
  try {
    const stats = await calImport.syncCalendarNow(cal.id)
    syncStats.value = { created: stats.created, routed: stats.routed }
    // Reload calendar list to update last_synced_at
    await loadCalendars()
  } catch (e) {
    syncError.value = e instanceof Error ? e.message : 'Error al sincronizar'
  } finally {
    syncing.value = false
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

// ─── Step 2 — Select events ───────────────────────────────────────────────────

const events = ref<ImportedEvent[]>([])
const loadingEvents = ref(false)
const eventsError = ref('')
const selectedIds = ref<Set<number>>(new Set())

const canImportIds = computed(() =>
  events.value
    .filter((e) => selectedIds.value.has(e.id) && e.import_status === 'assigned')
    .map((e) => e.id),
)
const nonAssignedSelected = computed(() =>
  events.value.filter(
    (e) => selectedIds.value.has(e.id) && e.import_status !== 'assigned',
  ).length,
)

const allSelected = computed(() => events.value.length > 0 && selectedIds.value.size === events.value.length)

function toggleAll() {
  if (allSelected.value) selectedIds.value = new Set()
  else selectedIds.value = new Set(events.value.map((e) => e.id))
}

function toggleEvent(id: number) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

function formatEventDate(iso: string, allDay: boolean): string {
  if (allDay) {
    const d = new Date(iso)
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${d.getDate()} ${months[d.getMonth()]}`
  }
  const d = new Date(iso)
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${d.getDate()} ${months[d.getMonth()]} · ${d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',hour12:false})}`
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  assigned:  { label: 'Listo', class: 'bg-[rgba(168,216,0,0.12)] text-acid border-[rgba(168,216,0,0.25)]' },
  pending:   { label: 'Pendiente', class: 'bg-[rgba(100,116,139,0.12)] text-ink-3 border-[rgba(100,116,139,0.2)]' },
  ambiguous: { label: 'Ambiguo', class: 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b] border-[rgba(245,158,11,0.25)]' },
  no_match:  { label: 'Sin gira', class: 'bg-[rgba(248,113,113,0.1)] text-[#f87171] border-[rgba(248,113,113,0.2)]' },
}

async function goToSelectEvents(cal: CalendarSubscription) {
  selectedCal.value = cal
  step.value = 'select-events'
  selectedIds.value = new Set()
  events.value = []
  eventsError.value = ''
  loadingEvents.value = true
  try {
    events.value = await calImport.listCalendarEvents(cal.id)
  } catch (e) {
    eventsError.value = e instanceof Error ? e.message : 'Error al cargar eventos'
  } finally {
    loadingEvents.value = false
  }
}

// ─── Step 3 — Bulk import ─────────────────────────────────────────────────────

const importResults = ref<BulkImportResultItem[]>([])
const importSummary = ref({ success: 0, skipped: 0, error: 0, total: 0 })
const importError = ref('')

async function runImport() {
  if (canImportIds.value.length === 0) return
  step.value = 'importing'
  importError.value = ''
  try {
    const result = await calImport.bulkSmartImport(canImportIds.value)
    importResults.value = result.results
    importSummary.value = result.summary
    await store.loadActivities()
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Error al importar'
    step.value = 'select-events'
    return
  }
  step.value = 'done'
}

// ─── Reset / close ────────────────────────────────────────────────────────────

function close() {
  emit('close')
  setTimeout(() => {
    step.value = 'select-cal'
    selectedCal.value = null
    calendars.value = []
    events.value = []
    selectedIds.value = new Set()
    importResults.value = []
    importSummary.value = { success: 0, skipped: 0, error: 0, total: 0 }
    calError.value = ''
    eventsError.value = ''
    importError.value = ''
    syncStats.value = null
    syncError.value = ''
  }, 300)
}

watch(
  () => props.show,
  (v) => { if (v) loadCalendars() },
)
</script>

<template>
  <AppModal :show="show" @close="close">

    <!-- ── STEP 1: Select calendar ───────────────────────────────────────────── -->
    <template v-if="step === 'select-cal'">
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div>
          <p class="text-base font-bold text-ink tracking-[-0.2px]">Importar de Google Calendar</p>
          <p class="text-[11px] text-ink-3 mt-0.5">Selecciona el calendario a usar</p>
        </div>
        <button class="w-7 h-7 flex items-center justify-center rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover flex-shrink-0" @click="close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loadingCals" class="flex justify-center py-8">
        <svg class="animate-spin text-ink-4" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
        </svg>
      </div>

      <!-- Error -->
      <p v-else-if="calError" class="text-[11px] text-red-400 text-center py-4">{{ calError }}</p>

      <!-- Empty -->
      <div v-else-if="calendars.length === 0" class="text-center py-8 space-y-3">
        <div class="w-12 h-12 rounded-[15px] bg-glass border border-line flex items-center justify-center mx-auto">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
          </svg>
        </div>
        <div class="space-y-1">
          <p class="text-[12px] font-semibold text-ink-3">No hay calendarios conectados</p>
          <p class="text-[11px] text-ink-4">Conecta tu Google Calendar para importar eventos</p>
        </div>
        <button
          class="flex items-center gap-1.5 mx-auto text-[11px] font-semibold text-acid bg-[rgba(168,216,0,0.1)] border border-[rgba(168,216,0,0.2)] rounded-lg px-3.5 py-2 cursor-pointer hover:bg-[rgba(168,216,0,0.18)] transition-colors"
          @click="() => { close(); uiState.openSettings('calendars') }"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Ir a Configuración → Calendarios
        </button>
      </div>

      <!-- Calendar list -->
      <div v-else class="space-y-2">
        <!-- Sync notice -->
        <div v-if="syncStats" class="text-[10px] text-acid bg-[rgba(168,216,0,0.08)] border border-[rgba(168,216,0,0.2)] rounded-lg px-3 py-1.5">
          Sincronización completada — {{ syncStats.created }} nuevos, {{ syncStats.routed }} asignados
        </div>
        <p v-if="syncError" class="text-[10px] text-red-400">{{ syncError }}</p>

        <div
          v-for="cal in calendars"
          :key="cal.id"
          class="flex items-center gap-3 bg-glass border border-line rounded-xl px-3.5 py-3 cursor-pointer hover:bg-glass-2 hover:border-line-2 transition-all duration-150 group"
          @click="goToSelectEvents(cal)"
        >
          <!-- Google Calendar icon -->
          <div class="w-9 h-9 rounded-xl bg-glass-2 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-semibold text-ink truncate">{{ cal.calendar_name }}</p>
            <p class="text-[10px] text-ink-4 truncate">{{ cal.calendar_id }}</p>
            <p class="text-[10px] text-ink-4 mt-0.5">
              Últ. sync: {{ cal.last_synced_at ? formatDate(cal.last_synced_at) : 'Nunca' }}
            </p>
          </div>

          <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
            <!-- Webhook badge -->
            <span
              class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border"
              :class="cal.webhook_status === 'active'
                ? 'bg-[rgba(31,173,90,0.1)] text-[#1fad5a] border-[rgba(31,173,90,0.2)]'
                : 'bg-glass border-line text-ink-4'"
            >{{ cal.webhook_status === 'active' ? '● Activo' : cal.webhook_status === 'expired' ? '○ Expirado' : '○ Sin webhook' }}</span>

            <!-- Sync button -->
            <button
              class="text-[10px] text-ink-3 hover:text-acid border border-line hover:border-line-acid rounded-md px-2 py-0.5 transition-colors bg-transparent cursor-pointer"
              :class="syncing ? 'opacity-50 cursor-not-allowed' : ''"
              :disabled="syncing"
              @click.stop="syncCalendar(cal)"
            >
              <span v-if="syncing">
                <svg class="animate-spin inline mr-0.5" width="8" height="8" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
                </svg>Sync…
              </span>
              <span v-else>↻ Sincronizar</span>
            </button>
          </div>

          <!-- Arrow -->
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4 group-hover:text-ink-2 transition-colors flex-shrink-0">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </template>

    <!-- ── STEP 2: Select events ──────────────────────────────────────────────── -->
    <template v-else-if="step === 'select-events'">
      <!-- Header -->
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <button
            class="w-6 h-6 flex items-center justify-center rounded-md border border-line bg-glass text-ink-2 hover:bg-glass-hover cursor-pointer flex-shrink-0"
            @click="step = 'select-cal'"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div class="min-w-0">
            <p class="text-base font-bold text-ink tracking-[-0.2px] truncate">{{ selectedCal?.calendar_name }}</p>
            <p class="text-[11px] text-ink-3">Eventos futuros · selecciona los que quieres importar</p>
          </div>
        </div>
        <button class="w-7 h-7 flex items-center justify-center rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover flex-shrink-0 ml-2" @click="close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loadingEvents" class="flex justify-center py-8">
        <svg class="animate-spin text-ink-4" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
        </svg>
      </div>

      <!-- Error -->
      <p v-else-if="eventsError" class="text-[11px] text-red-400 text-center py-4">{{ eventsError }}</p>

      <!-- Empty -->
      <div v-else-if="events.length === 0" class="text-center py-8 text-ink-4 text-[12px]">
        No hay eventos futuros pendientes de importar en este calendario
      </div>

      <!-- Event list -->
      <div v-else>
        <!-- Select all bar -->
        <div class="flex items-center justify-between mb-2 px-1">
          <button
            class="flex items-center gap-1.5 text-[11px] text-ink-3 hover:text-ink cursor-pointer bg-transparent border-none"
            @click="toggleAll"
          >
            <div
              class="w-[13px] h-[13px] rounded border flex items-center justify-center transition-all"
              :class="allSelected ? 'bg-acid border-acid' : 'bg-transparent border-line-2'"
            >
              <svg v-if="allSelected" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            Seleccionar todos
          </button>
          <span class="text-[11px] text-ink-4">{{ events.length }} evento{{ events.length !== 1 ? 's' : '' }}</span>
        </div>

        <!-- Events -->
        <div class="space-y-1 max-h-[50vh] overflow-y-auto mb-3">
          <div
            v-for="evt in events"
            :key="evt.id"
            class="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150"
            :class="selectedIds.has(evt.id) ? 'bg-glass-active border-line-acid' : 'bg-glass border-line hover:bg-glass-2'"
            @click="toggleEvent(evt.id)"
          >
            <!-- Checkbox -->
            <div
              class="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
              :class="selectedIds.has(evt.id) ? 'bg-acid border-acid' : 'bg-transparent border-line-2'"
            >
              <svg v-if="selectedIds.has(evt.id)" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-[12px] font-medium text-ink truncate leading-snug">{{ evt.summary }}</p>
              <p class="text-[10px] text-ink-3 mt-0.5">
                {{ formatEventDate(evt.start_datetime, evt.all_day) }}
                <span v-if="evt.location" class="text-ink-4"> · {{ evt.location }}</span>
              </p>
              <p v-if="evt.tour_name" class="text-[10px] text-ink-4 mt-0.5">
                <span class="text-ink-3">Gira:</span> {{ evt.tour_name }}
              </p>
            </div>

            <!-- Status badge -->
            <span
              class="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border mt-0.5"
              :class="STATUS_BADGE[evt.import_status]?.class ?? 'bg-glass border-line text-ink-4'"
            >
              {{ STATUS_BADGE[evt.import_status]?.label ?? evt.import_status }}
            </span>
          </div>
        </div>

        <!-- Warning for non-assigned -->
        <p v-if="nonAssignedSelected > 0" class="text-[10px] text-[#f59e0b] mb-2 px-1">
          ⚠ {{ nonAssignedSelected }} evento{{ nonAssignedSelected !== 1 ? 's' : '' }} seleccionado{{ nonAssignedSelected !== 1 ? 's' : '' }} sin gira asignada no se importará{{ nonAssignedSelected !== 1 ? 'n' : '' }}
        </p>

        <p v-if="importError" class="text-[11px] text-red-400 mb-2">{{ importError }}</p>

        <button
          class="w-full py-2.5 rounded-lg font-semibold text-[12px] border-none cursor-pointer transition-all"
          :class="canImportIds.length > 0 ? 'bg-acid text-black' : 'bg-glass border border-line text-ink-4 cursor-not-allowed'"
          :disabled="canImportIds.length === 0"
          @click="runImport"
        >
          Importar {{ canImportIds.length > 0 ? canImportIds.length : selectedIds.size }} actividade{{ (canImportIds.length || selectedIds.size) !== 1 ? 's' : '' }} con IA
        </button>
      </div>
    </template>

    <!-- ── STEP: Importing ────────────────────────────────────────────────────── -->
    <template v-else-if="step === 'importing'">
      <div class="flex flex-col items-center justify-center py-12 gap-3">
        <svg class="animate-spin text-acid" width="30" height="30" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
        </svg>
        <p class="text-[13px] font-semibold text-ink">Procesando con Gemini…</p>
        <p class="text-[11px] text-ink-3 text-center">La IA está estructurando y creando las actividades</p>
      </div>
    </template>

    <!-- ── STEP: Done ─────────────────────────────────────────────────────────── -->
    <template v-else-if="step === 'done'">
      <div class="mb-4">
        <p class="text-base font-bold text-ink tracking-[-0.2px] mb-3">Importación completada</p>
        <div class="flex gap-4">
          <div class="text-center">
            <p class="text-[22px] font-bold text-acid leading-none">{{ importSummary.success }}</p>
            <p class="text-[10px] text-ink-3 mt-1">importadas</p>
          </div>
          <div v-if="importSummary.skipped > 0" class="text-center">
            <p class="text-[22px] font-bold text-ink-3 leading-none">{{ importSummary.skipped }}</p>
            <p class="text-[10px] text-ink-4 mt-1">omitidas</p>
          </div>
          <div v-if="importSummary.error > 0" class="text-center">
            <p class="text-[22px] font-bold text-red-400 leading-none">{{ importSummary.error }}</p>
            <p class="text-[10px] text-ink-4 mt-1">errores</p>
          </div>
        </div>
      </div>

      <!-- Results list -->
      <div class="space-y-1.5 max-h-52 overflow-y-auto mb-4">
        <div
          v-for="r in importResults"
          :key="r.imported_event_id"
          class="flex items-start gap-2 bg-glass border border-line rounded-lg px-3 py-2"
        >
          <svg v-if="r.status === 'success'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1fad5a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <svg v-else-if="r.status === 'skipped'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>

          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-medium text-ink truncate">{{ r.activity_title ?? r.summary }}</p>
            <p v-if="r.activity_type_code" class="text-[10px] text-ink-4">{{ r.activity_type_code }}</p>
            <p v-if="r.error" class="text-[10px] text-red-400">{{ r.error }}</p>
          </div>
        </div>
      </div>

      <button
        class="w-full py-2.5 rounded-lg font-semibold text-[12px] bg-acid text-black cursor-pointer border-none"
        @click="close"
      >
        Cerrar
      </button>
    </template>

  </AppModal>
</template>
