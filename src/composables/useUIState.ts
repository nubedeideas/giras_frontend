import { ref } from 'vue'
import { useRouter } from 'vue-router'

export type SettingsTab = 'general' | 'calendars' | 'activities' | 'roles' | 'templates'

// Module-level: shared across all useUIState() calls
const wizardOpen = ref(false)

export function useUIState() {
  const router = useRouter()

  function openSettings(tab: SettingsTab = 'general') {
    router.push({ path: '/settings', query: { tab } })
  }

  function openWizard() {
    wizardOpen.value = true
  }

  function closeWizard() {
    wizardOpen.value = false
  }

  return { openSettings, wizardOpen, openWizard, closeWizard }
}
