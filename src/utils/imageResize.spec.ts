import { describe, expect, it } from 'vitest'
import { needsReencode, targetSize } from './imageResize'

describe('targetSize', () => {
  it('horizontal: el ancho pasa a 1600', () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
  })
  it('vertical: el alto pasa a 1600', () => {
    expect(targetSize(3024, 4032)).toEqual({ width: 1200, height: 1600 })
  })
  it('ya pequeña: no se amplía', () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 })
    expect(targetSize(1600, 900)).toEqual({ width: 1600, height: 900 })
  })
  it('acepta otro máximo', () => {
    expect(targetSize(1000, 500, 500)).toEqual({ width: 500, height: 250 })
  })
})

describe('needsReencode', () => {
  const MB = 1024 * 1024
  it('por tamaño en píxeles, en bytes o por formato', () => {
    expect(needsReencode({ type: 'image/jpeg', size: MB }, 1200, 900)).toBe(false)
    expect(needsReencode({ type: 'image/jpeg', size: MB }, 2400, 900)).toBe(true)
    expect(needsReencode({ type: 'image/png', size: 4 * MB + 1 }, 800, 600)).toBe(true)
    expect(needsReencode({ type: 'image/heic', size: MB }, 800, 600)).toBe(true)
  })
})
