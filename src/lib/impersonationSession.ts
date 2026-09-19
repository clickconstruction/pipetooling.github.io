import type { CSSProperties } from 'react'

/** Matches [`loginAsUser`](./loginAsUser.ts) stash for restoring the operator session after impersonation. */
export const IMPERSONATION_ORIGINAL_STORAGE_KEY = 'impersonation_original'

/** Shared palette for header “Back” and other impersonation-context controls ([`Layout.tsx`](../components/Layout.tsx)). */
export const IMPERSONATION_CHROME_BUTTON_STYLE: CSSProperties = {
  padding: '0.35rem 0.75rem',
  background: 'var(--bg-amber-100)',
  color: 'var(--text-amber-800)',
  border: '1px solid #f59e0b',
  borderRadius: 4,
  fontWeight: 600,
}

/** What `loginAsUser` stashes: the operator's tokens and, since v2.3606, the page they left. */
export type ImpersonationStash = { access_token?: string; refresh_token?: string; returnTo?: string }

export function readImpersonationStash(raw: string | null | undefined): ImpersonationStash | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    return v && typeof v === 'object' ? (v as ImpersonationStash) : null
  } catch {
    return null
  }
}

/**
 * Where Exit lands (v2.3606): the page the operator left, when the stash carries one on this
 * origin; the dashboard otherwise (an older stash, a foreign origin, a sign-in page).
 */
export function impersonationReturnPath(stash: ImpersonationStash | null, origin: string): string {
  const raw = stash?.returnTo?.trim()
  if (!raw) return '/dashboard'
  // Only an absolute URL on this origin or a root-relative path — never a bare string the URL
  // parser would happily resolve against the origin.
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/')) return '/dashboard'
  try {
    const u = new URL(raw, origin)
    if (u.origin !== origin) return '/dashboard'
    const path = `${u.pathname}${u.search}${u.hash}`
    if (/^\/(sign-in|dev-login|auth)/.test(u.pathname)) return '/dashboard'
    return path || '/dashboard'
  } catch {
    return '/dashboard'
  }
}

/** True when localStorage holds the pre-impersonation session (dev "login as user" flow). */
export function isImpersonationSessionActive(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = localStorage.getItem(IMPERSONATION_ORIGINAL_STORAGE_KEY)
    return Boolean(v && v.length > 0)
  } catch {
    return false
  }
}
