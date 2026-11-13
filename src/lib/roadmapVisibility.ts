import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike } from './subcontractorLikeRole'
import { isOfficeRole } from './doorRoles'

/**
 * Who can open the Roadmap page (journey-map Tier-2 #41) — and anything that
 * deep-links into it (the Review/Manage "Open roadmap →" affordances, the
 * Where-this-fits sheet's footer link).
 *
 * The set mirrors what RLS already lets these roles READ AND EDIT on every
 * roadmap (`is_checklist_tech_tree_staff_or_primary()`: dev, master,
 * assistant-like, primary). Before v2.NNNN the page was a dev-only client lens
 * over that same data — master/assistant/primary could edit roadmap tasks from
 * Review's Where-this-fits sheet and saw the GOALS strip, but had no door to the
 * roadmap itself. This function is the one place that decides the door; every
 * surface that points at the roadmap reads it.
 *
 * Task Mode hides the door for everyone — the mode is "one page, the daily
 * list"; the Layout bounce lands the person on `/checklist` and the on-page
 * chip says how to leave.
 */
export function canOpenRoadmap(role: UserRole | null | undefined, taskModeEnabled: boolean): boolean {
  if (taskModeEnabled) return false
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
}

/**
 * The roadmap "needs a person" card on the Dashboard / Quickfill Needs-You
 * stack: the office's since v2.6758 (punch list #188 row 37; the page widened
 * in v2.2916 and the card did not, a dev's alone until then). Never under Farm
 * Mode; `dashboardNeedsYou.ts` enforces the same rule structurally through
 * `kind: 'roadmap'`.
 */
export function canSeeRoadmapNeedsYou(role: UserRole | null | undefined, taskModeEnabled: boolean): boolean {
  return isOfficeRole(role) && canOpenRoadmap(role, taskModeEnabled)
}

export const ROADMAP_PATH = '/roadmap'

export type RoadmapView = 'map' | 'plan' | 'timeline'

/** `/roadmap`, `/roadmap?roadmap=<id>`, `/roadmap?roadmap=<id>&view=plan` — the one way to build a roadmap link. */
export function roadmapPath(roadmapId?: string | null, view?: RoadmapView | string | null): string {
  const params = new URLSearchParams()
  if (roadmapId) params.set('roadmap', roadmapId)
  if (view) params.set('view', view)
  const qs = params.toString()
  return qs ? `${ROADMAP_PATH}?${qs}` : ROADMAP_PATH
}
