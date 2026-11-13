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
  /** The one price the whole row reads, when it is a parts-book part with a price; null for a typed row. */
  pick: PricePick | null
}

export function rowWorth(row: Pick<SitePartRow, 'partId' | 'boxes'>, priceFor: (partKey: string) => PricePick | null): RowWorth {
  const held = row.boxes.filter((b) => b.onHand > 0)
  const book = row.partId ? priceFor(`id:${row.partId}`) : null
  let money = 0
  let pricedLines = 0
  let staleLines = 0
  for (const b of held) {
    const pick = book ?? priceFor(b.partKey)
    if (!pick) continue
    money += b.onHand * pick.price
    pricedLines += 1
    if (pick.stale) staleLines += 1
  }
  return { money: Math.round(money * 100) / 100, lines: held.length, pricedLines, staleLines, pick: book }
}

export type SiteWorth = {
  known: number
  lines: number
  pricedLines: number
  staleLines: number
  /** The rows with a line that has no price, most pieces first: where a tie to the parts book pays most. */
  unpriced: SitePartRow[]
}

export function siteWorth(rows: ReadonlyArray<SitePartRow>, priceFor: (partKey: string) => PricePick | null): SiteWorth {
  let known = 0
  let lines = 0
  let pricedLines = 0
  let staleLines = 0
  const unpriced: SitePartRow[] = []
  for (const row of rows) {
    const w = rowWorth(row, priceFor)
    known += w.money
    lines += w.lines
    pricedLines += w.pricedLines
    staleLines += w.staleLines
    if (w.lines > w.pricedLines) unpriced.push(row)
  }
  unpriced.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  return { known: Math.round(known * 100) / 100, lines, pricedLines, staleLines, unpriced }
}

function dollars(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "$2,310.00 known" over "9 of 118 lines have a price · 2 on a price older than 90 days". The cover is never dropped. */
export function worthWords(w: Pick<SiteWorth, 'known' | 'lines' | 'pricedLines' | 'staleLines'>): { big: string; small: string } {
  const cover = w.lines === 0 ? 'no line on hand' : `${w.pricedLines.toLocaleString('en-US')} of ${w.lines.toLocaleString('en-US')} ${w.lines === 1 ? 'line has' : 'lines have'} a price`
  const stale = w.staleLines > 0 ? ` · ${w.staleLines.toLocaleString('en-US')} on a price older than 90 days` : ''
  return { big: w.pricedLines === 0 ? 'No price yet' : `${dollars(w.known)} known`, small: `${cover}${stale}` }
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
