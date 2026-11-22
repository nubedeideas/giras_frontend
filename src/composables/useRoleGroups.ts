import { apiClient } from '@/utils/apiClient'
import type { GroupSummary } from '@/composables/useReminderSettings'

// ─── Types ────────────────────────────────────────────────────────────────────
// Contrato de /api/notifications/role-groups/ (spec 2026-11-21-recordatorios-por-tipo-y-bajo-
// demanda.md, §5.1 y §5.2, fase R3). Errores 400 envueltos con `details.code` (§5.3):
// `contact_not_assignable`, `bucket_unknown`, `name_too_long`; 429 por el throttle `ai_suggest`.

export type RoleBucketKey = 'band' | 'technicians' | 'drivers' | 'production'

/** Origen de la propuesta de cada persona: slug de rol, IA o ninguno. */
export type RoleProposalSource = 'role' | 'ai' | 'none'

export interface RoleProposalContact {
  uuid: string
  name: string
  role_text: string
  /** Marcada por defecto (p. ej. `artist` va a Banda sin marcar, D15.2). */
  selected: boolean
  source: RoleProposalSource
  confidence: number | null
}

export interface RoleProposalBucket {
  key: RoleBucketKey
  name: string
  /** Grupo con este `system_key` que ya existe en la gira, si lo hay. */
  existing_group: GroupSummary | null
  contacts: RoleProposalContact[]
}

export interface RoleTypeDestination {
  activity_type_code: string
  buckets: string[]
  /** Además de los grupos, el Equipo de la gira. */
  include_team: boolean
}

/** POST /api/notifications/role-groups/propose/ (sin escrituras). */
export interface RoleGroupsProposal {
  ai_used: boolean
  buckets: RoleProposalBucket[]
  unassigned: { uuid: string; name: string; role_text: string }[]
  type_destinations: RoleTypeDestination[]
}

/** Body de POST /api/notifications/role-groups/apply/. */
export interface RoleGroupsApply {
  tour: string
  /** `name` solo si el usuario lo ha cambiado; `contact_uuids` = contenido final del grupo. */
  groups: { key: string; name?: string; contact_uuids: string[] }[]
  apply_type_destinations: boolean
  type_destinations?: RoleTypeDestination[]
}

export interface RoleGroupsApplyResult {
  groups: GroupSummary[]
  reminder_settings_updated: number
  /** Avisos informativos, p. ej. `tour_team_recreated` (se recreó el "Equipo de la gira"). */
  warnings?: string[]
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useRoleGroups() {
  function propose(tourUuid: string): Promise<RoleGroupsProposal> {
    return apiClient.post<RoleGroupsProposal>(
      '/notifications/role-groups/propose/',
      { tour: tourUuid },
      { fallback: 'No se han podido proponer los grupos por rol' }
    )
  }

  function apply(payload: RoleGroupsApply): Promise<RoleGroupsApplyResult> {
    return apiClient.post<RoleGroupsApplyResult>('/notifications/role-groups/apply/', payload, {
      fallback: 'No se han podido crear los grupos',
    })
  }

  return { propose, apply }
}
