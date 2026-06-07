import { ref } from 'vue'
import { useRouter } from 'vue-router'

export type SettingsTab = 'general' | 'calendars' | 'activities' | 'roles' | 'templates'

// Module-level: shared across all useUIState() calls, reset on page reload
const wizardOpen = ref(false)
const wizardDismissed = ref(false)

export function useUIState() {
  const router = useRouter()

  function openSettings(tab: SettingsTab = 'general') {
    router.push({ path: '/settings', query: { tab } })
  }

  function openWizard() {
    wizardDismissed.value = false
    wizardOpen.value = true
  }

  function closeWizard() {
    wizardOpen.value = false
  }

  function dismissWizard() {
    wizardDismissed.value = true
    wizardOpen.value = false
  }

  return { openSettings, wizardOpen, wizardDismissed, openWizard, closeWizard, dismissWizard }
}
