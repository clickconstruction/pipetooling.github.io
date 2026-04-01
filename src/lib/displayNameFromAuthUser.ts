import type { User } from '@supabase/supabase-js'

/** Fallback display name before `users.name` loads (Clock button, greetings). */
export function displayNameFromAuthUser(user: User | null | undefined): string | null {
  if (!user) return null
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fromMeta = meta?.full_name ?? meta?.name
  if (typeof fromMeta === 'string') {
    const t = fromMeta.trim()
    if (t) return t
  }
  const email = user.email?.trim()
  if (email) {
    const at = email.indexOf('@')
    if (at > 0) return email.slice(0, at)
    return email
  }
  return null
}
