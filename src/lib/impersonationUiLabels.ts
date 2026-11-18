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

/** What a screen reader hears on the exit control, wherever it is drawn. */
export const IMPERSONATION_EXIT_ARIA_LABEL = 'Back to your original signed-in account'

/**
 * Where the exit control is drawn (v2.7782, the owner's ask of 2026-11-18). On a phone it was the
 * last press of the header's icon row, where its name was cut off and it ran past the screen's
 * edge. There it now has a line of its own above the header (`ViewAsExitStrip`),
 * so the row under it holds what it holds for anyone else. `phoneWidth` is the screen's width alone:
 * a desk header that collapsed to the phone's shape for want of room still has room for the button,
 * and keeps it in the row. `null` while nobody is being viewed as.
 */
export type ImpersonationExitPlacement = 'strip' | 'header'

export function impersonationExitPlacement(
  impersonating: boolean,
  phoneWidth: boolean,
): ImpersonationExitPlacement | null {
  if (!impersonating) return null
  return phoneWidth ? 'strip' : 'header'
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
