/**
 * The one "land on the schedule" rule for assistants returning to the app.
 *
 * Fires only when: the user is an `assistant`, the app has been away longer than the
 * threshold (a cold load or un-backgrounding after a real gap), AND they would otherwise
 * be on the home landing (`/` or `/dashboard`). The home-path guard is what keeps it from
 * pulling someone off a deep link (`/jobs?tab=stages`) or a page they were mid-task on.
 *
 * Dispatch Mode picks the threshold and the destination:
 * - Dispatch Mode ON  → 5 minutes away, any viewport, lands on the Schedule tab
 *   (`/dispatch-mode/schedule`) — the person opted into the dispatch shell.
 * - Dispatch Mode OFF → 1 hour away, phones only, lands on Schedule Dispatch
 *   (`/schedule-dispatch`) — on a desktop an assistant at the dashboard is doing office work.
 *
 * Until v2.3738 a second copy of this rule lived in `Layout.tsx` (the 5-minute Dispatch Mode
 * jump) with no home-path guard, so a cold deep link bounced to the schedule.
 */
import { isAssistantLike } from './subcontractorLikeRole'

/** Away threshold with Dispatch Mode off. */
export const AWAY_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour
/** Away threshold with Dispatch Mode on. */
export const DISPATCH_MODE_AWAY_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

/** Destination with Dispatch Mode off. */
export const DISPATCH_PATH = '/schedule-dispatch'
/** Destination with Dispatch Mode on. */
export const DISPATCH_MODE_SCHEDULE_PATH = '/dispatch-mode/schedule'

const HOME_PATHS: ReadonlySet<string> = new Set(['/', '/dashboard'])

export interface AssistantLandingInput {
  role: string | null
  isMobile: boolean
  pathname: string
  awayMs: number
  /** Layout's `dispatchModeActive` — the toggle, the role gate and Farm Mode already folded in. */
  dispatchMode: boolean
}

export function isHomePath(pathname: string): boolean {
  return HOME_PATHS.has(pathname)
}

export function awayThresholdMs(dispatchMode: boolean): number {
  return dispatchMode ? DISPATCH_MODE_AWAY_THRESHOLD_MS : AWAY_THRESHOLD_MS
}

export function landingPath(dispatchMode: boolean): string {
  return dispatchMode ? DISPATCH_MODE_SCHEDULE_PATH : DISPATCH_PATH
}

export function shouldLandOnDispatch(input: AssistantLandingInput): boolean {
  return (
    isAssistantLike(input.role) &&
    (input.dispatchMode || input.isMobile) &&
    isHomePath(input.pathname) &&
    input.awayMs >= awayThresholdMs(input.dispatchMode)
  )
}

/** The path to navigate to, or null when the rule does not fire. */
export function resolveAssistantLanding(input: AssistantLandingInput): string | null {
  return shouldLandOnDispatch(input) ? landingPath(input.dispatchMode) : null
}

/** Milliseconds since the app was last active. Missing/blank prior timestamp counts as "away". */
export function awayMsSince(lastActiveAt: number | null, now: number): number {
  if (lastActiveAt == null || !Number.isFinite(lastActiveAt)) return Number.POSITIVE_INFINITY
  return Math.max(0, now - lastActiveAt)
}

// ---- last-active stamp (localStorage; best effort) -------------------------------------------

const LAST_ACTIVE_KEY = 'pipetooling:last-active-at'

export function readLastActiveAt(): number | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LAST_ACTIVE_KEY)
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/** Stamp "active now" so the next open within the threshold is not a return. */
export function stampLastActive(now: number = Date.now()): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LAST_ACTIVE_KEY, String(now))
  } catch {
    // localStorage unavailable (private mode) — best effort
  }
}
