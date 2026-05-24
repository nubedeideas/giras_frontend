<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useContactsStore } from '@/stores/contacts'
import { useAuthStore } from '@/stores/auth'
import {
  useGoogleContactsImport,
  type ImportContact,
  type ImportRole,
  type ContactSubscription,
  type SyncStats,
} from '@/composables/useGoogleContactsImport'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

const emit = defineEmits<{ next: []; skip: [] }>()

const contactsStore = useContactsStore()
const authStore = useAuthStore()
const api = useGoogleContactsImport()

// ─── Source tab ───────────────────────────────────────────────────────────────

const source = ref<'google' | 'manual'>('google')

// ─── Shared roles ─────────────────────────────────────────────────────────────

const roles = ref<ImportRole[]>([])

async function loadRoles() {
  if (roles.value.length === 0) roles.value = await api.fetchRoles()
}

// ─── Google state machine ─────────────────────────────────────────────────────

type GoogleStep = 'idle' | 'loading' | 'syncing' | 'selecting' | 'importing' | 'done'
const gStep = ref<GoogleStep>('idle')
const subscription = ref<ContactSubscription | null>(null)
const syncStats = ref<SyncStats | null>(null)
const contacts = ref<ImportContact[]>([])
const gError = ref('')
const searchFilter = ref('')
const contactState = ref<Record<string, { selected: boolean; roleUuid: string }>>({})

const filteredContacts = computed(() => {
  const q = searchFilter.value.toLowerCase().trim()
  if (!q) return contacts.value
  return contacts.value.filter(
    (c) =>
      c.full_name.toLowerCase().includes(q) ||
      c.primary_email.toLowerCase().includes(q) ||
      (c.company_name ?? '').toLowerCase().includes(q) ||
      (c.job_title ?? '').toLowerCase().includes(q),
  )
})

const selectedUuids = computed(() =>
  Object.entries(contactState.value)
    .filter(([, s]) => s.selected)
    .map(([uuid]) => uuid),
)

const selectableContacts = computed(() => filteredContacts.value.filter((c) => !c.is_confirmed))

const allFilteredSelected = computed(
  () =>
    selectableContacts.value.length > 0 &&
    selectableContacts.value.every((c) => contactState.value[c.uuid]?.selected),
)

function toggleAll() {
  const val = !allFilteredSelected.value
  selectableContacts.value.forEach((c) => {
    if (contactState.value[c.uuid]) contactState.value[c.uuid].selected = val
  })
}

function initContactState(list: ImportContact[]) {
  const state: Record<string, { selected: boolean; roleUuid: string }> = {}
  list.forEach((c) => {
    state[c.uuid] = { selected: false, roleUuid: c.role?.uuid ?? '' }
  })
  contactState.value = state
}

async function startSync() {
  gError.value = ''
  gStep.value = 'loading'
  try {
    const sub = await api.getOrCreateSubscription()
    subscription.value = sub
    await loadRoles()
    gStep.value = 'syncing'
    const stats = await api.syncNow(sub.id)
    syncStats.value = stats
    const list = await api.fetchGoogleContacts()
    contacts.value = list
    initContactState(list)
    gStep.value = 'selecting'
  } catch (e) {
    gError.value = e instanceof Error ? e.message : 'Error desconocido'
    gStep.value = 'idle'
  }
}

async function doImport() {
  if (selectedUuids.value.length === 0) return
  gStep.value = 'importing'
  gError.value = ''
  const patchPromises = selectedUuids.value.map((uuid) => {
    const roleUuid = contactState.value[uuid]?.roleUuid || null
    return api.patchContactRole(uuid, roleUuid).catch(() => null)
  })
  await Promise.allSettled(patchPromises)
  await contactsStore.fetchContacts()
  gStep.value = 'done'
}

function formatDate(iso: string | null) {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('es', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Manual state machine ─────────────────────────────────────────────────────

type ManualStep = 'form' | 'saving' | 'done'
const manualStep = ref<ManualStep>('form')
const manualError = ref('')
const createdContact = ref<ImportContact | null>(null)

const form = reactive({
  contact_type: 'person' as 'person' | 'company',
  first_name: '',
  last_name: '',
  company_name: '',
  job_title: '',
  role: '',
  primary_email: '',
  primary_phone: '',
  city: '',
  country: '',
  website: '',
  notes: '',
  is_favorite: false,
  is_emergency: false,
})

function resetManualForm() {
  Object.assign(form, {
    contact_type: 'person',
    first_name: '',
    last_name: '',
    company_name: '',
    job_title: '',
    role: '',
    primary_email: '',
    primary_phone: '',
    city: '',
    country: '',
    website: '',
    notes: '',
    is_favorite: false,
    is_emergency: false,
  })
  manualStep.value = 'form'
  manualError.value = ''
  createdContact.value = null
}

const manualValid = computed(() => {
  if (form.contact_type === 'person') return !!(form.first_name.trim() || form.last_name.trim())
  return !!form.company_name.trim()
})

async function submitManual() {
  if (!manualValid.value) return
  manualStep.value = 'saving'
  manualError.value = ''
  try {
    await loadRoles()
    const payload: Record<string, unknown> = {
      contact_type: form.contact_type,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      company_name: form.company_name.trim(),
      job_title: form.job_title.trim(),
      primary_email: form.primary_email.trim(),
      primary_phone: form.primary_phone.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      website: form.website.trim(),
      notes: form.notes.trim(),
      is_favorite: form.is_favorite,
      is_emergency: form.is_emergency,
    }
    if (form.role) payload.role = form.role
    const created = await api.createContact(payload)
    createdContact.value = created
    await contactsStore.fetchContacts()
    manualStep.value = 'done'
  } catch (e) {
    manualError.value = e instanceof Error ? e.message : 'Error al crear contacto'
    manualStep.value = 'form'
  }
}

watch(source, (val) => {
  if (val === 'manual' && !authStore.isDemoMode) loadRoles()
})
</script>

<template>
  <div>
    <!-- Source toggle -->
    <div class="grid grid-cols-2 gap-2 mb-5">
      <div
        v-for="opt in [
          { key: 'google', label: 'Google Contacts', sub: 'OAuth sync' },
          { key: 'manual', label: 'Manual', sub: 'Formulario' },
        ]"
        :key="opt.key"
        class="bg-glass border rounded-xl p-3 text-center cursor-pointer transition-all duration-200"
        :class="source === opt.key ? 'border-line-acid bg-glass-active' : 'border-line hover:bg-glass-2'"
        @click="source = opt.key as 'google' | 'manual'"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          :stroke="source === opt.key ? 'var(--acid-muted)' : 'var(--ink-3)'"
          stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-1.5"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <p class="text-[11px] font-semibold text-ink">{{ opt.label }}</p>
        <p class="text-[9px] text-ink-3 mt-0.5">{{ opt.sub }}</p>
      </div>
    </div>

    <!-- ── Google tab ──────────────────────────────────────────────────────────── -->
    <template v-if="source === 'google'">
      <div
        v-if="authStore.isDemoMode"
        class="bg-glass border border-line rounded-lg px-3.5 py-4 text-center mb-4"
      >
        <p class="text-[12px] font-semibold text-ink-2 mb-0.5">Solo con cuenta real</p>
        <p class="text-[11px] text-ink-3">La sincronización requiere iniciar sesión con Google.</p>
      </div>

      <template v-else>
        <!-- IDLE -->
        <div v-if="gStep === 'idle'" class="text-center">
          <div class="bg-glass border border-line rounded-xl p-5 mb-4">
            <div class="w-10 h-10 rounded-xl bg-[rgba(26,143,255,0.1)] flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <p class="text-[13px] font-semibold text-ink mb-1">Google Contacts</p>
            <p v-if="subscription" class="text-[11px] text-ink-3">
              Última sync: {{ formatDate(subscription.last_synced_at) }}
            </p>
            <p v-else class="text-[11px] text-ink-3">
              Importa tu crew directamente desde Google
            </p>
          </div>
          <p v-if="gError" class="text-[11px] text-red-400 mb-3">{{ gError }}</p>
          <BtnPrimary full @click="startSync">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            {{ subscription ? 'Re-sincronizar' : 'Sincronizar Google Contacts' }}
          </BtnPrimary>
        </div>

        <!-- LOADING / SYNCING -->
        <div v-else-if="gStep === 'loading' || gStep === 'syncing'" class="text-center py-6">
          <svg class="animate-spin text-acid mx-auto mb-3" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
          </svg>
          <p class="text-[13px] font-semibold text-ink mb-1">
            {{ gStep === 'loading' ? 'Conectando...' : 'Sincronizando contactos' }}
          </p>
          <p class="text-[11px] text-ink-3">Esto puede tardar unos segundos</p>
        </div>

        <!-- SELECTING -->
        <div v-else-if="gStep === 'selecting'">
          <div v-if="syncStats" class="flex items-center gap-3 mb-3 flex-wrap">
            <span class="text-[10px] text-ink-3"><strong class="text-acid">+{{ syncStats.created }}</strong> nuevos</span>
            <span class="text-[10px] text-ink-3"><strong class="text-ink">{{ syncStats.updated }}</strong> actualizados</span>
            <span class="text-[10px] text-ink-3"><strong class="text-ink">{{ contacts.length }}</strong> total</span>
          </div>
          <div class="flex items-center gap-[7px] bg-glass border border-line rounded px-2.5 py-2 mb-2.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4 flex-shrink-0">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              v-model="searchFilter"
              placeholder="Filtrar contactos..."
              class="flex-1 bg-transparent border-none outline-none text-ink text-[12px] placeholder:text-ink-4"
            >
            <button
              v-if="searchFilter"
              class="text-ink-4 hover:text-ink border-none bg-transparent cursor-pointer"
              @click="searchFilter = ''"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="flex items-center gap-2 px-1 mb-1.5">
            <button
              class="w-4 h-4 rounded border-[1.5px] flex items-center justify-center flex-shrink-0 cursor-pointer border-none bg-transparent p-0"
              :class="allFilteredSelected ? 'bg-acid border-acid' : 'border-line-2 bg-glass'"
              @click="toggleAll"
            >
              <svg v-if="allFilteredSelected" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <span class="text-[10px] text-ink-3">
              {{ allFilteredSelected ? 'Deseleccionar todo' : 'Seleccionar todo' }} ({{ selectableContacts.length }})
            </span>
            <span class="ml-auto text-[10px] text-acid font-semibold">{{ selectedUuids.length }} seleccionados</span>
          </div>
          <div class="max-h-48 overflow-y-auto mb-4 border border-line rounded-lg overflow-hidden">
            <div v-if="filteredContacts.length === 0" class="py-6 text-center text-[12px] text-ink-3">
              No hay contactos que coincidan
            </div>
            <div
              v-for="c in filteredContacts"
              :key="c.uuid"
              class="flex items-center gap-2 px-2.5 py-2 transition-colors border-b border-line last:border-b-0"
              :class="c.is_confirmed ? 'opacity-50 cursor-default' : contactState[c.uuid]?.selected ? 'bg-glass-active' : 'hover:bg-glass cursor-pointer'"
              @click="!c.is_confirmed && contactState[c.uuid] && (contactState[c.uuid].selected = !contactState[c.uuid].selected)"
            >
              <div
                class="w-4 h-4 rounded border-[1.5px] flex items-center justify-center flex-shrink-0"
                :class="c.is_confirmed ? 'bg-[#1fad5a22] border-[#1fad5a66]' : contactState[c.uuid]?.selected ? 'bg-acid border-acid' : 'border-line-2 bg-glass'"
              >
                <svg v-if="c.is_confirmed" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#1fad5a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <svg v-else-if="contactState[c.uuid]?.selected" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-ink-2 border border-line" :style="{ background: c.role?.color ?? 'var(--bg4)' }">
                {{ c.first_name.charAt(0) }}{{ c.last_name.charAt(0) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[12px] font-medium text-ink truncate leading-snug">{{ c.full_name }}</p>
                <p class="text-[10px] text-ink-3 truncate">{{ c.primary_email || c.job_title || '—' }}</p>
              </div>
              <div class="flex-shrink-0" @click.stop>
                <span v-if="c.is_confirmed" class="text-[9px] font-semibold px-1.5 py-0.5 rounded" style="background:rgba(31,173,90,0.12);color:#1fad5a">Ya importado</span>
                <div v-else-if="contactState[c.uuid]" class="relative flex items-center gap-1">
                  <div v-if="contactState[c.uuid].roleUuid" class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ background: roles.find((r) => r.uuid === contactState[c.uuid].roleUuid)?.color ?? '#888' }" />
                  <select v-model="contactState[c.uuid].roleUuid" class="bg-glass border border-line rounded px-1.5 py-1 text-ink-3 text-[10px] outline-none focus:border-acid transition-colors appearance-none cursor-pointer max-w-[90px]">
                    <option value="">Sin rol</option>
                    <option v-for="r in roles" :key="r.uuid" :value="r.uuid">{{ r.name }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <BtnPrimary full :disabled="selectedUuids.length === 0" @click="doImport">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Importar {{ selectedUuids.length > 0 ? `${selectedUuids.length} contacto${selectedUuids.length !== 1 ? 's' : ''}` : 'seleccionados' }}
            </BtnPrimary>
            <BtnSecondary @click="gStep = 'idle'">↩</BtnSecondary>
          </div>
        </div>

        <!-- IMPORTING -->
        <div v-else-if="gStep === 'importing'" class="text-center py-6">
          <svg class="animate-spin text-acid mx-auto mb-3" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
          </svg>
          <p class="text-[13px] text-ink-2">Importando contactos...</p>
        </div>

        <!-- DONE (google) -->
        <div v-else-if="gStep === 'done'" class="text-center py-3">
          <div class="w-10 h-10 rounded-xl bg-acid flex items-center justify-center mx-auto mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p class="text-[14px] font-bold text-ink mb-1">¡Crew importado!</p>
          <p class="text-[11px] text-ink-3 mb-5">
            {{ selectedUuids.length }} contacto{{ selectedUuids.length !== 1 ? 's' : '' }} añadido{{ selectedUuids.length !== 1 ? 's' : '' }}
          </p>
          <BtnPrimary full @click="emit('next')">Continuar</BtnPrimary>
        </div>
      </template>
    </template>

    <!-- ── Manual tab ──────────────────────────────────────────────────────────── -->
    <template v-else>
      <!-- SAVING -->
      <div v-if="manualStep === 'saving'" class="text-center py-6">
        <svg class="animate-spin text-acid mx-auto mb-3" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
        </svg>
        <p class="text-[13px] text-ink-2">Creando contacto...</p>
      </div>

      <!-- DONE (manual) -->
      <div v-else-if="manualStep === 'done'" class="text-center py-3">
        <div class="w-10 h-10 rounded-xl bg-acid flex items-center justify-center mx-auto mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p class="text-[14px] font-bold text-ink mb-1">¡Contacto creado!</p>
        <p class="text-[11px] text-ink-3 mb-5">{{ createdContact?.full_name }} fue añadido al crew</p>
        <div class="flex gap-2">
          <BtnPrimary full @click="resetManualForm">Añadir otro</BtnPrimary>
          <BtnSecondary full @click="emit('next')">Continuar</BtnSecondary>
        </div>
      </div>

      <!-- FORM -->
      <div v-else class="space-y-3">
        <div class="flex gap-[3px] bg-glass border border-line rounded-[7px] p-0.5">
          <button
            v-for="ct in [{ key: 'person', label: 'Persona' }, { key: 'company', label: 'Empresa' }]"
            :key="ct.key"
            class="flex-1 py-[5px] rounded-[5px] border-none text-[11px] font-semibold cursor-pointer transition-all duration-150"
            :class="form.contact_type === ct.key ? 'bg-acid text-black' : 'bg-transparent text-ink-3 hover:text-ink'"
            @click="form.contact_type = ct.key as 'person' | 'company'"
          >
            {{ ct.label }}
          </button>
        </div>

        <div v-if="form.contact_type === 'person'" class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-semibold text-ink-3 block mb-1">Nombre *</label>
            <input v-model="form.first_name" placeholder="Juan" class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4" >
          </div>
          <div>
            <label class="text-[10px] font-semibold text-ink-3 block mb-1">Apellido</label>
            <input v-model="form.last_name" placeholder="García" class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4" >
          </div>
        </div>
        <div v-else>
          <label class="text-[10px] font-semibold text-ink-3 block mb-1">Empresa *</label>
          <input v-model="form.company_name" placeholder="Nombre de la empresa" class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4" >
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-semibold text-ink-3 block mb-1">Rol</label>
            <div class="relative flex items-center">
              <div v-if="form.role" class="absolute left-2.5 w-2 h-2 rounded-full pointer-events-none" :style="{ background: roles.find((r) => r.uuid === form.role)?.color ?? '#888' }" />
              <select v-model="form.role" class="w-full bg-glass border border-line rounded py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors appearance-none cursor-pointer" :class="form.role ? 'pl-7 pr-2.5' : 'px-2.5'">
                <option value="">Sin rol</option>
                <option v-for="r in roles" :key="r.uuid" :value="r.uuid">{{ r.name }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-semibold text-ink-3 block mb-1">Cargo</label>
            <input v-model="form.job_title" placeholder="Director de gira" class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4" >
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-semibold text-ink-3 block mb-1">Email</label>
            <input v-model="form.primary_email" type="email" placeholder="email@ejemplo.com" class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4" >
          </div>
          <div>
            <label class="text-[10px] font-semibold text-ink-3 block mb-1">Teléfono</label>
            <input v-model="form.primary_phone" type="tel" placeholder="+52 55 0000 0000" class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4" >
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-semibold text-ink-3 block mb-1">Ciudad</label>
            <input v-model="form.city" placeholder="Ciudad de México" class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4" >
          </div>
          <div>
            <label class="text-[10px] font-semibold text-ink-3 block mb-1">País</label>
            <input v-model="form.country" placeholder="México" class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4" >
          </div>
        </div>

        <div>
          <label class="text-[10px] font-semibold text-ink-3 block mb-1">Notas</label>
          <textarea v-model="form.notes" rows="2" placeholder="Notas adicionales..." class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4 resize-none" />
        </div>

        <div class="flex gap-2">
          <button
            class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded border transition-all cursor-pointer"
            :class="form.is_favorite ? 'border-acid bg-glass-active text-acid' : 'border-line bg-glass text-ink-3 hover:border-line-2 hover:text-ink'"
            @click="form.is_favorite = !form.is_favorite"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :fill="form.is_favorite ? 'currentColor' : 'none'">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span class="text-[11px] font-medium">Favorito</span>
          </button>
          <button
            class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded border transition-all cursor-pointer"
            :class="form.is_emergency ? 'border-[#e85d00] bg-glass-active text-[#e85d00]' : 'border-line bg-glass text-ink-3 hover:border-line-2 hover:text-ink'"
            @click="form.is_emergency = !form.is_emergency"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span class="text-[11px] font-medium">Emergencia</span>
          </button>
        </div>

        <p v-if="manualError" class="text-[11px] text-red-400">{{ manualError }}</p>

        <div class="flex gap-2 pt-1">
          <BtnPrimary full :disabled="!manualValid" @click="submitManual">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/>
            </svg>
            Crear contacto
          </BtnPrimary>
        </div>
      </div>
    </template>

    <!-- Skip -->
    <button
      v-if="(source === 'google' && (gStep === 'idle' || gStep === 'selecting')) || (source === 'manual' && manualStep === 'form')"
      class="w-full mt-3 text-[11px] text-ink-4 hover:text-ink-2 transition-colors bg-transparent border-none cursor-pointer py-1"
      @click="emit('skip')"
    >
      Omitir por ahora →
    </button>
  </div>
</template>
