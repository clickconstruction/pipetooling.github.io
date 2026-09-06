/**
 * CountTooling viewer grants — PipeTooling vouches for the sub (2026-09-06).
 *
 * A CountTooling view link (`counttooling.com/app/?t=<token>`) opens with no
 * account but behind an email domain gate that refuses a sub's Gmail. The sub
 * portal already trusts the sub (their portal link is the credential), so the
 * sub-portal function mints a short-lived GRANT signed with a secret both
 * projects hold (`COUNTTOOLING_VIEW_GRANT_SECRET` here, `PT_VIEW_GRANT_SECRET`
 * there) and appends it to the plans link as `&g=`. CountTooling's
 * get-view-project verifies it, skips the gate, and logs the visit under the
 * sub's name.
 *
 * This is the MINT side; the verify side lives in CountTooling
 * (`supabase/functions/_shared/viewGrant.mjs`). Both keep the same wire format
 * and are tested against the same fixtures (`src/lib/viewGrant.test.ts`):
 *   g = base64url(JSON claims) + "." + base64url(HMAC-SHA256(secret, claims-part))
 *   claims = { t, name, email?, person?, via, iat, exp }   (seconds)
 * Dependency-free (Web Crypto) so vitest runs the file Deno runs.
 */

export const VIEW_GRANT_MAX_AGE_SECONDS = 24 * 60 * 60
export const VIEW_GRANT_SOURCE = 'pipetooling-sub-portal'

export type ViewGrantClaims = {
  /** The CountTooling view token the grant is bound to. */
  t: string
  name: string
  email?: string | null
  person?: string | null
  via?: string
  exp?: number
}

const enc = new TextEncoder()

export function base64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

/** Mint a grant. Throws only on a missing secret, token or name — the caller decides whether to fall back to the bare link. */
export async function mintViewGrant(claims: ViewGrantClaims, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  if (!secret) throw new Error('view grant secret missing')
  if (typeof claims.t !== 'string' || !claims.t) throw new Error('view grant needs the view token (t)')
  if (typeof claims.name !== 'string' || !claims.name.trim()) throw new Error('view grant needs a viewer name')
  const body = {
    t: claims.t,
    name: claims.name.trim(),
    email: typeof claims.email === 'string' && claims.email.trim() ? claims.email.trim().toLowerCase() : null,
    person: typeof claims.person === 'string' && claims.person ? claims.person : null,
    via: claims.via && claims.via.trim() ? claims.via : VIEW_GRANT_SOURCE,
    iat: nowSeconds,
    exp: typeof claims.exp === 'number' ? claims.exp : nowSeconds + VIEW_GRANT_MAX_AGE_SECONDS,
  }
  const part = base64urlEncode(enc.encode(JSON.stringify(body)))
  const sig = await hmac(secret, part)
  return `${part}.${base64urlEncode(sig)}`
}

/** Decode a grant's claims without verifying (tests, logs). */
export function parseViewGrantClaims(g: string): Record<string, unknown> | null {
  const dot = g.indexOf('.')
  if (dot <= 0) return null
  try {
    const claims = JSON.parse(new TextDecoder().decode(base64urlDecode(g.slice(0, dot))))
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** The CountTooling view token in a plans link, or null when the link is not one. */
export function countToolingViewToken(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host !== 'counttooling.com' && host !== 'www.counttooling.com' && !host.endsWith('.counttooling.com')) return null
    const t = (u.searchParams.get('t') ?? '').trim()
    return t || null
  } catch {
    return null
  }
}

/** Append `g=` to a plans link (replacing a stale one), keeping the hash where it was. */
export function withViewGrant(url: string, grant: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set('g', grant)
    return u.toString()
  } catch {
    return url
  }
}

/**
 * The one call the sub-portal function makes: a CountTooling view link comes
 * back with a grant for this viewer; any other link (Drive, a PDF) or a missing
 * secret comes back unchanged. Never throws.
 */
export async function grantPlansLink(url: string | null, viewer: { name: string; email?: string | null; person?: string | null }, secret: string | undefined | null, nowSeconds?: number): Promise<string | null> {
  if (!url) return null
  const token = countToolingViewToken(url)
  if (!token || !secret || !viewer.name.trim()) return url
  try {
    const g = await mintViewGrant({ t: token, name: viewer.name, email: viewer.email ?? null, person: viewer.person ?? null }, secret, nowSeconds)
    return withViewGrant(url, g)
  } catch {
    return url
  }
}
