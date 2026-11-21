import { apiClient, buildQuery } from '@/utils/apiClient'
import type { ReminderStep } from '@/utils/reminders'
import type {
  AudienceBaseSource,
  GroupSummary,
  StepsSource,
} from '@/composables/useReminderSettings'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de /api/notifications/recipient-overrides/ (spec 2026-11-21-recordatorios-por-tipo-
// y-bajo-demanda.md, §5.2). Errores envueltos con `details.code` (§5.3).

export interface AudiencePerson {
  /** `null` en administradores sin contacto vinculado. */
  contact_uuid: string | null
  name: string
  has_phone: boolean
  has_email: boolean
  has_account: boolean
  /** `group:<uuid>` | `default_group` | `admins` | `added`. */
  sources: string[]
}

export interface RecipientOverride {
  uuid: string
  /** uuid de la actividad, o la actividad resumida en el listado de sugeridas (R3). */
  activity:
    | string
    | { uuid: string; title: string; scheduled_at: string; activity_type_code: string }
  action: 'add' | 'exclude'
  group: GroupSummary | null
  contact: { uuid: string; name: string } | null
  status: 'active' | 'suggested' | 'rejected'
  source: 'manual' | 'ai'
  reason: string
  created_at: string
}

/** GET /api/notifications/recipient-overrides/resolve/?activity=<uuid> */
export interface ActivityAudience {
  activity: { uuid: string; title: string; activity_type_code: string; scheduled_at: string }
  effective_steps: ReminderStep[]
  steps_source: StepsSource
  base_source: AudienceBaseSource
  base_groups: GroupSummary[]
  people: AudiencePerson[]
  /** Solo los `active`. */
  overrides: RecipientOverride[]
  /** `suggested` (R3). */
  suggestions: RecipientOverride[]
  warnings: string[]
}

/** Body de POST /recipient-overrides/: exactamente uno de `group` o `contact`. */
export interface RecipientOverrideCreate {
  activity: string
  action: 'add' | 'exclude'
  group?: string
  contact?: string
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useRecipientOverrides() {
  function resolve(activityUuid: string): Promise<ActivityAudience> {
    const qs = buildQuery({ activity: activityUuid })
    return apiClient.get<ActivityAudience>(`/notifications/recipient-overrides/resolve/?${qs}`, {
      fallback: 'No se han podido cargar los destinatarios',
    })
  }

  /** 201 al crear; 200 si cambia la acción de una existente. */
  function add(payload: RecipientOverrideCreate): Promise<RecipientOverride> {
    return apiClient.post<RecipientOverride>('/notifications/recipient-overrides/', payload, {
      fallback: 'No se ha podido guardar el cambio de destinatarios',
    })
  }

  function remove(uuid: string): Promise<void> {
    return apiClient.delete(`/notifications/recipient-overrides/${uuid}/`, {
      fallback: 'No se ha podido quitar el ajuste',
    })
  }

  return { resolve, add, remove }
}
