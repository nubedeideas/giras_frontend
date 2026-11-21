<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useActivitiesStore } from '@/stores/activities'
import { useToursStore } from '@/stores/tours'
import { useIsMobile } from '@/composables/useIsMobile'
import ActivityListPanel from '@/components/activities/ActivityListPanel.vue'
import ActivityDetail from '@/components/activities/ActivityDetail.vue'
import MobileDetailOverlay from '@/components/ui/MobileDetailOverlay.vue'
import TourSelectPrompt from '@/components/tour/TourSelectPrompt.vue'
import SelectTourModal from '@/components/modals/SelectTourModal.vue'
import AddActivityModal from '@/components/modals/AddActivityModal.vue'
import CreateActivityModal from '@/components/modals/CreateActivityModal.vue'
import ImportCalActivitiesModal from '@/components/modals/ImportCalActivitiesModal.vue'

const store = useActivitiesStore()
const toursStore = useToursStore()
const { isMobile } = useIsMobile()

const showSelectTour = ref(false)
const showAddModal = ref(false)
const showCreate = ref(false)
const showImportCal = ref(false)

function handleOpenAdd() {
  if (!toursStore.activeTour) {
    showSelectTour.value = true
  } else {
    showAddModal.value = true
  }
}

onMounted(() => {
  store.loadActivities()
})

// Deep link `/events?activity=<uuid>` (inbox): selecciona la actividad y limpia la query.
const route = useRoute()
const router = useRouter()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

watch(
  () => route.query.activity,
  async (value) => {
    if (value === undefined) return
    const uuid = typeof value === 'string' && UUID_RE.test(value) ? value : null
    // Deja que el `watch` de `activeTourId` del store limpie la selección antes de elegir.
    await nextTick()
    void router.replace({ query: { ...route.query, activity: undefined } })
    if (!uuid) return
    try {
      await store.selectActivity(uuid)
    } catch {
      // El detalle muestra el fallo igual que al seleccionar desde la lista.
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- List panel -->
    <ActivityListPanel @open-add="handleOpenAdd" />

    <!-- Detail panel (desktop only — mobile uses the full-screen overlay below) -->
    <div
      v-if="!isMobile"
      class="flex-1 overflow-hidden"
    >
      <Transition
        name="fade"
        mode="out-in"
      >
        <ActivityDetail
          v-if="store.selectedUuid"
          key="detail"
          @close="store.clearSelection()"
        />
        <!-- No tour selected — the full picker lives here on desktop (the
        lateral list panel stays minimal, see ActivityListPanel.vue) -->
        <TourSelectPrompt
          v-else-if="!toursStore.activeTour"
          key="picker"
        />
        <div
          v-else
          key="empty"
          class="flex-1 h-full bg-bg-3 flex flex-col items-center justify-center gap-2.5 text-ink-3"
        >
          <div class="w-12 h-12 rounded-[15px] bg-glass border border-line flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink-4"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="18"
                rx="2"
              />
              <line
                x1="3"
                y1="10"
                x2="21"
                y2="10"
              />
              <line
                x1="8"
                y1="2"
                x2="8"
                y2="6"
              />
              <line
                x1="16"
                y1="2"
                x2="16"
                y2="6"
              />
            </svg>
          </div>
          <p class="text-[12px]">
            Selecciona una actividad para ver el detalle
          </p>
        </div>
      </Transition>
    </div>

    <!-- Detail panel (mobile only — full-screen overlay) -->
    <MobileDetailOverlay
      v-if="isMobile"
      :show="!!store.selectedUuid"
      @close="store.clearSelection()"
    >
      <ActivityDetail
        v-if="store.selectedUuid"
        @close="store.clearSelection()"
      />
    </MobileDetailOverlay>

    <!-- Modals -->
    <SelectTourModal
      :show="showSelectTour"
      @close="showSelectTour = false"
      @selected="showAddModal = true"
    />
    <AddActivityModal
      :show="showAddModal"
      @close="showAddModal = false"
      @open-create="showCreate = true"
      @open-import-cal="showImportCal = true"
    />
    <CreateActivityModal
      :show="showCreate"
      @close="showCreate = false"
    />
    <ImportCalActivitiesModal
      :show="showImportCal"
      @close="showImportCal = false"
    />
  </div>
</template>
