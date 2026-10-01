/**
 * Account on the desk, PR C (v2.4344): the one rule for a new sign-in email. The desk's
 * Change… window checks with it before it calls `change-user-email`, and the function checks
 * with it again before it touches the login. Pure, no imports: Deno and Vite both load it.
 */

export function normalizeSignInEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase()
}

export type SignInEmailCheck = { ok: true; email: string; unchanged: boolean } | { ok: false; error: string }

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Is this a new address we can sign them in with? `unchanged` is true when it is the one they have. */
export function checkSignInEmail(current: string | null | undefined, requested: string | null | undefined): SignInEmailCheck {
  const email = normalizeSignInEmail(requested)
  if (!email) return { ok: false, error: 'Type the new email first.' }
  if (!EMAIL_SHAPE.test(email)) return { ok: false, error: 'That email does not look right.' }
  return { ok: true, email, unchanged: normalizeSignInEmail(current) === email }
}

/** An ILIKE pattern that matches exactly this text, so `_` and `%` in an address are not wildcards. */
export function exactIlikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}
