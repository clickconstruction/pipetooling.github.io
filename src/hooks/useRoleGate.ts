import { useCallback } from 'react'
import { useToastContext } from '../contexts/ToastContext'
import { recordNavClick } from '../lib/navClickTelemetry'
import {
  ROLE_GATE_TELEMETRY_CONTROL,
  roleGateRedirect,
  type RoleGateDecision,
  type RoleGateSurface,
} from '../lib/roleGate'

/**
 * The one way an in-page role gate refuses a link (journey-map Tier-2 #29).
 *
 *   const { bounce } = useRoleGate(authRole, authUser?.id)
 *   …
 *   if (isAssistant && tab === 'teams-summary') {
 *     const { toTab } = bounce('crew-pnl', '/jobs?tab=teams-summary')
 *     setActiveTab(toTab); setSearchParams(tab → toTab, { replace: true })
 *     return
 *   }
 *
 * `bounce` decides the landing + sentence through the pure kernel, shows the
 * sentence once (quiet for sub-like roles — J24-F8), records one
 * `role_gate_redirect` row in `ui_nav_clicks` (target = the refused link), and
 * hands the decision back so the caller applies its own navigation — tab
 * effects use `setSearchParams`, route-level gates use `navigate`.
 *
 * Toast duration is long enough to read after the page has already changed
 * under the person; the redirect itself never waits on either side effect.
 */

const ROLE_GATE_TOAST_MS = 7000
/** Effects re-run on the params they rewrite; the same refused link within this window speaks once. */
const ANNOUNCE_DEDUPE_MS = 1500

const lastAnnouncedAt = new Map<string, number>()

/** Test hook: forget every recent announcement. */
export function resetRoleGateAnnouncements(): void {
  lastAnnouncedAt.clear()
}

function shouldAnnounce(key: string, nowMs: number): boolean {
  const last = lastAnnouncedAt.get(key)
  if (last != null && nowMs - last < ANNOUNCE_DEDUPE_MS) return false
  lastAnnouncedAt.set(key, nowMs)
  return true
}

export function useRoleGate(role: string | null | undefined, userId: string | null | undefined) {
  const { showToast } = useToastContext()

  const bounce = useCallback(
    (surface: RoleGateSurface, from: string): RoleGateDecision => {
      const decision = roleGateRedirect({ from, role, surface })
      if (shouldAnnounce(`${role ?? ''}|${from}`, Date.now())) {
        if (!decision.quiet && decision.toast) showToast(decision.toast, 'info', ROLE_GATE_TOAST_MS)
        recordNavClick(userId, role ?? null, ROLE_GATE_TELEMETRY_CONTROL, from)
      }
      return decision
    },
    [role, userId, showToast],
  )

  return { bounce }
}
