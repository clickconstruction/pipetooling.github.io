/**
 * Pure logic for Continue with Google on the sign-in page (v2.8670, punch list #447).
 *
 * A person who has an account here may sign in with Google in place of the password. The Auth server links a
 * Google sign-in to the login whose address matches, so it lands on the same account, the same role and the
 * same rows, and the password keeps working. Sign-ups are closed on the project, so a Google address that
 * matches no account is refused: nobody gets an account by pressing the button.
 *
 * The press shows only while the project has Google switched on. That switch is the Supabase dashboard's own
 * (Authentication → Sign In / Providers → Google), read from the public settings the Auth server publishes, so
 * turning the provider off there takes the press away with no deploy.
 *
 * This module owns reading that switch, where Google sends the person back to, and the words for a refusal.
 * SignIn.tsx owns the press and the call.
 */

import { SIGN_IN_PATH, signInHrefCarrying } from './signInReturnAddress'

/** Whether the Auth server's public settings say Google is on. Anything else, and anything unreadable, is off. */
export function googleIsOn(settings: unknown): boolean {
  if (settings === null || typeof settings !== 'object') return false
  const external = (settings as { external?: unknown }).external
  if (external === null || typeof external !== 'object') return false
  return (external as { google?: unknown }).google === true
}

/**
 * Where Google sends the person back to: always the sign-in page, carrying the address that was waiting. Signed
 * in, the sign-in route sends them on to it. Refused, this page is where the reason can be said.
 */
export function googleRedirectTo(origin: string, waitingAddress: string | null): string {
  return `${origin}${signInHrefCarrying(waitingAddress) ?? SIGN_IN_PATH}`
}

/** The words for no account behind the Google address. Sign-ups are closed, so the office is the door. */
export const GOOGLE_NO_ACCOUNT_WORDS = 'No account uses that Google address. Sign in with the address the office has for you, or ask the office.'

/**
 * What the address says when Google or the Auth server sent the person back with a refusal, in plain words.
 * Null when there is none. The refusal arrives after the ? or after the #, so both are read.
 */
export function googleRefusalWords(search: string | null | undefined, hash: string | null | undefined): string | null {
  const q = new URLSearchParams(String(search ?? '').replace(/^\?/, ''))
  const f = new URLSearchParams(String(hash ?? '').replace(/^#/, ''))
  const get = (key: string) => q.get(key) ?? f.get(key) ?? ''
  const error = get('error')
  const code = get('error_code')
  const said = get('error_description').replace(/\+/g, ' ').trim()
  if (!error && !code) return null
  if (code === 'signup_disabled' || /signups? not allowed/i.test(said)) return GOOGLE_NO_ACCOUNT_WORDS
  if (code === 'user_banned' || /banned/i.test(said)) return 'This account is turned off. Ask the office.'
  if (error === 'access_denied' && !code) return 'Google did not sign you in, because the sign-in was stopped before it finished. Press Continue with Google to try again.'
  return `Google did not sign you in.${said ? ` ${said.replace(/[.\s]+$/, '')}.` : ''} Press Continue with Google to try again, or use your password.`
}

/** The address with the refusal taken out, so a reload does not say it again. The waiting address (`next`) stays. */
export function withoutGoogleRefusal(search: string | null | undefined): string {
  const q = new URLSearchParams(String(search ?? '').replace(/^\?/, ''))
  for (const key of ['error', 'error_code', 'error_description']) q.delete(key)
  const left = q.toString()
  return left ? `?${left}` : ''
}
