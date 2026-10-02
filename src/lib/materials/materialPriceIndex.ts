/**
 * What your materials cost (v2.4391): one monthly number for the parts you bid with, read from
 * the price book's own history (`material_part_price_history`, written by the
 * `track_price_history` trigger on every price insert and change).
 *
 * - **The basket** is the part + supply house pairs your takeoffs price from, each weighted by
 *   what you spend on it (Σ quantity × unit price × fixture count over the last year of lines).
 *   A 33¢ hook barely moves the number; a water heater does.
 * - **Each month** is the spend-weighted geometric mean of every basket price's move since the
 *   month before, chained from {@link MATERIAL_PRICE_BASE_MONTH} = 100.
 * - **A big jump is set aside** ({@link isBigJump}): a move to 1.5× or more, or to half or less,
 *   is a fixed typo or a pack size more often than the market, so it counts as no move. A price
 *   of {@link PLACEHOLDER_PRICE} or more is a stand-in, never a price.
 * - **Freshness** is the share of basket spend whose price was entered, changed or confirmed in
 *   the last 30 and 90 days. Under half within 90 days, the number is not shown
 *   ({@link MaterialPriceIndex.showNumber}): a flat line then means nobody looked, not that
 *   prices held (on 2026-10-01, 9 in 10 of the parts bid with had never been re-priced).
 *
 * Pure: no React, no supabase. The reads are `materialPriceIndexIo.ts`.
 */
import { ymdAddDays, ymdDaysBetween } from '../../utils/dateUtils'

/** The month that reads 100: February 2026, the first full month with price history. */
export const MATERIAL_PRICE_BASE_MONTH = '2026-02'
/** A price this high is a stand-in, not a price (a Reece sink read $999,999 on BP338). */
export const PLACEHOLDER_PRICE = 999_999
/** A month drawn faint: under this share of basket spend had a price at its end. */
export const FAINT_COVERAGE = 0.25
/** Under this share of spend checked within 90 days, the number is not shown. */
export const MIN_FRESH_SHARE = 0.5
/** Below this move either way, a change reads "about the same". */
export const SAME_BAND = 0.01

/** A move to 1.5× or more, or to half or less — or a price that is not a price. */
export function isBigJump(oldPrice: number, newPrice: number): boolean {
  if (!(oldPrice > 0) || !(newPrice > 0)) return true
  if (oldPrice >= PLACEHOLDER_PRICE || newPrice >= PLACEHOLDER_PRICE) return true
  const ratio = newPrice / oldPrice
  return ratio >= 1.5 || ratio <= 0.5
}

/** One `material_part_price_history` row. */
export type PriceEvent = {
  partId: string
  houseId: string
  /** null on a first price (the row's insert). */
  oldPrice: number | null
  newPrice: number
  /** App-calendar day of `changed_at`. */
  day: string
  /** `changed_at` as stored, for ordering within a day. */
  at: string
}

/** One part at one supply house, as the takeoffs price it. */
export type BasketPair = {
  partId: string
  houseId: string
  partName: string
  houseName: string
  /** Σ quantity × unit price × fixture count over the takeoff lines priced from it. */
  spend: number
  /** Today's book price. */
  price: number
  /** App-calendar day the price row was last updated: the "last touched" for a price older than the history. */
  priceUpdatedDay: string | null
  /** Open bids (no outcome, not adopted, not a robot's) with a line priced from it. */
  openBidCount: number
}

export type IndexMonth = {
  /** `YYYY-MM`. */
  month: string
  index: number
  /** Share of basket spend that had a price at the month's end. */
  coverage: number
  /** Too little of the basket had a price yet to read this month as sure. */
  faint: boolean
}

export type MovedPrice = {
  partId: string
  houseId: string
  partName: string
  houseName: string
  day: string
  oldPrice: number
  newPrice: number
  /** new ÷ old − 1. */
  change: number
  openBidCount: number
}

export type MaterialPriceIndex = {
  baseMonth: string
  months: IndexMonth[]
  /** This month's index (to today). */
  latest: number
  /** latest ÷ 100 − 1. */
  sinceBase: number
  /** latest ÷ the index three months back − 1; null before three months of history. */
  last3: number | null
  /** Shares of basket spend by when the price was last entered, changed or confirmed. */
  freshness: { within30: number; within90: number; older: number }
  /** Enough of the basket was checked in 90 days to say anything. */
  showNumber: boolean
  /** The latest ordinary move per price in the last 30 days, newest first. */
  moved: MovedPrice[]
  pairCount: number
  totalSpend: number
}

const pairKey = (partId: string, houseId: string) => `${partId}|${houseId}`

/** `YYYY-MM` months from `from` through `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number) as [number, number]
  const [ty, tm] = to.split('-').map(Number) as [number, number]
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** The last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export function monthEndDay(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

/**
 * The price in effect at the end of `day`: the newest event on or before it; before the first
 * event, that event's old price (a price older than the history); a pair with no events at all
 * has kept today's price since before the history began. Undefined = not priced yet.
 */
function priceOn(events: PriceEvent[], day: string, todayPrice: number): number | undefined {
  if (events.length === 0) return todayPrice
  let found: PriceEvent | undefined
  for (const e of events) {
    if (e.day <= day) found = e
    else break
  }
  if (found) return found.newPrice
  const first = events[0]!
  return first.oldPrice != null && first.oldPrice > 0 ? first.oldPrice : undefined
}

/** Null when the basket is empty (nothing priced from the book in a year of takeoffs). */
export function computeMaterialPriceIndex(args: {
  events: ReadonlyArray<PriceEvent>
  basket: ReadonlyArray<BasketPair>
  today: string
  baseMonth?: string
  movedDays?: number
  movedLimit?: number
}): MaterialPriceIndex | null {
  const { today, baseMonth = MATERIAL_PRICE_BASE_MONTH, movedDays = 30, movedLimit = 3 } = args
  const basket = args.basket.filter((p) => p.spend > 0)
  const totalSpend = basket.reduce((s, p) => s + p.spend, 0)
  if (basket.length === 0 || !(totalSpend > 0)) return null

  const eventsByPair = new Map<string, PriceEvent[]>()
  for (const p of basket) eventsByPair.set(pairKey(p.partId, p.houseId), [])
  for (const e of args.events) eventsByPair.get(pairKey(e.partId, e.houseId))?.push(e)
  for (const list of eventsByPair.values()) list.sort((a, b) => a.at.localeCompare(b.at))

  const todayMonth = today.slice(0, 7)
  const months: IndexMonth[] = []
  let index = 100
  let prevEnd: string | null = null
  for (const month of monthsBetween(baseMonth, todayMonth < baseMonth ? baseMonth : todayMonth)) {
    const end = month === todayMonth ? today : monthEndDay(month)
    let covered = 0
    let weighted = 0
    let weight = 0
    for (const p of basket) {
      const events = eventsByPair.get(pairKey(p.partId, p.houseId))!
      const now = priceOn(events, end, p.price)
      if (now == null) continue
      covered += p.spend
      if (prevEnd == null) continue
      const before = priceOn(events, prevEnd, p.price)
      if (before == null) continue
      weight += p.spend
      if (!isBigJump(before, now)) weighted += p.spend * Math.log(now / before)
    }
    if (prevEnd != null && weight > 0) index *= Math.exp(weighted / weight)
    const coverage = covered / totalSpend
    months.push({ month, index, coverage, faint: coverage < FAINT_COVERAGE })
    prevEnd = end
  }

  const latest = months[months.length - 1]!.index
  const threeBack = months.length > 3 ? months[months.length - 4]! : null

  let within30 = 0
  let within90 = 0
  for (const p of basket) {
    const events = eventsByPair.get(pairKey(p.partId, p.houseId))!
    const lastDay = events.length > 0 ? events.reduce((d, e) => (e.day > d ? e.day : d), events[0]!.day) : p.priceUpdatedDay
    const age = lastDay ? ymdDaysBetween(lastDay, today) : null
    if (age == null) continue
    if (age <= 30) within30 += p.spend
    else if (age <= 90) within90 += p.spend
  }
  const freshness = { within30: within30 / totalSpend, within90: within90 / totalSpend, older: 1 - (within30 + within90) / totalSpend }

  const since = ymdAddDays(today, -movedDays)
  const pairByKey = new Map(basket.map((p) => [pairKey(p.partId, p.houseId), p]))
  const latestMove = new Map<string, PriceEvent>()
  for (const e of args.events) {
    const key = pairKey(e.partId, e.houseId)
    if (!pairByKey.has(key) || e.day < since || e.oldPrice == null || e.oldPrice === e.newPrice || isBigJump(e.oldPrice, e.newPrice)) continue
    const seen = latestMove.get(key)
    if (!seen || e.at > seen.at) latestMove.set(key, e)
  }
  const moved: MovedPrice[] = [...latestMove.entries()]
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .slice(0, movedLimit)
    .map(([key, e]) => {
      const p = pairByKey.get(key)!
      return { partId: p.partId, houseId: p.houseId, partName: p.partName, houseName: p.houseName, day: e.day, oldPrice: e.oldPrice!, newPrice: e.newPrice, change: e.newPrice / e.oldPrice! - 1, openBidCount: p.openBidCount }
    })

  return {
    baseMonth,
    months,
    latest,
    sinceBase: latest / 100 - 1,
    last3: threeBack ? latest / threeBack.index - 1 : null,
    freshness,
    showNumber: within30 / totalSpend + within90 / totalSpend >= MIN_FRESH_SHARE,
    moved,
    pairCount: basket.length,
    totalSpend,
  }
}

export type ChangeWords = { kind: 'same' | 'up' | 'down'; pct: string }

/** A change in plain terms: inside ±1% is "about the same"; otherwise up or down by a one-decimal %. */
export function describeChange(change: number): ChangeWords {
  if (Math.abs(change) < SAME_BAND) return { kind: 'same', pct: '0%' }
  return { kind: change > 0 ? 'up' : 'down', pct: `${(Math.abs(change) * 100).toFixed(1)}%` }
}

/** The month's name, e.g. `2026-02` → "February". */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
}

/** The card's headline: "About the same as February", "Up 2.4% since February", "Down 1.2% since February". */
export function verdictText(index: Pick<MaterialPriceIndex, 'sinceBase' | 'baseMonth'>): string {
  const base = monthName(index.baseMonth)
  const words = describeChange(index.sinceBase)
  if (words.kind === 'same') return `About the same as ${base}`
  return `${words.kind === 'up' ? 'Up' : 'Down'} ${words.pct} since ${base}`
}

/** "about the same", "up 2.4%", "down 1.2%". */
export function changeText(change: number): string {
  const words = describeChange(change)
  return words.kind === 'same' ? 'about the same' : `${words.kind} ${words.pct}`
}
