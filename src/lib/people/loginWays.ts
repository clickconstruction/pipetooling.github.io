/**
 * A login's ways in (v2.8671, punch list #447): what the person desk's Ways in row reads and says.
 *
 * A person signs in with their password, with an emailed link, or since v2.8670 with Google. The Auth server
 * keeps one identity a way in. `dev_login_ways` reads them for a dev, and `dev_unlink_google` takes the Google
 * one off. This module turns the read into the row's words. It holds no call.
 */

export type LoginWay = { provider: string; email: string | null; lastSignInAt: string | null; linkedAt: string | null }
export type LoginWays = { hasLogin: boolean; hasPassword: boolean; ways: LoginWay[] }

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

/** The function's answer as the row reads it. Anything unreadable is a login with nothing known about it. */
export function parseLoginWays(json: unknown): LoginWays {
  const body = json !== null && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {}
  const rows = Array.isArray(body.ways) ? (body.ways as unknown[]) : []
  const ways: LoginWay[] = []
  for (const raw of rows) {
    if (raw === null || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const provider = text(r.provider)
    if (!provider) continue
    ways.push({ provider, email: text(r.email), lastSignInAt: text(r.last_sign_in_at), linkedAt: text(r.linked_at) })
  }
  return { hasLogin: body.has_login === true, hasPassword: body.has_password === true, ways }
}

/** The Google way in, when the login has one. */
export function googleWay(ways: LoginWays): LoginWay | null {
  return ways.ways.find((w) => w.provider === 'google') ?? null
}

/** Whether the Google account carries another address than the roster's. A link like that deserves a second look. */
export function googleAddressDiffers(way: LoginWay | null, rosterEmail: string | null | undefined): boolean {
  if (!way?.email || !rosterEmail) return false
  return way.email.trim().toLowerCase() !== rosterEmail.trim().toLowerCase()
}

/** The question before a Google link is taken off. It says what stays and what the person will notice. */
export function unlinkGoogleQuestion(who: string): { message: string; confirmLabel: string } {
  return {
    message: `Take Google off ${who}'s login? Their password and the emailed sign-in link still work, and nothing of theirs changes. They are signed out everywhere and sign in again.`,
    confirmLabel: 'Unlink Google',
  }
}
