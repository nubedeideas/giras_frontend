<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import SheetTabsChooser from '@/components/sheets/SheetTabsChooser.vue'
import { ApiError } from '@/utils/apiClient'
import { isGoogleDisconnected, isGoogleScopeMissing } from '@/composables/useGoogleIntegration'
import { useGoogleStore } from '@/stores/google'
import { isPickerError, pickSpreadsheet } from '@/composables/useGooglePicker'
import {
  inspectSheet,
  updateSheetSubscription,
  type SheetInspectTab,
  type SheetSubscription,
  type SheetTabInput,
} from '@/composables/useSheetSubscriptions'
import { pickerErrorKey, sheetApiErrorKey } from '@/utils/sheetSubscriptions'

// Editor de pestañas de una vinculación ("Pestañas…", F4 §4.3). Para listar las pestañas hace
// falta `inspect`, que necesita el ID de la hoja: quien la lee lo tiene en `open_url`; cualquier
// otro admin la elige en el selector de Google (con `drive.file`, Google solo le deja leerla así).
// Guarda con `PATCH {tabs}`; añadir pestañas las lee en la próxima vuelta.
const props = defineProps<{ sub: SheetSubscription; displayName: string }>()
const emit = defineEmits<{ saved: [sub: SheetSubscription]; cancel: []; stale: [] }>()

const { t } = useI18n()
const googleStore = useGoogleStore()

const tabs = ref<SheetInspectTab[] | null>(null)
const selected = ref<SheetTabInput[]>(
  props.sub.tabs.map((tab) => ({ gid: tab.gid, range: tab.range ?? '' }))
)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
/** Hay que elegir la hoja en el selector (sin `open_url` o el ID no se pudo leer). */
const needsPick = ref(false)

/** `spreadsheetId` de un enlace `docs.google.com/spreadsheets/d/{id}/…`. */
function idFromOpenUrl(url: string | null): string | null {
  if (!url) return null
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{25,100})(?:[/?#]|$)/.exec(url)
  return m ? m[1] : null
}

function apiText(e: unknown): string {
  const { key, named } = sheetApiErrorKey(e, 'manage', props.sub.spreadsheet_title)
  return named ? t(key, named) : t(key)
}

async function load(spreadsheetId: string) {
  loading.value = true
  error.value = ''
  try {
    const info = await inspectSheet({ tour: props.sub.tour, spreadsheet_id: spreadsheetId })
    // Otra hoja (o la misma en otra gira): ni pestañas ni guardar; se puede volver a elegir.
    if (info.already_subscribed !== props.sub.uuid) {
      tabs.value = null
      needsPick.value = true
      error.value = t('sheets.errors.spreadsheet_mismatch', { name: props.sub.spreadsheet_title })
      return
    }
    // Pestañas vinculadas que ya no existen: se siguen pudiendo quitar.
    const known = new Set(info.tabs.map((tab) => tab.gid))
    const gone = props.sub.tabs
      .filter((tab) => !known.has(tab.gid))
      .map((tab, i) => ({
        gid: tab.gid,
        title: tab.title || `#${tab.gid}`,
        index: info.tabs.length + i,
        hidden: false,
        rows: 0,
        columns: 0,
      }))
    tabs.value = [...info.tabs, ...gone]
    needsPick.value = false
  } catch (e) {
    if (isGoogleDisconnected(e)) void googleStore.load(true)
    error.value = isGoogleScopeMissing(e) ? t('sheets.errors.accessLost') : apiText(e)
  } finally {
    loading.value = false
  }
}

async function pick() {
  error.value = ''
  try {
    const sheet = await pickSpreadsheet({
      title: t('sheets.picker.chooseSame', { name: props.sub.spreadsheet_title }),
    })
    await load(sheet.id)
  } catch (e) {
    if (!isPickerError(e)) {
      error.value = t('sheets.errors.generic')
      return
    }
    const key = pickerErrorKey(e.code)
    if (key) error.value = t(key)
  }
}

onMounted(() => {
  const id = idFromOpenUrl(props.sub.open_url)
  if (id) void load(id)
  else needsPick.value = true
})

async function save() {
  if (saving.value) return
  if (selected.value.length === 0) {
    error.value = t('sheets.form.tabsRequired')
    return
  }
  saving.value = true
  error.value = ''
  try {
    const sub = await updateSheetSubscription(props.sub.uuid, { tabs: selected.value })
    emit('saved', sub)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      emit('stale')
      return
    }
    error.value = apiText(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-test="sheet-tabs-editor"
  >
    <p class="pr-12 text-[17px] font-bold text-ink break-words">
      {{ t('sheets.card.tabsTitle', { name: displayName }) }}
    </p>

    <div
      v-if="loading"
      class="flex flex-col gap-2"
      role="status"
      data-test="sheet-tabs-loading"
    >
      <div class="h-11 rounded-sm bg-bg-2 animate-pulse" />
      <div class="h-11 rounded-sm bg-bg-2 animate-pulse" />
    </div>

    <div
      v-else-if="needsPick && !tabs"
      class="flex flex-col items-start gap-2"
    >
      <p class="text-[14px] text-ink-2">
        {{ t('sheets.picker.chooseSame', { name: sub.spreadsheet_title }) }}
      </p>
      <BtnPrimary
        type="button"
        data-test="sheet-tabs-pick"
        @click="pick"
      >
        {{ t('sheets.form.choose') }}
      </BtnPrimary>
    </div>

    <SheetTabsChooser
      v-else-if="tabs"
      v-model:selected="selected"
      :tabs="tabs"
      :id-prefix="`sheet-${sub.uuid}`"
    />

    <p
      v-if="error"
      class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
      role="alert"
      data-test="sheet-tabs-error"
    >
      {{ error }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <BtnPrimary
        v-if="tabs"
        type="button"
        data-test="sheet-tabs-save"
        :disabled="saving || selected.length === 0"
        @click="save"
      >
        {{ saving ? t('sheets.card.saving') : t('sheets.card.save') }}
      </BtnPrimary>
      <BtnSecondary
        type="button"
        data-test="sheet-tabs-cancel"
        @click="emit('cancel')"
      >
        {{ t('common.cancel') }}
      </BtnSecondary>
    </div>
  </div>
</template>
