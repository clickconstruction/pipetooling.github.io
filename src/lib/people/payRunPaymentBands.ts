/**
 * Pay run → Payments, the band modes (v2.3725): the flat, sorted rows grouped under a tinted
 * band row like the ledger's — one band per **company week** the money went out (Sunday-start,
 * the same week the ledger's pay periods use, so a band reads `9/13–19 w38` like a period), or
 * one per **person** — each carrying its count, its sum, and who (a week) or how many weeks (a
 * person). Rows keep the table's sort inside a band; the bands follow that sort's direction when
 * it is theirs (weeks newest first unless *Paid on* is ascending; people A → Z unless *Person*
 * is descending). Pure — the view passes the day and week-start readers.
 */
import type { PayRunPaymentRow, PayRunPaymentSortKey, SortDir } from './payRunPayments'

export type PayRunPaymentsMode = 'flat' | 'week' | 'person'

export const PAY_RUN_PAYMENT_MODES: ReadonlyArray<{ key: PayRunPaymentsMode; label: string }> = [
  { key: 'flat', label: 'Flat' },
  { key: 'week', label: 'By week paid' },
  { key: 'person', label: 'By person' },
]

export type PayRunPaymentBand = {
  key: string
  /** Week mode: the Sunday and Saturday of the week the money went out. */
  periodStart: string | null
  periodEnd: string | null
  /** Person mode: the name as the rows spell it. */
  personName: string | null
  rows: PayRunPaymentRow[]
  count: number
  sumUsd: number
  /** Distinct people paid in the band (week mode). */
  people: number
  /** Distinct weeks the band's payments went out (person mode). */
  weeks: number
}

export type PayRunBandDates = {
  /** The calendar day (YYYY-MM-DD, app time zone) a payment was made. */
  dayOf: (row: PayRunPaymentRow) => string
  /** The Sunday that starts the company week containing a day; null for an unreadable day. */
  weekStartOf: (ymd: string) => string | null
  /** `ymd` plus `days`. */
  addDays: (ymd: string, days: number) => string
}

const round2 = (n: number) => Math.round(n * 100) / 100
const nameKey = (r: PayRunPaymentRow) => r.stub.personName.trim().toLowerCase()

/** The bands for a mode over rows already filtered and sorted; `flat` is none. */
export function buildPayRunPaymentBands(rows: readonly PayRunPaymentRow[], mode: PayRunPaymentsMode, sort: { key: PayRunPaymentSortKey; dir: SortDir }, dates: PayRunBandDates): PayRunPaymentBand[] {
  if (mode === 'flat') return []
  const byKey = new Map<string, PayRunPaymentBand>()
  for (const r of rows) {
    const weekStart = dates.weekStartOf(dates.dayOf(r)) ?? dates.dayOf(r)
    const key = mode === 'week' ? weekStart : nameKey(r)
    let band = byKey.get(key)
    if (!band) {
      band = {
        key,
        periodStart: mode === 'week' ? weekStart : null,
        periodEnd: mode === 'week' ? dates.addDays(weekStart, 6) : null,
        personName: mode === 'person' ? r.stub.personName.trim() : null,
        rows: [],
        count: 0,
        sumUsd: 0,
        people: 0,
        weeks: 0,
      }
      byKey.set(key, band)
    }
    band.rows.push(r)
  }
  const bands = [...byKey.values()]
  for (const b of bands) {
    b.count = b.rows.length
    b.sumUsd = round2(b.rows.reduce((s, r) => s + r.amount, 0))
    b.people = new Set(b.rows.map(nameKey)).size
    b.weeks = new Set(b.rows.map((r) => dates.weekStartOf(dates.dayOf(r)) ?? dates.dayOf(r))).size
  }
  if (mode === 'week') {
    const asc = sort.key === 'paid' && sort.dir === 'asc'
    bands.sort((a, b) => (asc ? 1 : -1) * a.key.localeCompare(b.key))
  } else {
    const desc = sort.key === 'person' && sort.dir === 'desc'
    bands.sort((a, b) => (desc ? -1 : 1) * a.personName!.localeCompare(b.personName!, undefined, { sensitivity: 'base' }))
  }
  return bands
}

/** The band's numbers, after its label: `3 payments · $491.55 · 3 people` or `… · 2 weeks`. */
export function payRunPaymentBandLine(band: PayRunPaymentBand, mode: Exclude<PayRunPaymentsMode, 'flat'>, money: (n: number) => string): string {
  const parts = [`${band.count} ${band.count === 1 ? 'payment' : 'payments'}`, money(band.sumUsd)]
  if (mode === 'week') parts.push(`${band.people} ${band.people === 1 ? 'person' : 'people'}`)
  else parts.push(`${band.weeks} ${band.weeks === 1 ? 'week' : 'weeks'}`)
  return parts.join(' · ')
}
