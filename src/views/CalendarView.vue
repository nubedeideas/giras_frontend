<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useIsMobile } from '@/composables/useIsMobile'
import CalendarGrid from '@/components/calendar/CalendarGrid.vue'
import CalendarSidePanel from '@/components/calendar/CalendarSidePanel.vue'
import MobileDetailOverlay from '@/components/ui/MobileDetailOverlay.vue'

const cal = useCalendarStore()
const { isMobile } = useIsMobile()

// The store keeps a default `selectedDate` for the desktop side panel's
// always-visible "day summary" — that default shouldn't auto-open the mobile
// overlay on first render, only an actual tap on a day should. Watching
// (not `immediate`) only reacts to real changes made after mount.
const showMobileDetail = ref(false)
watch(
  () => cal.selectedDate,
  (val) => {
    if (isMobile.value) showMobileDetail.value = !!val
  },
)

function closeMobileDetail() {
  showMobileDetail.value = false
  cal.selectedDate = null
}
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <CalendarGrid />

    <!-- Desktop only — mobile uses the full-screen overlay below -->
    <CalendarSidePanel v-if="!isMobile" />
  </div>

  <!-- Mobile only — full-screen overlay, opened on tapping a day -->
  <MobileDetailOverlay
    v-if="isMobile"
    :show="showMobileDetail"
    @close="closeMobileDetail"
  >
    <CalendarSidePanel />
  </MobileDetailOverlay>
</template>
