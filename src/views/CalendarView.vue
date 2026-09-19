<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCalendarStore } from '@/stores/calendar'
import { useActivitiesStore } from '@/stores/activities'
import { useToursStore } from '@/stores/tours'
import { useIsMobile } from '@/composables/useIsMobile'
import CalendarGrid from '@/components/calendar/CalendarGrid.vue'
import CalendarSidePanel from '@/components/calendar/CalendarSidePanel.vue'
import ActivityDetail from '@/components/activities/ActivityDetail.vue'
import MobileDetailOverlay from '@/components/ui/MobileDetailOverlay.vue'

const { t } = useI18n()
const cal = useCalendarStore()
const activitiesStore = useActivitiesStore()
const toursStore = useToursStore()
const { isMobile } = useIsMobile()

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
    <div
      v-if="!isMobile"
      class="overflow-hidden"
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
          v-else-if="cal.viewMode === 'grid'"
          key="agenda"
        />
        <div
          v-else
          key="empty"
          class="h-full my-3 ml-1.5 mr-3 bg-bg-3 rounded-2xl border border-line shadow-[0_4px_20px_var(--shadow-sm)] flex items-center justify-center text-center px-4"
        >
          <p class="text-[12px] text-ink-3">
            {{ t('calendar.selectActivity') }}
          </p>
        </div>
      </Transition>
    </div>
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
    <CalendarSidePanel v-else />
  </MobileDetailOverlay>
</template>
