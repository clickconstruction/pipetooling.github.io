/**
 * Server-side per-GC outcome writes for the Bid Room (Signable Bids Phase 2, v2.2470) — the
 * Deno port of src/lib/bids/gcPacketOutcome.ts + gcPackets.rollUpOutcome, driven by a GC's
 * signature or decline instead of a staff click. Dependency-free decision core (tested from
 * src/lib for parity); the write half takes a minimal client so the sign function can pass its
 * service-role client.
 */

export type OutcomeVersionRow = {
  id: string
  customer_id: string | null
  outcome: string | null
  sent_on: string | null
}

/** gcPackets.rollUpOutcome, verbatim semantics. */
export function roomRollUpOutcome(packets: ReadonlyArray<{ outcome: string | null; sentOn: string | null }>): 'won' | 'lost' | null {
  if (packets.some((p) => p.outcome === 'won')) return 'won'
  const sent = packets.filter((p) => p.sentOn || p.outcome)
  if (sent.length > 0 && sent.every((p) => p.outcome === 'lost')) return 'lost'
  return null
}

export type RoomOutcomePlan = {
  /** The signing/declining GC's version ids. */
  packetVersionIds: string[]
  /** Version ids of OTHER sent, unanswered packets that a win auto-marks lost. */
  autoLostVersionIds: string[]
  /** What bids.outcome should become, or null to leave it. */
  bidOutcomeSet: 'won' | 'lost' | null
}

/**
 * Decide every write for a room outcome. `roomCustomerId` null = the bid's own GC (versions
 * with no customer_id). Mirrors setGcPacketOutcome: a win auto-loses other sent unanswered
 * packets; the bid-level outcome only moves when not already decided (a GC win always wins).
 */
export function planRoomOutcome(args: {
  outcome: 'won' | 'lost'
  roomCustomerId: string | null
  versions: OutcomeVersionRow[]
  bidOutcome: string | null
}): RoomOutcomePlan {
  // Unsplit bid (no bid_versions rows — the common single-GC case): the packet IS the bid, so
  // the outcome lands on bids.outcome directly, same decided rules as the roll-up. Found by the
  // live E2E (v2.2476): ZZ Twin Test 1 signatures/declines wrote nothing at all.
  if (args.versions.length === 0) {
    const decided = args.bidOutcome === 'won' || args.bidOutcome === 'lost' || args.bidOutcome === 'started_or_complete'
    let bidOutcomeSet: 'won' | 'lost' | null = null
    if (args.outcome === 'won' && args.bidOutcome !== 'won' && args.bidOutcome !== 'started_or_complete') bidOutcomeSet = 'won'
    else if (args.outcome === 'lost' && !decided) bidOutcomeSet = 'lost'
    return { packetVersionIds: [], autoLostVersionIds: [], bidOutcomeSet }
  }
  const packetOf = (v: OutcomeVersionRow) => v.customer_id ?? null
  const groups = new Map<string | null, OutcomeVersionRow[]>()
  for (const v of args.versions) {
    const k = packetOf(v)
    groups.set(k, [...(groups.get(k) ?? []), v])
  }
  const mine = groups.get(args.roomCustomerId) ?? []
  const packetVersionIds = mine.map((v) => v.id)

  const autoLostVersionIds: string[] = []
  if (args.outcome === 'won') {
    for (const [k, vs] of groups) {
      if (k === args.roomCustomerId) continue
      const anyOutcome = vs.some((v) => v.outcome != null)
      const anySent = vs.some((v) => v.sent_on != null)
      if (!anyOutcome && anySent) autoLostVersionIds.push(...vs.map((v) => v.id))
    }
  }

  const packetsAfter = [...groups.entries()].map(([k, vs]) => {
    const sentOn = vs.map((v) => v.sent_on).filter((x): x is string => !!x).sort().reverse()[0] ?? null
    let outcome = vs.find((v) => v.outcome)?.outcome ?? null
    if (k === args.roomCustomerId) outcome = args.outcome
    else if (args.outcome === 'won' && vs.some((v) => autoLostVersionIds.includes(v.id))) outcome = 'lost'
    return { outcome, sentOn }
  })
  const roll = roomRollUpOutcome(packetsAfter)
  const decided = args.bidOutcome === 'won' || args.bidOutcome === 'lost' || args.bidOutcome === 'started_or_complete'
  let bidOutcomeSet: 'won' | 'lost' | null = null
  if (roll === 'won' && args.bidOutcome !== 'won' && args.bidOutcome !== 'started_or_complete') bidOutcomeSet = 'won'
  else if (roll === 'lost' && !decided) bidOutcomeSet = 'lost'
  return { packetVersionIds, autoLostVersionIds, bidOutcomeSet }
}

/** Loss categories a GC may self-select on the decline path (staff-only reasons excluded). */
export const ROOM_DECLINE_CATEGORIES = ['price', 'other_sub', 'project_died'] as const
export function isRoomDeclineCategory(v: unknown): v is (typeof ROOM_DECLINE_CATEGORIES)[number] {
  return typeof v === 'string' && (ROOM_DECLINE_CATEGORIES as readonly string[]).includes(v)
}
