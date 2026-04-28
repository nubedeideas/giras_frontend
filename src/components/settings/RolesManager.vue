<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useContactRoles, type ContactRole } from '@/composables/useContactRoles'

const api = useContactRoles()

// ─── State ────────────────────────────────────────────────────────────────────

const roles = ref<ContactRole[]>([])
const loading = ref(false)
const error = ref('')

// Edit state
const editingUuid = ref<string | null>(null)
const editForm = ref({ name: '', color: '', description: '' })
const editError = ref('')
const editSaving = ref(false)

// Create state
const showCreate = ref(false)
const createForm = ref({ name: '', color: '#1a8fff', description: '' })
const createError = ref('')
const createSaving = ref(false)

// Delete state
const deletingUuid = ref<string | null>(null)
const deleteError = ref('')
const deleteSaving = ref(false)

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS = [
  '#a8d800', '#1a8fff', '#e85d00', '#9b5de5',
  '#e91e8c', '#1fad5a', '#f59e0b', '#ef4444',
  '#06b6d4', '#64748b', '#f97316', '#8b5cf6',
]

// ─── Load ─────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value = ''
  try {
    roles.value = await api.listRoles()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar roles'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ─── Edit ─────────────────────────────────────────────────────────────────────

function startEdit(role: ContactRole) {
  editingUuid.value = role.uuid
  editForm.value = { name: role.name, color: role.color, description: role.description }
  editError.value = ''
  showCreate.value = false
  deletingUuid.value = null
}

function cancelEdit() {
  editingUuid.value = null
  editError.value = ''
}

async function saveEdit() {
  if (!editingUuid.value || !editForm.value.name.trim()) return
  editSaving.value = true
  editError.value = ''
  try {
    const updated = await api.updateRole(editingUuid.value, {
      name: editForm.value.name.trim(),
      color: editForm.value.color,
      description: editForm.value.description.trim(),
    })
    const idx = roles.value.findIndex((r) => r.uuid === updated.uuid)
    if (idx >= 0) roles.value[idx] = updated
    editingUuid.value = null
  } catch (e) {
    editError.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    editSaving.value = false
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

function openCreate() {
  showCreate.value = true
  createForm.value = { name: '', color: '#1a8fff', description: '' }
  createError.value = ''
  editingUuid.value = null
  deletingUuid.value = null
}

function cancelCreate() {
  showCreate.value = false
  createError.value = ''
}

async function submitCreate() {
  if (!createForm.value.name.trim()) return
  createSaving.value = true
  createError.value = ''
  try {
    const created = await api.createRole({
      name: createForm.value.name.trim(),
      color: createForm.value.color,
      description: createForm.value.description.trim(),
    })
    roles.value.push(created)
    showCreate.value = false
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Error al crear rol'
  } finally {
    createSaving.value = false
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

function startDelete(uuid: string) {
  deletingUuid.value = uuid
  deleteError.value = ''
  editingUuid.value = null
  showCreate.value = false
}

async function confirmDelete() {
  if (!deletingUuid.value) return
  deleteSaving.value = true
  deleteError.value = ''
  try {
    await api.deleteRole(deletingUuid.value)
    roles.value = roles.value.filter((r) => r.uuid !== deletingUuid.value)
    deletingUuid.value = null
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Error al eliminar'
  } finally {
    deleteSaving.value = false
  }
}
</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="flex items-center justify-center py-6">
    <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
    </svg>
  </div>

  <div v-else>
    <p v-if="error" class="text-[11px] text-red-400 mb-3">{{ error }}</p>

    <!-- Roles list -->
    <div class="bg-glass border border-line rounded px-3.5 py-1 mb-3">
      <div
        v-for="role in roles"
        :key="role.uuid"
        class="border-b border-line last:border-b-0"
      >
        <!-- Normal row -->
        <div
          v-if="editingUuid !== role.uuid && deletingUuid !== role.uuid"
          class="flex items-center gap-2.5 py-2.5 group"
        >
          <!-- Color dot -->
          <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: role.color }" />

          <!-- Name + badges -->
          <div class="flex-1 min-w-0 flex items-center gap-1.5">
            <span class="text-[12px] text-ink truncate">{{ role.name }}</span>
            <span
              v-if="role.is_system"
              class="text-[9px] font-semibold px-1.5 py-px rounded-full border border-line text-ink-4 leading-none"
            >
              sistema
            </span>
          </div>

          <!-- Actions (hover) -->
          <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              class="w-6 h-6 flex items-center justify-center rounded text-ink-4 hover:text-ink hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent"
              title="Editar"
              @click="startEdit(role)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              v-if="!role.is_system"
              class="w-6 h-6 flex items-center justify-center rounded text-ink-4 hover:text-red-400 hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent"
              title="Eliminar"
              @click="startDelete(role.uuid)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Edit row -->
        <div v-else-if="editingUuid === role.uuid" class="py-2.5 space-y-2">
          <!-- Name input -->
          <input
            v-model="editForm.name"
            class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
            placeholder="Nombre del rol"
            @keydown.enter="saveEdit"
            @keydown.esc="cancelEdit"
          />

          <!-- Description input -->
          <input
            v-model="editForm.description"
            class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink-2 text-[11px] outline-none focus:border-acid transition-colors"
            placeholder="Descripción (opcional)"
            @keydown.enter="saveEdit"
            @keydown.esc="cancelEdit"
          />

          <!-- Color picker -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="c in COLORS"
              :key="c"
              class="w-5 h-5 rounded-full border-2 transition-all cursor-pointer"
              :style="{ background: c, borderColor: editForm.color === c ? 'white' : 'transparent' }"
              @click="editForm.color = c"
            />
          </div>

          <p v-if="editError" class="text-[10px] text-red-400">{{ editError }}</p>

          <!-- Actions -->
          <div class="flex gap-1.5">
            <button
              class="flex-1 py-1.5 rounded text-[11px] font-semibold bg-acid text-black cursor-pointer border-none transition-opacity"
              :class="editSaving ? 'opacity-50' : ''"
              :disabled="editSaving || !editForm.name.trim()"
              @click="saveEdit"
            >
              {{ editSaving ? 'Guardando…' : 'Guardar' }}
            </button>
            <button
              class="px-3 py-1.5 rounded text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
              @click="cancelEdit"
            >
              Cancelar
            </button>
          </div>
        </div>

        <!-- Delete confirm row -->
        <div v-else-if="deletingUuid === role.uuid" class="py-2.5">
          <p class="text-[11px] text-ink-2 mb-1">¿Eliminar <strong class="text-ink">{{ role.name }}</strong>?</p>
          <p v-if="deleteError" class="text-[10px] text-red-400 mb-1">{{ deleteError }}</p>
          <div class="flex gap-1.5">
            <button
              class="flex-1 py-1.5 rounded text-[11px] font-semibold cursor-pointer border-none transition-opacity"
              style="background: rgba(239,68,68,0.15); color: #f87171"
              :class="deleteSaving ? 'opacity-50' : ''"
              :disabled="deleteSaving"
              @click="confirmDelete"
            >
              {{ deleteSaving ? 'Eliminando…' : 'Eliminar' }}
            </button>
            <button
              class="px-3 py-1.5 rounded text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
              @click="deletingUuid = null"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="roles.length === 0 && !loading" class="py-4 text-center text-[11px] text-ink-4">
        No hay roles definidos
      </div>
    </div>

    <!-- Create form -->
    <div v-if="showCreate" class="bg-glass border border-line-acid rounded px-3.5 py-3 mb-3 space-y-2">
      <p class="text-[10px] font-bold text-ink-3 tracking-[0.5px] uppercase">Nuevo rol</p>

      <input
        v-model="createForm.name"
        class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        placeholder="Nombre del rol *"
        autofocus
        @keydown.enter="submitCreate"
        @keydown.esc="cancelCreate"
      />

      <input
        v-model="createForm.description"
        class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink-2 text-[11px] outline-none focus:border-acid transition-colors"
        placeholder="Descripción (opcional)"
        @keydown.enter="submitCreate"
        @keydown.esc="cancelCreate"
      />

      <!-- Color picker -->
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="c in COLORS"
          :key="c"
          class="w-5 h-5 rounded-full border-2 transition-all cursor-pointer"
          :style="{ background: c, borderColor: createForm.color === c ? 'white' : 'transparent' }"
          @click="createForm.color = c"
        />
      </div>

      <p v-if="createError" class="text-[10px] text-red-400">{{ createError }}</p>

      <div class="flex gap-1.5">
        <button
          class="flex-1 py-1.5 rounded text-[11px] font-semibold bg-acid text-black cursor-pointer border-none transition-opacity"
          :class="createSaving || !createForm.name.trim() ? 'opacity-50' : ''"
          :disabled="createSaving || !createForm.name.trim()"
          @click="submitCreate"
        >
          {{ createSaving ? 'Creando…' : 'Crear rol' }}
        </button>
        <button
          class="px-3 py-1.5 rounded text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
          @click="cancelCreate"
        >
          Cancelar
        </button>
      </div>
    </div>

    <!-- Add role button -->
    <button
      v-if="!showCreate"
      class="w-full flex items-center justify-center gap-1.5 py-2 rounded border border-dashed border-line-2 text-[11px] text-ink-4 hover:text-ink hover:border-line cursor-pointer bg-transparent transition-colors"
      @click="openCreate"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Nuevo rol
    </button>
  </div>
</template>
