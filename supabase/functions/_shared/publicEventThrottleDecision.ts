/**
 * The pure decision half of the public-telemetry throttle (v2.2697). Dependency-free on
 * purpose: src/lib/publicEventThrottle.test.ts imports it straight into the app's tsc
 * program (the ctRosterDiff pattern), so nothing here may reach for a Deno URL import —
 * that lives in publicEventThrottle.ts, which does the counting and calls this.
 *
 *   duplicate — the identical event (same subject, option, IP) inside DEDUPE_MS is dropped;
 *               a person re-tapping the same card within half a minute is one signal.
 *   rate cap  — more than IP_CAP events from one IP on one subject inside CAP_WINDOW_MS is
 *               dropped; four options × a curious human never approaches it, a loop does.
 */
export const PUBLIC_EVENT_DEDUPE_MS = 30_000
export const PUBLIC_EVENT_IP_CAP = 60
export const PUBLIC_EVENT_CAP_WINDOW_MS = 10 * 60_000

export type PublicEventGateDecision = { record: true; reason: 'ok' } | { record: false; reason: 'duplicate' | 'rate_cap' }

/** The decision, given the two counts. */
export function decidePublicEvent(counts: { identicalRecent: number; fromIpInWindow: number }): PublicEventGateDecision {
  if (counts.identicalRecent > 0) return { record: false, reason: 'duplicate' }
  if (counts.fromIpInWindow >= PUBLIC_EVENT_IP_CAP) return { record: false, reason: 'rate_cap' }
  return { record: true, reason: 'ok' }
}
