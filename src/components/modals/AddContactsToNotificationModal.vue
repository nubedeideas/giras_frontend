<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useNotifications, type ContactListItem, type NotificationChannel } from '@/composables/useNotifications'

const props = defineProps<{
  show: boolean
  notificationUuid: string
  channel: NotificationChannel
}>()
const emit = defineEmits<{ close: []; added: [] }>()

const api = useNotifications()

const contacts = ref<ContactListItem[]>([])
const loading = ref(false)
const loadError = ref('')
const search = ref('')
const selected = ref<Set<string>>(new Set())
const saving = ref(false)
const saveError = ref('')

// ─── Roles ────────────────────────────────────────────────────────────────────

// All roles derived from loaded contacts
const availableRoles = computed(() => {
  const seen = new Map<string, { uuid: string; name: string; color: string }>()
  for (const c of contacts.value) {
    if (c.role && !seen.has(c.role.uuid)) {
      seen.set(c.role.uuid, { uuid: c.role.uuid, name: c.role.name, color: c.role.color })
    }
  }
  return [...seen.values()]
})

// For each role: how many contacts total and how many are selected
function roleStats(roleUuid: string) {
  const roleContacts = contacts.value.filter((c) => c.role?.uuid === roleUuid)
  const selectedCount = roleContacts.filter((c) => selected.value.has(c.uuid)).length
  return { total: roleContacts.length, selectedCount }
}

// State: 'none' | 'partial' | 'all'
function roleSelectionState(roleUuid: string): 'none' | 'partial' | 'all' {
  const { total, selectedCount } = roleStats(roleUuid)
  if (selectedCount === 0) return 'none'
  if (selectedCount === total) return 'all'
  return 'partial'
}

function toggleRoleSelection(roleUuid: string) {
  const roleContacts = contacts.value.filter((c) => c.role?.uuid === roleUuid)
  const state = roleSelectionState(roleUuid)
  if (state === 'all') {
    // Deselect all from this role
    roleContacts.forEach((c) => selected.value.delete(c.uuid))
  } else {
    // Select all from this role
    roleContacts.forEach((c) => selected.value.add(c.uuid))
  }
  selected.value = new Set(selected.value)
}

// ─── Filtered contact list ────────────────────────────────────────────────────

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return contacts.value
  return contacts.value.filter(
    (c) =>
      c.full_name.toLowerCase().includes(q) ||
      (c.company_name ?? '').toLowerCase().includes(q) ||
      (c.primary_email ?? '').toLowerCase().includes(q) ||
      (c.primary_phone ?? '').includes(q),
  )
})

// ─── Init ─────────────────────────────────────────────────────────────────────

watch(
  () => props.show,
  async (v) => {
    if (v) {
      selected.value = new Set()
      search.value = ''
      saveError.value = ''
      await loadContacts()
    }
  },
)

async function loadContacts() {
  loading.value = true
  loadError.value = ''
  try {
    contacts.value = await api.listGlobalContacts()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Error al cargar contactos'
  } finally {
    loading.value = false
  }
}

// ─── Individual toggle ────────────────────────────────────────────────────────

function toggle(uuid: string) {
  if (selected.value.has(uuid)) selected.value.delete(uuid)
  else selected.value.add(uuid)
  selected.value = new Set(selected.value)
}

function missingContactInfo(c: ContactListItem): boolean {
  if (props.channel === 'email') return !c.primary_email
  if (props.channel === 'sms' || props.channel === 'whatsapp') return !c.primary_phone
  return false
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function addSelected() {
  if (selected.value.size === 0) return
  saving.value = true
  saveError.value = ''
  try {
    await api.addContacts(props.notificationUuid, Array.from(selected.value))
    emit('added')
    emit('close')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Error al agregar contactos'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <!-- Header -->
    <div class="flex items-start justify-between mb-4">
      <div>
        <p class="text-base font-bold text-ink tracking-[-0.2px]">Agregar Contactos</p>
        <p class="text-[10px] text-ink-3 mt-0.5">
          {{ selected.size }} seleccionado{{ selected.size !== 1 ? 's' : '' }}
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

    <!-- ── Role group-select chips ──────────────────────────────────────────── -->
    <div v-if="!loading && availableRoles.length > 0" class="mb-3">
      <p class="text-[9px] font-semibold text-ink-4 uppercase tracking-[0.5px] mb-1.5">
        Seleccionar por rol
      </p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="role in availableRoles"
          :key="role.uuid"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer select-none"
          :style="roleSelectionState(role.uuid) === 'all'
            ? { background: role.color + '22', borderColor: role.color, color: role.color }
            : roleSelectionState(role.uuid) === 'partial'
              ? { background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }
              : { background: 'transparent', borderColor: 'var(--line)', color: 'var(--ink-3)' }"
          @click="toggleRoleSelection(role.uuid)"
        >
          <!-- Color dot -->
          <span
            class="w-2 h-2 rounded-full flex-shrink-0 transition-opacity"
            :style="{ background: role.color, opacity: roleSelectionState(role.uuid) === 'none' ? '0.45' : '1' }"
          />

          <!-- Name -->
          <span>{{ role.name }}</span>

          <!-- Counter badge -->
          <span
            class="text-[9px] font-bold px-1 py-0.5 rounded min-w-[18px] text-center leading-none transition-colors"
            :style="roleSelectionState(role.uuid) === 'all'
              ? { background: role.color + '33', color: role.color }
              : roleSelectionState(role.uuid) === 'partial'
                ? { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
                : { background: 'var(--glass-2)', color: 'var(--ink-4)' }"
          >
            {{ roleStats(role.uuid).selectedCount }}/{{ roleStats(role.uuid).total }}
          </span>

          <!-- Check icon when all selected -->
          <svg
            v-if="roleSelectionState(role.uuid) === 'all'"
            width="9" height="9" viewBox="0 0 24 24" fill="none"
            :stroke="role.color" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="relative mb-3">
      <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        v-model="search"
        class="w-full bg-glass border border-line rounded-lg pl-8 pr-3 py-[7px] text-[12px] text-ink placeholder:text-ink-4 outline-none focus:border-line-2 transition-colors"
        placeholder="Buscar contactos…"
      />
    </div>

    <!-- Contact list -->
    <div class="max-h-[42vh] overflow-y-auto -mx-1 px-1">

      <div v-if="loading" class="flex justify-center py-8">
        <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
        </svg>
      </div>

      <p v-else-if="loadError" class="text-[11px] text-red-400 py-4 text-center">{{ loadError }}</p>

      <p v-else-if="filtered.length === 0" class="text-[11px] text-ink-4 py-4 text-center">
        Sin resultados
      </p>

      <template v-else>
        <button
          v-for="c in filtered"
          :key="c.uuid"
          class="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg border-none text-left transition-colors cursor-pointer"
          :class="selected.has(c.uuid) ? 'bg-acid/10' : 'bg-transparent hover:bg-glass'"
          @click="toggle(c.uuid)"
        >
          <!-- Checkbox -->
          <span
            class="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
            :class="selected.has(c.uuid) ? 'bg-acid border-acid' : 'border-line bg-glass'"
          >
            <svg v-if="selected.has(c.uuid)" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="text-[12px] font-medium text-ink truncate">{{ c.full_name || c.company_name || '—' }}</p>
              <span
                v-if="c.role"
                class="text-[9px] font-semibold px-1 py-0.5 rounded flex-shrink-0"
                :style="{ background: c.role.color + '22', color: c.role.color }"
              >{{ c.role.name }}</span>
            </div>
            <p class="text-[10px] text-ink-3 truncate">
              <span v-if="c.primary_email">{{ c.primary_email }}</span>
              <span v-if="c.primary_email && c.primary_phone"> · </span>
              <span v-if="c.primary_phone">{{ c.primary_phone }}</span>
              <span v-if="!c.primary_email && !c.primary_phone" class="text-ink-4">Sin contacto</span>
            </p>
          </div>

          <!-- Missing info warning -->
          <span
            v-if="missingContactInfo(c)"
            class="text-[10px] text-[#f59e0b] flex-shrink-0"
            title="Falta información de contacto para este canal"
          >⚠</span>
        </button>
      </template>
    </div>

    <!-- Error -->
    <p v-if="saveError" class="text-[11px] text-red-400 mt-2">{{ saveError }}</p>

    <!-- Actions -->
    <div class="flex gap-2 mt-4">
      <button
        class="flex-1 py-2.5 rounded-lg font-semibold text-[12px] border-none cursor-pointer transition-all"
        :class="saving || selected.size === 0 ? 'bg-glass text-ink-4 cursor-not-allowed' : 'bg-acid text-black'"
        :disabled="saving || selected.size === 0"
        @click="addSelected"
      >
        {{ saving ? 'Agregando…' : `Agregar ${selected.size > 0 ? selected.size : ''} contacto${selected.size !== 1 ? 's' : ''}` }}
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
