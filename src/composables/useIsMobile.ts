import { onMounted, onUnmounted, ref } from 'vue'

// Mirrors Tailwind's default `lg` breakpoint (1024px), the cutover already
// used app-wide for mobile vs desktop chrome (AppLayout.vue, MobileNav.vue).
export const MOBILE_QUERY = '(max-width: 1023.98px)'

export function useIsMobile() {
  const isMobile = ref(
    typeof window === 'undefined' ? false : window.matchMedia(MOBILE_QUERY).matches
  )

  let mql: MediaQueryList | null = null
  function handleChange(e: MediaQueryListEvent) {
    isMobile.value = e.matches
  }

  onMounted(() => {
    mql = window.matchMedia(MOBILE_QUERY)
    isMobile.value = mql.matches
    mql.addEventListener('change', handleChange)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', handleChange)
  })

  return { isMobile }
}
