import { apiClient, buildQuery } from '@/utils/apiClient'
import type { Paginated } from '@/types'

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

export function useAdminPayments() {
  function list(query: string | PaymentFilters = {}): Promise<Paginated<PaymentListItem>> {
    const url =
      typeof query === 'string'
        ? query
        : `/admin/payments/?${buildQuery({ page_size: 20, ...query })}`
    return apiClient.get<Paginated<PaymentListItem>>(url, {
      fallback: 'Error al cargar pagos',
    })
  }

  function get(uuid: string): Promise<PaymentDetail> {
    return apiClient.get<PaymentDetail>(`/admin/payments/${uuid}/`, {
      fallback: 'Error al cargar el pago',
    })
  }

  function refund(uuid: string, reason: string): Promise<PaymentDetail> {
    return apiClient.post<PaymentDetail>(
      `/admin/payments/${uuid}/refund/`,
      { reason },
      {
        fallback: 'Error al solicitar el reembolso',
        // 502: la pasarela (Cobry) no respondió; el mensaje del backend no es accionable.
        statusMessages: {
          502: 'La pasarela de pago no ha respondido. Inténtalo de nuevo en unos minutos.',
        },
      }
    )
  }

  return { list, get, refund }
}
