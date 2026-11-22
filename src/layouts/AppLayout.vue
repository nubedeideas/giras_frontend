<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import MobileNav from '@/components/MobileNav.vue'
import SubscriptionUsageBanner from '@/components/SubscriptionUsageBanner.vue'
import DashboardHeader from '@/components/DashboardHeader.vue'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard.vue'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import { useUIState } from '@/composables/useUIState'
import { useUIStore } from '@/stores/ui'
import { useNoIndex } from '@/composables/usePageMeta'
import { useInboxPolling } from '@/composables/useInboxPolling'
import { takeOnboardingResume } from '@/utils/googleOAuth'

useNoIndex()
const route = useRoute()
// Contador del inbox: un único polling para toda la app autenticada.
useInboxPolling()

const {
  openSettings,
  wizardOpen,
  wizardDismissed,
  wizardResume,
  openWizard,
  closeWizard,
  dismissWizard,
} = useUIState()
const toursStore = useToursStore()
const authStore = useAuthStore()
// El store aún aplica data-theme a <html>, pero ya no hay CSS asociado (Paleta B, tema único).
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
  // Vuelta de Google tras conectar Calendar o Contactos desde el asistente: mismo paso y gira.
  const resume = authStore.isDemoMode ? null : takeOnboardingResume()
  // La gira se resuelve por uuid: el id sintético del store depende del orden de `GET /tours/`
  // y tras la recarga del OAuth el número guardado podría ser otra gira.
  if (resume) {
    const tour = resume.tourUuid
      ? toursStore.tours.find((tr) => tr.uuid === resume.tourUuid)
      : undefined
    openWizard({ step: resume.step, tourId: tour?.id ?? null })
  }
})
</script>

<template>
  <!-- Marco exterior negro (escritorio); la tarjeta papel lleva el borde lima con brillo
       (.app-frame). El overflow-hidden va en la tarjeta para no cortar el halo. -->
  <div class="h-screen bg-black lg:p-6 xl:p-8">
    <div class="app-frame flex h-full overflow-hidden bg-bg lg:max-w-[1800px] lg:mx-auto lg:rounded-3xl">
      <AppSidebar @open-settings="openSettings('general')" />

      <div class="flex-1 overflow-hidden flex flex-col">
        <DashboardHeader />
        <!-- En /home el dashboard ya enseña el aviso de cupo -->
        <SubscriptionUsageBanner v-if="route.name !== 'home'" />
        <div class="flex-1 overflow-hidden">
          <RouterView />
        </div>
      </div>

      <MobileNav />

      <OnboardingWizard
        v-if="showWizard"
        :initial-step="wizardResume?.step"
        :initial-tour-id="wizardResume?.tourId ?? null"
        @complete="onOnboardingComplete"
        @close="onWizardClose"
      />
    </div>
  </div>
</template>
