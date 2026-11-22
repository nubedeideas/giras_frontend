/** Iniciales para el avatar: nombre + apellido; sin nombre, la primera letra del email. */
export function userInitials(
  user: { first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined
): string {
  if (!user) return ''
  const fromName = `${user.first_name?.trim().charAt(0) ?? ''}${user.last_name?.trim().charAt(0) ?? ''}`
  return (fromName || user.email?.trim().charAt(0) || '').toUpperCase()
}
