import { createI18n } from 'vue-i18n'
import { watch } from 'vue'
import es from './es'
import en from './en'

const stored = localStorage.getItem('locale')
const initialLocale = stored === 'es' || stored === 'en' ? stored : 'es'

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: { es, en },
})

watch(
  () => i18n.global.locale.value,
  (l) => localStorage.setItem('locale', l)
)

export default i18n
