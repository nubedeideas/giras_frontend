<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useReminderSettings,
  type ReminderCatalog,
  type ReminderTypeSetting,
} from '@/composables/useReminderSettings'
import { useToursStore } from '@/stores/tours'
import ReminderEstimateCard from './ReminderEstimateCard.vue'
import TourReminderTypeRow from './TourReminderTypeRow.vue'
import ManageGroupContactsModal from '@/components/modals/ManageGroupContactsModal.vue'
import RoleGroupsProposalModal from './RoleGroupsProposalModal.vue'
import AiReviewList from './AiReviewList.vue'
import type { RoleGroupsApplyResult } from '@/composables/useRoleGroups'
import { isForbidden, reminderErrorMessage } from '@/utils/reminders'

/**
 * Pestaña "Recordatorios" del hub de gira (C1.3): estimación y cupo, Equipo de la gira y una
 * fila por tipo de actividad. Solo para admins (el padre la oculta; el 403/404 se trata aquí).
 */
const props = defineProps<{ tourUuid: string }>()

const { t } = useI18n()
const api = useReminderSettings()
const toursStore = useToursStore()

const catalog = ref<ReminderCatalog | null>(null)
const loading = ref(false)
const error = ref('')
const forbidden = ref(false)
const showManageTeam = ref(false)
const showRoleGroups = ref(false)
const roleGroupsNotice = ref('')
const roleGroupsWarnings = ref<string[]>([])
const aiReview = ref<InstanceType<typeof AiReviewList> | null>(null)

const typeNames = computed<Record<string, string>>(() =>
  Object.fromEntries((catalog.value?.types ?? []).map((x) => [x.activity_type_code, x.name]))
)

let request = 0

async function load() {
  const req = ++request
  loading.value = true
  error.value = ''
  forbidden.value = false
  try {
    const data = await api.getCatalog(props.tourUuid, { estimate: true })
    if (req === request) catalog.value = data
  } catch (e) {
    if (req !== request) return
    catalog.value = null
    onError(e)
  } finally {
    if (req === request) loading.value = false
  }
}

function onError(e: unknown) {
  if (isForbidden(e)) {
    onForbidden()
    return
  }
  error.value = reminderErrorMessage(e, t, 'reminders.errors.load', { load: true })
}

/** 403/404: el usuario ya no administra la gira. Se avisa y se recargan las giras. */
function onForbidden() {
  forbidden.value = true
  catalog.value = null
  void toursStore.loadTours()
}

/**
 * Tras guardar una fila o cambiar el Equipo de la gira, la estimación, el cupo y los avisos
 * cambian: se piden de nuevo sin esqueleto y sin sustituir las filas, para no pisar el borrador
 * de otra fila que se esté editando. De cada tipo solo se actualizan `warnings` y `base_source`
 * (mutando el objeto: la fila vigila la referencia de `setting`, no su contenido).
 */
async function refreshQuietly({
  mergeTypes = false,
  replaceTypes = false,
}: { mergeTypes?: boolean; replaceTypes?: boolean } = {}) {
  const req = request
  try {
    const data = await api.getCatalog(props.tourUuid, { estimate: true })
    if (req !== request || !catalog.value) return
    catalog.value.estimate = data.estimate
    catalog.value.plan = data.plan
    catalog.value.default_group = data.default_group
    catalog.value.groups = data.groups
    if (replaceTypes) {
      // Cambio masivo (grupos por rol): los grupos y destinos de cada tipo vienen del backend.
      catalog.value.types = data.types
    } else if (mergeTypes) {
      const fresh = new Map(data.types.map((x) => [x.activity_type_code, x]))
      for (const row of catalog.value.types) {
        const f = fresh.get(row.activity_type_code)
        if (!f) continue
        row.warnings = f.warnings
        row.base_source = f.base_source
      }
    }
  } catch (e) {
    // La estimación anterior sigue valiendo como aproximación; un 403/404 sí se enseña.
    if (isForbidden(e)) onForbidden()
  }
}

function onSaved(updated: ReminderTypeSetting) {
  if (!catalog.value) return
  const idx = catalog.value.types.findIndex(
    (x) => x.activity_type_code === updated.activity_type_code
  )
  if (idx >= 0) catalog.value.types[idx] = updated
  void refreshQuietly()
}

function onTeamSaved(count: number) {
  showManageTeam.value = false
  if (catalog.value?.default_group) catalog.value.default_group.contact_count = count
  void refreshQuietly({ mergeTypes: true })
}

/**
 * Grupos por rol aplicados: cambian los grupos asignables, sus contactos y (si se marcó) los
 * destinos de cada tipo. Se recarga el catálogo entero sin esqueleto.
 */
function onRoleGroupsApplied(result: RoleGroupsApplyResult, applyDestinations: boolean) {
  showRoleGroups.value = false
  roleGroupsNotice.value = applyDestinations
    ? t(
        'roleGroups.appliedWithTypes',
        { n: result.groups.length, types: result.reminder_settings_updated },
        result.groups.length
      )
    : t('roleGroups.applied', { n: result.groups.length }, result.groups.length)
  // Solo los avisos conocidos: nunca se enseña un código crudo.
  roleGroupsWarnings.value = (result.warnings ?? [])
    .map((w) => {
      const key = `roleGroups.warnings.${w}`
      const text = t(key)
      return text === key ? '' : text
    })
    .filter(Boolean)
  void refreshQuietly({ replaceTypes: true })
  void aiReview.value?.reload()
}

function onRoleGroupsForbidden() {
  showRoleGroups.value = false
  onForbidden()
}

function openRoleGroups() {
  roleGroupsNotice.value = ''
  roleGroupsWarnings.value = []
  showRoleGroups.value = true
}

watch(() => props.tourUuid, load, { immediate: true })
</script>

<template>
  <div
    class="max-w-3xl"
    data-test="tour-reminders"
  >
    <div class="mb-4 flex flex-wrap items-start gap-3">
      <div class="flex-1 min-w-[200px]">
        <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">
          {{ t('reminders.tour.title') }}
        </h2>
        <p class="text-[12px] text-ink-3 mt-1">
          {{ t('reminders.tour.subtitle') }}
        </p>
      </div>
      <button
        v-if="catalog && !forbidden"
        type="button"
        class="w-full sm:w-auto min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-semibold bg-glass border border-line-acid text-acid hover:bg-glass-hover cursor-pointer"
        data-test="role-groups-open"
        @click="openRoleGroups"
      >
        <!-- Icono de IA (destellos) -->
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /></svg>
        {{ t('roleGroups.button') }}
      </button>
    </div>

    <!-- Sin permiso -->
    <div
      v-if="forbidden"
      class="bg-glass border border-line rounded-lg px-4 py-4 text-center"
      data-test="reminders-not-admin"
    >
      <p class="text-[12px] text-ink-2">
        {{ t('reminders.errors.notAdmin') }}
      </p>
    </div>

    <!-- Cargando: esqueleto -->
    <div
      v-else-if="loading && !catalog"
      class="space-y-2"
      data-test="reminders-loading"
    >
      <div class="h-24 bg-glass border border-line rounded-lg animate-pulse" />
      <div class="h-14 bg-glass border border-line rounded-lg animate-pulse" />
      <div
        v-for="n in 4"
        :key="n"
        class="h-14 bg-glass border border-line rounded-sm animate-pulse"
      />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="bg-glass border border-line rounded-lg px-4 py-4 text-center"
      data-test="reminders-error"
    >
      <p class="text-[12px] text-red-400 mb-2">
        {{ error }}
      </p>
      <button
        class="min-h-[44px] sm:min-h-0 text-[12px] font-semibold text-acid bg-transparent border-none cursor-pointer"
        data-test="reminders-retry"
        @click="load"
      >
        {{ t('reminders.tour.retry') }}
      </button>
    </div>

    <template v-else-if="catalog">
      <p
        v-if="roleGroupsNotice"
        class="text-[12px] text-wa-green mb-3"
        role="status"
        data-test="role-groups-applied"
      >
        {{ roleGroupsNotice }}
      </p>
      <p
        v-for="w in roleGroupsWarnings"
        :key="w"
        class="text-[12px] text-ink-2 mb-3"
        role="status"
        data-test="role-groups-warning"
      >
        {{ w }}
      </p>

      <ReminderEstimateCard
        :plan="catalog.plan"
        :estimate="catalog.estimate"
        class="mb-3"
      />

      <!-- Equipo de la gira -->
      <div
        class="bg-glass border border-line rounded-lg px-4 py-3 mb-5 flex flex-wrap items-center gap-3"
        data-test="reminders-team"
      >
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase">
            {{ t('reminders.team.title') }}
          </p>
          <template v-if="catalog.default_group">
            <p class="text-[13px] text-ink font-semibold mt-0.5 truncate">
              {{ catalog.default_group.name }}
              <span
                class="text-[11px] font-normal text-ink-3"
                data-test="team-count"
              >· {{
                t(
                  'reminders.tour.contacts',
                  { n: catalog.default_group.contact_count },
                  catalog.default_group.contact_count
                )
              }}</span>
            </p>
            <p
              v-if="catalog.default_group.contact_count === 0"
              class="text-[11px] text-brand-orange mt-1"
              data-test="team-empty"
            >
              {{ t('reminders.team.empty') }}
            </p>
          </template>
          <p
            v-else
            class="text-[11px] text-brand-orange mt-1"
            data-test="team-missing"
          >
            {{ t('reminders.team.missing') }}
          </p>
        </div>
        <button
          v-if="catalog.default_group"
          type="button"
          class="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[11px] font-semibold bg-glass border border-line text-ink-2 hover:bg-glass-hover hover:text-ink cursor-pointer"
          data-test="team-manage"
          @click="showManageTeam = true"
        >
          {{ t('reminders.team.manage') }}
        </button>
      </div>

      <!-- Revisión de la IA -->
      <AiReviewList
        ref="aiReview"
        :tour-uuid="tourUuid"
        @changed="refreshQuietly({ mergeTypes: true })"
        @forbidden="onForbidden"
      />

      <!-- Por tipo -->
      <p
        v-if="catalog.types.length === 0"
        class="text-[12px] text-ink-4 text-center py-6"
        data-test="reminders-empty"
      >
        {{ t('reminders.tour.empty') }}
      </p>
      <div
        v-else
        class="space-y-1.5"
      >
        <TourReminderTypeRow
          v-for="setting in catalog.types"
          :key="setting.activity_type_code"
          :tour-uuid="tourUuid"
          :setting="setting"
          :groups="catalog.groups"
          :limits="catalog.limits"
          @saved="onSaved"
          @forbidden="onForbidden"
        />
      </div>

      <ManageGroupContactsModal
        :show="showManageTeam"
        :group-uuid="catalog.default_group?.uuid ?? null"
        @close="showManageTeam = false"
        @saved="onTeamSaved"
      />

      <RoleGroupsProposalModal
        :show="showRoleGroups"
        :tour-uuid="tourUuid"
        :type-names="typeNames"
        @close="showRoleGroups = false"
        @applied="onRoleGroupsApplied"
        @forbidden="onRoleGroupsForbidden"
      />
    </template>
  </div>
</template>
