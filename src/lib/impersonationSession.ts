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
