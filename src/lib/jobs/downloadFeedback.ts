/**
 * How long a download button says what it is doing (v2.4584). A packet builds
 * in a fraction of a second, and a label that flips for that long reads as a
 * flicker, not as an answer. The button holds "Downloading…" for at least
 * DOWNLOADING_MIN_MS from the press, then "Downloaded" for DOWNLOADED_HOLD_MS.
 */
export const DOWNLOADING_MIN_MS = 1500
export const DOWNLOADED_HOLD_MS = 2000

export type DownloadPhase = 'idle' | 'busy' | 'done'

/** What is left of the minimum hold once the work is finished; 0 when the work itself took that long. */
export function remainingHoldMs(startedAtMs: number, nowMs: number, minMs: number = DOWNLOADING_MIN_MS): number {
  const elapsed = nowMs - startedAtMs
  if (!Number.isFinite(elapsed) || elapsed < 0) return minMs
  return Math.max(0, minMs - elapsed)
}
