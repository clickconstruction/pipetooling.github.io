import type { TakeoffFixtureHistoryRow } from '../../types/database-functions'
import { fixtureKey } from './takeoffFixtureKey'

/**
 * Shaping for the fixture-history RPC (docs/TAKEOFFS_REFRESH_PLAN.md,
 * decisions 5 and 6): group rows per key, pick the "Same as B383" chips, and
 * build the copy-from-a-previous-bid preview. Pure; the RPC client lives in
 * `takeoffFixtureHistoryRpc.ts`.
 */

/** Rows per key, in the RPC's order (most recent bid first). */
export function groupFixtureHistory(rows: ReadonlyArray<TakeoffFixtureHistoryRow>): Map<string, TakeoffFixtureHistoryRow[]> {
  const out = new Map<string, TakeoffFixtureHistoryRow[]>()
  for (const r of rows) {
    const list = out.get(r.key) ?? []
    list.push(r)
    out.set(r.key, list)
  }
  return out
}

/**
 * The chips a fixture shows: up to `max` rows, most recent first, with a
 * `won` bid promoted to the front when one is in the set — a price that won
 * the job is the better anchor than the one that merely went out last.
 */
export function pickSameAsChips(rowsForKey: ReadonlyArray<TakeoffFixtureHistoryRow>, max = 2): TakeoffFixtureHistoryRow[] {
  const take = rowsForKey.slice(0, Math.max(0, max))
  const wonIdx = take.findIndex((r) => r.outcome === 'won')
  if (wonIdx > 0) {
    const won = take[wonIdx]!
    return [won, ...take.filter((_, i) => i !== wonIdx)]
  }
  return take
}

export type CopyFromBidCandidate = {
  bidId: string
  bidNumber: string | null
  projectName: string | null
  sentOn: string | null
  outcome: string | null
  /** Uncosted count rows on THIS bid the source bid can fill, with the source row for each. */
  fills: Array<{ countRowId: string; source: TakeoffFixtureHistoryRow }>
  /** Sum of source line counts across `fills`. */
  lineCount: number
}

/**
 * Which previous bids can fill this bid's uncosted fixtures, best first
 * (most fixtures fillable, then most recent). Every uncosted row is matched
 * by key; a source bid contributes at most one row per key (the RPC already
 * picked its best example).
 */
export function buildCopyFromBidPreview(
  countRows: ReadonlyArray<{ id: string; fixture: string | null | undefined }>,
  uncostedIds: ReadonlyArray<string>,
  history: ReadonlyArray<TakeoffFixtureHistoryRow>,
): CopyFromBidCandidate[] {
  const uncosted = new Set(uncostedIds)
  const byKey = groupFixtureHistory(history)
  const byBid = new Map<string, CopyFromBidCandidate>()
  for (const row of countRows) {
    if (!uncosted.has(row.id)) continue
    const key = fixtureKey(row.fixture)
    if (!key) continue
    for (const src of byKey.get(key) ?? []) {
      let cand = byBid.get(src.bid_id)
      if (!cand) {
        cand = { bidId: src.bid_id, bidNumber: src.bid_number, projectName: src.project_name, sentOn: src.sent_on, outcome: src.outcome, fills: [], lineCount: 0 }
        byBid.set(src.bid_id, cand)
      }
      cand.fills.push({ countRowId: row.id, source: src })
      cand.lineCount += src.line_count
    }
  }
  return [...byBid.values()].sort(
    (a, b) => b.fills.length - a.fills.length || String(b.sentOn ?? '').localeCompare(String(a.sentOn ?? '')) || a.bidId.localeCompare(b.bidId),
  )
}
