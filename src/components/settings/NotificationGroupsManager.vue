<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToursStore } from '@/stores/tours'
import {
  useNotificationGroups,
  isTourTeamGroup,
  type NotificationGroupListItem,
} from '@/composables/useNotificationGroups'
import ManageGroupContactsModal from '@/components/modals/ManageGroupContactsModal.vue'
import { inUseErrorMessage } from '@/utils/notificationRules'
import { hasApiErrorCode, SYSTEM_GROUP_LOCKED } from '@/utils/notificationErrors'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

const api = useNotificationGroups()
const toursStore = useToursStore()
const { t } = useI18n()

// ─── State ────────────────────────────────────────────────────────────────────

const groups = ref<NotificationGroupListItem[]>([])
const loading = ref(false)
const error = ref('')

// Edit state
const editingUuid = ref<string | null>(null)
const editForm = ref({ name: '', description: '', tour: '' })
const editError = ref('')
const editSaving = ref(false)
// El listado no trae `description`: la edición carga el detalle antes de dejar guardar.
const editLoading = ref(false)
const editLoadFailed = ref(false)
// Guard de respuesta vieja: abrir otro grupo antes de que vuelva el detalle del anterior.
let editRequest = 0
// Equipo de la gira: nombre y gira bloqueados, sin borrado (403 `system_group_locked`).
const editingLocked = computed(() => {
  const g = groups.value.find((x) => x.uuid === editingUuid.value)
  return !!g && isTourTeamGroup(g)
})

// Create state
const showCreate = ref(false)
const createForm = ref({ name: '', description: '', tour: '' })
const createError = ref('')
const createSaving = ref(false)

// Delete state
const deletingUuid = ref<string | null>(null)
const deleteError = ref('')
const deleteSaving = ref(false)

// Manage contacts modal
const managingUuid = ref<string | null>(null)

// ─── Load ─────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value = ''
  try {
    groups.value = await api.listGroups()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar grupos'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ─── Edit ─────────────────────────────────────────────────────────────────────

async function startEdit(group: NotificationGroupListItem) {
  const request = ++editRequest
  editingUuid.value = group.uuid
  editForm.value = { name: group.name, description: '', tour: group.tour ?? '' }
  editError.value = ''
  editLoadFailed.value = false
  editLoading.value = true
  showCreate.value = false
  deletingUuid.value = null
  try {
    const detail = await api.getGroup(group.uuid)
    if (request !== editRequest) return
    editForm.value = {
      name: detail.name,
      description: detail.description ?? '',
      tour: detail.tour ?? '',
    }
  } catch {
    if (request !== editRequest) return
    editLoadFailed.value = true
    editError.value = t('settings.groupsManager.loadError')
  } finally {
    if (request === editRequest) editLoading.value = false
  }
}

function cancelEdit() {
  editRequest++
  editingUuid.value = null
  editError.value = ''
  editLoading.value = false
  editLoadFailed.value = false
}

async function saveEdit() {
  if (!editingUuid.value || !editForm.value.name.trim()) return
  if (editLoading.value || editLoadFailed.value) return
  editSaving.value = true
  editError.value = ''
  try {
    const description = editForm.value.description.trim()
    const updated = await api.updateGroup(
      editingUuid.value,
      editingLocked.value
        ? { description }
        : { name: editForm.value.name.trim(), description, tour: editForm.value.tour || null }
    )
    const idx = groups.value.findIndex((g) => g.uuid === updated.uuid)
    if (idx >= 0) {
      groups.value[idx] = {
        uuid: updated.uuid,
        name: updated.name,
        tour: updated.tour,
        tour_name: updated.tour_name,
        contact_count: updated.contact_count,
        system_key: updated.system_key ?? null,
      }
    }
    editingUuid.value = null
  } catch (e) {
    if (hasApiErrorCode(e, SYSTEM_GROUP_LOCKED)) {
      editError.value = t('settings.groupsManager.systemLocked')
    } else {
      editError.value = e instanceof Error ? e.message : 'Error al guardar'
    }
  } finally {
    editSaving.value = false
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

function openCreate() {
  showCreate.value = true
  createForm.value = { name: '', description: '', tour: '' }
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
    const created = await api.createGroup({
      name: createForm.value.name.trim(),
      description: createForm.value.description.trim(),
      tour: createForm.value.tour || null,
    })
    groups.value.push({
      uuid: created.uuid,
      name: created.name,
      tour: created.tour,
      tour_name: created.tour_name,
      contact_count: created.contact_count,
      system_key: created.system_key ?? null,
    })
    showCreate.value = false
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Error al crear grupo'
  } finally {
    createSaving.value = false
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

function startDelete(uuid: string) {
  const group = groups.value.find((g) => g.uuid === uuid)
  if (group && isTourTeamGroup(group)) return
  editRequest++
  deletingUuid.value = uuid
  deleteError.value = ''
  editingUuid.value = null
  editLoading.value = false
  showCreate.value = false
}

async function confirmDelete() {
  if (!deletingUuid.value) return
  deleteSaving.value = true
  deleteError.value = ''
  try {
    await api.deleteGroup(deletingUuid.value)
    groups.value = groups.value.filter((g) => g.uuid !== deletingUuid.value)
    deletingUuid.value = null
  } catch (e) {
    // 403 `system_group_locked`: Equipo de la gira con un listado sin `system_key`.
    // 409 `group_in_use` (lo usan reglas activas): el mensaje del backend dice cuántas.
    deleteError.value = hasApiErrorCode(e, SYSTEM_GROUP_LOCKED)
      ? t('settings.groupsManager.systemLocked')
      : inUseErrorMessage(e, 'group', 'Error al eliminar')
  } finally {
    deleteSaving.value = false
  }
}

// ─── Manage contacts ──────────────────────────────────────────────────────────

function openManageContacts(uuid: string) {
  managingUuid.value = uuid
}

function onContactsSaved(newCount: number) {
  const idx = groups.value.findIndex((g) => g.uuid === managingUuid.value)
  if (idx >= 0) groups.value[idx].contact_count = newCount
  managingUuid.value = null
}
</script>

<template>
  <!-- Loading -->
  <div
    v-if="loading"
    class="flex items-center justify-center py-6"
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

  <div v-else>
    <p
      v-if="error"
      class="text-[13px] text-failed-fg mb-3"
    >
      {{ error }}
    </p>

    <!-- Groups list -->
    <div
      class="bg-glass border border-line rounded px-3.5 py-1 mb-3"
      data-test="groups-list"
    >
      <div
        v-for="group in groups"
        :key="group.uuid"
        class="border-b border-line last:border-b-0"
      >
        <!-- Normal row -->
        <div
          v-if="editingUuid !== group.uuid && deletingUuid !== group.uuid"
          class="flex items-center gap-2.5 py-2.5 group"
        >
          <!-- Icon -->
          <div class="w-6 h-6 rounded-lg bg-glass-2 flex items-center justify-center flex-shrink-0">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ink-3)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle
                cx="9"
                cy="7"
                r="4"
              />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>

          <!-- Name + badges -->
          <div class="flex-1 min-w-0 flex items-center gap-1.5">
            <button
              type="button"
              class="text-[14px] text-ink text-left truncate underline decoration-line-2 underline-offset-2 hover:text-olive hover:decoration-olive cursor-pointer bg-transparent border-none p-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
              :aria-label="t('settings.editItem', { name: group.name })"
              data-test="group-title"
              @click="startEdit(group)"
            >
              {{ group.name }}
            </button>
            <span
              class="text-[12px] font-semibold px-1.5 py-px rounded-full border border-line text-ink-4 leading-none flex-shrink-0"
            >
              {{ group.tour_name ?? 'Global' }}
            </span>
            <span
              v-if="isTourTeamGroup(group)"
              class="text-[12px] font-semibold px-1.5 py-px rounded-full border border-line text-ink-4 leading-none flex-shrink-0"
              :title="t('settings.groupsManager.systemHint')"
              data-test="group-system-badge"
            >
              {{ t('settings.groupsManager.systemBadge') }}
            </span>
            <span class="text-[12px] text-ink-4 flex-shrink-0">
              {{ group.contact_count }} contacto{{ group.contact_count !== 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Actions: siempre visibles (color olive) y táctiles en móvil -->
          <div class="flex items-center gap-0.5 flex-shrink-0">
            <button
              class="w-11 h-11 lg:w-6 lg:h-6 flex items-center justify-center rounded text-olive hover:text-olive-strong hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
              title="Gestionar contactos"
              data-test="group-row-contacts"
              @click="openManageContacts(group.uuid)"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle
                  cx="8.5"
                  cy="7"
                  r="4"
                />
                <line
                  x1="20"
                  y1="8"
                  x2="20"
                  y2="14"
                /><line
                  x1="23"
                  y1="11"
                  x2="17"
                  y2="11"
                />
              </svg>
            </button>
            <button
              class="w-11 h-11 lg:w-6 lg:h-6 flex items-center justify-center rounded text-olive hover:text-olive-strong hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
              title="Editar"
              data-test="group-row-edit"
              @click="startEdit(group)"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              v-if="!isTourTeamGroup(group)"
              class="w-11 h-11 lg:w-6 lg:h-6 flex items-center justify-center rounded text-ink-4 hover:text-failed-fg hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
              title="Eliminar"
              data-test="group-row-delete"
              @click="startDelete(group.uuid)"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Edit row -->
        <div
          v-else-if="editingUuid === group.uuid"
          class="py-2.5 space-y-2"
        >
          <p
            v-if="editLoading"
            class="text-[12px] text-ink-3"
            data-test="group-edit-loading"
          >
            {{ t('settings.groupsManager.loading') }}
          </p>
          <input
            v-model="editForm.name"
            class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors disabled:cursor-not-allowed"
            placeholder="Nombre del grupo"
            :disabled="editLoading || editingLocked"
            data-test="group-edit-name"
            @keydown.enter="saveEdit"
            @keydown.esc="cancelEdit"
          >
          <input
            v-model="editForm.description"
            class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors disabled:cursor-not-allowed"
            placeholder="Descripción (opcional)"
            :disabled="editLoading"
            data-test="group-edit-description"
            @keydown.enter="saveEdit"
            @keydown.esc="cancelEdit"
          >
          <select
            v-model="editForm.tour"
            class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive cursor-pointer transition-colors disabled:cursor-not-allowed"
            :disabled="editLoading || editingLocked"
            data-test="group-edit-tour"
          >
            <option value="">
              Global (todas las giras)
            </option>
            <option
              v-for="tour in toursStore.tours"
              :key="tour.uuid"
              :value="tour.uuid"
            >
              {{ tour.artist_name }} — {{ tour.name }}
            </option>
          </select>

          <!-- Miembros y borrado desde la propia edición -->
          <div class="flex flex-wrap items-center gap-2">
            <BtnSecondary
              small
              type="button"
              data-test="group-edit-contacts"
              @click="openManageContacts(group.uuid)"
            >
              {{ t('settings.groupsManager.manageContacts', { n: group.contact_count }) }}
            </BtnSecondary>
            <button
              v-if="!editingLocked"
              type="button"
              class="min-h-[44px] lg:min-h-0 px-2 text-[13px] font-medium text-failed-fg hover:underline bg-transparent border-none cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
              data-test="group-edit-delete"
              @click="startDelete(group.uuid)"
            >
              {{ t('settings.groupsManager.delete') }}
            </button>
          </div>
          <p
            v-if="editingLocked"
            class="text-[12px] text-ink-3"
            data-test="group-edit-locked-hint"
          >
            {{ t('settings.groupsManager.systemHint') }}
          </p>

          <p
            v-if="editError"
            class="text-[12px] text-failed-fg"
            data-test="group-edit-error"
          >
            {{ editError }}
          </p>

          <div class="flex gap-1.5">
            <button
              class="flex-1 py-1.5 rounded text-[13px] font-semibold bg-acid text-ink cursor-pointer border-none transition-opacity disabled:cursor-not-allowed"
              :class="editSaving || editLoading || editLoadFailed ? 'opacity-50' : ''"
              :disabled="editSaving || editLoading || editLoadFailed || !editForm.name.trim()"
              data-test="group-edit-save"
              @click="saveEdit"
            >
              {{ editSaving ? 'Guardando…' : 'Guardar' }}
            </button>
            <button
              class="px-3 py-1.5 rounded text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
              @click="cancelEdit"
            >
              Cancelar
            </button>
          </div>
        </div>

        <!-- Delete confirm row -->
        <div
          v-else-if="deletingUuid === group.uuid"
          class="py-2.5"
        >
          <p class="text-[13px] text-ink-2 mb-1">
            ¿Eliminar <strong class="text-ink">{{ group.name }}</strong>?
          </p>
          <p
            v-if="deleteError"
            class="text-[12px] text-failed-fg mb-1"
          >
            {{ deleteError }}
          </p>
          <div class="flex gap-1.5">
            <button
              class="flex-1 py-1.5 rounded text-[13px] font-semibold cursor-pointer border-none transition-opacity"
              style="background: var(--failed-bg); color: var(--failed-fg)"
              :class="deleteSaving ? 'opacity-50' : ''"
              :disabled="deleteSaving"
              @click="confirmDelete"
            >
              {{ deleteSaving ? 'Eliminando…' : 'Eliminar' }}
            </button>
            <button
              class="px-3 py-1.5 rounded text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
              @click="deletingUuid = null"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="groups.length === 0 && !loading"
        class="py-4 text-center text-[13px] text-ink-4"
      >
        No hay grupos de notificación definidos
      </div>
    </div>

    <!-- Create form -->
    <div
      v-if="showCreate"
      class="bg-glass border border-line-acid rounded px-3.5 py-3 mb-3 space-y-2"
    >
      <p class="text-[12px] font-bold text-ink-2 tracking-[0.5px] uppercase">
        Nuevo grupo
      </p>

      <input
        v-model="createForm.name"
        class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors"
        placeholder="Nombre del grupo *"
        autofocus
        @keydown.enter="submitCreate"
        @keydown.esc="cancelCreate"
      >
      <input
        v-model="createForm.description"
        class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors"
        placeholder="Descripción (opcional)"
        @keydown.enter="submitCreate"
        @keydown.esc="cancelCreate"
      >
      <select
        v-model="createForm.tour"
        class="w-full bg-bg-2 border border-line rounded px-2.5 py-1.5 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive cursor-pointer transition-colors"
      >
        <option value="">
          Global (todas las giras)
        </option>
        <option
          v-for="tour in toursStore.tours"
          :key="tour.uuid"
          :value="tour.uuid"
        >
          {{ tour.artist_name }} — {{ tour.name }}
        </option>
      </select>

      <p
        v-if="createError"
        class="text-[12px] text-failed-fg"
      >
        {{ createError }}
      </p>

      <div class="flex gap-1.5">
        <button
          class="flex-1 py-1.5 rounded text-[13px] font-semibold bg-acid text-ink cursor-pointer border-none transition-opacity"
          :class="createSaving || !createForm.name.trim() ? 'opacity-50' : ''"
          :disabled="createSaving || !createForm.name.trim()"
          @click="submitCreate"
        >
          {{ createSaving ? 'Creando…' : 'Crear grupo' }}
        </button>
        <button
          class="px-3 py-1.5 rounded text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
          @click="cancelCreate"
        >
          Cancelar
        </button>
      </div>
    </div>

    <!-- Add group button -->
    <button
      v-if="!showCreate"
      class="w-full flex items-center justify-center gap-1.5 py-2 rounded border border-dashed border-line-2 text-[13px] text-ink-4 hover:text-ink hover:border-line cursor-pointer bg-transparent transition-colors"
      @click="openCreate"
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
        <line
          x1="12"
          y1="5"
          x2="12"
          y2="19"
        /><line
          x1="5"
          y1="12"
          x2="19"
          y2="12"
        />
      </svg>
      Nuevo grupo
    </button>

    <!-- Manage contacts modal -->
    <ManageGroupContactsModal
      :show="!!managingUuid"
      :group-uuid="managingUuid"
      @close="managingUuid = null"
      @saved="onContactsSaved"
    />
  </div>
</template>
