<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCalendarStore } from '@/stores/calendar'
import { useActivitiesStore } from '@/stores/activities'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import { useIsMobile } from '@/composables/useIsMobile'
import CalendarGrid from '@/components/calendar/CalendarGrid.vue'
import CalendarSidePanel from '@/components/calendar/CalendarSidePanel.vue'
import ActivityDetail from '@/components/activities/ActivityDetail.vue'
import MobileDetailOverlay from '@/components/ui/MobileDetailOverlay.vue'
import DetailPane from '@/components/ui/DetailPane.vue'
import SelectTourModal from '@/components/modals/SelectTourModal.vue'
import AddActivityModal from '@/components/modals/AddActivityModal.vue'
import CreateActivityModal from '@/components/modals/CreateActivityModal.vue'
import ImportCalActivitiesModal from '@/components/modals/ImportCalActivitiesModal.vue'
import ImportDropModal from '@/components/import/ImportDropModal.vue'
import { useImportReturn } from '@/composables/useImportReturn'

const { t } = useI18n()
const cal = useCalendarStore()
const activitiesStore = useActivitiesStore()
const toursStore = useToursStore()
const auth = useAuthStore()
const { isMobile } = useIsMobile()

// Alta desde el panel lateral: mismo flujo que "Agregar" de Actividades (sin gira activa, elegir
// gira primero), con la fecha del día seleccionado (día de la gira) prerrellenada.
const showSelectTour = ref(false)
const showAddModal = ref(false)
const showCreate = ref(false)
const showImportCal = ref(false)
const showImport = ref(false)
const addDate = ref<string | null>(null)

const canImport = computed(
  () => toursStore.activeTour?.current_user_is_admin === true && !auth.isDemoMode
)

const importSheets = ref(false)
useImportReturn({
  ready: () => canImport.value && !!toursStore.activeTour?.uuid,
  onSheets: () => {
    importSheets.value = true
    showImport.value = true
  },
})

function closeImport() {
  showImport.value = false
  importSheets.value = false
}

function openImportFromCreate() {
  showCreate.value = false
  showImport.value = true
}

function handleOpenAdd() {
  // Sin gira, el día elegido no pertenece a la gira que se va a escoger: sin fecha prerrellenada.
  addDate.value = toursStore.activeTour ? cal.selectedDate : null
  if (!toursStore.activeTour) showSelectTour.value = true
  else showAddModal.value = true
}

onMounted(() => {
  cal.resetToDefaultMonth()
  if (toursStore.activeTour) activitiesStore.loadActivities()
})

// Confirmed UX: closing the detail always closes back to the grid in one
// step — no intermediate "back to day agenda" level.
function closeAll() {
  cal.selectedDate = null
  activitiesStore.clearSelection()
}

const showMobileDetail = computed(
  () => !!activitiesStore.selectedUuid || (cal.viewMode === 'grid' && !!cal.selectedDate),
)
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <CalendarGrid />

    <!-- Desktop only — mobile uses the full-screen overlay below.
    ActivityDetail wants flex-1, CalendarSidePanel/empty-state want a fixed
    w-72 — a single persistent wrapper (always mounted, only its width class
    toggles) keeps the row down to one flex item changing size at a time,
    instead of two differently-sized panels briefly competing for space (or,
    with out-in alone and no wrapper, the grid flashing to full width in the
    gap between the old panel leaving and the new one entering). -->
    <DetailPane
      v-if="!isMobile"
      :class="activitiesStore.selectedUuid ? 'flex-1' : 'w-72 flex-shrink-0'"
    >
      <Transition
        name="fade"
        mode="out-in"
      >
        <ActivityDetail
          v-if="activitiesStore.selectedUuid"
          key="detail"
          @close="closeAll"
        />
        <CalendarSidePanel
          v-else-if="cal.viewMode === 'grid' && toursStore.activeTourId"
          key="agenda"
          @add="handleOpenAdd"
        />
        <div
          v-else
          key="empty"
          class="flex-1 my-3 ml-1.5 mr-3 bg-bg-3 rounded-2xl border border-line shadow-[0_4px_20px_var(--shadow-sm)] flex items-center justify-center text-center px-4"
        >
          <p class="text-[14px] text-ink-3">
            {{ t('calendar.selectActivity') }}
          </p>
        </div>
      </Transition>
    </DetailPane>
  </div>

  <!-- Mobile only — full-screen overlay -->
  <MobileDetailOverlay
    v-if="isMobile"
    :show="showMobileDetail"
    @close="closeAll"
  >
    <ActivityDetail
      v-if="activitiesStore.selectedUuid"
      @close="closeAll"
    />
    <CalendarSidePanel
      v-else
      @add="handleOpenAdd"
    />
  </MobileDetailOverlay>

  <SelectTourModal
    :show="showSelectTour"
    @close="showSelectTour = false"
    @selected="showAddModal = true"
  />
  <AddActivityModal
    :show="showAddModal"
    :can-import="canImport"
    @close="showAddModal = false"
    @open-create="showCreate = true"
    @open-import-cal="showImportCal = true"
    @open-import="showImport = true"
  />
  <CreateActivityModal
    :show="showCreate"
    :can-import="canImport"
    :initial-date="addDate"
    @close="showCreate = false"
    @open-import="openImportFromCreate"
  />
  <ImportDropModal
    v-if="canImport && toursStore.activeTour?.uuid"
    :show="showImport"
    :tour-uuid="toursStore.activeTour.uuid"
    entry-point="activities"
    expected="itinerary"
    :start-with-sheets="importSheets"
    @close="closeImport"
  />
  <ImportCalActivitiesModal
    :show="showImportCal"
    @close="showImportCal = false"
  />
</template>
