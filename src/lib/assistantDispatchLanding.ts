/**
 * Decide whether a mobile assistant returning to the app should land on the Dispatch page.
 *
 * Fires only when: the user is an `assistant`, on mobile, the app has been away longer than
 * the threshold (a cold load or un-backgrounding after a real gap), AND they would otherwise
 * be on the home landing (`/` or `/dashboard`). The home-path guard is what keeps it from
 * pulling someone off a deep link or a page they were mid-task on.
 */
export const AWAY_THRESHOLD_MS = 60 * 60 * 1000 // ~1 hour

export const DISPATCH_PATH = '/schedule-dispatch'

const HOME_PATHS: ReadonlySet<string> = new Set(['/', '/dashboard'])

export function shouldLandOnDispatch(input: {
  role: string | null
  isMobile: boolean
  pathname: string
  awayMs: number
}): boolean {
  return (
    input.role === 'assistant' &&
    input.isMobile &&
    HOME_PATHS.has(input.pathname) &&
    input.awayMs >= AWAY_THRESHOLD_MS
  )
}

/** Milliseconds since the app was last active. Missing/blank prior timestamp counts as "away". */
export function awayMsSince(lastActiveAt: number | null, now: number): number {
  if (lastActiveAt == null || !Number.isFinite(lastActiveAt)) return Number.POSITIVE_INFINITY
  return Math.max(0, now - lastActiveAt)
}
