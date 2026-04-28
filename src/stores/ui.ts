import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AppTheme = 'dark' | 'light'

const STORAGE_KEY = 'gigsync-theme'

function getInitialTheme(): AppTheme {
  const stored = localStorage.getItem(STORAGE_KEY) as AppTheme | null
  if (stored === 'dark' || stored === 'light') return stored
  // Fall back to OS preference
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export const useUIStore = defineStore('ui', () => {
  const theme = ref<AppTheme>(getInitialTheme())

  function applyTheme(t: AppTheme) {
    if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem(STORAGE_KEY, t)
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function setTheme(t: AppTheme) {
    theme.value = t
  }

  // Apply on every change
  watch(theme, applyTheme, { immediate: true })

  return { theme, toggleTheme, setTheme }
})
