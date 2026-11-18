/**
 * Bids → Pricing, Copy prices: fill the viewed (empty) price with another price's effective
 * prices. The reads, the pricing of the source (`scenarioPricingRows`) and the per-row writes
 * stay in `BidsPricingTab`; this is what sits between them, as it was written inline
 * (decomposition queue row 1): whether the source lives on another version, which price lands on
 * which row, and what the toast says afterwards.
 */

/**
 * A source on ANOTHER version keys its prices to that version's own count rows, so they are
 * paired onto this version's rows by fixture name (`rekeyRowMap`). A source with no version, or
 * on the version on screen, prices the rows on screen as they are.
 */
export function copyPricesCrossesVersions(sourceBidVersionId: string | null, selectedBidVersionId: string | null): boolean {
  return sourceBidVersionId != null && sourceBidVersionId !== selectedBidVersionId
}

/** One source row as the pricing kernel hands it back; only these three are read. */
export type CopyPricesSourceRow = { countRow: { id: string }; priced: boolean; unitPrice: number }

export type CopyPricesPlan = {
  /** The prices to write, in the source's row order. */
  writes: Array<{ targetRowId: string; unitPrice: number }>
  /** Priced source rows with no matching row on this version. */
  dropped: number
}

/**
 * Which price lands on which row. A row nothing prices is skipped; a saved $0 is a price and
 * copies like any other (v2.6001). `rowMap` null is the same version: a price lands on its own
 * row. With a map, a priced row whose fixture has no one counterpart here is dropped and counted.
 */
export function copyPricesPlan(rows: ReadonlyArray<CopyPricesSourceRow>, rowMap: ReadonlyMap<string, string> | null): CopyPricesPlan {
  const writes: CopyPricesPlan['writes'] = []
  let dropped = 0
  for (const row of rows) {
    if (!row.priced) continue
    const targetRowId = rowMap ? rowMap.get(row.countRow.id) ?? null : row.countRow.id
    if (!targetRowId) {
      dropped++
      continue
    }
    writes.push({ targetRowId, unitPrice: row.unitPrice })
  }
  return { writes, dropped }
}

/** What the copy says when it is done, and in which tone. */
export function copyPricesOutcomeWords(copied: number, dropped: number, sourceName: string): { message: string; tone: 'info' | 'success' | 'error' } {
  if (copied > 0 && dropped > 0) {
    return { message: `Copied ${copied} price${copied !== 1 ? 's' : ''} from "${sourceName}" — ${dropped} had no matching row in this packet's counts.`, tone: 'info' }
  }
  if (copied > 0) return { message: `Copied ${copied} price${copied !== 1 ? 's' : ''} from "${sourceName}".`, tone: 'success' }
  if (dropped > 0) return { message: `"${sourceName}" prices matched none of this packet's count rows — nothing copied.`, tone: 'error' }
  return { message: `"${sourceName}" has no prices to copy.`, tone: 'error' }
}
