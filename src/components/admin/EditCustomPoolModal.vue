<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useAdminCustomPools, type CustomPool } from '@/composables/useAdminCustomPools'
import { useAdminUsers, type UserSearchResult } from '@/composables/useAdminUsers'

const props = defineProps<{ show: boolean; pool: CustomPool | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const api = useAdminCustomPools()
const usersApi = useAdminUsers()

const selectedUser = ref<UserSearchResult | null>(null)
const userQuery = ref('')
const userResults = ref<UserSearchResult[]>([])
const searchingUsers = ref(false)
const totalNotifications = ref(0)
const totalShows = ref(0)
const notes = ref('')
const saving = ref(false)
const error = ref('')

const isEdit = computed(() => !!props.pool)

watch(
  () => [props.show, props.pool] as const,
  ([show, pool]) => {
    if (!show) return
    selectedUser.value = null
    userQuery.value = ''
    userResults.value = []
    totalNotifications.value = pool?.total_notifications ?? 0
    totalShows.value = pool?.total_shows ?? 0
    notes.value = pool?.notes ?? ''
    error.value = ''
  },
  { immediate: true },
)

let userDebounce: ReturnType<typeof setTimeout>
watch(userQuery, (q: string) => {
  clearTimeout(userDebounce)
  if (!q.trim()) {
    userResults.value = []
    return
  }
  userDebounce = setTimeout(async () => {
    searchingUsers.value = true
    try {
      userResults.value = await usersApi.search(q)
    } catch {
      userResults.value = []
    } finally {
      searchingUsers.value = false
    }
  }, 300)
})

function selectUser(u: UserSearchResult) {
  selectedUser.value = u
  userQuery.value = ''
  userResults.value = []
}

async function submit() {
  saving.value = true
  error.value = ''
  try {
    if (isEdit.value && props.pool) {
      await api.update(props.pool.uuid, {
        total_notifications: totalNotifications.value,
        total_shows: totalShows.value,
        notes: notes.value.trim() || undefined,
      })
    } else {
      if (!selectedUser.value) return
      await api.create({
        user: selectedUser.value.uuid,
        total_notifications: totalNotifications.value,
        total_shows: totalShows.value,
        notes: notes.value.trim() || undefined,
      })
    }
    emit('saved')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    saving.value = false
  }
}

const inputClass =
  'w-full bg-bg-3 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 transition-colors'
const labelClass = 'block text-[10px] font-semibold text-ink-3 tracking-[0.5px] uppercase mb-1'
</script>

<template>
  <AppModal
    :show="show"
    @close="emit('close')"
  >
    <p class="text-base font-bold text-ink tracking-[-0.2px] mb-4">
      {{ isEdit ? 'Editar cupo Custom' : 'Nuevo cupo Custom' }}
    </p>

    <div class="space-y-3">
      <div v-if="!isEdit">
        <label :class="labelClass">Cliente</label>

        <div
          v-if="selectedUser"
          class="flex items-center justify-between bg-bg-3 border border-line-acid rounded-lg px-3 py-2"
        >
          <div class="min-w-0">
            <p class="text-[12px] text-ink truncate">
              {{ selectedUser.full_name || selectedUser.email }}
            </p>
            <p class="text-[10px] text-ink-4 truncate">
              {{ selectedUser.email }}
            </p>
          </div>
          <button
            class="text-[10px] text-ink-4 hover:text-ink cursor-pointer border-none bg-transparent flex-shrink-0"
            @click="selectedUser = null"
          >
            Cambiar
          </button>
        </div>

        <div
          v-else
          class="relative"
        >
          <input
            v-model="userQuery"
            :class="inputClass"
            placeholder="Buscar por email o nombre…"
          >
          <div
            v-if="userQuery.trim() && (searchingUsers || userResults.length > 0)"
            class="absolute top-full left-0 right-0 mt-1 bg-bg-3 border border-line rounded-lg z-10 py-1 shadow-lg max-h-40 overflow-y-auto"
          >
            <p
              v-if="searchingUsers"
              class="px-3 py-1.5 text-[11px] text-ink-4"
            >
              Buscando…
            </p>
            <template v-else>
              <button
                v-for="u in userResults"
                :key="u.uuid"
                class="w-full flex flex-col items-start px-3 py-1.5 hover:bg-glass cursor-pointer transition-colors border-none bg-transparent text-left"
                @click="selectUser(u)"
              >
                <span class="text-[12px] text-ink">{{ u.full_name || u.email }}</span>
                <span class="text-[10px] text-ink-4">{{ u.email }}</span>
              </button>
            </template>
          </div>
          <p
            v-else-if="userQuery.trim() && !searchingUsers"
            class="text-[11px] text-ink-4 mt-1"
          >
            Sin resultados
          </p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label :class="labelClass">Total notificaciones</label>
          <input
            v-model.number="totalNotifications"
            type="number"
            min="0"
            :class="inputClass"
          >
        </div>
        <div>
          <label :class="labelClass">Total shows</label>
          <input
            v-model.number="totalShows"
            type="number"
            min="0"
            :class="inputClass"
          >
        </div>
      </div>
      <div>
        <label :class="labelClass">Notas</label>
        <textarea
          v-model="notes"
          :class="inputClass"
          rows="2"
          style="resize: vertical"
        />
      </div>

      <p
        v-if="error"
        class="text-[11px] text-red-400"
      >
        {{ error }}
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <button
          class="px-3.5 py-[7px] rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          class="px-3.5 py-[7px] rounded-sm text-[11px] font-bold bg-acid text-black cursor-pointer disabled:opacity-50"
          :disabled="saving || (!isEdit && !selectedUser)"
          @click="submit"
        >
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </div>
  </AppModal>
</template>
