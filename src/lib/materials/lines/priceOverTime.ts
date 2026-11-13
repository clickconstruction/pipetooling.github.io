/**
 * Supply house bill lines, Price over time (punch list #298 PR 4b, v2.7116; frame H of the card's mock-up). Pure. The
 * book keeps one price per part per house, the last one checked. The lines themselves are the real price history:
 * every purchase is a point with its day, its house, its quantity and what was paid for one. This file turns one
 * row of What we buy into those points, the last price paid at each house, and the scale the chart draws them on.
 *
 * A price is the bill's unit price through its pricing unit (each, per hundred, per thousand) and, where the
 * crosswalk says one of the house's units is several of the book's, through that factor, so a stick and a foot
 * land on one scale. A return is not a price paid and is left out.
 */
import { indexTeaches, lineIdentity, priceEach, type CodeTeach, type PurchaseLine } from './whatWeBuy'
import { foldCode } from '../partMatch'

export interface PricePoint {
  lineId: string
  invoiceId: string
  /** YYYY-MM-DD. */
  datedOn: string
  houseId: string | null
  houseName: string
  billNumber: string
  quantity: number
  unit: string
  /** What was paid for one, in dollars. */
  priceEach: number
  /** The jobs the bill is on, by name. */
  jobs: string[]
}

/**
 * Every purchase of one What we buy row, newest first. `rowKey` is the row's key (`part:<id>`, `code:<house>|<code>`
 * or `words:<house>|<words>`). A line with no price and no quantity to work one out from is left out, and so is a
 * credit's line.
 */
export function pricePoints(args: { lines: readonly PurchaseLine[]; teaches: readonly CodeTeach[]; rowKey: string; houseNames: ReadonlyMap<string, string>; jobsOfBill?: ReadonlyMap<string, readonly string[]> }): PricePoint[] {
  const teaches = indexTeaches(args.teaches)
  const out: PricePoint[] = []
  for (const line of args.lines) {
    if (!line.datedOn || (line.quantity ?? 0) <= 0) continue
    const identity = lineIdentity(line, teaches)
    if (identity.kind === 'charge' || identity.key !== args.rowKey) continue
    const each = priceEach(line)
    if (each == null) continue
    const factor = teaches.get(`${line.houseId ?? ''}|${foldCode(line.houseCode)}`)?.unitFactor ?? 1
    out.push({
      lineId: line.id,
      invoiceId: line.invoiceId,
      datedOn: line.datedOn,
      houseId: line.houseId,
      houseName: (line.houseId && args.houseNames.get(line.houseId)) || 'No house',
      billNumber: line.billNumber ?? '',
      quantity: line.quantity ?? 0,
      unit: line.unit.trim().toUpperCase(),
      priceEach: factor > 0 ? each / factor : each,
      jobs: [...(args.jobsOfBill?.get(line.invoiceId) ?? [])],
    })
  }
  out.sort((a, b) => b.datedOn.localeCompare(a.datedOn) || a.houseName.localeCompare(b.houseName) || a.lineId.localeCompare(b.lineId))
  return out
}

export interface HouseLast {
  houseId: string | null
  houseName: string
  priceEach: number
  datedOn: string
  /** The change since the purchase before it at the same house, as a share: 0.06 is up 6 percent. Null with no earlier purchase. */
  change: number | null
  /** The day of that earlier purchase. */
  sinceYmd: string | null
  /** True for the lowest last price among the houses bought from in the last 90 days, when there are two or more. */
  cheapest: boolean
}

const DAY_MS = 86_400_000
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)

/** The window the cheapest house is judged in. */
export const CHEAPEST_WINDOW_DAYS = 90

/** The last price paid at each house, the newest purchase first. `points` are newest first, as `pricePoints` answers them. */
export function lastPaidByHouse(points: readonly PricePoint[], todayYmd: string): HouseLast[] {
  const byHouse = new Map<string, PricePoint[]>()
  for (const p of points) byHouse.set(p.houseId ?? '', [...(byHouse.get(p.houseId ?? '') ?? []), p])
  const out: HouseLast[] = []
  for (const list of byHouse.values()) {
    const last = list[0]!
    // The purchase before it on an earlier day: two lines on one bill are one purchase.
    const before = list.find((p) => p.datedOn < last.datedOn)
    out.push({ houseId: last.houseId, houseName: last.houseName, priceEach: last.priceEach, datedOn: last.datedOn, change: before && before.priceEach > 0 ? last.priceEach / before.priceEach - 1 : null, sinceYmd: before?.datedOn ?? null, cheapest: false })
  }
  out.sort((a, b) => b.datedOn.localeCompare(a.datedOn) || a.houseName.localeCompare(b.houseName))
  const recent = out.filter((h) => daysBetween(h.datedOn, todayYmd) <= CHEAPEST_WINDOW_DAYS)
  if (recent.length >= 2) {
    const low = Math.min(...recent.map((h) => h.priceEach))
    const lowest = recent.filter((h) => h.priceEach === low)
    if (lowest.length === 1) lowest[0]!.cheapest = true
  }
  return out
}

/** *up 6%*, *down 3%*, *the same*; '' with no earlier purchase. Under half a percent reads as the same. */
export function changeWords(change: number | null): string {
  if (change == null) return ''
  const pct = Math.round(Math.abs(change) * 100)
  if (pct === 0) return 'the same'
  return `${change > 0 ? 'up' : 'down'} ${pct}%`
}

/** A day as the cards print it: *Oct 22*, with the year when it is not this one. */
export function dayWords(ymd: string, todayYmd: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mo = months[Number(ymd.slice(5, 7)) - 1] ?? ''
  const day = Number(ymd.slice(8, 10))
  return ymd.slice(0, 4) === todayYmd.slice(0, 4) ? `${mo} ${day}` : `${mo} ${day}, ${ymd.slice(0, 4)}`
}

/** The houses that get a series of their own; every other house shares the muted mark. A scatter must tell every pair apart, and three hues can. */
export const HOUSE_SERIES_MAX = 3

/**
 * Which series each house draws in, 0 to 2, or null for the muted one. The order is the company's houses by how
 * many lines they have in all, so a house keeps its colour from one part to the next and a filter never repaints it.
 */
export function houseSeries(allLines: readonly Pick<PurchaseLine, 'houseId'>[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const l of allLines) if (l.houseId) counts.set(l.houseId, (counts.get(l.houseId) ?? 0) + 1)
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, HOUSE_SERIES_MAX)
  return new Map(ranked.map(([id], i) => [id, i]))
}

export interface PriceScale {
  /** The days at the chart's two ends, YYYY-MM-DD. */
  fromYmd: string
  toYmd: string
  /** The price at the bottom and the top, in dollars, padded so no point sits on an edge. */
  min: number
  max: number
  /** Three prices to print on the axis, bottom to top. */
  ticks: number[]
  /** The first day of each month to mark, at most six, oldest first. */
  monthMarks: string[]
}

/** The chart's scale for these points and the book's price, when there is one to draw. Null with no point. */
export function priceScale(points: readonly PricePoint[], bookPrice: number | null): PriceScale | null {
  if (points.length === 0) return null
  const prices = [...points.map((p) => p.priceEach), ...(bookPrice != null && bookPrice > 0 ? [bookPrice] : [])]
  let lo = Math.min(...prices)
  let hi = Math.max(...prices)
  // One price, or prices a hair apart, still get a band to sit in.
  const pad = Math.max((hi - lo) * 0.12, hi * 0.02, 0.005)
  lo = Math.max(0, lo - pad)
  hi = hi + pad
  const days = points.map((p) => p.datedOn).sort()
  let fromYmd = days[0]!
  let toYmd = days[days.length - 1]!
  if (fromYmd === toYmd) {
    // One day: a fortnight either side, so the point sits in the middle.
    fromYmd = new Date(Date.parse(`${fromYmd}T00:00:00Z`) - 14 * DAY_MS).toISOString().slice(0, 10)
    toYmd = new Date(Date.parse(`${toYmd}T00:00:00Z`) + 14 * DAY_MS).toISOString().slice(0, 10)
  }
  const months: string[] = []
  let y = Number(fromYmd.slice(0, 4))
  let m = Number(fromYmd.slice(5, 7))
  for (let i = 0; i < 240; i++) {
    const first = `${y}-${String(m).padStart(2, '0')}-01`
    if (first > toYmd) break
    if (first >= fromYmd) months.push(first)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  const step = Math.max(1, Math.ceil(months.length / 6))
  return { fromYmd, toYmd, min: lo, max: hi, ticks: [lo, (lo + hi) / 2, hi], monthMarks: months.filter((_, i) => i % step === 0) }
}

/** Where a day falls on the scale, 0 at the left end to 1 at the right. */
export function dayAt(scale: PriceScale, ymd: string): number {
  const span = daysBetween(scale.fromYmd, scale.toYmd)
  return span <= 0 ? 0.5 : Math.min(1, Math.max(0, daysBetween(scale.fromYmd, ymd) / span))
}

/** Where a price falls on the scale, 0 at the bottom to 1 at the top. */
export function priceAt(scale: PriceScale, price: number): number {
  return scale.max <= scale.min ? 0.5 : Math.min(1, Math.max(0, (price - scale.min) / (scale.max - scale.min)))
}

/**
 * The book's one price for the chart: the row checked most recently, the lower of two checked the same day, as
 * `pickBookPrice` picks it. The book's price is already for one of the book's units. Null when the book has none.
 */
export function bookLine(prices: readonly { houseId: string; price: number; checkedOn: string | null }[]): { price: number; checkedOn: string | null; houseId: string } | null {
  let best: { houseId: string; price: number; checkedOn: string | null } | null = null
  for (const p of prices) {
    if (!best || (p.checkedOn ?? '') > (best.checkedOn ?? '') || ((p.checkedOn ?? '') === (best.checkedOn ?? '') && p.price < best.price)) best = p
  }
  return best
}

/** Days past which the book's price reads as stale, the parts book's own rule (`BOOK_PRICE_FRESH_DAYS`). */
export const BOOK_STALE_DAYS = 90

/** Whether the book's price is stale: never checked, or checked more than ninety days ago. */
export function bookIsStale(checkedOn: string | null, todayYmd: string): boolean {
  return !checkedOn || daysBetween(checkedOn, todayYmd) > BOOK_STALE_DAYS
}
