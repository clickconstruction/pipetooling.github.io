/**
 * Impersonation chrome labels (dev "view as" another account).
 *
 * J26-F6 / C72: the exit control used to read as the impersonated person's bare
 * name at every viewport — tapping "Bryan" silently dropped you back to dev. The
 * control now says what it does: "Exit impersonation (Bryan)", or the compact
 * "Exit (Bryan)" where the header is tight. Pure; no React.
 */

/** Who you are viewing as: profile name, else the email local-part, else null. */
function impersonatedIdentity(
  profileName: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const trimmed = profileName?.trim()
  if (trimmed) return trimmed
  const e = email?.trim()
  if (e) {
    const at = e.indexOf('@')
    return at > 0 ? e.slice(0, at) : e
  }
  return null
}

/**
 * Visible label of the header / Settings exit control. Always names the action;
 * the person rides along in parentheses when known. `compact` (narrow header)
 * drops the word "impersonation" but keeps the verb.
 */
export function impersonationExitDisplayLabel(
  profileName: string | null | undefined,
  email: string | null | undefined,
  opts?: { compact?: boolean },
): string {
  const who = impersonatedIdentity(profileName, email)
  const verb = opts?.compact ? 'Exit' : 'Exit impersonation'
  return who ? `${verb} (${who})` : verb
}

/** Tooltip `title` for the exit control: what happens, with the full name or email. */
export function impersonationExitTitle(
  profileName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = profileName?.trim()
  const e = email?.trim()
  const who = trimmed || e
  return who ? `Stop viewing as ${who} and go back to your own account` : 'Back to your own account'
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
