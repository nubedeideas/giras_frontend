/**
 * Importe con su moneda (`Intl.NumberFormat`), sin conversiones: la moneda es la que devuelve
 * el backend. `null` (o un importe no numérico) → "—". Los importes pequeños (< 0,01 y
 * distintos de 0) usan 4 decimales para que 0,005 no salga como 0,01.
 */
export function formatMoney(
  amount: string | number | null | undefined,
  currency: string,
  locale: string,
  digits = 2
): string {
  if (amount === null || amount === undefined || amount === '') return '—'
  const value = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const fraction = abs > 0 && abs < 0.01 ? Math.max(digits, 4) : digits
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(value)
  } catch {
    // Moneda no ISO (p. ej. "MIXED"): número con el código al lado.
    const n = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(value)
    return currency ? `${n} ${currency}` : n
  }
}

/** Diferencia `current - previous` con signo explícito ("+1,20 US$", "−0,50 US$"). */
export function formatMoneyDelta(
  current: string | null,
  previous: string | null,
  currency: string,
  locale: string
): string {
  const a = Number(current ?? 0)
  const b = Number(previous ?? 0)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '—'
  const diff = Math.round((a - b) * 100000) / 100000
  const formatted = formatMoney(Math.abs(diff), currency, locale)
  if (diff > 0) return `+${formatted}`
  if (diff < 0) return `−${formatted}`
  return formatted
}
