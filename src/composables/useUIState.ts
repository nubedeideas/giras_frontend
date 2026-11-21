import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { OnboardingResumeStep } from '@/utils/googleOAuth'

export type SettingsTab =
  | 'general'
  | 'calendars'
  | 'activities'
  | 'roles'
  | 'templates'
  | 'subscription'
  | 'billing'

// Module-level: shared across all useUIState() calls, reset on page reload
const wizardOpen = ref(false)
const wizardDismissed = ref(false)
// Paso y gira con los que reabrir el asistente (vuelta de Google tras conectar desde él).
export interface WizardResume {
  step: OnboardingResumeStep
  tourId: number | null
}
const wizardResume = ref<WizardResume | null>(null)

export function useUIState() {
  const router = useRouter()

  function openSettings(tab: SettingsTab = 'general') {
    router.push({ path: '/settings', query: { tab } })
  }

  function openWizard(resume?: WizardResume) {
    wizardResume.value = resume ? { step: resume.step, tourId: resume.tourId } : null
    wizardDismissed.value = false
    wizardOpen.value = true
  }

  function closeWizard() {
    wizardOpen.value = false
    wizardResume.value = null
  }

  function dismissWizard() {
    wizardDismissed.value = true
    wizardOpen.value = false
    wizardResume.value = null
  }

  return {
    openSettings,
    wizardOpen,
    wizardDismissed,
    wizardResume,
    openWizard,
    closeWizard,
    dismissWizard,
  }
}
