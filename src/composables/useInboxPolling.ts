import { onBeforeUnmount, onMounted, watch } from 'vue'
import { ApiError } from '@/utils/apiClient'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'

export const INBOX_POLL_MS = 60_000
export const INBOX_POLL_MAX_MS = 300_000

/**
 * Polling del contador del inbox. Lo monta una sola vez `AppLayout`.
 *
 * - Cada 60 s con la pestaña visible; oculta, se para, y al volver refresca en el acto.
 * - Nada sin sesión ni en modo demo. Al cerrar sesión, para y vacía el store.
 * - Ante errores dobla la espera (60 → 120 → 240 → 300 s) y vuelve a 60 s tras un éxito.
 *   Un 401 que `fetchWithAuth` no ha podido recuperar para el polling hasta que la pestaña
 *   vuelve a estar visible (un intento más) o hasta el próximo login.
 *
 * Todo el acceso a `document` va dentro de `onMounted` (vite-ssg prerenderiza en Node).
 */
export function useInboxPolling() {
  const auth = useAuthStore()
  const inbox = useInboxStore()

  let timer: ReturnType<typeof setTimeout> | null = null
  let delay = INBOX_POLL_MS
  let mounted = false
  let halted = false
  let inflight = false

  const canPoll = () => mounted && !halted && auth.isLoggedIn && !auth.isDemoMode
  const isHidden = () => document.visibilityState === 'hidden'

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function schedule() {
    clearTimer()
    if (!canPoll() || isHidden()) return
    timer = setTimeout(tick, delay)
  }

  async function tick() {
    timer = null
    if (!canPoll() || inflight) return
    inflight = true
    try {
      await inbox.refreshCount()
      delay = INBOX_POLL_MS
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        halted = true
      } else {
        delay = Math.min(delay * 2, INBOX_POLL_MAX_MS)
      }
    } finally {
      inflight = false
    }
    schedule()
  }

  function onVisibilityChange() {
    if (isHidden()) {
      clearTimer()
      return
    }
    clearTimer()
    // Un intento más al volver: un 401 por un refresco de token caído por red no debe dejar el
    // polling parado toda la sesión. Si sigue siendo 401, se vuelve a parar.
    halted = false
    void tick()
  }

  watch(
    () => [auth.isLoggedIn, auth.isDemoMode] as const,
    ([loggedIn, demo]) => {
      clearTimer()
      if (!loggedIn || demo) {
        inbox.reset()
        return
      }
      halted = false
      delay = INBOX_POLL_MS
      if (mounted && !isHidden()) void tick()
    }
  )

  onMounted(() => {
    mounted = true
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (!isHidden()) void tick()
  })

  onBeforeUnmount(() => {
    mounted = false
    clearTimer()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
}
