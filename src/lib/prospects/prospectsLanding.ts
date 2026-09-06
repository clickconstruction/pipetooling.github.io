/**
 * Where `/prospects` lands when the URL names no `?tab=` (v2.2910, journey-map
 * J25-F1). The page has two top-level pipelines — Customers (the cold-call
 * deck with its timer) and Hiring (the prospective-hires board, per-user
 * `users.team_prospects_access`). Before this kernel every cold landing went to
 * the calling deck, so a hiring-only user was handed a live prospect card and a
 * running timer with the Hiring pill a small button away.
 *
 * Rules, in order:
 * 1. Holds Hiring but cannot work the customer pipeline → Hiring. The deck would
 *    render its "no access" state anyway.
 * 2. No Hiring access → the calling deck (the only pipeline they have).
 * 3. Holds both → wherever they last chose (remembered per browser); the calling
 *    deck when nothing is remembered, because callers with a Hiring grant are
 *    still callers first.
 */
export type ProspectsLandingTab = 'follow-up' | 'team'

/** localStorage key for rule 3. Written on explicit top-tab clicks only, never on URL-driven landings. */
export const PROSPECTS_LAST_TOP_TAB_KEY = 'prospects:lastTopTab'

export type ProspectsLandingInput = {
  /** `canAccessProspectPipeline(role, estimatorProspectsAccess)` — may the viewer work the customer deck? */
  canAccessFollowUp: boolean
  /** `users.team_prospects_access` — may the viewer open the Hiring board? */
  teamProspectsAccess: boolean
  /** Last top tab the viewer clicked, if the browser remembers one. */
  remembered?: string | null
}

export function resolveProspectsLanding(input: ProspectsLandingInput): ProspectsLandingTab {
  if (!input.teamProspectsAccess) return 'follow-up'
  if (!input.canAccessFollowUp) return 'team'
  return input.remembered === 'team' ? 'team' : 'follow-up'
}

/** Best-effort read of the remembered top tab — storage can be absent or throw (private windows, blocked site data). */
export function readRememberedProspectsTopTab(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(PROSPECTS_LAST_TOP_TAB_KEY)
  } catch {
    return null
  }
}

export function rememberProspectsTopTab(tab: ProspectsLandingTab): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PROSPECTS_LAST_TOP_TAB_KEY, tab)
  } catch {
    // Storage is a convenience; landing still resolves without it.
  }
}
