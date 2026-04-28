import { useRouter } from 'vue-router'

export type SettingsTab = 'general' | 'calendars' | 'activities' | 'roles' | 'templates'

export function useUIState() {
  const router = useRouter()

  function openSettings(tab: SettingsTab = 'general') {
    router.push({ path: '/settings', query: { tab } })
  }

  return { openSettings }
}
