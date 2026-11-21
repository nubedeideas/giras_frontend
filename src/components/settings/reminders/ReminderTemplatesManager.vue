<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActivityTypes, type ActivityType } from '@/composables/useActivityTypes'
import ReminderStepsEditor from './ReminderStepsEditor.vue'
import { ApiError } from '@/utils/apiClient'
import {
  DEFAULT_REMINDER_LIMITS,
  reminderErrorMessage,
  sameSteps,
  stepsOfType,
  stepsSummary,
  validateSteps,
  type ReminderStep,
} from '@/utils/reminders'

/**
 * Pestaña "Recordatorios" de Configuración (C1.2): plantilla del usuario por tipo de actividad.
 * Guardado por fila (PATCH `reminder_steps`) y "Restablecer valores de Giras" por fila y global.
 */
const api = useActivityTypes()
const { t } = useI18n()

const CATEGORY_ORDER = ['logistics', 'production', 'media', 'meetings', 'fan', 'personal', 'other']

const types = ref<ActivityType[]>([])
const loading = ref(false)
const loadError = ref('')

interface RowState {
  open: boolean
  draft: ReminderStep[]
  saving: boolean
  error: string
  saved: boolean
  confirmingReset: boolean
}
const rowState = reactive<Record<string, RowState>>({})

function emptyState(): RowState {
  return { open: false, draft: [], saving: false, error: '', saved: false, confirmingReset: false }
}

/** Crea el estado de cada fila al cargar (no durante el render). */
function setTypes(list: ActivityType[]) {
  for (const type of list) if (!rowState[type.uuid]) rowState[type.uuid] = emptyState()
  types.value = list
}

function state(uuid: string): RowState {
  return rowState[uuid] ?? emptyState()
}

const confirmingResetAll = ref(false)
const resettingAll = ref(false)
const resetAllError = ref('')

const grouped = computed(() => {
  const byCat = new Map<string, ActivityType[]>()
  for (const type of types.value) {
    const cat = CATEGORY_ORDER.includes(type.category) ? type.category : 'other'
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(type)
  }
  return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
    category: c,
    items: byCat.get(c)!.sort((a, b) => a.display_order - b.display_order),
  }))
})

async function reloadQuietly() {
  try {
    setTypes(await api.listActivityTypes())
  } catch {
    // Se queda la lista anterior; el error de la fila ya se ve.
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    setTypes(await api.listActivityTypes())
  } catch (e) {
    loadError.value = reminderErrorMessage(e, t, 'reminders.errors.load', { load: true })
  } finally {
    loading.value = false
  }
}

onMounted(load)

function toggleOpen(type: ActivityType) {
  const s = state(type.uuid)
  s.open = !s.open
  s.error = ''
  s.saved = false
  s.confirmingReset = false
  if (s.open) s.draft = stepsOfType(type)
}

function isDirty(type: ActivityType): boolean {
  return !sameSteps(state(type.uuid).draft, stepsOfType(type))
}

function canSave(type: ActivityType): boolean {
  const s = state(type.uuid)
  return isDirty(type) && !s.saving && validateSteps(s.draft, DEFAULT_REMINDER_LIMITS).valid
}

function replaceType(updated: ActivityType) {
  const idx = types.value.findIndex((x) => x.uuid === updated.uuid)
  if (idx >= 0) types.value[idx] = { ...types.value[idx], ...updated }
}

async function save(type: ActivityType) {
  const s = state(type.uuid)
  if (!canSave(type)) return
  s.saving = true
  s.error = ''
  s.saved = false
  try {
    const updated = await api.updateReminderSteps(type.uuid, s.draft)
    replaceType(updated)
    s.draft = stepsOfType(updated)
    s.saved = true
  } catch (e) {
    s.error = reminderErrorMessage(e, t, 'reminders.errors.save')
    // El tipo ya no existe (borrado en otra pestaña): se recarga la lista.
    if (e instanceof ApiError && e.status === 404) void reloadQuietly()
  } finally {
    s.saving = false
  }
}

async function resetOne(type: ActivityType) {
  const s = state(type.uuid)
  s.confirmingReset = false
  s.saving = true
  s.error = ''
  s.saved = false
  try {
    await api.resetReminders([type.code])
    // La respuesta solo trae `{updated}`: se recarga la lista para ver los pasos restaurados.
    setTypes(await api.listActivityTypes())
    const fresh = types.value.find((x) => x.uuid === type.uuid)
    if (fresh) s.draft = stepsOfType(fresh)
  } catch (e) {
    s.error = reminderErrorMessage(e, t, 'reminders.errors.reset')
  } finally {
    s.saving = false
  }
}

async function resetAll() {
  confirmingResetAll.value = false
  resettingAll.value = true
  resetAllError.value = ''
  try {
    await api.resetReminders()
    setTypes(await api.listActivityTypes())
    for (const type of types.value) {
      const s = rowState[type.uuid]
      if (s) {
        s.draft = stepsOfType(type)
        s.error = ''
        s.saved = false
      }
    }
  } catch (e) {
    resetAllError.value = reminderErrorMessage(e, t, 'reminders.errors.reset')
  } finally {
    resettingAll.value = false
  }
}
</script>

<template>
  <div data-test="reminder-templates">
    <!-- Cargando -->
    <div
      v-if="loading && types.length === 0"
      class="space-y-2"
      data-test="templates-loading"
    >
      <div
        v-for="n in 4"
        :key="n"
        class="h-12 bg-glass border border-line rounded-sm animate-pulse"
      />
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="bg-glass border border-line rounded-sm px-4 py-3 text-center"
      data-test="templates-error"
    >
      <p class="text-[12px] text-red-400 mb-2">
        {{ loadError }}
      </p>
      <button
        class="text-[11px] font-semibold text-acid bg-transparent border-none cursor-pointer"
        @click="load"
      >
        {{ t('reminders.tour.retry') }}
      </button>
    </div>

    <!-- Vacío -->
    <p
      v-else-if="types.length === 0"
      class="text-[12px] text-ink-4 text-center py-6"
      data-test="templates-empty"
    >
      {{ t('reminders.templates.empty') }}
    </p>

    <template v-else>
      <!-- Restablecer todos -->
      <div class="flex flex-wrap items-center justify-end gap-2 mb-3">
        <template v-if="!confirmingResetAll">
          <button
            class="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer disabled:opacity-50"
            :disabled="resettingAll"
            data-test="reset-all"
            @click="confirmingResetAll = true"
          >
            {{ t('reminders.templates.resetAll') }}
          </button>
        </template>
        <div
          v-else
          class="w-full bg-glass border border-line rounded-sm px-3 py-2"
        >
          <p class="text-[11px] text-ink-2 mb-2">
            {{ t('reminders.templates.resetConfirm') }}
          </p>
          <div class="flex gap-1.5">
            <button
              class="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[11px] font-semibold bg-acid text-black border-none cursor-pointer"
              data-test="reset-all-confirm"
              @click="resetAll"
            >
              {{ t('reminders.templates.confirm') }}
            </button>
            <button
              class="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 cursor-pointer"
              @click="confirmingResetAll = false"
            >
              {{ t('reminders.templates.cancel') }}
            </button>
          </div>
        </div>
      </div>
      <p
        v-if="resetAllError"
        class="text-[11px] text-red-400 mb-3"
        data-test="reset-all-error"
      >
        {{ resetAllError }}
      </p>

      <section
        v-for="group in grouped"
        :key="group.category"
        class="mb-5"
      >
        <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-2">
          {{ t(`reminders.categories.${group.category}`) }}
        </p>
        <div class="space-y-1.5">
          <div
            v-for="type in group.items"
            :key="type.uuid"
            class="bg-glass border border-line rounded-sm"
            :class="type.is_active ? '' : 'opacity-70'"
            :data-test="`template-${type.code}`"
          >
            <button
              type="button"
              class="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] bg-transparent border-none cursor-pointer text-left"
              :aria-expanded="state(type.uuid).open"
              data-test="template-toggle"
              @click="toggleOpen(type)"
            >
              <span
                class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                :style="{ background: type.color }"
              />
              <span class="flex-1 min-w-0">
                <span class="block text-[12px] font-semibold text-ink truncate">
                  {{ type.name }}
                  <span
                    v-if="!type.is_active"
                    class="text-[10px] font-normal text-ink-4"
                  >· {{ t('reminders.templates.inactive') }}</span>
                </span>
                <span
                  class="block text-[11px] text-ink-3"
                  data-test="template-summary"
                >
                  {{ stepsSummary(stepsOfType(type), t) }}
                </span>
              </span>
              <span class="text-[11px] text-ink-3 flex-shrink-0">
                {{ state(type.uuid).open ? t('reminders.templates.close') : t('reminders.templates.edit') }}
              </span>
            </button>

            <div
              v-if="state(type.uuid).open"
              class="px-3 pb-3 border-t border-line pt-3"
            >
              <ReminderStepsEditor
                v-model="state(type.uuid).draft"
                :disabled="state(type.uuid).saving"
              />

              <p
                v-if="state(type.uuid).error"
                class="text-[11px] text-red-400 mt-2"
                data-test="template-error"
              >
                {{ state(type.uuid).error }}
              </p>
              <p
                v-else-if="state(type.uuid).saved && !isDirty(type)"
                class="text-[11px] text-acid mt-2"
                data-test="template-saved"
              >
                {{ t('reminders.templates.saved') }}
              </p>

              <div
                v-if="!state(type.uuid).confirmingReset"
                class="flex flex-wrap items-center gap-2 mt-3"
              >
                <button
                  class="min-h-[44px] sm:min-h-0 px-3.5 py-[7px] rounded-sm text-[11px] font-bold bg-acid text-black border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="!canSave(type)"
                  data-test="template-save"
                  @click="save(type)"
                >
                  {{ state(type.uuid).saving ? t('reminders.templates.saving') : t('reminders.templates.save') }}
                </button>
                <button
                  class="min-h-[44px] sm:min-h-0 px-3 py-[7px] rounded-sm text-[11px] font-medium bg-transparent border-none text-ink-3 hover:text-ink cursor-pointer"
                  :disabled="state(type.uuid).saving"
                  data-test="template-reset"
                  @click="state(type.uuid).confirmingReset = true"
                >
                  {{ t('reminders.templates.reset') }}
                </button>
              </div>
              <div
                v-else
                class="mt-3"
              >
                <p class="text-[11px] text-ink-2 mb-1.5">
                  {{ t('reminders.templates.resetConfirm') }}
                </p>
                <div class="flex gap-1.5">
                  <button
                    class="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[11px] font-semibold bg-acid text-black border-none cursor-pointer"
                    data-test="template-reset-confirm"
                    @click="resetOne(type)"
                  >
                    {{ t('reminders.templates.confirm') }}
                  </button>
                  <button
                    class="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 cursor-pointer"
                    @click="state(type.uuid).confirmingReset = false"
                  >
                    {{ t('reminders.templates.cancel') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
