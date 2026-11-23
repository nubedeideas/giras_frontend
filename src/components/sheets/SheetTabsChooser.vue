<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SHEETS_MAX_TABS,
  type SheetInspectTab,
  type SheetTabInput,
} from '@/composables/useSheetSubscriptions'

// Lista de pestañas de una hoja con casillas (F4 §4.3): hasta 5 marcadas (el resto, deshabilitadas
// con la pista), las ocultas con su etiqueta y un "Rango (opcional)" plegado por pestaña marcada.
// La usan el alta (`SheetLinkForm`) y el editor de pestañas de la tarjeta.
const props = defineProps<{
  tabs: SheetInspectTab[]
  selected: SheetTabInput[]
  /** Prefijo de los `id` (varias listas en la misma página). */
  idPrefix: string
}>()
const emit = defineEmits<{ 'update:selected': [value: SheetTabInput[]] }>()

const { t } = useI18n()

/** Pestañas con el campo de rango abierto. */
const openRanges = ref<Set<number>>(
  new Set(props.selected.filter((s) => (s.range ?? '').trim() !== '').map((s) => s.gid))
)

const sortedTabs = computed(() => [...props.tabs].sort((a, b) => a.index - b.index))
const selectedGids = computed(() => new Set(props.selected.map((s) => s.gid)))
const atMax = computed(() => props.selected.length >= SHEETS_MAX_TABS)

function isSelected(gid: number): boolean {
  return selectedGids.value.has(gid)
}

function rangeOf(gid: number): string {
  return props.selected.find((s) => s.gid === gid)?.range ?? ''
}

function toggle(gid: number) {
  if (isSelected(gid)) {
    emit(
      'update:selected',
      props.selected.filter((s) => s.gid !== gid)
    )
    return
  }
  if (atMax.value) return
  emit('update:selected', [...props.selected, { gid, range: '' }])
}

function setRange(gid: number, value: string) {
  emit(
    'update:selected',
    props.selected.map((s) => (s.gid === gid ? { ...s, range: value } : s))
  )
}

function toggleRange(gid: number) {
  const next = new Set(openRanges.value)
  if (next.has(gid)) next.delete(gid)
  else next.add(gid)
  openRanges.value = next
}

const inputClass =
  'w-full min-h-[44px] lg:min-h-0 rounded-sm border border-line bg-bg-3 px-3 py-2 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-olive'
</script>

<template>
  <fieldset
    class="flex flex-col gap-2"
    data-test="sheet-tabs"
  >
    <legend class="text-[13px] font-semibold text-ink">
      {{ t('sheets.form.tabs') }}
    </legend>
    <p
      class="text-[13px] text-ink-2"
      :data-test="atMax ? 'sheet-tabs-max' : 'sheet-tabs-hint'"
    >
      {{ t('sheets.form.tabsHint', { max: SHEETS_MAX_TABS }) }}
    </p>
    <p
      v-if="tabs.length === 0"
      class="text-[14px] text-ink-2"
      data-test="sheet-no-tabs"
    >
      {{ t('sheets.form.noTabs') }}
    </p>
    <ul
      v-else
      class="flex flex-col rounded-sm border border-line bg-bg-3 divide-y divide-line"
    >
      <li
        v-for="tab in sortedTabs"
        :key="tab.gid"
        class="flex flex-col gap-1.5 px-3 py-1"
        data-test="sheet-tab"
        :data-gid="tab.gid"
      >
        <label
          :for="`${idPrefix}-tab-${tab.gid}`"
          class="flex items-center gap-3 min-h-[44px]"
          :class="!isSelected(tab.gid) && atMax ? 'cursor-not-allowed' : 'cursor-pointer'"
        >
          <input
            :id="`${idPrefix}-tab-${tab.gid}`"
            type="checkbox"
            class="w-5 h-5 accent-olive flex-shrink-0"
            :checked="isSelected(tab.gid)"
            :disabled="!isSelected(tab.gid) && atMax"
            data-test="sheet-tab-check"
            @change="toggle(tab.gid)"
          >
          <span class="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span class="text-[15px] text-ink break-words">{{ tab.title }}</span>
            <span
              v-if="tab.hidden"
              class="rounded-sm border border-line bg-bg-2 px-1.5 text-[12px] text-ink-2"
              data-test="sheet-tab-hidden"
            >{{ t('sheets.form.hidden') }}</span>
            <span class="text-[13px] text-ink-2 font-time tnum">{{
              t('sheets.form.rows', { n: tab.rows }, tab.rows)
            }}</span>
          </span>
        </label>
        <div
          v-if="isSelected(tab.gid)"
          class="flex flex-col items-start gap-1.5 pb-2 pl-8"
        >
          <button
            type="button"
            class="inline-flex items-center min-h-[44px] lg:min-h-0 p-0 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
            :aria-expanded="openRanges.has(tab.gid)"
            :aria-controls="`${idPrefix}-range-${tab.gid}`"
            data-test="sheet-tab-range-toggle"
            @click="toggleRange(tab.gid)"
          >
            {{ t('sheets.form.range') }}
          </button>
          <div
            v-if="openRanges.has(tab.gid)"
            :id="`${idPrefix}-range-${tab.gid}`"
            class="flex flex-col gap-1 w-full"
          >
            <input
              type="text"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              maxlength="23"
              placeholder="A3:H200"
              :aria-label="`${t('sheets.form.range')} · ${tab.title}`"
              :class="[inputClass, 'font-time tnum']"
              :value="rangeOf(tab.gid)"
              data-test="sheet-tab-range"
              @input="setRange(tab.gid, ($event.target as HTMLInputElement).value)"
            >
            <p class="text-[13px] text-ink-2">
              {{ t('sheets.form.rangeHint') }}
            </p>
          </div>
        </div>
      </li>
    </ul>
  </fieldset>
</template>
