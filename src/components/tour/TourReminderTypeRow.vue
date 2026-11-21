<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useReminderSettings,
  type GroupSummary,
  type ReminderTypeSetting,
} from '@/composables/useReminderSettings'
import { useIsMobile } from '@/composables/useIsMobile'
import { ApiError } from '@/utils/apiClient'
import ReminderStepsEditor from '@/components/settings/reminders/ReminderStepsEditor.vue'
import MobileDetailOverlay from '@/components/ui/MobileDetailOverlay.vue'
import {
  DEFAULT_REMINDER_LIMITS,
  isForbidden,
  recipientWarningLabel,
  reminderErrorMessage,
  sameSteps,
  sortSteps,
  stepsSummary,
  validateSteps,
  type ReminderLimits,
  type ReminderStep,
} from '@/utils/reminders'

/**
 * Un tipo de actividad en la pestaña Recordatorios de la gira (C1.3): pasos efectivos, interruptor
 * "Personalizar en esta gira" (apagarlo = `steps: null`, optimista con reversión), "Sin
 * recordatorios en esta gira" (`steps: []`) y grupos destino. Guardado por fila.
 */
const props = withDefaults(
  defineProps<{
    tourUuid: string
    setting: ReminderTypeSetting
    groups: GroupSummary[]
    limits?: ReminderLimits
  }>(),
  { limits: () => DEFAULT_REMINDER_LIMITS }
)
const emit = defineEmits<{ saved: [setting: ReminderTypeSetting]; forbidden: [] }>()

const { t } = useI18n()
const api = useReminderSettings()
const { isMobile } = useIsMobile()

const expanded = ref(false)
const customizing = ref(false)
const noReminders = ref(false)
const draft = ref<ReminderStep[]>([])
const selectedGroups = ref<string[]>([])
const saving = ref(false)
const error = ref('')

function syncFromSetting() {
  const s = props.setting
  customizing.value = s.tour_steps !== null
  noReminders.value = Array.isArray(s.tour_steps) && s.tour_steps.length === 0
  draft.value = sortSteps(s.tour_steps && s.tour_steps.length ? s.tour_steps : s.template_steps)
  selectedGroups.value = s.groups.map((g) => g.uuid)
}

watch(() => props.setting, syncFromSetting, { immediate: true })

const sourceChip = computed(() => {
  const s = props.setting
  if (s.steps_source === 'tour') {
    return s.tour_steps && s.tour_steps.length === 0
      ? { key: 'disabledHere', cls: 'bg-glass-2 text-ink-3' }
      : { key: 'customized', cls: 'bg-acid-dim text-acid' }
  }
  return { key: 'fromTemplate', cls: 'bg-glass-2 text-ink-2' }
})

const desiredSteps = computed<ReminderStep[] | null>(() => {
  if (!customizing.value) return null
  return noReminders.value ? [] : draft.value
})

const stepsChanged = computed(() => {
  const desired = desiredSteps.value
  const current = props.setting.tour_steps
  if (desired === null || current === null) return desired !== current
  return !sameSteps(desired, current)
})

const groupsChanged = computed(() => {
  const current = new Set(props.setting.groups.map((g) => g.uuid))
  return (
    current.size !== selectedGroups.value.length ||
    selectedGroups.value.some((uuid) => !current.has(uuid))
  )
})

const validation = computed(() =>
  customizing.value && !noReminders.value ? validateSteps(draft.value, props.limits) : null
)

const canSave = computed(
  () =>
    !saving.value &&
    (stepsChanged.value || groupsChanged.value) &&
    (validation.value === null || validation.value.valid)
)

/**
 * Grupos destino del tipo que no están en el catálogo de quien edita (p. ej. globales de otro
 * coadmin): se pintan como chip de solo lectura y se conservan tal cual.
 */
const hiddenGroups = computed(() => {
  const visible = new Set(props.groups.map((g) => g.uuid))
  return props.setting.groups.filter((g) => !visible.has(g.uuid))
})

function groupLabel(g: GroupSummary): string {
  return `${g.name} · ${t('reminders.tour.contacts', { n: g.contact_count }, g.contact_count)}`
}

function toggleGroup(uuid: string) {
  selectedGroups.value = selectedGroups.value.includes(uuid)
    ? selectedGroups.value.filter((x) => x !== uuid)
    : [...selectedGroups.value, uuid]
}

function handleError(e: unknown) {
  error.value = reminderErrorMessage(e, t, 'reminders.errors.save', { load: true })
  if (isForbidden(e)) emit('forbidden')
}

async function toggleCustomize() {
  error.value = ''
  if (!customizing.value) {
    customizing.value = true
    noReminders.value = false
    draft.value = sortSteps(props.setting.template_steps)
    return
  }
  // Apagar sin nada guardado en la gira: solo se cierra el editor.
  if (props.setting.tour_steps === null) {
    customizing.value = false
    return
  }
  // Optimista: se vuelve a la plantilla al momento y se revierte si falla.
  customizing.value = false
  saving.value = true
  try {
    const updated = await api.upsert({
      tour: props.tourUuid,
      activity_type_code: props.setting.activity_type_code,
      steps: null,
    })
    emit('saved', updated)
  } catch (e) {
    customizing.value = true
    handleError(e)
    // 403/404/429 ya traen su propio mensaje (no admin, demasiadas solicitudes).
    if (!isForbidden(e) && !(e instanceof ApiError && e.status === 429)) {
      error.value = t('reminders.tour.toggleError')
    }
  } finally {
    saving.value = false
  }
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    const updated = await api.upsert({
      tour: props.tourUuid,
      activity_type_code: props.setting.activity_type_code,
      steps: desiredSteps.value,
      // Solo si cambiaron: así un coadmin que no ve algún grupo puede guardar los pasos.
      ...(groupsChanged.value ? { group_uuids: selectedGroups.value } : {}),
    })
    emit('saved', updated)
    expanded.value = false
  } catch (e) {
    handleError(e)
  } finally {
    saving.value = false
  }
}

function open() {
  syncFromSetting()
  error.value = ''
  expanded.value = true
}

function close() {
  syncFromSetting()
  expanded.value = false
}
</script>

<template>
  <div
    class="bg-glass border border-line rounded-sm"
    :data-test="`type-row-${setting.activity_type_code}`"
  >
    <!-- Resumen -->
    <div class="flex items-start gap-2.5 px-3 py-2.5">
      <span
        class="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
        :style="{ background: setting.color }"
      />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap">
          <p class="text-[12px] font-semibold text-ink truncate max-w-full">
            {{ setting.name }}
          </p>
          <span
            class="text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-[0.4px]"
            :class="sourceChip.cls"
            data-test="type-source"
          >{{ t(`reminders.tour.${sourceChip.key}`) }}</span>
        </div>
        <p
          class="text-[11px] text-ink-2 mt-0.5"
          data-test="type-summary"
        >
          {{ stepsSummary(setting.effective_steps, t) }}
        </p>
        <p class="text-[10px] mt-0.5">
          <span class="text-ink-4">{{ t('reminders.tour.groups') }}: </span>
          <span
            v-if="setting.groups.length"
            class="text-ink-2"
            data-test="type-groups"
          >{{ setting.groups.map((g) => g.name).join(', ') }}</span>
          <span
            v-else
            class="text-ink-4"
            data-test="type-groups-empty"
          >{{ t('reminders.tour.groupsEmpty') }}</span>
        </p>
        <p
          v-if="setting.replaced_by_legacy_rule"
          class="text-[10px] text-brand-orange mt-0.5"
          data-test="type-legacy-rule"
        >
          {{ t('reminders.tour.legacyRule') }}
        </p>
        <p
          v-for="w in setting.warnings"
          :key="w"
          class="text-[10px] text-brand-orange mt-0.5"
          data-test="type-warning"
        >
          ⚠ {{ recipientWarningLabel(w, t) }}
        </p>
        <p
          v-if="error && !expanded"
          class="text-[10px] text-red-400 mt-0.5"
          data-test="type-error"
        >
          {{ error }}
        </p>
      </div>
      <button
        type="button"
        class="flex-shrink-0 min-h-[44px] sm:min-h-0 px-2.5 py-1 rounded-sm text-[11px] font-medium bg-transparent border border-line text-ink-2 hover:text-ink hover:bg-glass-hover cursor-pointer"
        :aria-expanded="expanded"
        data-test="type-configure"
        @click="expanded ? close() : open()"
      >
        {{ expanded && !isMobile ? t('reminders.tour.close') : t('reminders.tour.configure') }}
      </button>
    </div>

    <!-- Editor: en línea en escritorio, hoja a pantalla completa en móvil -->
    <component
      :is="isMobile ? MobileDetailOverlay : 'div'"
      v-if="expanded || isMobile"
      v-bind="isMobile ? { show: expanded } : {}"
      @close="close"
    >
      <div
        class="px-3 pb-3 pt-3 border-t border-line"
        :class="isMobile ? 'flex-1 overflow-y-auto border-t-0' : ''"
        data-test="type-editor"
      >
        <p
          v-if="isMobile"
          class="text-[14px] font-bold text-ink mb-3"
        >
          {{ setting.name }}
        </p>

        <!-- Personalizar en esta gira -->
        <div class="flex items-center justify-between gap-3 mb-3">
          <span class="text-[12px] text-ink">{{ t('reminders.tour.customize') }}</span>
          <button
            type="button"
            role="switch"
            :aria-checked="customizing"
            :aria-label="t('reminders.tour.customize')"
            class="relative flex-shrink-0 w-9 h-5 rounded-full border-none cursor-pointer transition-colors"
            :class="[customizing ? 'bg-acid' : 'bg-glass-2', saving ? 'opacity-50' : '']"
            :disabled="saving"
            data-test="type-customize"
            @click="toggleCustomize"
          >
            <span
              class="absolute top-0.5 w-4 h-4 rounded-full bg-bg-3 transition-all"
              :class="customizing ? 'left-[18px]' : 'left-0.5'"
            />
          </button>
        </div>

        <template v-if="customizing">
          <label class="flex items-center gap-2 mb-3 text-[12px] text-ink-2 cursor-pointer min-h-[44px] sm:min-h-0">
            <input
              v-model="noReminders"
              type="checkbox"
              class="accent-[var(--acid)] w-4 h-4"
              :disabled="saving"
              data-test="type-no-reminders"
            >
            {{ t('reminders.tour.disabledHere') }}
          </label>
          <ReminderStepsEditor
            v-if="!noReminders"
            v-model="draft"
            :limits="limits"
            :disabled="saving"
          />
        </template>
        <p
          v-else
          class="text-[11px] text-ink-3 mb-1"
        >
          {{ t('reminders.tour.fromTemplate') }}: {{ stepsSummary(setting.template_steps, t) }}
        </p>

        <!-- Grupos destino -->
        <div class="mt-4">
          <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-1.5">
            {{ t('reminders.tour.groups') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="g in hiddenGroups"
              :key="g.uuid"
              class="inline-flex items-center min-h-[44px] sm:min-h-0 px-2.5 py-1 rounded-full text-[11px] border border-line bg-glass-2 text-ink-3"
              :data-test="`type-group-readonly-${g.uuid}`"
            >
              {{ groupLabel(g) }}
            </span>
            <button
              v-for="g in groups"
              :key="g.uuid"
              type="button"
              :aria-pressed="selectedGroups.includes(g.uuid)"
              class="min-h-[44px] sm:min-h-0 px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-colors"
              :class="
                selectedGroups.includes(g.uuid)
                  ? 'bg-acid-dim text-acid border-line-acid'
                  : 'bg-transparent text-ink-3 border-line hover:text-ink'
              "
              :disabled="saving"
              :data-test="`type-group-${g.uuid}`"
              @click="toggleGroup(g.uuid)"
            >
              {{ groupLabel(g) }}
            </button>
          </div>
          <p
            v-if="selectedGroups.length === 0"
            class="text-[10px] text-ink-4 mt-1.5"
          >
            {{ t('reminders.tour.groupsHint') }}
          </p>
        </div>

        <p
          v-if="error"
          class="text-[11px] text-red-400 mt-3"
          data-test="type-editor-error"
        >
          {{ error }}
        </p>

        <div class="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            class="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 px-3.5 py-[7px] rounded-sm text-[11px] font-bold bg-acid text-black border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canSave"
            data-test="type-save"
            @click="save"
          >
            {{ saving ? t('reminders.tour.saving') : t('reminders.tour.save') }}
          </button>
          <button
            type="button"
            class="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 px-3 py-[7px] rounded-sm text-[11px] font-medium bg-glass border border-line text-ink-2 cursor-pointer"
            @click="close"
          >
            {{ t('reminders.tour.cancel') }}
          </button>
        </div>
      </div>
    </component>
  </div>
</template>
