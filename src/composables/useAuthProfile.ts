import { apiClient } from '@/utils/apiClient'
import { useAuthStore, type AuthUser } from '@/stores/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Campos que acepta PATCH /api/auth/update_me/ (el resto se ignora en el backend). */
export interface UpdateMePayload {
  first_name?: string
  last_name?: string
  timezone?: string
  language?: string
  onboarding_completed?: boolean
  /** E.164 laxo (`^\+?[0-9 ]{7,20}$`); se guarda sin espacios. `''` lo borra. */
  phone_number?: string
}

// ─── Composable ───────────────────────────────────────────────────────────────

/** Perfil del usuario autenticado. El store solo guarda el resultado (`setUser`). */
export function useAuthProfile() {
  /**
   * PATCH /api/auth/update_me/. Lanza `ApiError` (`fieldErrors.phone_number` en un 400 de
   * teléfono). En modo demo no llama a la API: actualiza el usuario en memoria.
   */
  async function updateMe(payload: UpdateMePayload): Promise<AuthUser> {
    const auth = useAuthStore()
    if (auth.isDemoMode) {
      const merged = { ...(auth.user as AuthUser), ...payload } as AuthUser
      auth.setUser(merged)
      return merged
    }
    const data = await apiClient.patch<AuthUser>('/auth/update_me/', payload, {
      fallback: 'No se ha podido guardar',
    })
    auth.setUser(data)
    return data
  }

  return { updateMe }
}
