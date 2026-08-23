/**
 * Per-GC outcome rows (Bids by GC, v2.2164): one row per GC a bid went to, with the outcome that
 * GC's packet resolves to. Builder stats (Call queue, By builder, Map focus, call session) and the
 * Why-we-lost / Waiting-to-hear lenses read these instead of the bid's outcome, so a bid won with one
 * GC and lost with another counts as a win for one builder and a loss for the other.
 *
 * Resolution, per packet of a bid with ≥2 real packets:
 *   explicit packet outcome → that;
 *   no packet on the bid has an outcome → the bid's outcome (legacy / unchanged behavior);
 *   another packet won → lost, reason `gc_lost` unless recorded (the winner got the project) — also
 *   the inferred reason for a packet already marked lost beside that win;
 *   otherwise → pending if sent, unsent if not.
 * Single-packet bids and "Also sent to" shared-letter packets take the bid's outcome. Pure.
 */
import type { GcPacket } from './gcPackets'

export type GcOutcomeKind = 'won' | 'lost' | 'pending' | 'unsent'

export type GcOutcomeBidLike = {
  id: string
  outcome: string | null
  bid_date_sent: string | null
  bid_value: number | string | null
  loss_category?: string | null
  loss_reason?: string | null
}

export type GcOutcomeRow = {
  bidId: string
  /** Customer id of the GC; the bid's own builder key when the packet has no GC id. */
  gcKey: string
  gcName: string
  /** `GcPacket.key` when the row comes from a packet; null for the plain bid-level row. */
  packetKey: string | null
  versionIds: string[]
  outcome: GcOutcomeKind
  /** True when the outcome / reason are the packet's own (explicit or inferred from a sibling win). */
  perGc: boolean
  sentOn: string | null
  value: number
  lossCategory: string | null
  lossNote: string | null
  /** True when `lossCategory` was inferred from a sibling win (nothing recorded on the packet yet). */
  reasonInferred: boolean
  /** The other GCs on the same bid and what they did — for the "also went to" line. */
  siblings: Array<{ gcKey: string; gcName: string; outcome: GcOutcomeKind }>
  /** "Also sent to" GC with no packet of its own (same letter as the bid's GC). */
  sharedLetter: boolean
}

export function classifyBidOutcome(bid: { outcome: string | null; bid_date_sent: string | null }): GcOutcomeKind {
  if (bid.outcome === 'won' || bid.outcome === 'started_or_complete') return 'won'
  if (bid.outcome === 'lost') return 'lost'
  return bid.bid_date_sent ? 'pending' : 'unsent'
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v) : v ?? 0
  return Number.isFinite(n) ? (n as number) : 0
}

/**
 * Rows for one bid. `builderKey` / `builderName` describe the bid's own GC (used for packets with no
 * GC id and for the plain row when the bid has no packets).
 */
export function gcOutcomeRowsForBid(
  bid: GcOutcomeBidLike,
  builder: { key: string; name: string },
  packets: ReadonlyArray<GcPacket> | undefined,
): GcOutcomeRow[] {
  const bidOutcome = classifyBidOutcome(bid)
  const bidValue = num(bid.bid_value)
  const bidCategory = bid.loss_category ?? null
  const bidNote = (bid.loss_reason ?? '').trim() || null
  const real = (packets ?? []).filter((p) => !p.sharedLetter)
  const shared = (packets ?? []).filter((p) => p.sharedLetter)

  const rows: GcOutcomeRow[] = []
  if (real.length <= 1) {
    const p = real[0]
    const explicit = p?.outcome === 'won' || p?.outcome === 'lost' ? (p.outcome as GcOutcomeKind) : null
    rows.push({
      bidId: bid.id,
      gcKey: p?.gcId ?? builder.key,
      gcName: p?.gcId ? p.name : builder.name,
      packetKey: p?.key ?? null,
      versionIds: p?.versions.map((v) => v.id) ?? [],
      outcome: explicit ?? bidOutcome,
      perGc: false,
      sentOn: p?.sentOn ?? bid.bid_date_sent,
      value: p?.sentValue ?? bidValue,
      lossCategory: bidCategory,
      lossNote: bidNote,
      reasonInferred: false,
      siblings: [],
      sharedLetter: false,
    })
  } else {
    const anyMarked = real.some((p) => p.outcome === 'won' || p.outcome === 'lost')
    const wonElsewhere = real.some((p) => p.outcome === 'won')
    for (const p of real) {
      const recorded = p.versions.find((v) => v.loss_category)?.loss_category ?? null
      const note = p.versions.find((v) => v.outcome_note)?.outcome_note ?? null
      let outcome: GcOutcomeKind
      let perGc = true
      let lossCategory: string | null = recorded
      let lossNote: string | null = note
      let reasonInferred = false
      if (p.outcome === 'won' || p.outcome === 'lost') {
        outcome = p.outcome
        // A packet marked lost beside a sibling win (the auto-mark on a GC win, or by hand) with no
        // reason recorded: the winner got the project.
        if (outcome === 'lost' && !recorded && wonElsewhere) { lossCategory = 'gc_lost'; reasonInferred = true }
      }
      else if (!anyMarked) { outcome = bidOutcome; perGc = false; lossCategory = recorded ?? bidCategory; lossNote = note ?? bidNote }
      else if (wonElsewhere) { outcome = 'lost'; if (!recorded) { lossCategory = 'gc_lost'; reasonInferred = true } }
      else outcome = p.sentOn ? 'pending' : 'unsent'
      rows.push({
        bidId: bid.id,
        gcKey: p.gcId ?? builder.key,
        gcName: p.gcId ? p.name : builder.name,
        packetKey: p.key,
        versionIds: p.versions.map((v) => v.id),
        outcome,
        perGc,
        sentOn: p.sentOn,
        value: p.sentValue ?? bidValue,
        lossCategory,
        lossNote,
        reasonInferred,
        siblings: [],
        sharedLetter: false,
      })
    }
    for (const r of rows) r.siblings = rows.filter((o) => o !== r).map((o) => ({ gcKey: o.gcKey, gcName: o.gcName, outcome: o.outcome }))
  }
  for (const p of shared) {
    if (rows.some((r) => r.gcKey === p.gcId)) continue
    rows.push({
      bidId: bid.id,
      gcKey: p.gcId ?? p.key,
      gcName: p.name,
      packetKey: p.key,
      versionIds: [],
      outcome: bidOutcome,
      perGc: false,
      sentOn: p.sentOn,
      value: bidValue,
      lossCategory: bidCategory,
      lossNote: bidNote,
      reasonInferred: false,
      siblings: [],
      sharedLetter: true,
    })
  }
  return rows
}

/** Builder tallies over rows — the per-GC replacement for counting bids. */
/** Multi-GC rows carry their own answer and reason (a packet with versions and siblings); everything else writes the bid. */
export function gcRowIsPacketScoped(row: Pick<GcOutcomeRow, 'packetKey' | 'versionIds' | 'siblings'>): boolean {
  return row.packetKey != null && row.versionIds.length > 0 && row.siblings.length > 0
}

export function tallyGcOutcomeRows(rows: ReadonlyArray<Pick<GcOutcomeRow, 'outcome'>>): { won: number; lost: number; pending: number; unsent: number; hitRatePct: number | null } {
  let won = 0, lost = 0, pending = 0, unsent = 0
  for (const r of rows) {
    if (r.outcome === 'won') won++
    else if (r.outcome === 'lost') lost++
    else if (r.outcome === 'pending') pending++
    else unsent++
  }
  const decided = won + lost
  return { won, lost, pending, unsent, hitRatePct: decided > 0 ? Math.round((won / decided) * 100) : null }
}
