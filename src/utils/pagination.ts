import type { Paginated } from '@/types'

/** Some endpoints return a raw DRF-paginated envelope, others a plain capped array (e.g. "last 50") */
export function toArray<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results
}
