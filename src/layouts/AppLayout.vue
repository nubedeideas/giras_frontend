<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import MobileNav from '@/components/MobileNav.vue'
import TourBand from '@/components/TourBand.vue'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard.vue'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import { useUIState } from '@/composables/useUIState'
import { useUIStore } from '@/stores/ui'

const { openSettings, wizardOpen, wizardDismissed, closeWizard, dismissWizard } = useUIState()
const toursStore = useToursStore()
const authStore = useAuthStore()
// Instantiating the store here triggers the watcher that applies data-theme to <html>
useUIStore()

const toursLoaded = ref(false)

// Auto-show only when: tours loaded successfully, user is real (not demo), and has no tours yet
const autoShowWizard = computed(
  () =>
    toursLoaded.value &&
    authStore.isLoggedIn &&
    !authStore.isDemoMode &&
    toursStore.error === null &&
    toursStore.tours.length === 0 &&
    !wizardDismissed.value,
)

const showWizard = computed(() => autoShowWizard.value || wizardOpen.value)

function onOnboardingComplete(tourId: number | null) {
  closeWizard()
  if (tourId !== null) toursStore.setActiveTour(tourId)
}

function onWizardClose() {
  dismissWizard()
}

onMounted(async () => {
  await toursStore.loadTours()
  toursLoaded.value = true
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

    <OnboardingWizard
      v-if="showWizard"
      @complete="onOnboardingComplete"
      @close="onWizardClose"
    />
  </div>
</template>
