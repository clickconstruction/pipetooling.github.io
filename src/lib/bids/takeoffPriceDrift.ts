/**
 * What a takeoff's materials would cost at today's book (v2.4395). Each part line remembers the
 * price it was picked at and the book row it came from (`source_material_part_price_id`); the
 * book moves on. This compares the two, line by line:
 *
 * - **Moved**: the book row reads a different price now. The gap counts toward the bid's line,
 *   and Refresh prices sets the line to today's price from the same row.
 * - **Looks wrong**: the book row's price now is a stand-in or a big jump from the line's
 *   (`isBigJump`, the same rule What your materials cost uses). It is left out of the gap and
 *   out of Refresh, and is named so someone fixes the book.
 * - A typed price (no source row) or a row the reader cannot see is left as it is.
 *
 * Pure: no React, no supabase. Takeoffs feeds it the tab's own lines; Pricing reads them through
 * `useTakeoffPriceDrift`.
 */
import { isBigJump } from '../materials/materialPriceIndex'

export type DriftLine = {
  id: string
  partName: string
  quantity: number
  unitPrice: number
  /** The fixture count this line multiplies by (`roughCountMultiplier`). */
  count: number
  sourcePriceId: string | null
}

export type BookPrice = { price: number; houseName: string; /** The part's name in the book, for a line that has none to hand. */ partName?: string | null }

export type MovedLine = {
  lineId: string
  partName: string
  houseName: string
  /** quantity × fixture count. */
  quantity: number
  priced: number
  today: number
  /** (today − priced) × quantity. */
  change: number
}

export type WrongBookPrice = { sourcePriceId: string; partName: string; houseName: string; priced: number; today: number; lineCount: number }

export type TakeoffDrift = {
  /** Σ unit price × quantity × fixture count over every line, as priced. */
  materials: number
  moved: MovedLine[]
  /** Σ change over the moved lines: what today's book adds (+) or saves (−). */
  gap: number
  /** gap ÷ materials; 0 with no materials. */
  share: number
  wrong: WrongBookPrice[]
  /** What Refresh prices writes: each moved line at today's price from its own book row. */
  refresh: Array<{ lineId: string; unitPrice: number }>
}

export function takeoffPriceDrift(lines: ReadonlyArray<DriftLine>, book: ReadonlyMap<string, BookPrice>): TakeoffDrift {
  let materials = 0
  const moved: MovedLine[] = []
  const wrong = new Map<string, WrongBookPrice>()
  for (const line of lines) {
    const qty = Math.max(0, Number(line.quantity) || 0) * (line.count > 0 ? line.count : 1)
    const priced = Number(line.unitPrice) || 0
    materials += qty * priced
    if (!line.sourcePriceId || !(priced > 0) || !(qty > 0)) continue
    const row = book.get(line.sourcePriceId)
    if (!row || row.price === priced) continue
    const partName = line.partName || row.partName || 'Part'
    if (isBigJump(priced, row.price)) {
      const seen = wrong.get(line.sourcePriceId)
      if (seen) seen.lineCount += 1
      else wrong.set(line.sourcePriceId, { sourcePriceId: line.sourcePriceId, partName, houseName: row.houseName, priced, today: row.price, lineCount: 1 })
      continue
    }
    moved.push({ lineId: line.id, partName, houseName: row.houseName, quantity: qty, priced, today: row.price, change: (row.price - priced) * qty })
  }
  const gap = moved.reduce((s, m) => s + m.change, 0)
  moved.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  return {
    materials,
    moved,
    gap,
    share: materials > 0 ? gap / materials : 0,
    wrong: [...wrong.values()],
    refresh: moved.map((m) => ({ lineId: m.lineId, unitPrice: m.today })),
  }
}

/** "$624 less" / "$10 more", rounded to the dollar. */
export function gapWords(gap: number): string {
  const dollars = Math.round(Math.abs(gap)).toLocaleString('en-US')
  return gap < 0 ? `$${dollars} less` : `$${dollars} more`
}

/** The line's first sentence: "3 prices on this takeoff moved in the book." */
export function movedWords(count: number): string {
  return count === 1 ? '1 price on this takeoff moved in the book.' : `${count} prices on this takeoff moved in the book.`
}
