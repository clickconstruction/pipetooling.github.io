/**
 * Stale-bundle nudge (v2.1007, improvement-plan item #8): "Not now" on the
 * update pill used to dismiss it until the NEXT deploy — one tap and a phone
 * could ride an old bundle for days (the v2.986 outage tail). Now a dismissed
 * pill re-surfaces on route navigation — a natural between-tasks moment —
 * throttled so it never nags more than once per gap.
 */
export const UPDATE_PILL_RESURFACE_MIN_GAP_MS = 10 * 60 * 1000

export function shouldResurfaceUpdatePill(params: {
  /** An update is downloaded and waiting (onNeedRefresh fired). */
  updateWaiting: boolean
  /** The user dismissed the pill; epoch ms of the dismissal (null = never dismissed). */
  dismissedAtMs: number | null
  nowMs: number
  minGapMs?: number
}): boolean {
  const { updateWaiting, dismissedAtMs, nowMs, minGapMs = UPDATE_PILL_RESURFACE_MIN_GAP_MS } = params
  if (!updateWaiting) return false
  if (dismissedAtMs == null) return false
  return nowMs - dismissedAtMs >= minGapMs
}
