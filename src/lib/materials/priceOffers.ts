/**
 * Price offers for a row with no price (punch list #342, PR 1): where a price could come from,
 * found by words and never accepted by the app.
 *
 * A row on a site's materials screen is usually a name a crew typed. The parts book may hold the
 * same part under a longer name, and a supply house bill may have a line for it. An offer is a
 * candidate whose name holds every word of the row's name, as the screen's own same-words fold
 * reads both (`sameWordsKey`): `1" pex tees` fits `1" PEX TEE BRASS`, and never a 2 inch part.
 *
 * An offer is a guess. On the first site measured a name with a size and no material fitted a PVC
 * part, a copper one and a PEX one at prices far apart, and three of eight lone fits were a
 * different thing. So nothing here picks one: the rule returns the list, a person presses, and an
 * offer is never added to a money figure.
 *
 * Pure: the parts book's names and prices and the bills' lines come in (`priceOffersIo.ts`), the
 * offers go out. The window is `components/materials/SitePricingWindow.tsx`.
 */
import { pickBookPrice, priceWords, type BookPriceRow, type PricePick } from './bookPrice'
import { priceEach } from './lines/whatWeBuy'
import type { PricingUnit } from './lines/paperChecks'
import { sameWordsKey, type SitePartRow } from './siteRollup'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

/** A part of the parts book, as the offers read it. */
export type OfferPart = { id: string; name: string; manufacturer: string | null }

/** One priced part line of a supply house bill (`supply_purchase_lines`). */
export type OfferLine = {
  id: string
  houseId: string | null
  houseName: string
  /** YYYY-MM-DD; null when the paper prints none. */
  datedOn: string | null
  houseCode: string
  description: string
  unit: string
  pricingUnit: PricingUnit
  unitPrice: number | null
  quantity: number | null
  extendedCents: number | null
}

export type OfferSources = {
  parts: ReadonlyArray<OfferPart>
  prices: ReadonlyArray<BookPriceRow>
  lines: ReadonlyArray<OfferLine>
}

/** A parts-book part that fits, with the price the one rule would read for it. Accepting it is a tie. */
export type BookOffer = {
  kind: 'book'
  key: string
  partId: string
  name: string
  manufacturer: string | null
  pick: PricePick
  /** Words the candidate has that the row's name does not: fewer is a closer fit. */
  extra: number
}

/** What a supply house bill paid for a line that fits: the newest line of that house with those words. */
export type BillOffer = {
  kind: 'bill'
  key: string
  lineId: string
  description: string
  houseId: string | null
  houseName: string
  datedOn: string | null
  /** The price for one, through the bill's pricing unit. */
  priceEach: number
  /** The unit the bill sells it by, as printed: EA, FT. */
  unit: string
  /** How many lines of that house read the same words. */
  bills: number
  extra: number
}

export type PriceOffer = BookOffer | BillOffer

/** A name needs at least this many words before anything is offered: one word alone fits too much. */
export const OFFER_MIN_WORDS = 2

/**
 * The words a name is matched by: the same-words fold with the inch mark set aside, so a bill's
 * `2 PVC DWV 90` and a crew's `2" 90 pvc` share their `2`. The screen's rows never fold this way
 * (a bare 2 is not read as 2 inch there); an offer may, because a person accepts it.
 */
export function offerTokens(name: string): string[] {
  return sameWordsKey(name)
    .split(' ')
    .map((t) => t.replace(/"/g, ''))
    .filter(Boolean)
}

/** The words the parts-book picker opens on for a name: the folded words, as the book would spell a size. */
export function bookSearchFolded(name: string): string {
  return offerTokens(name)
    .map((t) => t.replace(/×/g, 'x'))
    .slice(0, 6)
    .join(' ')
}

type BookEntry = { tokens: ReadonlySet<string>; part: OfferPart; pick: PricePick }
type BillEntry = { tokens: ReadonlySet<string>; line: OfferLine; priceEach: number; bills: number }

/** The sources folded once, so each row is a pass over two lists. */
export type OfferIndex = { book: BookEntry[]; bills: BillEntry[] }

export function buildOfferIndex(sources: OfferSources, today: string): OfferIndex {
  const priceRows = new Map<string, BookPriceRow[]>()
  for (const p of sources.prices) {
    const list = priceRows.get(p.partId)
    if (list) list.push(p)
    else priceRows.set(p.partId, [p])
  }
  const book: BookEntry[] = []
  for (const part of sources.parts) {
    // A part with no price in the book prices nothing: the picker still reaches it by words.
    const pick = pickBookPrice(priceRows.get(part.id) ?? [], today)
    if (!pick) continue
    book.push({ tokens: new Set(offerTokens(part.name)), part, pick })
  }
  // One offer per house and wording: the newest line, with how many lines read the same. A house prints one part
  // under more than one number, and three rows of the same words at the same price tell the reader nothing.
  const byCode = new Map<string, { line: OfferLine; priceEach: number; bills: number }>()
  for (const line of sources.lines) {
    const each = priceEach(line)
    // A credit or a line with nothing to divide has no price for one.
    if (each == null || each <= 0 || (line.quantity ?? 0) < 0) continue
    const key = `${line.houseId ?? ''}|${sameWordsKey(line.description)}`
    const cur = byCode.get(key)
    if (!cur) byCode.set(key, { line, priceEach: each, bills: 1 })
    else {
      cur.bills += 1
      if ((line.datedOn ?? '') > (cur.line.datedOn ?? '')) {
        cur.line = line
        cur.priceEach = each
      }
    }
  }
  const bills: BillEntry[] = [...byCode.values()].map((g) => ({ tokens: new Set(offerTokens(g.line.description)), line: g.line, priceEach: g.priceEach, bills: g.bills }))
  return { book, bills }
}

function fits(words: ReadonlyArray<string>, candidate: ReadonlySet<string>): boolean {
  return words.every((w) => candidate.has(w))
}

/**
 * A row's offers: the parts-book parts that fit, closest first, then the bills, closest then
 * newest first. A row that is already a parts-book part is offered bills only. A name of one word
 * is offered nothing.
 */
export function rowOffers(row: Pick<SitePartRow, 'name' | 'partId'>, index: OfferIndex): PriceOffer[] {
  const words = offerTokens(row.name)
  if (words.length < OFFER_MIN_WORDS) return []
  const book: BookOffer[] = []
  if (!row.partId) {
    for (const e of index.book) {
      if (!fits(words, e.tokens)) continue
      book.push({ kind: 'book', key: `book:${e.part.id}`, partId: e.part.id, name: e.part.name, manufacturer: e.part.manufacturer, pick: e.pick, extra: e.tokens.size - words.length })
    }
    book.sort((a, b) => a.extra - b.extra || Number(a.pick.stale) - Number(b.pick.stale) || (b.pick.checkedOn ?? '').localeCompare(a.pick.checkedOn ?? '') || a.name.localeCompare(b.name))
  }
  const bills: BillOffer[] = []
  for (const e of index.bills) {
    if (!fits(words, e.tokens)) continue
    bills.push({ kind: 'bill', key: `bill:${e.line.id}`, lineId: e.line.id, description: e.line.description, houseId: e.line.houseId, houseName: e.line.houseName, datedOn: e.line.datedOn, priceEach: e.priceEach, unit: e.line.unit, bills: e.bills, extra: e.tokens.size - words.length })
  }
  bills.sort((a, b) => a.extra - b.extra || (b.datedOn ?? '').localeCompare(a.datedOn ?? '') || a.description.localeCompare(b.description))
  return [...book, ...bills]
}

/** Every row's offers by row key; a row with none is left out. */
export function siteOffers(rows: ReadonlyArray<Pick<SitePartRow, 'key' | 'name' | 'partId'>>, index: OfferIndex): Map<string, PriceOffer[]> {
  const out = new Map<string, PriceOffer[]>()
  for (const row of rows) {
    const offers = rowOffers(row, index)
    if (offers.length > 0) out.set(row.key, offers)
  }
  return out
}

function dollars(n: number): string {
  // A fitting priced by the hundred can cost under a cent: three places keep it from reading $0.00.
  const digits = n < 0.1 ? 3 : 2
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

/** "Oct 3" this year, "Oct 3, 2025" another. */
function dayWords(ymd: string, today: string): string {
  const short = formatWorkDateYmdMonthDayShort(ymd)
  return ymd.slice(0, 4) === today.slice(0, 4) ? short : `${short}, ${ymd.slice(0, 4)}`
}

/**
 * An offer as the window draws it: the candidate's own name, where it comes from with its day,
 * and the price for one. The source always opens with the word Offer.
 */
export function offerWords(offer: PriceOffer, today: string): { name: string; from: string; price: string } {
  if (offer.kind === 'book') return { name: offer.name, from: `Offer · ${priceWords(offer.pick, today)}`, price: dollars(offer.pick.price) }
  const house = offer.houseName || 'a supply house'
  const day = offer.datedOn ? ` · ${dayWords(offer.datedOn, today)}` : ''
  const unit = offer.unit.trim() ? ` · sold by ${offer.unit.trim().toUpperCase()}` : ''
  return { name: offer.description, from: `Offer · a bill · ${house}${day}${unit}`, price: `${dollars(offer.priceEach)} each` }
}

/** "41 rows have an offer" for the Worth tile; empty when none has. A count of rows, never dollars. */
export function offerRowsWords(rowsWithOffer: number): string {
  if (rowsWithOffer <= 0) return ''
  return `${rowsWithOffer.toLocaleString('en-US')} ${rowsWithOffer === 1 ? 'row has' : 'rows have'} an offer`
}
