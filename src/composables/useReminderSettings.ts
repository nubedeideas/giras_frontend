import { apiClient, buildQuery } from '@/utils/apiClient'
import type { ReminderLimits, ReminderStep } from '@/utils/reminders'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de /api/notifications/reminder-settings/ (spec 2026-11-21-recordatorios-por-tipo-y-
// bajo-demanda.md, §5.2). Errores envueltos con `details.code` (§5.3): ver `apiErrorCode`.

export type { ReminderChannel, ReminderStep } from '@/utils/reminders'

export type StepsSource = 'tour' | 'user' | 'legacy'
export type AudienceBaseSource = 'type_groups' | 'default_group' | 'admins'

export interface GroupSummary {
  uuid: string
  name: string
  contact_count: number
  system_key: string | null
  is_default: boolean
}

/** Un tipo de actividad en la gira (fila de `types` del catálogo y respuesta del POST). */
export interface ReminderTypeSetting {
  activity_type_code: string
  name: string
  category: string
  icon: string
  color: string
  /** Plantilla del usuario. */
  template_steps: ReminderStep[]
  /** `null` = hereda la plantilla; `[]` = sin recordatorios en esta gira. */
  tour_steps: ReminderStep[] | null
  effective_steps: ReminderStep[]
  steps_source: StepsSource
  /** Destinos del tipo en la gira (vacío = base por defecto). */
  groups: GroupSummary[]
  base_source: AudienceBaseSource
  /** Regla `activity_upcoming` legada con `replaces_default_reminders`. */
  replaced_by_legacy_rule: boolean
  warnings: string[]
}

export interface ReminderPlanUsage {
  limit: number
  used: number
  remaining: number
  percentage: number
  is_unlimited: boolean
}

export interface ReminderEstimate {
  activities: number
  whatsapp: number
  email: number
  in_app: number
  cost_usd: number
  first_send_at: string | null
  approximate: true
}

/** GET /api/notifications/reminder-settings/?tour=<uuid>&estimate=1 */
export interface ReminderCatalog {
  tour: { uuid: string; name: string }
  default_group: GroupSummary | null
  /** Asignables: de la gira y globales visibles. */
  groups: GroupSummary[]
  types: ReminderTypeSetting[]
  limits: ReminderLimits
  /** `null` si la gira no tiene suscripción: el backend no limita ni cobra cupo. */
  plan: ReminderPlanUsage | null
  estimate?: ReminderEstimate
}

/** Body de POST /api/notifications/reminder-settings/ (upsert por `tour` + código). */
export interface ReminderSettingUpsert {
  tour: string
  activity_type_code: string
  steps: ReminderStep[] | null
  /** Omitido = no se tocan los grupos. */
  group_uuids?: string[]
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useReminderSettings() {
  function getCatalog(
    tourUuid: string,
    { estimate = false }: { estimate?: boolean } = {}
  ): Promise<ReminderCatalog> {
    const qs = buildQuery({ tour: tourUuid, estimate: estimate ? 1 : undefined })
    return apiClient.get<ReminderCatalog>(`/notifications/reminder-settings/?${qs}`, {
      fallback: 'No se han podido cargar los recordatorios de la gira',
    })
  }

  /** 200 si la fila existía, 201 si se crea; en ambos casos devuelve el tipo recalculado. */
  function upsert(payload: ReminderSettingUpsert): Promise<ReminderTypeSetting> {
    return apiClient.post<ReminderTypeSetting>('/notifications/reminder-settings/', payload, {
      fallback: 'No se han podido guardar los recordatorios',
    })
  }

  return { getCatalog, upsert }
}
