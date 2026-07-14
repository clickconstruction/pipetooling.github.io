import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike } from './subcontractorLikeRole'

export const DASHBOARD_CLOCK_STRIP_SCOPE_KEY = 'dashboard_clock_strip_scope'

export function stripScopeEligible(role: UserRole | null): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

/** Explicit stored preference wins; missing key defaults org-wide for dev/master/assistant. */
export function readClockStripScopeFromStorage(role: UserRole | null): 'team' | 'everyone' {
  try {
    if (typeof localStorage === 'undefined') {
      return stripScopeEligible(role) ? 'everyone' : 'team'
    }
    const v = localStorage.getItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY)
    if (v === 'everyone') return 'everyone'
    if (v === 'team') return 'team'
    return stripScopeEligible(role) ? 'everyone' : 'team'
  } catch {
    return stripScopeEligible(role) ? 'everyone' : 'team'
  }
}
