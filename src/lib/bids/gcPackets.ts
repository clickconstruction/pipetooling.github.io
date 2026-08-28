/**
 * GC packets (Bids by GC, v2.2161/v2.2162): a bid's versions grouped by the GC they go to.
 * A version with no `customer_id` belongs to the bid's own GC. Pure — used by the version picker,
 * the Bid Board's per-GC rows and Followup.
 */
import type { LatestSend } from './versionSends'

export type GcVersionLike = {
  id: string
  name: string
  customer_id: string | null
  sort_order: number
  created_at?: string | null
  starred_price_book_version_id?: string | null
  outcome?: string | null
  outcome_at?: string | null
  /** Per-GC loss reason (v2.2164) — same keys as bids.loss_category. */
  loss_category?: string | null
  outcome_note?: string | null
}

export type GcPacket<V extends GcVersionLike = GcVersionLike> = {
  /** '' = the bid's own GC; else the customer id. */
  key: string
  gcId: string | null
  name: string
  versions: V[]
  /** Latest send across the packet's versions (YYYY-MM-DD), with the pre-v2.2124 bid-date fallback. */
  sentOn: string | null
  /** Value of the latest send in the packet (the ★ at send time), if any. */
  sentValue: number | null
  /** 'won' | 'lost' | null — the packet's outcome (first version that has one). */
  outcome: string | null
  /**
   * A GC on the bid's "Also sent to" list with no version of its own: it got the same letter as the
   * bid's GC. Shown for completeness; its answer is tracked with the bid until it gets its own packet.
   */
  sharedLetter?: boolean
}

/**
 * Default "Start from" source when adding a version to a GC's packet (v2.2365): the packet's own
 * versions come first — the selected one if it's in the packet, else the packet's ★'d version, else
 * its first by sort order. Only a packet with no versions falls back to the bid-wide selection, so
 * "+ version" never silently clones another GC's packet.
 */
export function defaultCopySourceId<V extends GcVersionLike>(
  versions: ReadonlyArray<V>,
  gcId: string | null,
  selectedId: string | null,
): string | null {
  const packet = [...versions].filter((v) => (v.customer_id ?? null) === gcId).sort((a, b) => a.sort_order - b.sort_order)
  if (selectedId && packet.some((v) => v.id === selectedId)) return selectedId
  const starred = packet.find((v) => v.starred_price_book_version_id)
  if (starred) return starred.id
  if (packet[0]) return packet[0].id
  return selectedId ?? versions[0]?.id ?? null
}

export function groupVersionsByGc<V extends GcVersionLike>(
  versions: ReadonlyArray<V>,
  opts: {
    bidGcName: string | null
    gcNames: Record<string, string>
    latestSends: Record<string, LatestSend>
    bidDateSent: string | null
    /** "Also sent to" GCs (bid_gc_recipients); those without a version become shared-letter packets. */
    recipients?: ReadonlyArray<{ customerId: string; name: string }>
  },
): GcPacket<V>[] {
  const groups: GcPacket<V>[] = []
  for (const v of [...versions].sort((a, b) => a.sort_order - b.sort_order)) {
    const key = v.customer_id ?? ''
    let g = groups.find((x) => x.key === key)
    if (!g) {
      g = { key, gcId: v.customer_id ?? null, name: v.customer_id ? (opts.gcNames[v.customer_id] ?? '…') : (opts.bidGcName ?? 'the GC'), versions: [], sentOn: null, sentValue: null, outcome: null }
      groups.push(g)
    }
    g.versions.push(v)
  }
  groups.sort((a, b) => (a.key === '' ? -1 : b.key === '' ? 1 : 0))
  const anySends = Object.keys(opts.latestSends).length > 0
  for (const g of groups) {
    let best: LatestSend | null = null
    for (const v of g.versions) { const s = opts.latestSends[v.id]; if (s && (!best || s.sentOn > best.sentOn)) best = s }
    if (best) { g.sentOn = best.sentOn; g.sentValue = best.value }
    else if (!anySends && opts.bidDateSent) {
      // Pre-per-GC bids: the bid's sent date applies to versions that existed then, not to packets added later.
      const existedThen = g.versions.some((v) => !v.created_at || String(v.created_at).slice(0, 10) <= opts.bidDateSent!)
      if (existedThen) g.sentOn = opts.bidDateSent
    }
    g.outcome = g.versions.find((v) => v.outcome)?.outcome ?? null
  }
  for (const r of opts.recipients ?? []) {
    if (groups.some((g) => g.gcId === r.customerId)) continue
    groups.push({ key: `shared:${r.customerId}`, gcId: r.customerId, name: r.name, versions: [], sentOn: opts.bidDateSent, sentValue: null, outcome: null, sharedLetter: true })
  }
  return groups
}

/** Bid-level roll-up from the packets: won if any won; lost if every packet that was sent lost; else null (leave as is). */
export function rollUpOutcome(packets: ReadonlyArray<{ outcome: string | null; sentOn: string | null }>): 'won' | 'lost' | null {
  if (packets.some((p) => p.outcome === 'won')) return 'won'
  const sent = packets.filter((p) => p.sentOn || p.outcome)
  if (sent.length > 0 && sent.every((p) => p.outcome === 'lost')) return 'lost'
  return null
}

/**
 * The board's "sent 1/2" roll-up badge (v2.2411, per-GC sent follow-through): how many of a
 * multi-GC bid's REAL packets (shared-letter recipients ride the bid, they don't count) have a
 * send. Null when the badge would be noise: fewer than two real packets, or nothing sent yet
 * (an all-unsent bid already sits in Unsent/Working — "sent 0/2" says nothing).
 */
/**
 * Bid→Job (Per-GC Phase 3): which packet gave us the job. Exactly one won real packet is the
 * answer; zero means the import must ask; more than one means the OUTCOMES are ambiguous and
 * the import asks which one the job is for (writing nothing).
 */
export function resolveWinningPacket<P extends { outcome: string | null; sharedLetter?: boolean }>(
  packets: ReadonlyArray<P>,
): { winner: P | null; multiple: boolean } {
  const won = packets.filter((p) => !p.sharedLetter && p.outcome === 'won')
  return { winner: won.length === 1 ? (won[0] ?? null) : null, multiple: won.length > 1 }
}

export function perGcSentSummary(
  packets: ReadonlyArray<{ sentOn: string | null; sharedLetter?: boolean }> | undefined,
): { sent: number; total: number; complete: boolean } | null {
  const real = (packets ?? []).filter((p) => !p.sharedLetter)
  if (real.length < 2) return null
  const sent = real.filter((p) => p.sentOn != null).length
  if (sent === 0) return null
  return { sent, total: real.length, complete: sent === real.length }
}
