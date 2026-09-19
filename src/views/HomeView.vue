<script setup lang="ts">
import { useRouter } from 'vue-router'
import TourSelectPrompt from '@/components/tour/TourSelectPrompt.vue'

const router = useRouter()

// Tours are already loaded once by AppLayout.vue on mount — TourSelectPrompt
// just reads the store reactively, no fetch of its own.
function goToActivities() {
  router.push('/events')
}
</script>

<template>
  <div class="h-full overflow-hidden bg-bg-3">
    <TourSelectPrompt @confirmed="goToActivities" />
  </div>
</template>
