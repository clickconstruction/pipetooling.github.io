/**
 * Materials on site (punch list #209), the owner's call 5: a container line's missing money is priced
 * from the parts book — the supply house's latest price, with the day it was last checked drawn
 * beside it — and falls back to the price the office read off the invoice that landed the part when
 * the book's price is older than `BOOK_PRICE_FRESH_DAYS` or the book has none. A part typed on site
 * (a `text:` key) has no book page, so it only ever carries the invoice price. Pure: the book's rows
 * and the invoice prices come in, a pick and its words go out; the store does the reading.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort, ymdDaysBetween } from '../../utils/dateUtils'
import { PLACEHOLDER_PRICE } from './materialPriceIndex'

/** The parts book's own freshness rule (What your materials cost): a price checked longer ago than this is stale. */
export const BOOK_PRICE_FRESH_DAYS = 90

export type BookPriceRow = {
  partId: string
  supplyHouse: string
  price: number
  /** The day the price was last checked, YYYY-MM-DD: `effective_date` (Check prices writes it), else the row's updated day; null when never. */
  checkedOn: string | null
}

export type PricePick = {
  price: number
  /** `site`: a price a person accepted for the site (punch list #342), read off a bill or typed. */
  from: 'book' | 'invoice' | 'site'
  /** The supply house whose price this is; null for an invoice price or a typed one. */
  supplyHouse: string | null
  /** The day the price is from: the book's check, the bill's day, the day it was typed. */
  checkedOn: string | null
  /** Whole days from the check to today; null for an invoice price or a price never checked. */
  ageDays: number | null
  /** A book price checked longer ago than `BOOK_PRICE_FRESH_DAYS`, or never checked. An invoice price is never stale: it is what was paid. */
  stale: boolean
  /** A site's own price: where the person took it from. */
  via?: 'bill' | 'typed' | 'book'
  /** A site's own price taken from a parts-book part without tying the name to it: the part's name. */
  bookPart?: string
  /** A site's own price: who accepted it. */
  byName?: string
}

/** The table's row (`material_part_prices` with its supply house joined) as the kernel reads it. */
export function bookPriceRow(r: { part_id: string; price: number; effective_date: string | null; updated_at: string | null; supply_houses?: { name: string } | null }): BookPriceRow {
  const effective = (r.effective_date ?? '').trim().slice(0, 10)
  const updated = r.updated_at ? calendarYmdInAppTzFromIso(r.updated_at) : ''
  return { partId: r.part_id, supplyHouse: r.supply_houses?.name ?? '', price: r.price, checkedOn: effective || updated || null }
}

function ageOf(checkedOn: string | null, today: string): number | null {
  return checkedOn ? ymdDaysBetween(checkedOn, today) : null
}

function isStale(ageDays: number | null): boolean {
  return ageDays == null || ageDays > BOOK_PRICE_FRESH_DAYS
}

/**
 * A price a money figure may read (v2.7249, punch list #344 PR 7): above zero and under the parts book's stand-in,
 * `PLACEHOLDER_PRICE`, the app's own rule for the book (`materialPriceIndex.ts`). The on-site rule refused only a
 * price under zero, so a row at 0 won a same-day tie as the lower price and read as known and fresh, and a stand-in
 * of 999,999 priced a line at a million dollars a piece. Neither is a price: the part then reads its next source, or
 * *no price*.
 */
export function isRealPrice(price: number | null | undefined): price is number {
  return typeof price === 'number' && Number.isFinite(price) && price > 0 && price < PLACEHOLDER_PRICE
}

/**
 * The supply house's latest price: of a part's rows, the one checked most recently wins; two checked
 * the same day go to the lower price; a row never checked comes after every dated one. Null for no rows.
 */
export function pickBookPrice(rows: ReadonlyArray<BookPriceRow>, today: string): PricePick | null {
  let best: BookPriceRow | null = null
  for (const r of rows) {
    if (!isRealPrice(r.price)) continue
    if (!best) {
      best = r
      continue
    }
    const a = r.checkedOn ?? ''
    const b = best.checkedOn ?? ''
    if (a > b || (a === b && r.price < best.price)) best = r
  }
  if (!best) return null
  const ageDays = ageOf(best.checkedOn, today)
  return { price: best.price, from: 'book', supplyHouse: best.supplyHouse || null, checkedOn: best.checkedOn, ageDays, stale: isStale(ageDays) }
}

/** The price the office read off the invoice that landed a part, kept on the device. */
export function invoicePick(price: number | null): PricePick | null {
  if (!isRealPrice(price)) return null
  return { price, from: 'invoice', supplyHouse: null, checkedOn: null, ageDays: null, stale: false }
}

/**
 * The one rule every money figure reads through, by part key (`id:<part>` or `text:<name>`): a fresh
 * book price first; past 90 days or with no book page, the invoice price the office read when the
 * part landed; a stale book price when that is all there is, flagged; null when nothing is known.
 */
export function priceLookup(book: (partId: string) => ReadonlyArray<BookPriceRow>, invoice: (partKey: string) => number | null, today: string): (partKey: string) => PricePick | null {
  return (partKey) => {
    const fromInvoice = invoicePick(invoice(partKey))
    if (!partKey.startsWith('id:')) return fromInvoice
    const fromBook = pickBookPrice(book(partKey.slice(3)), today)
    if (fromBook && !fromBook.stale) return fromBook
    return fromInvoice ?? fromBook
  }
}

/** "Oct 3" this year, "Oct 3, 2025" another. */
function dayWords(ymd: string, today: string): string {
  const short = formatWorkDateYmdMonthDayShort(ymd)
  return ymd.slice(0, 4) === today.slice(0, 4) ? short : `${short}, ${ymd.slice(0, 4)}`
}

/**
 * The words beside a priced figure: "parts book · checked Oct 3", "parts book · checked Jul 1, 129 days
 * ago" when stale, "parts book · never checked", "invoice price", or a site's own price: "Pecan Supply’s
 * bill · Sep 30", "typed by Dana · Nov 13".
 */
export function priceWords(pick: PricePick, today: string): string {
  if (pick.from === 'invoice') return 'invoice price'
  if (pick.from === 'site') {
    const day = pick.checkedOn ? ` · ${dayWords(pick.checkedOn, today)}` : ''
    const old = pick.stale && pick.ageDays != null ? `, ${pick.ageDays} days ago` : ''
    if (pick.via === 'bill') return `${pick.supplyHouse ? `${pick.supplyHouse}’s bill` : 'a bill'}${day}${old}`
    if (pick.via === 'book') return `the parts book’s price for ${pick.bookPart || 'a part'}${pick.checkedOn ? ` · checked ${dayWords(pick.checkedOn, today)}` : ''}${old}`
    return `typed${pick.byName ? ` by ${pick.byName}` : ''}${day}${old}`
  }
  if (!pick.checkedOn) return 'parts book · never checked'
  const day = dayWords(pick.checkedOn, today)
  if (pick.stale && pick.ageDays != null) return `parts book · checked ${day}, ${pick.ageDays} days ago`
  return `parts book · checked ${day}`
}

/** The longer line for a title: "Pecan Supply's price, checked Oct 3." / "The price typed off the invoice that landed the part." */
export function priceTitle(pick: PricePick, today: string): string {
  if (pick.from === 'invoice') return 'The price typed off the invoice that landed the part.'
  if (pick.from === 'site') {
    const by = pick.byName ? ` by ${pick.byName}` : ''
    const old = pick.stale ? ` It is older than ${BOOK_PRICE_FRESH_DAYS} days.` : ''
    const on = pick.checkedOn ? ` of ${dayWords(pick.checkedOn, today)}` : ''
    if (pick.via === 'bill') return `What ${pick.supplyHouse ? `${pick.supplyHouse}’s bill` : 'a bill'}${on} paid, accepted for this site${by}.${old}`
    if (pick.via === 'book') return `The parts book’s price for ${pick.bookPart || 'a part'}, taken for this site${by}. The row keeps its own name.${old}`
    return `A price typed for this site${by}${pick.checkedOn ? ` on ${dayWords(pick.checkedOn, today)}` : ''}.${old}`
  }
  const whose = pick.supplyHouse ? `${pick.supplyHouse}’s price` : 'The parts book’s price'
  if (!pick.checkedOn) return `${whose}, never checked.`
  const when = `checked ${dayWords(pick.checkedOn, today)}`
  return pick.stale ? `${whose}, ${when}, older than ${BOOK_PRICE_FRESH_DAYS} days.` : `${whose}, ${when}.`
}

/** The distinct book parts a ledger names, for the store's one read. */
export function bookPartIds(movements: ReadonlyArray<{ partId: string | null }>): string[] {
  return [...new Set(movements.map((m) => m.partId).filter((id): id is string => Boolean(id)))]
}
