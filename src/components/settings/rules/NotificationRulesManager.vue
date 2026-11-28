<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import RuleBuilder from './RuleBuilder.vue'
import RuleListItem from './RuleListItem.vue'
import RulePresetsPanel from './RulePresetsPanel.vue'
import RulePreviewPanel from './RulePreviewPanel.vue'
import { useToursStore } from '@/stores/tours'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import {
  RuleApiError,
  useNotificationRules,
  type Rule,
  type RuleOptions,
  type RulePreset,
} from '@/composables/useNotificationRules'
import { ApiError } from '@/utils/apiClient'
import { ruleErrorLabel } from '@/utils/notificationRules'

/**
 * Pestaña "Reglas" de Configuración (spec 3.6, C5.1): reglas de notificación de una gira
 * administrable, sugeridas y constructor. Deep links: `?tab=rules&tour=<uuid>&rule=<uuid>`.
 */

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toursStore = useToursStore()
const api = useNotificationRules()

// ─── Gira seleccionada ────────────────────────────────────────────────────────

const adminTours = computed(() => toursStore.tours.filter((tour) => tour.current_user_is_admin))

const selectedTourUuid = computed<string>(() => {
  const fromQuery = typeof route.query.tour === 'string' ? route.query.tour : ''
  if (fromQuery && adminTours.value.some((tour) => tour.uuid === fromQuery)) return fromQuery
  const active = toursStore.activeTour
  if (active && adminTours.value.some((tour) => tour.uuid === active.uuid)) return active.uuid
  return adminTours.value[0]?.uuid ?? ''
})

function selectTour(uuid: string) {
  router.replace({ query: { ...route.query, tab: 'rules', tour: uuid, rule: undefined } })
}

// ─── Datos ────────────────────────────────────────────────────────────────────

const options = ref<RuleOptions | null>(null)
const rules = ref<Rule[]>([])
const presets = ref<RulePreset[]>([])
const loading = ref(false)
const loadError = ref('')
const noAccess = ref(false)
let requestId = 0

async function load() {
  const tourUuid = selectedTourUuid.value
  const id = ++requestId
  if (!tourUuid) {
    options.value = null
    rules.value = []
    presets.value = []
    return
  }
  loading.value = true
  loadError.value = ''
  noAccess.value = false
  try {
    const [opts, list, presetList] = await Promise.all([
      api.getOptions(tourUuid),
      api.listRules(tourUuid),
      api.listPresets(tourUuid),
    ])
    // Respuesta de una gira anterior: se descarta.
    if (id !== requestId) return
    options.value = opts
    rules.value = list
    presets.value = presetList
    openDeepLinkedRule()
  } catch (e) {
    if (id !== requestId) return
    options.value = null
    rules.value = []
    presets.value = []
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
      // Ya no es admin (o la gira no es visible): se refresca la lista de giras.
      noAccess.value = true
      toursStore.loadTours()
    } else {
      loadError.value = e instanceof Error ? e.message : t('rules.loadError')
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

async function reloadPresets() {
  const tourUuid = selectedTourUuid.value
  if (!tourUuid) return
  try {
    presets.value = await api.listPresets(tourUuid)
  } catch {
    // La lista de sugeridas no es crítica: se queda la anterior.
  }
}

watch(selectedTourUuid, load)

/**
 * Hasta que la lista de giras se ha cargado al menos una vez no se sabe si hay giras
 * administrables: así no parpadea el aviso de permisos antes de `loadTours()`.
 */
const toursReady = ref(toursStore.tours.length > 0)
watch(
  () => toursStore.loading,
  (isLoading) => {
    if (!isLoading) toursReady.value = true
  }
)

function reloadTours() {
  return toursStore.loadTours()
}

onMounted(async () => {
  // Sin giras cargadas, el `watch` de la gira seleccionada lanza la carga cuando lleguen.
  if (!toursStore.tours.length) {
    if (!toursStore.loading) {
      await reloadTours()
      toursReady.value = true
    }
    return
  }
  load()
})

// ─── Límite ───────────────────────────────────────────────────────────────────

const maxRules = computed(() => options.value?.limits.max_rules_per_tour ?? 0)
const limitReached = computed(() => !!maxRules.value && rules.value.length >= maxRules.value)

// ─── Constructor ──────────────────────────────────────────────────────────────

const builderOpen = ref(false)
const editingRule = ref<Rule | null>(null)
const builderKey = ref(0)

function openCreate() {
  if (limitReached.value) return
  editingRule.value = null
  builderKey.value++
  builderOpen.value = true
}

function openEdit(rule: Rule) {
  if (!rule.is_editable) return
  editingRule.value = rule
  builderKey.value++
  builderOpen.value = true
  if (route.query.rule !== rule.uuid) {
    router.replace({ query: { ...route.query, tab: 'rules', rule: rule.uuid } })
  }
}

function closeBuilder() {
  builderOpen.value = false
  editingRule.value = null
  if (route.query.rule) router.replace({ query: { ...route.query, rule: undefined } })
}

function openDeepLinkedRule() {
  const uuid = typeof route.query.rule === 'string' ? route.query.rule : ''
  if (!uuid) return
  const rule = rules.value.find((r) => r.uuid === uuid)
  if (rule?.is_editable) openEdit(rule)
}

// Una regla legada puede sustituir los recordatorios por defecto ("notificable" en calendario).
const sharedCatalog = useReminderCatalogStore()

function upsert(rule: Rule) {
  void sharedCatalog.invalidate()
  const idx = rules.value.findIndex((r) => r.uuid === rule.uuid)
  if (idx >= 0) rules.value.splice(idx, 1, rule)
  else rules.value.push(rule)
}

function onSaved(rule: Rule) {
  upsert(rule)
  closeBuilder()
  reloadPresets()
}

// ─── Acciones de la lista ─────────────────────────────────────────────────────

const busyUuid = ref<string | null>(null)
const listError = ref('')

function errorText(e: unknown, fallbackKey: string) {
  if (e instanceof RuleApiError) return ruleErrorLabel(e.code, t) ?? e.message
  return e instanceof Error ? e.message : t(fallbackKey)
}

/** Optimista: cambia el interruptor al momento y lo revierte si falla. */
async function onToggle(rule: Rule) {
  const next = !rule.is_active
  const idx = rules.value.findIndex((r) => r.uuid === rule.uuid)
  if (idx < 0) return
  listError.value = ''
  rules.value.splice(idx, 1, { ...rule, is_active: next })
  busyUuid.value = rule.uuid
  try {
    const saved = await api.toggleRule(rule.uuid, next)
    upsert(saved)
    reloadPresets()
  } catch (e) {
    const current = rules.value.findIndex((r) => r.uuid === rule.uuid)
    if (current >= 0) rules.value.splice(current, 1, { ...rules.value[current], is_active: rule.is_active })
    listError.value = `${t('rules.list.toggleError')} ${errorText(e, 'rules.list.toggleError')}`
  } finally {
    busyUuid.value = null
  }
}

async function onDuplicate(rule: Rule) {
  listError.value = ''
  busyUuid.value = rule.uuid
  try {
    upsert(await api.duplicateRule(rule.uuid))
  } catch (e) {
    listError.value = errorText(e, 'rules.list.duplicateError')
  } finally {
    busyUuid.value = null
  }
}

async function onDelete(rule: Rule) {
  listError.value = ''
  busyUuid.value = rule.uuid
  try {
    await api.deleteRule(rule.uuid)
    rules.value = rules.value.filter((r) => r.uuid !== rule.uuid)
    void sharedCatalog.invalidate()
    reloadPresets()
  } catch (e) {
    listError.value = errorText(e, 'rules.list.deleteError')
  } finally {
    busyUuid.value = null
  }
}

// ─── Vista previa de una regla guardada ───────────────────────────────────────

const previewRule = ref<Rule | null>(null)

// ─── Sugeridas ────────────────────────────────────────────────────────────────

const presetBusyKey = ref<string | null>(null)
const presetError = ref('')

async function onApplyPreset(key: string) {
  const tourUuid = selectedTourUuid.value
  if (!tourUuid) return
  presetBusyKey.value = key
  presetError.value = ''
  try {
    upsert(await api.applyPreset(tourUuid, key))
    await reloadPresets()
  } catch (e) {
    presetError.value = errorText(e, 'rules.presets.applyError')
  } finally {
    presetBusyKey.value = null
  }
}

function onOpenPresetRule(uuid: string) {
  const rule = rules.value.find((r) => r.uuid === uuid)
  if (rule) openEdit(rule)
}

// Orden del backend (`-is_active, trigger, name`), mantenido tras cambios locales.
const sortedRules = computed(() =>
  [...rules.value].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      String(a.trigger).localeCompare(String(b.trigger)) ||
      a.name.localeCompare(b.name)
  )
)
</script>

<template>
  <div data-test="rules-manager">
    <!-- Cargando la lista de giras -->
    <div
      v-if="!toursReady || (toursStore.loading && !toursStore.tours.length)"
      class="space-y-2"
      data-test="rules-tours-loading"
    >
      <div
        v-for="i in 2"
        :key="i"
        class="h-12 rounded-sm bg-glass border border-line animate-pulse"
      />
    </div>

    <!-- Error al cargar las giras -->
    <div
      v-else-if="toursStore.error && !toursStore.tours.length"
      class="py-6 text-center"
      data-test="rules-tours-error"
    >
      <p class="text-[14px] text-failed-fg mb-2">
        {{ t('rules.toursError') }}
      </p>
      <BtnSecondary
        type="button"
        small
        @click="reloadTours"
      >
        {{ t('rules.retry') }}
      </BtnSecondary>
    </div>

    <!-- Sin giras administrables -->
    <div
      v-else-if="!adminTours.length"
      class="py-6 text-center text-[14px] text-ink-3"
      data-test="rules-no-admin"
    >
      {{ t('rules.empty.noAdminTours') }}
    </div>

    <template v-else>
      <!-- Cabecera: gira + nueva regla -->
      <div class="flex flex-col sm:flex-row sm:items-end gap-2 mb-4">
        <label class="flex-1 min-w-0">
          <span class="text-[12px] font-bold text-ink-2 tracking-[0.5px] uppercase">{{
            t('rules.tourSelector')
          }}</span>
          <select
            :value="selectedTourUuid"
            class="mt-1 w-full bg-bg-4 border border-line rounded-sm px-2 py-1.5 text-[14px] text-ink"
            data-test="rules-tour-select"
            @change="selectTour(($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="tour in adminTours"
              :key="tour.uuid"
              :value="tour.uuid"
            >
              {{ tour.artist_name }} — {{ tour.name }}
            </option>
          </select>
        </label>
        <BtnPrimary
          type="button"
          :disabled="!options || limitReached"
          :class="!options || limitReached ? 'opacity-50 pointer-events-none' : ''"
          data-test="rules-new"
          @click="openCreate"
        >
          + {{ t('rules.newRule') }}
        </BtnPrimary>
      </div>
      <p
        v-if="limitReached"
        class="text-[13px] text-brand-orange -mt-2 mb-3"
        data-test="rules-limit"
      >
        {{ t('rules.limitReached', { max: maxRules }) }}
      </p>

      <!-- Sin acceso a esta gira (403/404): el selector sigue visible para cambiar de gira -->
      <div
        v-if="noAccess"
        class="py-6 text-center"
        data-test="rules-no-access"
      >
        <p class="text-[14px] text-ink-3 mb-2">
          {{ t('rules.empty.noAdminTours') }}
        </p>
        <BtnSecondary
          type="button"
          small
          @click="load"
        >
          {{ t('rules.retry') }}
        </BtnSecondary>
      </div>

      <!-- Cargando: esqueleto -->
      <div
        v-else-if="loading"
        class="space-y-2"
        data-test="rules-loading"
      >
        <div
          v-for="i in 3"
          :key="i"
          class="h-16 rounded-sm bg-glass border border-line animate-pulse"
        />
      </div>

      <!-- Error -->
      <div
        v-else-if="loadError"
        class="py-6 text-center"
        data-test="rules-error"
      >
        <p class="text-[14px] text-failed-fg mb-2">
          {{ loadError }}
        </p>
        <BtnSecondary
          type="button"
          small
          @click="load"
        >
          {{ t('rules.retry') }}
        </BtnSecondary>
      </div>

      <template v-else-if="options">
        <RulePresetsPanel
          :presets="presets"
          :busy-key="presetBusyKey"
          :error="presetError"
          @apply="onApplyPreset"
          @open="onOpenPresetRule"
        />

        <p
          v-if="listError"
          class="text-[13px] text-failed-fg mb-2"
          data-test="rules-list-error"
        >
          {{ listError }}
        </p>

        <div
          v-if="!rules.length"
          class="py-6 text-center text-[14px] text-ink-3"
          data-test="rules-empty"
        >
          {{ t('rules.empty.noRules') }}
        </div>
        <div
          v-else
          class="space-y-2"
        >
          <RuleListItem
            v-for="rule in sortedRules"
            :key="rule.uuid"
            :rule="rule"
            :options="options"
            :busy="busyUuid === rule.uuid"
            @toggle="onToggle"
            @edit="openEdit"
            @duplicate="onDuplicate"
            @preview="previewRule = $event"
            @delete="onDelete"
          />
        </div>
      </template>
    </template>

    <!-- Constructor -->
    <AppModal
      :show="builderOpen && !!options"
      @close="closeBuilder"
    >
      <RuleBuilder
        v-if="builderOpen && options"
        :key="builderKey"
        :tour-uuid="selectedTourUuid"
        :options="options"
        :rule="editingRule"
        @saved="onSaved"
        @cancel="closeBuilder"
      />
    </AppModal>

    <!-- Vista previa de una regla guardada -->
    <AppModal
      :show="!!previewRule"
      @close="previewRule = null"
    >
      <div
        v-if="previewRule"
        class="space-y-3"
      >
        <p class="text-[15px] font-bold text-ink">
          {{ previewRule.name }}
        </p>
        <RulePreviewPanel
          :tour-uuid="selectedTourUuid"
          :rule-uuid="previewRule.uuid"
          :trigger="String(previewRule.trigger)"
          :activity-type-codes="previewRule.activity_type_codes"
        />
        <div class="flex justify-end">
          <BtnSecondary
            type="button"
            @click="previewRule = null"
          >
            {{ t('rules.close') }}
          </BtnSecondary>
        </div>
      </div>
    </AppModal>
  </div>
</template>
