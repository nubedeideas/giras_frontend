<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { useTours, type TourFull } from '@/composables/useTours'
import TourInsightsPanel from '@/components/tour/TourInsightsPanel.vue'
import TourDocumentsPanel from '@/components/tour/TourDocumentsPanel.vue'
import ScheduleConflictsPanel from '@/components/tour/ScheduleConflictsPanel.vue'
import TourSelectPrompt from '@/components/tour/TourSelectPrompt.vue'
import CrewPortalPanel from '@/components/tour/CrewPortalPanel.vue'
import TourRemindersPanel from '@/components/tour/TourRemindersPanel.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toursStore = useToursStore()
const toursApi = useTours()

type Tab = 'insights' | 'documents' | 'conflicts' | 'crew' | 'reminders'
const activeTab = ref<Tab>('insights')

const BASE_TABS: { key: Tab; labelKey: string }[] = [
  { key: 'insights', labelKey: 'tourHub.tabs.insights' },
  { key: 'documents', labelKey: 'tourHub.tabs.documents' },
  { key: 'conflicts', labelKey: 'tourHub.tabs.conflicts' },
]

const hasTourUuid = computed(() => !!toursStore.activeTour?.uuid)

// Rol real del usuario en la gira: `current_user_is_admin` del detalle (staff, owner o miembro
// activo admin/tour_manager), igual que el backend. El listado no lo trae, así que se carga el
// detalle; mientras falte (o si el backend aún no lo expone) se aproxima por owner/superuser.
const tourDetail = ref<TourFull | null>(null)
let detailRequest = 0

// uuid de la gira cuyo detalle ya ha respondido (bien o mal): hasta entonces los permisos salen
// del fallback y no son fiables para decidir la pestaña `crew` pedida por query.
const detailSettledFor = ref<string | null>(null)

async function loadDetail(uuid: string | undefined) {
  const req = ++detailRequest
  tourDetail.value = null
  detailSettledFor.value = null
  if (!uuid) return
  try {
    const full = await toursApi.getTour(uuid)
    if (req === detailRequest) tourDetail.value = full
  } catch {
    // Sin detalle se queda el fallback.
  } finally {
    if (req === detailRequest) detailSettledFor.value = uuid
  }
}

watch(() => toursStore.activeTour?.uuid, loadDetail, { immediate: true })

const fallbackIsAdmin = computed(
  () =>
    !!auth.user?.is_superuser ||
    (!!auth.user?.email && auth.user.email === toursStore.activeTour?.owner_email)
)

const isAdmin = computed(() => {
  const detail = tourDetail.value
  if (detail && detail.uuid === toursStore.activeTour?.uuid) {
    if (typeof detail.current_user_is_admin === 'boolean') return detail.current_user_is_admin
  }
  return fallbackIsAdmin.value
})

// Gestión del portal del crew y de la visibilidad de documentos: admin de la gira o staff
// (`can_manage_crew` del detalle); si el backend no lo expone, se usa `isAdmin`.
const canManageCrew = computed(() => {
  const detail = tourDetail.value
  if (detail && detail.uuid === toursStore.activeTour?.uuid) {
    if (typeof detail.can_manage_crew === 'boolean') return detail.can_manage_crew
  }
  return isAdmin.value
})

// La pestaña del portal del crew solo la ven quienes pueden gestionarlo (el backend da 403 al resto).
// La de recordatorios, solo los admins de la gira (`current_user_is_admin`; staff no cuenta).
const TABS = computed(() => {
  const tabs = [...BASE_TABS]
  if (isAdmin.value) tabs.push({ key: 'reminders', labelKey: 'tourHub.tabs.reminders' })
  if (canManageCrew.value) tabs.push({ key: 'crew', labelKey: 'tourHub.tabs.crew' })
  return tabs
})
watch(canManageCrew, (can) => {
  if (!can && activeTab.value === 'crew') activeTab.value = 'insights'
})
watch(isAdmin, (admin) => {
  if (!admin && activeTab.value === 'reminders') activeTab.value = 'insights'
})

// Deep link `/tour?tab=<pestaña>` (inbox → Conflictos): solo pestañas visibles; luego se limpia.
// `crew` depende del permiso real, así que espera a que responda el detalle de la gira.
const requestedTab = ref<string | null>(null)

function applyRequestedTab() {
  const tab = requestedTab.value
  if (tab === null) return
  const needsDetail = tab === 'crew' || tab === 'reminders'
  const detailReady =
    !!toursStore.activeTour?.uuid && detailSettledFor.value === toursStore.activeTour.uuid
  if (needsDetail && !detailReady) return
  const match = TABS.value.find((x) => x.key === tab)
  if (match) activeTab.value = match.key
  requestedTab.value = null
  void router.replace({ query: { ...route.query, tab: undefined } })
}

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === undefined) return
    requestedTab.value = typeof tab === 'string' ? tab : ''
    applyRequestedTab()
  },
  { immediate: true }
)
watch([TABS, detailSettledFor], applyRequestedTab)
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg-3">
    <!-- No tour selected -->
    <TourSelectPrompt v-if="!toursStore.activeTourId" />

    <!-- No UUID (mock tour) -->
    <div
      v-else-if="!hasTourUuid"
      class="h-full flex flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <p class="text-[12px] text-ink-4">
        Esta gira aún no tiene datos del servidor
      </p>
    </div>

    <div
      v-else
      class="max-w-6xl mx-auto px-4 sm:px-6 py-6"
    >
      <!-- Tabs -->
      <div class="flex flex-wrap items-center gap-1.5 mb-6">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors cursor-pointer border-none"
          :class="activeTab === tab.key ? 'bg-glass-active text-acid' : 'bg-glass text-ink-2 hover:text-ink'"
          @click="activeTab = tab.key"
        >
          {{ t(tab.labelKey) }}
        </button>
      </div>

      <TourInsightsPanel
        v-if="activeTab === 'insights'"
        :tour-uuid="toursStore.activeTour!.uuid"
      />
      <TourDocumentsPanel
        v-else-if="activeTab === 'documents'"
        :tour-uuid="toursStore.activeTour!.uuid"
        :is-admin="isAdmin"
        :can-manage-crew="canManageCrew"
      />
      <ScheduleConflictsPanel
        v-else-if="activeTab === 'conflicts'"
        :tour-uuid="toursStore.activeTour!.uuid"
      />
      <CrewPortalPanel
        v-else-if="activeTab === 'crew' && canManageCrew"
        :tour-uuid="toursStore.activeTour!.uuid"
      />
      <TourRemindersPanel
        v-else-if="activeTab === 'reminders' && isAdmin"
        :tour-uuid="toursStore.activeTour!.uuid"
      />
    </div>
  </div>
</template>
