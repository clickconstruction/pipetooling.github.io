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
}

export function groupVersionsByGc<V extends GcVersionLike>(
  versions: ReadonlyArray<V>,
  opts: { bidGcName: string | null; gcNames: Record<string, string>; latestSends: Record<string, LatestSend>; bidDateSent: string | null },
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
  return groups
}

/** Bid-level roll-up from the packets: won if any won; lost if every packet that was sent lost; else null (leave as is). */
export function rollUpOutcome(packets: ReadonlyArray<{ outcome: string | null; sentOn: string | null }>): 'won' | 'lost' | null {
  if (packets.some((p) => p.outcome === 'won')) return 'won'
  const sent = packets.filter((p) => p.sentOn || p.outcome)
  if (sent.length > 0 && sent.every((p) => p.outcome === 'lost')) return 'lost'
  return null
}
