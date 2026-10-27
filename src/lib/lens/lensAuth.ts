/**
 * The invented person's session (punch list #194): what supabase-js keeps in storage for a
 * signed-in person, and what the auth server says about them. The token is shaped like a real
 * one and signed by nobody, so the real server refuses it and the lens's world never checks it.
 * Pure.
 */
import type { LensPerson } from './lensPeople'

const YEAR = 365 * 24 * 3600

function b64url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function lensAccessToken(p: LensPerson, nowSec: number): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify({ sub: p.id, email: p.email, role: 'authenticated', aud: 'authenticated', iat: nowSec, exp: nowSec + YEAR, aal: 'aal1', session_id: `lens-${p.id}`, is_anonymous: false }))
  return `${header}.${body}.lens`
}

export function lensUser(p: LensPerson) {
  const at = '2026-01-05T15:00:00.000Z'
  return {
    id: p.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: p.email,
    email_confirmed_at: at,
    phone: '',
    confirmed_at: at,
    last_sign_in_at: at,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: p.name },
    identities: [],
    created_at: at,
    updated_at: at,
    is_anonymous: false,
  }
}

export function lensSession(p: LensPerson, nowSec: number) {
  return {
    access_token: lensAccessToken(p, nowSec),
    token_type: 'bearer',
    expires_in: YEAR,
    expires_at: nowSec + YEAR,
    refresh_token: `lens-refresh-${p.id}`,
    user: lensUser(p),
  }
}

/** supabase-js's storage key for a project's session: `sb-<project ref>-auth-token`. */
export function authStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
}

/** The auth server's answer for one request, as status and JSON body. */
export function answerAuth(path: string, method: string, p: LensPerson, nowSec: number): { status: number; body: unknown } {
  if (path === 'user' && method === 'GET') return { status: 200, body: lensUser(p) }
  if (path === 'user' && method === 'PUT') return { status: 200, body: lensUser(p) }
  if (path === 'token') return { status: 200, body: lensSession(p, nowSec) }
  if (path === 'logout') return { status: 204, body: null }
  if (path === 'settings') return { status: 200, body: { external: { email: true }, disable_signup: true, mailer_autoconfirm: false } }
  if (path === '.well-known/jwks.json') return { status: 200, body: { keys: [] } }
  return { status: 400, body: { code: 400, error_code: 'lens_unsupported', msg: `The lens does not sign anyone in or out through /auth/v1/${path}.` } }
}
