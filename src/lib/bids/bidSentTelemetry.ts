/**
 * `bid_sent{lane}` telemetry (Tier-2 #20). The version-send ledger already records ledger
 * sends per row; the bid-room first send and the hand stamp had no trace at all. No new table
 * and no migration: every lane records one `ui_nav_clicks` row — control `bid_sent`, target
 * `#lane=<lane>` — the same best-effort channel the Needs-You cards use (v2.2896).
 */
import { recordNavClick } from '../navClickTelemetry'
import type { BidSentLane } from './bidSentDate'

export const BID_SENT_TELEMETRY_CONTROL = 'bid_sent'

/** Pure: the target string for a lane — `#lane=room`. */
export function bidSentTelemetryTarget(lane: BidSentLane): string {
  return `#lane=${lane}`
}

/** Fire-and-forget; never throws (recordNavClick swallows). */
export function recordBidSentLane(userId: string | null | undefined, role: string | null, lane: BidSentLane): void {
  recordNavClick(userId, role, BID_SENT_TELEMETRY_CONTROL, bidSentTelemetryTarget(lane))
}
