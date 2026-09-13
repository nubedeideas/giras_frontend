import { createI18n } from 'vue-i18n'
import { watch } from 'vue'
import es from './es'
import en from './en'

// Module-level init runs during SSR too (vite-ssg prerender pass) — localStorage/document
// don't exist in Node, so guard them here and in the watcher below.
const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem('locale')
const initialLocale = stored === 'es' || stored === 'en' ? stored : 'es'

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: { es, en },
})

watch(
  () => i18n.global.locale.value,
  (l) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('locale', l)
    if (typeof document !== 'undefined') document.documentElement.lang = l
  },
  { immediate: true }
)

export default i18n
