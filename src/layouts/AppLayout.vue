<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import MobileNav from '@/components/MobileNav.vue'
import TourBand from '@/components/TourBand.vue'
import { useToursStore } from '@/stores/tours'
import { useUIState } from '@/composables/useUIState'
import { useUIStore } from '@/stores/ui'

const { openSettings } = useUIState()
const toursStore = useToursStore()
// Instantiating the store here triggers the watcher that applies data-theme to <html>
useUIStore()

onMounted(() => {
  toursStore.loadTours()
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-bg">
    <AppSidebar @open-settings="openSettings('general')" />

    <div class="flex-1 overflow-hidden flex flex-col">
      <TourBand />
      <div class="flex-1 overflow-hidden">
        <RouterView />
      </div>
    </div>

    <MobileNav />
  </div>
</template>
