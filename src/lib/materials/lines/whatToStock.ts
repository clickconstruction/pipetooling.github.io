/**
 * Supply house bill lines, What to stock (punch list #298 PR 4c, v2.7118; frame I of the card's mock-up). Pure. The
 * owner's ask was what to stack up on. A bill cannot say what was used; it can say what the company keeps going
 * back for: a part bought on many separate days in small counts. So the rows are ranked by trips, not by dollars,
 * since the trip is the cost that stock on a shelf would save.
 *
 *   * A trip is a day the row was bought. Two bills on one day are one trip.
 *   * A trip is to the counter when its bill carries a PO Generator code (the code a tech is given at the counter)
 *     or the whole bill is small. A row mostly bought on big bills was delivered, and is said so.
 *   * A return is not a trip.
 */
import { indexTeaches, lineIdentity, priceEach, priceWords, type CodeTeach, type PurchaseLine } from './whatWeBuy'

/** A bill under this, lines and charges together, reads as a trip to the counter. */
export const SMALL_BILL_CENTS = 25_000
/** A row needs this many trips in the window to be listed. */
export const STOCK_MIN_TRIPS = 3
/** The windows the page offers, in days. */
export const STOCK_WINDOWS = [30, 90, 180] as const
export type StockWindow = (typeof STOCK_WINDOWS)[number]

export interface StockRow {
  key: string
  name: string
  partId: string | null
  /** For a row with no part: the house and its code. */
  byCode: string
  /** Separate days it was bought in the window. */
  trips: number
  /** The fewest and the most bought on one bill. */
  atATime: { min: number; max: number }
  unit: string
  /** Jobs the bills are on. */
  jobs: number
  spendCents: number
  /** Whether most of its trips were to the counter. */
  counter: boolean
  houses: string[]
  /** One line a person can read the row as. */
  readAs: string
}

const DAY_MS = 86_400_000

/** The first day of a window that ends today, YYYY-MM-DD. */
export function windowStart(todayYmd: string, days: number): string {
  return new Date(Date.parse(`${todayYmd}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10)
}

/** *2 to 4*, or *1* when every bill carried the same count. */
export function atATimeWords(a: { min: number; max: number }): string {
  const f = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return a.min === a.max ? f(a.min) : `${f(a.min)} to ${f(a.max)}`
}

/** *the counter, Ridgeway Supply*, *the counter, both houses*, *delivered, 3 houses*. */
export function whereWords(row: Pick<StockRow, 'counter' | 'houses'>): string {
  const houses = row.houses.length === 1 ? row.houses[0]! : row.houses.length === 2 ? 'both houses' : `${row.houses.length} houses`
  return `${row.counter ? 'the counter' : 'delivered'}, ${houses}`
}

/**
 * The parts the company keeps going back for, the most trips first. `counterBills` are the bills that carry a PO
 * Generator code; `jobsOfBill` the jobs each bill is on.
 */
export function whatToStock(args: {
  lines: readonly PurchaseLine[]
  teaches: readonly CodeTeach[]
  partNames: ReadonlyMap<string, string>
  houseNames: ReadonlyMap<string, string>
  jobsOfBill: ReadonlyMap<string, readonly string[]>
  counterBills: ReadonlySet<string>
  todayYmd: string
  windowDays: number
}): StockRow[] {
  const from = windowStart(args.todayYmd, args.windowDays)
  const teaches = indexTeaches(args.teaches)
  const inWindow = args.lines.filter((l) => l.datedOn && l.datedOn >= from && l.datedOn <= args.todayYmd)
  // A bill's whole size, parts and charges, says whether it was a trip to the counter.
  const billCents = new Map<string, number>()
  for (const l of inWindow) billCents.set(l.invoiceId, (billCents.get(l.invoiceId) ?? 0) + (l.extendedCents ?? 0))

  type Acc = { key: string; partId: string | null; houseId: string | null; code: string; words: string; wordsDay: string; bills: Map<string, { day: string; qty: number }>; units: Map<string, number>; spendCents: number; houses: Set<string>; priceSum: number; priceN: number }
  const accs = new Map<string, Acc>()
  for (const line of inWindow) {
    // A return is not a trip, and a line with no count says nothing about how many at a time.
    if ((line.quantity ?? 0) <= 0) continue
    const identity = lineIdentity(line, teaches)
    if (identity.kind === 'charge') continue
    let acc = accs.get(identity.key)
    if (!acc) {
      acc = { key: identity.key, partId: identity.kind === 'part' ? identity.partId : null, houseId: line.houseId, code: line.houseCode.trim(), words: line.description, wordsDay: line.datedOn!, bills: new Map(), units: new Map(), spendCents: 0, houses: new Set(), priceSum: 0, priceN: 0 }
      accs.set(identity.key, acc)
    }
    const bill = acc.bills.get(line.invoiceId) ?? { day: line.datedOn!, qty: 0 }
    bill.qty += line.quantity ?? 0
    acc.bills.set(line.invoiceId, bill)
    const unit = line.unit.trim().toUpperCase()
    if (unit) acc.units.set(unit, (acc.units.get(unit) ?? 0) + 1)
    acc.spendCents += line.extendedCents ?? 0
    acc.houses.add((line.houseId && args.houseNames.get(line.houseId)) || 'No house')
    if (line.datedOn! >= acc.wordsDay && line.description.trim()) {
      acc.words = line.description
      acc.wordsDay = line.datedOn!
    }
    const each = priceEach(line)
    if (each != null) {
      acc.priceSum += each
      acc.priceN += 1
    }
  }

  const rows: StockRow[] = []
  for (const a of accs.values()) {
    const days = new Map<string, boolean>()
    const jobs = new Set<string>()
    let min = Infinity
    let max = 0
    for (const [invoiceId, bill] of a.bills) {
      const counter = args.counterBills.has(invoiceId) || (billCents.get(invoiceId) ?? 0) < SMALL_BILL_CENTS
      days.set(bill.day, (days.get(bill.day) ?? false) || counter)
      for (const j of args.jobsOfBill.get(invoiceId) ?? []) jobs.add(j)
      min = Math.min(min, bill.qty)
      max = Math.max(max, bill.qty)
    }
    const trips = days.size
    if (trips < STOCK_MIN_TRIPS) continue
    const counterTrips = [...days.values()].filter(Boolean).length
    const counter = counterTrips * 2 >= trips
    const houseName = (a.houseId && args.houseNames.get(a.houseId)) || 'No house'
    const price = a.priceN ? a.priceSum / a.priceN : null
    const every = Math.max(1, Math.round(args.windowDays / trips))
    const readAs = !counter
      ? 'on big orders, not a trip to the counter'
      : max <= 1
        ? `one at a time, ${trips} times`
        : `a trip every ${every} ${every === 1 ? 'day' : 'days'}${price != null ? ` for a ${priceWords(price)} part` : ''}`
    rows.push({
      key: a.key,
      name: a.partId ? args.partNames.get(a.partId) || a.words.trim() || 'A part in the book' : a.words.trim() || a.code || 'No description',
      partId: a.partId,
      byCode: a.partId ? '' : [houseName, a.code].filter(Boolean).join(' '),
      trips,
      atATime: { min: Math.round(min * 1000) / 1000, max: Math.round(max * 1000) / 1000 },
      unit: [...a.units.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]?.[0] ?? '',
      jobs: jobs.size,
      spendCents: a.spendCents,
      counter,
      houses: [...a.houses].sort(),
      readAs,
    })
  }
  rows.sort((x, y) => y.trips - x.trips || y.jobs - x.jobs || x.spendCents - y.spendCents || x.name.localeCompare(y.name))
  return rows
}

/** What the page says a bill can and cannot tell, and what is missing from it. */
export const WHAT_TO_STOCK_LIMITS = {
  purchases:
    'A bill says what was bought, when, from whom and for what. It does not say what was installed, what sat on a truck, what moved between jobs or what walked away. So this list answers what we keep going back for. It cannot answer how many the jobs used.',
  bigBox: 'Card purchases at big-box stores are not here. They have no lines on any paper, and they are the small, frequent buys this list most wants. A photo of the receipt at the counter is the door for them.',
} as const
