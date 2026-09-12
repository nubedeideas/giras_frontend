import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

/** Not enumerated exactly by the backend spec — treated as an open string, only 'completed' is load-bearing (refund eligibility). */
export type PaymentStatus = string

export interface PaymentListItem {
  uuid: string
  user_email: string
  tour_name: string
  tour_uuid: string
  amount: string
  currency: string
  status: PaymentStatus
  authorization_code: string | null
  payment_date: string | null
  created_at: string
}

export interface PaymentDetail extends PaymentListItem {
  notes: string
  subscription_plan: string | null
  user_full_name: string
}

export interface PaymentFilters {
  status?: string
  currency?: string
  search?: string
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  return q.toString()
}

export function useAdminPayments() {
  function auth() {
    return useAuthStore()
  }
  const jsonHeaders = { 'Content-Type': 'application/json' }

  async function list(query: string | PaymentFilters = {}): Promise<Paginated<PaymentListItem>> {
    const url =
      typeof query === 'string'
        ? query
        : `${API_BASE}/admin/payments/?${buildQuery({ page_size: 20, ...query })}`
    const res = await auth().fetchWithAuth(url)
    if (!res.ok) throw new Error('Error al cargar pagos')
    return res.json()
  }

  async function get(uuid: string): Promise<PaymentDetail> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/payments/${uuid}/`)
    if (!res.ok) throw new Error('Error al cargar el pago')
    return res.json()
  }

  async function refund(uuid: string, reason: string): Promise<PaymentDetail> {
    const res = await auth().fetchWithAuth(`${API_BASE}/admin/payments/${uuid}/refund/`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ reason }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (res.status === 502) throw new Error('La pasarela de pago no respondió. Intentá de nuevo en unos minutos.')
      throw new Error(data.detail ?? 'Error al solicitar el reembolso')
    }
    return data
  }

  return { list, get, refund }
}
