/**
 * What a site's material is worth, and how much of it has a price (punch list #330, PR 4).
 *
 * The figure is never a bare total. On the first site read about one piece in twenty had a price,
 * so a dollar total would have priced a sliver and read as the whole. The figure says *known*,
 * and the cover (*9 of 118 lines have a price*) sits beside it always. A line with no price is
 * counted, never guessed.
 *
 * A row that is a parts-book part reads the book's price through the one rule every money figure
 * on site reads (`priceLookup` in `bookPrice.ts`): a fresh book price, the invoice price past 90
 * days, a stale book price flagged when that is all there is. A typed name tied to the book is
 * such a row, which is how a tie raises the cover. A typed name with no tie carries only the
 * price the office read off the invoice that landed it, per line.
 *
 * Pure: the rows and the price lookup come in, the figures go out.
 */
import type { PricePick } from './bookPrice'
import type { SitePartRow } from './siteRollup'

export type RowWorth = {
  /** The money of the lines that have a price; 0 when none has. */
  money: number
  /** The row's lines with something on hand. */
  lines: number
  pricedLines: number
  /** Priced lines whose parts-book price is older than the book's 90 days. */
  staleLines: number
  /** The price the row reads: the parts-book part's, or the first priced line's for a typed row; null when no line has one. */
  pick: PricePick | null
}

export function rowWorth(row: Pick<SitePartRow, 'partId' | 'boxes'>, priceFor: (partKey: string) => PricePick | null): RowWorth {
  const held = row.boxes.filter((b) => b.onHand > 0)
  const book = row.partId ? priceFor(`id:${row.partId}`) : null
  let money = 0
  let pricedLines = 0
  let staleLines = 0
  let first: PricePick | null = null
  for (const b of held) {
    const pick = book ?? priceFor(b.partKey)
    if (!pick) continue
    first = first ?? pick
    money += b.onHand * pick.price
    pricedLines += 1
    if (pick.stale) staleLines += 1
  }
  return { money: Math.round(money * 100) / 100, lines: held.length, pricedLines, staleLines, pick: book ?? first }
}

export type SiteWorth = {
  known: number
  lines: number
  pricedLines: number
  staleLines: number
  /** The rows with a line that has no price, most pieces first: where a tie to the parts book pays most. */
  unpriced: SitePartRow[]
  /** The rows on a price older than 90 days, most pieces first (punch list #342). */
  stale: SitePartRow[]
  /** The rows a person set aside as not a part, and their lines on hand: out of every count above. */
  leftOut: SitePartRow[]
  leftOutLines: number
}

export function siteWorth(rows: ReadonlyArray<SitePartRow>, priceFor: (partKey: string) => PricePick | null, isLeftOut: (row: SitePartRow) => boolean = () => false): SiteWorth {
  let known = 0
  let lines = 0
  let pricedLines = 0
  let staleLines = 0
  let leftOutLines = 0
  const unpriced: SitePartRow[] = []
  const stale: SitePartRow[] = []
  const leftOut: SitePartRow[] = []
  const byPieces = (a: SitePartRow, b: SitePartRow) => b.total - a.total || a.name.localeCompare(b.name)
  for (const row of rows) {
    // A row set aside as not a part is counted nowhere: not in the money, not in the cover.
    if (isLeftOut(row)) {
      leftOut.push(row)
      leftOutLines += row.boxes.filter((b) => b.onHand > 0).length
      continue
    }
    const w = rowWorth(row, priceFor)
    known += w.money
    lines += w.lines
    pricedLines += w.pricedLines
    staleLines += w.staleLines
    if (w.lines > w.pricedLines) unpriced.push(row)
    if (w.staleLines > 0) stale.push(row)
  }
  unpriced.sort(byPieces)
  stale.sort(byPieces)
  leftOut.sort(byPieces)
  return { known: Math.round(known * 100) / 100, lines, pricedLines, staleLines, unpriced, stale, leftOut, leftOutLines }
}

function dollars(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "$2,310.00 known" over "9 of 118 lines have a price · 2 on a price older than 90 days · 14 left out". The cover is never dropped. */
export function worthWords(w: Pick<SiteWorth, 'known' | 'lines' | 'pricedLines' | 'staleLines'> & { leftOutLines?: number }): { big: string; small: string } {
  const cover = w.lines === 0 ? 'no line on hand' : `${w.pricedLines.toLocaleString('en-US')} of ${w.lines.toLocaleString('en-US')} ${w.lines === 1 ? 'line has' : 'lines have'} a price`
  const stale = w.staleLines > 0 ? ` · ${w.staleLines.toLocaleString('en-US')} on a price older than 90 days` : ''
  const out = (w.leftOutLines ?? 0) > 0 ? ` · ${(w.leftOutLines ?? 0).toLocaleString('en-US')} left out` : ''
  return { big: w.pricedLines === 0 ? 'No price yet' : `${dollars(w.known)} known`, small: `${cover}${stale}${out}` }
}

/** The three lists the Worth tile holds: the rows with no price, on a price older than 90 days, and left out. */
export type PriceLens = 'none' | 'old' | 'out'

const LENS_CHIP: Record<PriceLens, string> = { none: 'No price', old: 'An old price', out: 'Left out' }

/** A chip over the list with its count: "No price · 87", "An old price · 9", "Left out · 14". */
export function lensChipWords(lens: PriceLens, rows: number): string {
  return `${LENS_CHIP[lens]} · ${rows.toLocaleString('en-US')}`
}

/** The words a typed name is searched by in the parts book: its words with the inch marks and punctuation set aside. */
export function bookSearchWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[“”″"']/g, ' ')
    .replace(/[,;:()[\]!?*#%_\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
}
