/**
 * Throttle for the public, token-gated telemetry writes (v2.2697): option views on the
 * estimate acceptance page and in the bid room. Both endpoints are deliberately best-effort
 * (always 200, never block browsing), which also meant anyone holding a link — a replaying
 * mail scanner, a forwarded link, a stuck tab — could insert without bound and litter the
 * activity feed the office reads. The decision is pure and lives in
 * publicEventThrottleDecision.ts (unit-tested from src/lib); this file only counts and calls it:
 *
 *   duplicate — the identical event (same subject, option, IP) inside DEDUPE_MS is dropped;
 *               a person re-tapping the same card within half a minute is one signal.
 *   rate cap  — more than IP_CAP events from one IP on one subject inside CAP_WINDOW_MS is
 *               dropped; four options × a curious human never approaches it, a loop does.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  PUBLIC_EVENT_CAP_WINDOW_MS,
  PUBLIC_EVENT_DEDUPE_MS,
  decidePublicEvent,
  type PublicEventGateDecision,
} from './publicEventThrottleDecision.ts'

export { PUBLIC_EVENT_CAP_WINDOW_MS, PUBLIC_EVENT_DEDUPE_MS, PUBLIC_EVENT_IP_CAP, decidePublicEvent } from './publicEventThrottleDecision.ts'
export type { PublicEventGateDecision } from './publicEventThrottleDecision.ts'

/**
 * Run the two counts against an events table and decide. `subjectColumn` is the FK that
 * scopes the subject (estimate_id / room_id). A missing IP still dedupes on the option
 * alone within the window — better to under-count a NAT'd office than to spam.
 */
export async function publicEventGate(
  admin: SupabaseClient,
  args: {
    table: 'estimate_customer_events' | 'bid_proposal_room_events'
    subjectColumn: 'estimate_id' | 'room_id'
    subjectId: string
    eventType: string
    optionKey: string
    clientIp: string | null
    now?: Date
  },
): Promise<PublicEventGateDecision> {
  const now = args.now ?? new Date()
  const dedupeSince = new Date(now.getTime() - PUBLIC_EVENT_DEDUPE_MS).toISOString()
  const capSince = new Date(now.getTime() - PUBLIC_EVENT_CAP_WINDOW_MS).toISOString()
  try {
    let dup = admin
      .from(args.table)
      .select('id', { count: 'exact', head: true })
      .eq(args.subjectColumn, args.subjectId)
      .eq('event_type', args.eventType)
      .eq('metadata->>option_key', args.optionKey)
      .gte('occurred_at', dedupeSince)
    if (args.clientIp) dup = dup.eq('client_ip', args.clientIp)
    let cap = admin
      .from(args.table)
      .select('id', { count: 'exact', head: true })
      .eq(args.subjectColumn, args.subjectId)
      .gte('occurred_at', capSince)
    if (args.clientIp) cap = cap.eq('client_ip', args.clientIp)
    const [d, c] = await Promise.all([dup, cap])
    return decidePublicEvent({ identicalRecent: d.count ?? 0, fromIpInWindow: c.count ?? 0 })
  } catch (e) {
    // The gate must never turn a telemetry write into an error; on a failed count, record.
    console.error('publicEventGate', e)
    return { record: true, reason: 'ok' }
  }
}
