import { beforeEach, describe, expect, it } from 'vitest'
import { PENDING_KEY, isGooglePurpose, savePending, takePending } from './googleOAuth'

beforeEach(() => {
  sessionStorage.clear()
})

describe('googleOAuth', () => {
  it('takePending acepta el propósito sheets (F4) y descarta los desconocidos', () => {
    const now = Date.now()
    savePending({ kind: 'connect', state: 'S', purpose: 'sheets', returnTo: '/tour', createdAt: now })
    expect(takePending(now)).toMatchObject({ purpose: 'sheets', returnTo: '/tour' })
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull()

    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ kind: 'connect', state: 'S', purpose: 'drive', createdAt: now })
    )
    expect(takePending(now)?.purpose).toBeUndefined()
  })

  it('isGooglePurpose', () => {
    expect(['calendar', 'contacts', 'sheets'].every(isGooglePurpose)).toBe(true)
    expect(isGooglePurpose('drive')).toBe(false)
    expect(isGooglePurpose(undefined)).toBe(false)
  })
})
