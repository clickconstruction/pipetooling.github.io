/**
 * A price of the site's own (punch list #342, PR 2): what a person accepted for a row of a
 * site's materials that the parts book does not price.
 *
 * A name a crew typed has no page in the parts book. Its only price was the one the office read
 * off an invoice, kept in the browser that read it. The pricing window lets a person accept a
 * price for the row: what a supply house bill paid, a price they type, or a parts-book part's
 * price taken without the tie, so the row keeps its own name (**Just price**). Each answer is a row
 * of `on_site_prices`, kept for the site, and the newest answer of a row is the one read. The
 * same table holds *not a part* (`left_out`): scrap, tools, a mixed box, set aside so the cover
 * on the Worth figure can reach the end.
 *
 * `sitePriceLookup` is the one rule with the site's answers in it, in the order the old rule
 * already had: a parts-book price checked inside 90 days, then the site's own price, then the
 * invoice price on this device, then a stale book price, flagged. It reads a line through the
 * site's ties, so a typed name tied to a parts-book part is priced as that part on every screen.
 * A site's price has a day, the bill's or the day it was typed, and is flagged past 90 days as a
 * book price is.
 *
 * Pure: the rows come in (`sitePricesIo.ts` through the on-site store), the picks go out.
 */
import { ymdDaysBetween, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { BOOK_PRICE_FRESH_DAYS, invoicePick, pickBookPrice, priceWords, type BookPriceRow, type PricePick } from './bookPrice'
import { sameWordsKey } from './siteRollup'

/** One answer about a row's price on one site. */
export type SitePrice = {
  id: string
  /** The site screen's row key: `id:<part id>` or `words:<the same-words fold>`. */
  rowKey: string
  /** The row's name as it read when the answer was given. */
  rowName: string
  kind: 'price' | 'left_out'
  /** The price for one, as counted on site; null for a row left out. */
  unitPrice: number | null
  /** `book`: a parts-book part's price taken without tying the name to the part (**Just price**). */
  source: 'typed' | 'bill' | 'book'
  sourceLineId: string | null
  /** The supply house, for a bill's price; the part's name, for a parts-book part's price. */
  sourceWords: string
  /** YYYY-MM-DD: the bill's day, or the day it was typed. */
  pricedOn: string
  byName: string
  at: string
}

/** The newest answer of each row key: the one the screens read. */
export function latestSitePrices(rows: ReadonlyArray<SitePrice>): Map<string, SitePrice> {
  const out = new Map<string, SitePrice>()
  for (const r of rows) {
    const cur = out.get(r.rowKey)
    if (!cur || r.at > cur.at) out.set(r.rowKey, r)
  }
  return out
}

/** An answer as the price rule reads it; null for a row left out, which has no price. */
export function sitePick(p: SitePrice, today: string): PricePick | null {
  if (p.kind !== 'price' || p.unitPrice == null || !Number.isFinite(p.unitPrice) || p.unitPrice < 0) return null
  const ageDays = p.pricedOn ? ymdDaysBetween(p.pricedOn, today) : null
  return { price: p.unitPrice, from: 'site', supplyHouse: p.source === 'bill' ? p.sourceWords || null : null, checkedOn: p.pricedOn || null, ageDays, stale: ageDays == null || ageDays > BOOK_PRICE_FRESH_DAYS, via: p.source, byName: p.byName || undefined, ...(p.source === 'book' ? { bookPart: p.sourceWords } : {}) }
}

/** The site screen's row key of a ledger line's part key: a parts-book part as it is, a typed name by its same-words fold. */
export function ownRowKey(partKey: string): string {
  if (partKey.startsWith('id:')) return partKey
  return `words:${sameWordsKey(partKey.startsWith('text:') ? partKey.slice('text:'.length) : partKey)}`
}

/**
 * The one price rule with a site's answers in it, by a line's part key (`id:<part>` or
 * `text:<name>`). `canon` is the site's ties (`tieCanon`), `site` the newest answer of a row key.
 */
export function sitePriceLookup(args: { book: (partId: string) => ReadonlyArray<BookPriceRow>; invoice: (partKey: string) => number | null; site: (rowKey: string) => SitePrice | undefined; canon: (rowKey: string) => string; today: string }): (partKey: string) => PricePick | null {
  const { book, invoice, site, canon, today } = args
  return (partKey) => {
    const own = ownRowKey(partKey)
    const row = canon(own)
    // A typed name tied to a parts-book part reads that part's book price.
    const bookId = row.startsWith('id:') ? row.slice(3) : partKey.startsWith('id:') ? partKey.slice(3) : null
    const fromBook = bookId ? pickBookPrice(book(bookId), today) : null
    if (fromBook && !fromBook.stale) return fromBook
    const answer = site(row) ?? site(own)
    const fromSite = answer ? sitePick(answer, today) : null
    return fromSite ?? invoicePick(invoice(partKey)) ?? fromBook
  }
}

/** The answers given about one row, newest first: what *Priced here* lists. Read on the row's key and the keys folded into it. */
export function rowSitePrices(row: { key: string; memberKeys: ReadonlyArray<string> }, rows: ReadonlyArray<SitePrice>): SitePrice[] {
  const keys = new Set([row.key, ...row.memberKeys])
  return rows.filter((r) => keys.has(r.rowKey)).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

/** The row was set aside as not a part: its newest answer says so. */
export function isLeftOut(row: { key: string; memberKeys: ReadonlyArray<string> }, rows: ReadonlyArray<SitePrice>): boolean {
  return rowSitePrices(row, rows)[0]?.kind === 'left_out'
}

function dollars(n: number): string {
  const digits = n > 0 && n < 0.1 ? 3 : 2
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

/** One answer as *Priced here* reads it: "$3.12 for one · Pecan Supply’s bill · Sep 30 · by Dana, Nov 13". */
export function sitePriceWords(p: SitePrice, today: string): string {
  const when = p.at ? formatWorkDateYmdMonthDayShort(p.at.slice(0, 10)) : ''
  const by = [p.byName ? `by ${p.byName}` : '', when].filter(Boolean).join(', ')
  if (p.kind === 'left_out') return ['Left out, not a part', by].filter(Boolean).join(' · ')
  const pick = sitePick(p, today)
  // The source's own words name who typed it, so a typed price says who once.
  const source = pick ? priceWords({ ...pick, byName: undefined }, today) : ''
  return [`${dollars(p.unitPrice ?? 0)} for one`, source, by].filter(Boolean).join(' · ')
}
