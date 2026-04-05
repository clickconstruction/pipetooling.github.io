/** Visible header / exit control label during impersonation (compact; email local-part if no name). */
export function impersonationExitDisplayLabel(
  profileName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = profileName?.trim()
  if (trimmed) return trimmed
  const e = email?.trim()
  if (e) {
    const at = e.indexOf('@')
    return at > 0 ? e.slice(0, at) : e
  }
  return 'Back'
}

/** Tooltip `title` for the exit control: full name, full email, or short default. */
export function impersonationExitTitle(
  profileName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = profileName?.trim()
  if (trimmed) return trimmed
  const e = email?.trim()
  if (e) return e
  return 'Back to my account'
}

/** Settings banner: who you are viewing as (never the literal word "Back"). */
export function impersonationSignedInAsDescription(
  profileName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = profileName?.trim()
  if (trimmed) return trimmed
  const e = email?.trim()
  if (e) return e
  return 'another user'
}
