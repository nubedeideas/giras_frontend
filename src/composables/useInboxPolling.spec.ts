import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { ApiError } from '@/utils/apiClient'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import { INBOX_POLL_MS, useInboxPolling } from './useInboxPolling'

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(v: DocumentVisibilityState) {
  visibility = v
  document.dispatchEvent(new Event('visibilitychange'))
}

const Host = defineComponent({
  setup() {
    useInboxPolling()
    return () => h('div')
  },
})

function setup({ loggedIn = true, demo = false } = {}) {
  const auth = useAuthStore()
  auth.isLoggedIn = loggedIn
  auth.isDemoMode = demo
  const inbox = useInboxStore()
  const refresh = vi.spyOn(inbox, 'refreshCount').mockResolvedValue()
  const reset = vi.spyOn(inbox, 'reset')
  return { auth, inbox, refresh, reset }
}

/** Avanza el reloj y deja resolver las promesas del tick. */
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  localStorage.setItem('gs_access_token', 'access')
  setActivePinia(createPinia())
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useInboxPolling', () => {
  it('polls every 60 s while visible', async () => {
    const { refresh } = setup()
    const w = mount(Host)
    await advance(0)
    expect(refresh).toHaveBeenCalledTimes(1)
    await advance(INBOX_POLL_MS - 1)
    expect(refresh).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(refresh).toHaveBeenCalledTimes(2)
    await advance(INBOX_POLL_MS)
    expect(refresh).toHaveBeenCalledTimes(3)
    w.unmount()
  })

  it('pauses when hidden and refreshes immediately on visible', async () => {
    const { refresh } = setup()
    const w = mount(Host)
    await advance(0)
    expect(refresh).toHaveBeenCalledTimes(1)
    setVisibility('hidden')
    await advance(INBOX_POLL_MS * 5)
    expect(refresh).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    await advance(0)
    expect(refresh).toHaveBeenCalledTimes(2)
    await advance(INBOX_POLL_MS)
    expect(refresh).toHaveBeenCalledTimes(3)
    w.unmount()
  })

  it('does not poll logged out or in demo mode', async () => {
    const out = setup({ loggedIn: false })
    const w1 = mount(Host)
    await advance(INBOX_POLL_MS * 3)
    expect(out.refresh).not.toHaveBeenCalled()
    w1.unmount()

    setActivePinia(createPinia())
    const demo = setup({ demo: true })
    const w2 = mount(Host)
    await advance(INBOX_POLL_MS * 3)
    setVisibility('hidden')
    setVisibility('visible')
    await advance(0)
    expect(demo.refresh).not.toHaveBeenCalled()
    w2.unmount()
  })

  it('backs off on errors up to 5 min and resets after success', async () => {
    const { refresh } = setup()
    refresh
      .mockRejectedValueOnce(new ApiError(500, null)) // t=0
      .mockRejectedValueOnce(new ApiError(0, null)) // t=120
      .mockRejectedValueOnce(new ApiError(500, null)) // t=360
      .mockRejectedValueOnce(new ApiError(500, null)) // t=660
      .mockResolvedValueOnce() // t=960 (tope de 300 s)
      .mockResolvedValue()
    const w = mount(Host)
    await advance(0)
    expect(refresh).toHaveBeenCalledTimes(1)
    await advance(119_999)
    expect(refresh).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(refresh).toHaveBeenCalledTimes(2)
    await advance(240_000)
    expect(refresh).toHaveBeenCalledTimes(3)
    await advance(299_999)
    expect(refresh).toHaveBeenCalledTimes(3)
    await advance(1)
    expect(refresh).toHaveBeenCalledTimes(4)
    await advance(300_000)
    expect(refresh).toHaveBeenCalledTimes(5) // éxito
    await advance(INBOX_POLL_MS)
    expect(refresh).toHaveBeenCalledTimes(6)
    w.unmount()
  })

  it('stops on unrecoverable 401', async () => {
    const { refresh } = setup()
    refresh.mockRejectedValueOnce(new ApiError(401, null))
    const w = mount(Host)
    await advance(INBOX_POLL_MS * 10)
    expect(refresh).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('retries once more after a 401 when the tab becomes visible again', async () => {
    const { refresh } = setup()
    refresh
      .mockRejectedValueOnce(new ApiError(401, null))
      .mockRejectedValueOnce(new ApiError(401, null))
      .mockResolvedValue()
    const w = mount(Host)
    await advance(INBOX_POLL_MS * 3)
    expect(refresh).toHaveBeenCalledTimes(1)

    // Sigue en 401: se vuelve a parar.
    setVisibility('hidden')
    setVisibility('visible')
    await advance(INBOX_POLL_MS * 3)
    expect(refresh).toHaveBeenCalledTimes(2)

    // Ahora el token se ha recuperado: reanuda cada 60 s.
    setVisibility('hidden')
    setVisibility('visible')
    await advance(0)
    expect(refresh).toHaveBeenCalledTimes(3)
    await advance(INBOX_POLL_MS)
    expect(refresh).toHaveBeenCalledTimes(4)
    w.unmount()
  })

  it('stops on logout and on unmount', async () => {
    const { auth, refresh, reset } = setup()
    const w = mount(Host)
    await advance(0)
    expect(refresh).toHaveBeenCalledTimes(1)

    auth.isLoggedIn = false
    await nextTick()
    expect(reset).toHaveBeenCalled()
    await advance(INBOX_POLL_MS * 3)
    expect(refresh).toHaveBeenCalledTimes(1)

    // Vuelve a entrar: reanuda en el acto.
    auth.isLoggedIn = true
    await nextTick()
    await advance(0)
    expect(refresh).toHaveBeenCalledTimes(2)

    w.unmount()
    await advance(INBOX_POLL_MS * 3)
    setVisibility('hidden')
    setVisibility('visible')
    await advance(0)
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
