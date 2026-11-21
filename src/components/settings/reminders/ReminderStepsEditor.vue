<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DEFAULT_REMINDER_LIMITS,
  REMINDER_CHANNELS,
  channelMeta,
  minutesToParts,
  nextStepMinutes,
  partsToMinutes,
  validateSteps,
  type OffsetUnit,
  type ReminderChannel,
  type ReminderLimits,
  type ReminderStep,
} from '@/utils/reminders'

/**
 * Editor de pasos `[{minutes, channel}]` (plantilla del usuario y personalización por gira).
 * Emite los pasos tal cual se editan; la validación (espejo del backend) se pinta en vivo y el
 * padre decide si deja guardar con `validateSteps`.
 */
const props = withDefaults(
  defineProps<{
    modelValue: ReminderStep[]
    limits?: ReminderLimits
    disabled?: boolean
  }>(),
  { limits: () => DEFAULT_REMINDER_LIMITS, disabled: false }
)
const emit = defineEmits<{ 'update:modelValue': [steps: ReminderStep[]] }>()

const { t } = useI18n()

interface Row {
  id: number
  value: number
  unit: OffsetUnit
  channel: ReminderChannel
}

let nextId = 0
const rows = ref<Row[]>([])

function toRows(steps: ReminderStep[]): Row[] {
  return steps.map((s) => ({ id: nextId++, ...minutesToParts(s.minutes), channel: s.channel }))
}

function toSteps(list: Row[]): ReminderStep[] {
  return list.map((r) => ({ minutes: partsToMinutes(r.value, r.unit), channel: r.channel }))
}

// Solo se reconstruyen las filas si el cambio viene de fuera (no del propio editor), para no
// perder la unidad elegida mientras se escribe.
watch(
  () => props.modelValue,
  (steps) => {
    if (!sameOrder(toSteps(rows.value), steps)) rows.value = toRows(steps)
  },
  { immediate: true, deep: true }
)

function sameOrder(a: ReminderStep[], b: ReminderStep[]): boolean {
  return a.length === b.length && a.every((s, i) => s.minutes === b[i].minutes && s.channel === b[i].channel)
}

function commit() {
  emit('update:modelValue', toSteps(rows.value))
}

const validation = computed(() => validateSteps(toSteps(rows.value), props.limits))
const atMax = computed(() => rows.value.length >= props.limits.max_steps)

function addStep() {
  if (atMax.value || props.disabled) return
  const minutes = nextStepMinutes(toSteps(rows.value))
  rows.value.push({ id: nextId++, ...minutesToParts(minutes), channel: 'whatsapp' })
  commit()
}

function removeStep(id: number) {
  rows.value = rows.value.filter((r) => r.id !== id)
  commit()
}

function setValue(row: Row, raw: string) {
  const n = Number(raw)
  row.value = Number.isFinite(n) ? n : 0
  commit()
}

function setUnit(row: Row, unit: OffsetUnit) {
  row.unit = unit
  commit()
}

function setChannel(row: Row, channel: ReminderChannel) {
  if (props.disabled) return
  row.channel = channel
  commit()
}

function stepError(i: number): string {
  const code = validation.value.stepErrors[i]
  return code ? t(`reminders.errors.${code}`) : ''
}

const UNITS: OffsetUnit[] = ['minutes', 'hours', 'days']
</script>

<template>
  <div
    class="space-y-2"
    data-test="steps-editor"
  >
    <p
      v-if="rows.length === 0"
      class="text-[11px] text-ink-4"
      data-test="steps-none"
    >
      {{ t('reminders.step.none') }}
    </p>

    <div
      v-for="(row, i) in rows"
      :key="row.id"
      class="bg-glass border border-line rounded-sm px-2.5 py-2"
      data-test="step-row"
    >
      <div class="flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          inputmode="numeric"
          min="1"
          class="w-16 h-9 px-2 rounded-sm bg-bg-2 border border-line text-[12px] text-ink outline-none focus:border-line-acid"
          :aria-label="t('reminders.step.amount')"
          :value="row.value"
          :disabled="disabled"
          data-test="step-value"
          @input="setValue(row, ($event.target as HTMLInputElement).value)"
        >
        <select
          class="h-9 px-2 rounded-sm bg-bg-2 border border-line text-[12px] text-ink outline-none cursor-pointer"
          :aria-label="t('reminders.step.unit')"
          :value="row.unit"
          :disabled="disabled"
          data-test="step-unit"
          @change="setUnit(row, ($event.target as HTMLSelectElement).value as OffsetUnit)"
        >
          <option
            v-for="u in UNITS"
            :key="u"
            :value="u"
          >
            {{ t(`reminders.units.${u}`) }}
          </option>
        </select>
        <span class="text-[11px] text-ink-3">{{ t('reminders.step.before') }}</span>

        <!-- Canal: tres botones con icono -->
        <div
          class="flex gap-1 w-full sm:w-auto sm:ml-auto"
          role="radiogroup"
          :aria-label="t('reminders.step.channel')"
        >
          <button
            v-for="ch in REMINDER_CHANNELS"
            :key="ch"
            type="button"
            role="radio"
            :aria-checked="row.channel === ch"
            :title="t(`reminders.channels.${ch}`)"
            class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 min-h-[44px] sm:min-h-0 sm:h-8 px-2 rounded-sm border text-[10px] font-semibold cursor-pointer transition-colors"
            :class="
              row.channel === ch
                ? [channelMeta(ch).bgClass, channelMeta(ch).colorClass, 'border-line-2']
                : 'bg-transparent border-line text-ink-3 hover:text-ink'
            "
            :disabled="disabled"
            :data-test="`step-channel-${ch}`"
            @click="setChannel(row, ch)"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              v-html="channelMeta(ch).iconPath"
            />
            <span>{{ t(`reminders.channels.${ch}`) }}</span>
          </button>
        </div>

        <button
          type="button"
          class="min-h-[44px] sm:min-h-0 sm:h-8 px-2 text-[11px] text-ink-3 hover:text-red-400 bg-transparent border-none cursor-pointer"
          :disabled="disabled"
          data-test="step-remove"
          @click="removeStep(row.id)"
        >
          {{ t('reminders.step.remove') }}
        </button>
      </div>

      <p
        v-if="row.channel === 'in_app'"
        class="text-[10px] text-ink-3 mt-1.5"
        data-test="step-in-app-hint"
      >
        {{ t('reminders.channels.inAppHint') }}
      </p>
      <p
        v-if="stepError(i)"
        class="text-[10px] text-red-400 mt-1"
        data-test="step-error"
      >
        {{ stepError(i) }}
      </p>
    </div>

    <p
      v-if="validation.code === 'too_many_steps'"
      class="text-[10px] text-red-400"
    >
      {{ t('reminders.errors.too_many_steps') }}
    </p>

    <div class="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        class="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-dashed border-line text-[11px] font-medium text-ink-3 hover:text-ink hover:border-line-2 bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="atMax || disabled"
        data-test="step-add"
        @click="addStep"
      >
        + {{ t('reminders.step.add') }}
      </button>
      <span
        v-if="atMax"
        class="text-[10px] text-ink-4"
        data-test="step-max"
      >
        {{ t('reminders.step.max', { max: limits.max_steps }) }}
      </span>
    </div>
  </div>
</template>
