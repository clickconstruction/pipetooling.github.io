/**
 * Supply house bill lines, What we buy (punch list #298 PR 4a, v2.7114; frame G of the card's mock-up). Pure. The
 * lines that count as purchases (the view `supply_purchase_lines`: invoices and credits whose check passed, a credit
 * signed negative) grouped into what the company buys: per part where a line is matched, and per house and code where
 * it is not, so the page is useful before anyone has matched a code.
 *
 *   * A line finds its part by its own `part_id`, else by the house's number for it (`supply_part_codes`, the
 *     crosswalk of punch list #308). A code the crosswalk marks *not a part* counts as a charge.
 *   * A line with no part is grouped by its house and its code; with no code either, by its house and its words.
 *   * A bill split across jobs by percent gives each job that share of its lines, when the page is held to a job.
 *   * Freight, fuel and fees are counted as spend under Charges, never as a part (the card's call 6).
 *
 * The reads are `purchaseLinesIo.ts`; the page is `WhatWeBuyTab.tsx`.
 */
import { foldCode, foldName } from '../partMatch'
import { PRICING_UNIT_DIVISOR, type PricingUnit } from './paperChecks'

/** One row of `supply_purchase_lines`, as the page reads it. Quantity and extension are signed by the view: a credit is negative. */
export interface PurchaseLine {
  id: string
  invoiceId: string
  /** The paper's own number, as printed. */
  billNumber?: string
  houseId: string | null
  /** YYYY-MM-DD, the paper's date; null when the paper prints none. */
  datedOn: string | null
  lineKind: 'part' | 'charge'
  houseCode: string
  /** The manufacturer's number, when the paper prints one apart from the house's code. */
  mfrNumber?: string
  description: string
  unit: string
  pricingUnit: PricingUnit
  unitPrice: number | null
  partId: string | null
  quantity: number | null
  extendedCents: number | null
}

/** A house's number for a part, from the crosswalk. */
export interface CodeTeach {
  houseId: string
  /** Folded as `foldCode` folds it. */
  codeKey: string
  partId: string | null
  notAPart: boolean
  /** How many of the book's units one of the house's prices covers (a stick of ten feet against a book priced a foot: 10). 1 when not said. */
  unitFactor?: number
}

export type BuySort = 'spend' | 'quantity' | 'often'

export interface BuyFilters {
  /** '' for every house. */
  houseId: string
  /** '' for every job. */
  jobId: string
  /** YYYY-MM, both ends counted. */
  fromMonth: string
  toMonth: string
  sort: BuySort
}

export interface BuyRow {
  key: string
  /** The part's name from the book, or the line as printed when no part is matched. */
  name: string
  partId: string | null
  /** For a row with no part: the house and its code, *Pecan Supply Co 0417-2210*. '' for a matched part. */
  byCode: string
  /** How many bills carry it. */
  bills: number
  quantity: number
  /** The unit most of its lines print, upper case; '' when none prints one. */
  unit: string
  /** True when its lines print more than one unit, so the quantity adds unlike things. */
  mixedUnits: boolean
  spendCents: number
  /** Spend in each month of the span, oldest first. */
  byMonth: number[]
  /** The houses it was bought at, the most spent first. */
  houses: string[]
  /** The newest purchase's price for one, in dollars, and its day; null when no line prints a price or a quantity. */
  lastPaid: { priceEach: number; datedOn: string } | null
}

export interface BuySummary {
  /** Spend on parts in the span, and the bills it is on. */
  partsCents: number
  bills: number
  /** Freight, fuel and fees. */
  chargesCents: number
  /** Rows, and how many of them have no part yet. */
  rows: number
  byCodeOnly: number
}

/** The months of a span, oldest first: '2026-05'…'2026-10'. Empty when the span is backwards or not a month. */
export function monthsOfSpan(fromMonth: string, toMonth: string): string[] {
  const m = /^(\d{4})-(\d{2})$/
  const a = m.exec(fromMonth)
  const b = m.exec(toMonth)
  if (!a || !b) return []
  const out: string[] = []
  let y = Number(a[1])
  let mo = Number(a[2])
  const endY = Number(b[1])
  const endMo = Number(b[2])
  while ((y < endY || (y === endY && mo <= endMo)) && out.length < 120) {
    out.push(`${y}-${String(mo).padStart(2, '0')}`)
    mo += 1
    if (mo > 12) {
      mo = 1
      y += 1
    }
  }
  return out
}

/** The span the page opens on: the six months that end with this one. */
export function defaultSpan(todayYmd: string): { fromMonth: string; toMonth: string } {
  const y = Number(todayYmd.slice(0, 4))
  const mo = Number(todayYmd.slice(5, 7))
  const from = new Date(Date.UTC(y, mo - 1 - 5, 1))
  return { fromMonth: `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, '0')}`, toMonth: todayYmd.slice(0, 7) }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '2026-05' → 'May 2026'. */
export function monthWords(month: string): string {
  const mo = Number(month.slice(5, 7))
  return `${MONTHS[mo - 1] ?? month} ${month.slice(0, 4)}`
}

/** The crosswalk by house and folded code. */
export function indexTeaches(teaches: readonly CodeTeach[]): Map<string, CodeTeach> {
  return new Map(teaches.map((t) => [`${t.houseId}|${t.codeKey}`, t]))
}

/** What a line is: a part in the book, a code at a house, words at a house, or a charge. */
export function lineIdentity(line: Pick<PurchaseLine, 'lineKind' | 'houseId' | 'houseCode' | 'description' | 'partId'>, teaches: ReadonlyMap<string, CodeTeach>): { kind: 'part'; key: string; partId: string } | { kind: 'code' | 'words'; key: string } | { kind: 'charge' } {
  if (line.lineKind === 'charge') return { kind: 'charge' }
  if (line.partId) return { kind: 'part', key: `part:${line.partId}`, partId: line.partId }
  const house = line.houseId ?? ''
  const codeKey = foldCode(line.houseCode)
  if (codeKey) {
    const taught = teaches.get(`${house}|${codeKey}`)
    if (taught?.notAPart) return { kind: 'charge' }
    if (taught?.partId) return { kind: 'part', key: `part:${taught.partId}`, partId: taught.partId }
    return { kind: 'code', key: `code:${house}|${codeKey}` }
  }
  return { kind: 'words', key: `words:${house}|${foldName(line.description)}` }
}

/** A line's price for one, in dollars: the printed price through its pricing unit, else the extension over the quantity. */
export function priceEach(line: Pick<PurchaseLine, 'unitPrice' | 'pricingUnit' | 'quantity' | 'extendedCents'>): number | null {
  if (line.unitPrice != null && line.unitPrice > 0) return line.unitPrice / PRICING_UNIT_DIVISOR[line.pricingUnit]
  if (line.quantity && line.extendedCents != null && line.extendedCents !== 0) return Math.abs(line.extendedCents / line.quantity) / 100
  return null
}

type Acc = {
  key: string
  partId: string | null
  houseId: string | null
  code: string
  words: string
  wordsDay: string
  bills: Set<string>
  quantity: number
  units: Map<string, number>
  spendCents: number
  byMonth: number[]
  byHouse: Map<string, number>
  last: { priceEach: number; datedOn: string } | null
}

/**
 * What the company buys in a span, as rows with their summary. `shares` is each bill's share for the job the page is
 * held to, 0 to 1, and is read only when `filters.jobId` is set: a bill with no share on that job is left out, and
 * one split by percent gives that percent of its quantity and spend.
 */
export function whatWeBuy(args: {
  lines: readonly PurchaseLine[]
  teaches: readonly CodeTeach[]
  partNames: ReadonlyMap<string, string>
  houseNames: ReadonlyMap<string, string>
  /** invoice id → share on the filtered job. */
  shares?: ReadonlyMap<string, number>
  filters: BuyFilters
}): { rows: BuyRow[]; summary: BuySummary; months: string[] } {
  const months = monthsOfSpan(args.filters.fromMonth, args.filters.toMonth)
  const monthIndex = new Map(months.map((m, i) => [m, i]))
  const teaches = indexTeaches(args.teaches)
  const accs = new Map<string, Acc>()
  const summary: BuySummary = { partsCents: 0, bills: 0, chargesCents: 0, rows: 0, byCodeOnly: 0 }
  const billsCounted = new Set<string>()

  for (const line of args.lines) {
    if (!line.datedOn) continue
    const mi = monthIndex.get(line.datedOn.slice(0, 7))
    if (mi == null) continue
    if (args.filters.houseId && line.houseId !== args.filters.houseId) continue
    let share = 1
    if (args.filters.jobId) {
      share = args.shares?.get(line.invoiceId) ?? 0
      if (share <= 0) continue
    }
    const cents = Math.round((line.extendedCents ?? 0) * share)
    const identity = lineIdentity(line, teaches)
    billsCounted.add(line.invoiceId)
    if (identity.kind === 'charge') {
      summary.chargesCents += cents
      continue
    }
    summary.partsCents += cents
    let acc = accs.get(identity.key)
    if (!acc) {
      acc = { key: identity.key, partId: identity.kind === 'part' ? identity.partId : null, houseId: line.houseId, code: line.houseCode.trim(), words: line.description, wordsDay: line.datedOn, bills: new Set(), quantity: 0, units: new Map(), spendCents: 0, byMonth: months.map(() => 0), byHouse: new Map(), last: null }
      accs.set(identity.key, acc)
    }
    acc.bills.add(line.invoiceId)
    acc.quantity += (line.quantity ?? 0) * share
    const unit = line.unit.trim().toUpperCase()
    if (unit) acc.units.set(unit, (acc.units.get(unit) ?? 0) + 1)
    acc.spendCents += cents
    acc.byMonth[mi] = (acc.byMonth[mi] ?? 0) + cents
    const houseName = (line.houseId && args.houseNames.get(line.houseId)) || 'No house'
    acc.byHouse.set(houseName, (acc.byHouse.get(houseName) ?? 0) + cents)
    // The newest line's words name a row with no part, and its price is the last paid.
    if (line.datedOn >= acc.wordsDay && line.description.trim()) {
      acc.words = line.description
      acc.wordsDay = line.datedOn
    }
    const each = priceEach(line)
    if (each != null && (line.quantity ?? 0) > 0 && (!acc.last || line.datedOn >= acc.last.datedOn)) acc.last = { priceEach: each, datedOn: line.datedOn }
  }

  const rows: BuyRow[] = [...accs.values()].map((a) => {
    const units = [...a.units.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    const houseName = (a.houseId && args.houseNames.get(a.houseId)) || 'No house'
    return {
      key: a.key,
      name: a.partId ? args.partNames.get(a.partId) || a.words.trim() || 'A part in the book' : a.words.trim() || a.code || 'No description',
      partId: a.partId,
      byCode: a.partId ? '' : [houseName, a.code].filter(Boolean).join(' '),
      bills: a.bills.size,
      quantity: Math.round(a.quantity * 1000) / 1000,
      unit: units[0]?.[0] ?? '',
      mixedUnits: units.length > 1,
      spendCents: a.spendCents,
      byMonth: a.byMonth,
      houses: [...a.byHouse.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([name]) => name),
      lastPaid: a.last,
    }
  })
  const by: Record<BuySort, (r: BuyRow) => number> = { spend: (r) => r.spendCents, quantity: (r) => r.quantity, often: (r) => r.bills }
  const measure = by[args.filters.sort]
  rows.sort((x, y) => measure(y) - measure(x) || y.spendCents - x.spendCents || x.name.localeCompare(y.name))

  summary.bills = billsCounted.size
  summary.rows = rows.length
  summary.byCodeOnly = rows.filter((r) => !r.partId).length
  return { rows, summary, months }
}

/** *43 times*, *1 time*: how many bills carry a row. */
export function timesWords(bills: number): string {
  return `${bills.toLocaleString('en-US')} ${bills === 1 ? 'time' : 'times'}`
}

/** *5,320 FT*, *196 EA*, *12* with no unit, and *about* in front when the lines print more than one unit. */
export function quantityWords(row: Pick<BuyRow, 'quantity' | 'unit' | 'mixedUnits'>): string {
  const q = row.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${row.mixedUnits ? 'about ' : ''}${q}${row.unit ? ` ${row.unit}` : ''}`
}

/** A price for one as money: $3.84, and three places under a dollar so a foot of pipe reads $0.507. */
export function priceWords(priceEachDollars: number): string {
  const places = priceEachDollars < 1 ? 3 : 2
  return `$${priceEachDollars.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places })}`
}

/** Whole dollars for the table: $19,702. */
export function dollarsWords(cents: number): string {
  const sign = cents < 0 ? '−' : ''
  return `${sign}$${Math.round(Math.abs(cents) / 100).toLocaleString('en-US')}`
}

/** The foot of the page: what is counted, and the three limits the card states. */
export const WHAT_WE_BUY_FOOT = [
  'Counts bills and credits whose lines add up, or that a person counted as read. Quotes, acknowledgements and ship tickets are never counted.',
  'A bill split across jobs by percent gives its lines to each job by that percent.',
  'A part with no match is counted by its house’s code. The same part bought at two houses is two rows until someone matches it.',
  'Card purchases at big-box stores are not here. They have no lines on any paper.',
] as const
