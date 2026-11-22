import { afterEach, describe, expect, it, vi } from 'vitest'
import * as datetime from '@/utils/datetime'
import { COMMON_TIMEZONES, defaultTourZone, isValidZone, zoneOptions } from './timezones'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('defaultTourZone', () => {
  it('con el navegador en UTC propone Europe/Madrid', () => {
    vi.spyOn(datetime, 'browserZone').mockReturnValue('UTC')
    expect(defaultTourZone()).toBe('Europe/Madrid')
  })

  it('con Etc/UTC o una zona inválida, también Madrid', () => {
    vi.spyOn(datetime, 'browserZone').mockReturnValue('Etc/UTC')
    expect(defaultTourZone()).toBe('Europe/Madrid')
    vi.spyOn(datetime, 'browserZone').mockReturnValue('Marte/Olympus')
    expect(defaultTourZone()).toBe('Europe/Madrid')
  })

  it('usa la del navegador si es una zona real', () => {
    vi.spyOn(datetime, 'browserZone').mockReturnValue('America/Bogota')
    expect(defaultTourZone()).toBe('America/Bogota')
  })
})

describe('zoneOptions', () => {
  it('añade al principio la zona que falta', () => {
    const opts = zoneOptions('Asia/Tokyo')
    expect(opts[0]).toBe('Asia/Tokyo')
    expect(opts).toHaveLength(COMMON_TIMEZONES.length + 1)
  })

  it('no duplica una zona que ya está', () => {
    expect(zoneOptions('Europe/Madrid')).toEqual([...COMMON_TIMEZONES])
    expect(zoneOptions()).toEqual([...COMMON_TIMEZONES])
  })

  it('incluye las nuevas zonas europeas y americanas', () => {
    for (const z of ['Europe/Lisbon', 'America/Santiago', 'America/Chicago']) {
      expect(COMMON_TIMEZONES).toContain(z)
    }
    expect(COMMON_TIMEZONES.every(isValidZone)).toBe(true)
  })
})
