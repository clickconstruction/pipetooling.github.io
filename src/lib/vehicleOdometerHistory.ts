import { daysBetweenYmd, type FleetOdometerEntry } from './vehicleFleet'

/**
 * Odometer history sheet (v2.2172): tap a card's "229,950 mi · 9d ago" line
 * and see every reading plus the pace. Pure: sorting, per-row deltas, and
 * the averages live here so the modal stays thin and the math is tested.
 *
 * Pace method: (last − first) ÷ days over the FULL history, × 30.44 for a
 * month and × 365.25 for a year — first/last smooth over gaps, so one late
 * reading doesn't swing them. A "last 90 days" pace uses the in-window
 * readings (earliest vs latest inside the window) for a recent-trend check.
 */

const DAYS_PER_MONTH = 30.44
const DAYS_PER_YEAR = 365.25

/** Chronological (oldest first); same-day ties by created_at. */
export function sortOdometerEntries(entries: readonly FleetOdometerEntry[]): FleetOdometerEntry[] {
  return [...entries].sort((a, b) => (a.read_date < b.read_date ? -1 : a.read_date > b.read_date ? 1 : (a.created_at ?? '').localeCompare(b.created_at ?? '')))
}

export type OdometerHistoryRow = {
  id: string
  readDate: string
  miles: number
  /** vs the chronologically previous reading; null on the first. */
  deltaMiles: number | null
  deltaDays: number | null
  kind: 'first' | 'gain' | 'dip' | 'same'
  byName: string | null
}

/** Newest first, each row carrying its delta from the reading before it. */
export function odometerHistoryRows(entries: readonly FleetOdometerEntry[], nameById: (id: string | null | undefined) => string | null): OdometerHistoryRow[] {
  const asc = sortOdometerEntries(entries)
  const rows: OdometerHistoryRow[] = asc.map((e, i) => {
    const prev = i > 0 ? asc[i - 1]! : null
    const deltaMiles = prev ? e.odometer_value - prev.odometer_value : null
    const deltaDays = prev ? daysBetweenYmd(prev.read_date, e.read_date) : null
    const kind: OdometerHistoryRow['kind'] = prev == null ? 'first' : deltaMiles! < 0 ? 'dip' : deltaMiles === 0 ? 'same' : 'gain'
    return { id: e.id, readDate: e.read_date, miles: e.odometer_value, deltaMiles, deltaDays, kind, byName: nameById(e.created_by) }
  })
  return rows.reverse()
}

export type OdometerPace = {
  readings: number
  firstDate: string | null
  lastDate: string | null
  spanDays: number
  spanMiles: number
  /** null until there are 2+ readings on different days with a non-negative span. */
  perMonth: number | null
  perYear: number | null
  /** Last-90-days pace (mi/month) from in-window readings; null with <2 in window or same-day only. */
  recentPerMonth: number | null
  recentReadings: number
  trend: 'faster' | 'slower' | 'same' | null
}

export function odometerPace(entries: readonly FleetOdometerEntry[], todayYmd: string): OdometerPace {
  const asc = sortOdometerEntries(entries)
  const n = asc.length
  if (n === 0) return { readings: 0, firstDate: null, lastDate: null, spanDays: 0, spanMiles: 0, perMonth: null, perYear: null, recentPerMonth: null, recentReadings: 0, trend: null }
  const first = asc[0]!
  const last = asc[n - 1]!
  const spanDays = daysBetweenYmd(first.read_date, last.read_date)
  const spanMiles = last.odometer_value - first.odometer_value
  const perDay = n >= 2 && spanDays > 0 && spanMiles >= 0 ? spanMiles / spanDays : null
  const perMonth = perDay == null ? null : perDay * DAYS_PER_MONTH
  const perYear = perDay == null ? null : perDay * DAYS_PER_YEAR

  const windowStart = addDaysYmd(todayYmd, -90)
  const recent = asc.filter((e) => e.read_date >= windowStart)
  let recentPerMonth: number | null = null
  if (recent.length >= 2) {
    const rf = recent[0]!
    const rl = recent[recent.length - 1]!
    const rd = daysBetweenYmd(rf.read_date, rl.read_date)
    const rm = rl.odometer_value - rf.odometer_value
    if (rd > 0 && rm >= 0) recentPerMonth = (rm / rd) * DAYS_PER_MONTH
  }
  let trend: OdometerPace['trend'] = null
  if (perMonth != null && recentPerMonth != null && perMonth > 0) {
    const ratio = recentPerMonth / perMonth
    trend = ratio > 1.1 ? 'faster' : ratio < 0.9 ? 'slower' : 'same'
  }
  return { readings: n, firstDate: first.read_date, lastDate: last.read_date, spanDays, spanMiles, perMonth, perYear, recentPerMonth, recentReadings: recent.length, trend }
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))))
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "2,140" / "224,411.7" — whole miles unless the value carries a fraction. */
export function formatMiles(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

/** "8.6 months" / "12 days" / "2.1 years" for the span tile. */
export function formatSpanDays(days: number): string {
  if (days < 45) return `${days} day${days === 1 ? '' : 's'}`
  const months = days / DAYS_PER_MONTH
  if (months < 18) return `${months.toFixed(1).replace(/\.0$/, '')} months`
  return `${(days / DAYS_PER_YEAR).toFixed(1).replace(/\.0$/, '')} years`
}

/** Row caption: "+1,230 mi in 12 days" · "first reading" · "↓ 120 below the previous reading" · "no change in 3 days". */
export function odometerRowCaption(r: OdometerHistoryRow): string {
  if (r.kind === 'first') return 'first reading'
  if (r.kind === 'dip') return `↓ ${formatMiles(Math.abs(r.deltaMiles ?? 0))} below the previous reading`
  const days = r.deltaDays ?? 0
  const when = days === 0 ? 'same day' : `in ${days} day${days === 1 ? '' : 's'}`
  if (r.kind === 'same') return `no change · ${when}`
  return `+${formatMiles(r.deltaMiles ?? 0)} mi ${when}`
}
