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

const { openSettings, wizardOpen, closeWizard } = useUIState()
const toursStore = useToursStore()
const authStore = useAuthStore()
// Instantiating the store here triggers the watcher that applies data-theme to <html>
useUIStore()

const toursLoaded = ref(false)

const firstLoginOnboarding = computed(
  () =>
    toursLoaded.value &&
    authStore.isLoggedIn &&
    !authStore.isDemoMode &&
    !localStorage.getItem('giras_onboarding_done') &&
    toursStore.tours.length === 0,
)

const showWizard = computed(() => firstLoginOnboarding.value || wizardOpen.value)

function onOnboardingComplete(tourId: number | null) {
  if (firstLoginOnboarding.value) localStorage.setItem('giras_onboarding_done', '1')
  closeWizard()
  if (tourId !== null) toursStore.setActiveTour(tourId)
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
    />
  </div>
</template>
