import { describe, expect, it } from 'vitest'
import { formatMoney, formatMoneyDelta } from './money'
import { normSpaces as norm } from '@/test/twilioCosts'


describe('formatMoney', () => {
  it('formats es and en with currency', () => {
    expect(norm(formatMoney('1234.50000', 'USD', 'en'))).toBe('$1,234.50')
    expect(norm(formatMoney('1234.50000', 'USD', 'es'))).toBe('1234,50 US$')
    expect(norm(formatMoney('12.5', 'EUR', 'es'))).toBe('12,50 €')
    expect(norm(formatMoney('0', 'USD', 'en'))).toBe('$0.00')
    expect(norm(formatMoney('-3.2', 'USD', 'en'))).toBe('-$3.20')
  })

  it('uses 4 decimals for amounts under 0.01', () => {
    expect(norm(formatMoney('0.00500', 'USD', 'en'))).toBe('$0.0050')
    expect(norm(formatMoney('0.00500', 'USD', 'es'))).toBe('0,0050 US$')
    expect(norm(formatMoney('-0.0042', 'USD', 'en'))).toBe('-$0.0042')
    expect(norm(formatMoney('0.01', 'USD', 'en'))).toBe('$0.01')
  })

  it('returns dash for null', () => {
    expect(formatMoney(null, 'USD', 'es')).toBe('—')
    expect(formatMoney(undefined, 'USD', 'es')).toBe('—')
    expect(formatMoney('', 'USD', 'es')).toBe('—')
    expect(formatMoney('abc', 'USD', 'es')).toBe('—')
  })

  it('does not throw with a non ISO currency', () => {
    expect(norm(formatMoney('10', 'MIXED', 'en'))).toBe('10.00 MIXED')
  })
})

describe('formatMoneyDelta', () => {
  it('adds an explicit sign', () => {
    expect(norm(formatMoneyDelta('3.00000', '1.00000', 'USD', 'en'))).toBe('+$2.00')
    expect(norm(formatMoneyDelta('1.00000', '3.00000', 'USD', 'en'))).toBe('−$2.00')
    expect(norm(formatMoneyDelta('1.00000', '1.00000', 'USD', 'en'))).toBe('$0.00')
  })
})
