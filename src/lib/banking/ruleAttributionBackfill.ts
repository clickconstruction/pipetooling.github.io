/**
 * People-in-Rules retroactive backfill (v2.1726): when a rule that names a
 * person is saved, the Accounting tab offers to tag the transactions the rule
 * already sorted (its approved suggestions). These kernels hold the pure
 * parts: dedup + skip-already-attributed planning, and chunking for the
 * `.in()` reads / batched upserts.
 */

/** Matches MERCURY_TRANSACTION_ID_IN_CHUNK_SIZE — larger `.in()` lists blow up request URLs. */
export const BACKFILL_READ_CHUNK = 200
/** Attribution upsert batch size. */
export const BACKFILL_WRITE_CHUNK = 500

export type AttributionBackfillPlan = {
  /** Candidate txs with no attribution today — safe to tag. */
  toTag: string[]
  /** Candidates that already have a person (hand-set or earlier rule) — kept as-is. */
  skipped: number
}

export function planAttributionBackfill(
  candidateTxIds: string[],
  alreadyAttributedTxIds: Iterable<string>,
): AttributionBackfillPlan {
  const have = new Set(alreadyAttributedTxIds)
  const seen = new Set<string>()
  const toTag: string[] = []
  let skipped = 0
  for (const id of candidateTxIds) {
    if (seen.has(id)) continue
    seen.add(id)
    if (have.has(id)) skipped += 1
    else toTag.push(id)
  }
  return { toTag, skipped }
}

export function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}
