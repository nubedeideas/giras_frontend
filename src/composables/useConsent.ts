import { ref } from 'vue'

export type ConsentStatus = 'granted' | 'denied'

const STORAGE_KEY = 'gs_cookie_consent'

// Module-level init runs during SSR too (vite-ssg prerender pass) — localStorage doesn't
// exist in Node, so guard it. The real value is re-read client-side on hydration anyway.
const status = ref<ConsentStatus | null>(
  typeof localStorage === 'undefined'
    ? null
    : ((localStorage.getItem(STORAGE_KEY) as ConsentStatus | null) ?? null)
)

function pushConsentUpdate(value: ConsentStatus) {
  window.gtag?.('consent', 'update', {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  })
}

function accept() {
  status.value = 'granted'
  localStorage.setItem(STORAGE_KEY, 'granted')
  pushConsentUpdate('granted')
}

function reject() {
  status.value = 'denied'
  localStorage.setItem(STORAGE_KEY, 'denied')
  pushConsentUpdate('denied')
}

// Singleton state shared across every component that mounts the banner
export function useConsent() {
  return { status, accept, reject }
}
