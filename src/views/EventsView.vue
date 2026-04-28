<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useActivitiesStore } from '@/stores/activities'
import { useToursStore } from '@/stores/tours'
import ActivityListPanel from '@/components/activities/ActivityListPanel.vue'
import ActivityDetail from '@/components/activities/ActivityDetail.vue'
import SelectTourModal from '@/components/modals/SelectTourModal.vue'
import AddActivityModal from '@/components/modals/AddActivityModal.vue'
import CreateActivityModal from '@/components/modals/CreateActivityModal.vue'
import ImportCalActivitiesModal from '@/components/modals/ImportCalActivitiesModal.vue'

const store = useActivitiesStore()
const toursStore = useToursStore()

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
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- List panel -->
    <ActivityListPanel @open-add="handleOpenAdd" />

    <!-- Detail panel -->
    <div class="flex-1 overflow-hidden">
      <Transition name="fade">
        <ActivityDetail
          v-if="store.selectedUuid"
          @close="store.clearSelection()"
        />
        <div
          v-else
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
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
            </svg>
          </div>

          <!-- No tour selected -->
          <template v-if="!toursStore.activeTour">
            <p class="text-[12px]">Selecciona una gira para ver sus actividades</p>
            <select
              class="mt-1 bg-bg-4 border border-line rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:border-line-2 cursor-pointer transition-colors w-56"
              :value="''"
              @change="(e) => {
                const id = Number((e.target as HTMLSelectElement).value)
                if (id) { toursStore.setActiveTour(id); store.loadActivities() }
              }"
            >
              <option value="" disabled>— Elige una gira —</option>
              <option v-for="t in toursStore.tours" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
          </template>

          <!-- Tour selected, no activity selected -->
          <p v-else class="text-[12px]">Selecciona una actividad para ver el detalle</p>
        </div>
      </Transition>
    </div>

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
