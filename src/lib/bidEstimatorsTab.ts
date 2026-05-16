/**
 * Pure helpers for the Bids → Estimators tab.
 *
 * Data model:
 *   - Columns = users (estimator role + org-wide augmentation list).
 *   - Rows    = days in a contiguous YYYY-MM-DD window (descending: most recent first).
 *   - Cell    = list of bids the user clocked into that day, each rendered as
 *               `<bid label> — N%` where N = userHoursThatDay / bidAllTimeHours × 100.
 *
 * Hour aggregation excludes rejected/revoked sessions (matches existing weekly
 * estimator labor logic in `bidBoardWeeklyEstimatorLaborCost.ts`).
 */
import { ymdAddDays } from '../utils/dateUtils'

export const BID_ESTIMATORS_TAB_DEFAULT_WINDOW_DAYS = 30

/** RPC row from `list_bid_estimators_window_hours` (per user × bid × day). */
export type BidEstimatorsWindowHoursRow = {
  user_id: string
  bid_id: string
  work_date: string
  hours: number
}

/** RPC row from `list_bid_estimators_all_time_hours` (per bid lifetime total). */
export type BidEstimatorsAllTimeHoursRow = {
  bid_id: string
  hours: number
}

/** One bid chip rendered inside a single cell. */
export type BidEstimatorsCellEntry = {
  bidId: string
  hoursOnDay: number
  /** All-time bid-clock hours across the whole team. Used as denominator. */
  bidAllTimeHours: number
  /** `hoursOnDay / bidAllTimeHours × 100`, or null if denominator is ≤ 0. */
  pctOfBidAllTime: number | null
}

/** Builds the descending list of YYYY-MM-DD rows for the table. */
export function buildBidEstimatorsWindowDays(
  todayYmd: string,
  windowDays: number = BID_ESTIMATORS_TAB_DEFAULT_WINDOW_DAYS,
): string[] {
  if (windowDays <= 0) return []
  const out: string[] = []
  for (let i = 0; i < windowDays; i += 1) {
    out.push(ymdAddDays(todayYmd, -i))
  }
  return out
}

/** Inclusive start date (`windowDays - 1` days before today). */
export function bidEstimatorsWindowStartYmd(
  todayYmd: string,
  windowDays: number = BID_ESTIMATORS_TAB_DEFAULT_WINDOW_DAYS,
): string {
  if (windowDays <= 1) return todayYmd
  return ymdAddDays(todayYmd, -(windowDays - 1))
}

function cellKey(userId: string, workDateYmd: string): string {
  return `${userId}::${workDateYmd}`
}

/**
 * Folds the two RPC payloads into a `Map<userId::workDate, BidEstimatorsCellEntry[]>`.
 * Per-cell entries are sorted by hoursOnDay desc, then bidId for stability.
 *
 * Rows that reference unknown bids (allTime map missing) still appear, with
 * `bidAllTimeHours = hoursOnDay` (the user's own day already contributed) so the
 * % shown is at most 100% rather than silently 0. This is defensive against
 * lifetime aggregation drift; the migration computes both with the same filter
 * so this fallback should never trigger in practice.
 */
export function buildBidEstimatorsCellMap(
  windowRows: readonly BidEstimatorsWindowHoursRow[],
  allTimeRows: readonly BidEstimatorsAllTimeHoursRow[],
): Map<string, BidEstimatorsCellEntry[]> {
  const allTimeByBidId = new Map<string, number>()
  for (const r of allTimeRows) {
    const h = Number(r.hours)
    if (Number.isFinite(h)) allTimeByBidId.set(r.bid_id, h)
  }

  const out = new Map<string, BidEstimatorsCellEntry[]>()
  for (const r of windowRows) {
    const h = Number(r.hours)
    if (!Number.isFinite(h) || h <= 0) continue

    const denom = allTimeByBidId.get(r.bid_id) ?? h
    const pct = denom > 0 ? (h / denom) * 100 : null

    const entry: BidEstimatorsCellEntry = {
      bidId: r.bid_id,
      hoursOnDay: h,
      bidAllTimeHours: denom,
      pctOfBidAllTime: pct,
    }
    const k = cellKey(r.user_id, r.work_date)
    const arr = out.get(k)
    if (arr) arr.push(entry)
    else out.set(k, [entry])
  }

  for (const arr of out.values()) {
    arr.sort((a, b) => {
      if (b.hoursOnDay !== a.hoursOnDay) return b.hoursOnDay - a.hoursOnDay
      return a.bidId.localeCompare(b.bidId)
    })
  }

  return out
}

/** O(1) cell lookup. Returns empty array when no bid time on that day for that user. */
export function lookupBidEstimatorsCell(
  cellMap: Map<string, BidEstimatorsCellEntry[]>,
  userId: string,
  workDateYmd: string,
): readonly BidEstimatorsCellEntry[] {
  return cellMap.get(cellKey(userId, workDateYmd)) ?? []
}

/** Distinct bid IDs across the window — used to fetch labels and totals. */
export function distinctBidIdsFromWindowRows(
  rows: readonly BidEstimatorsWindowHoursRow[],
): string[] {
  const s = new Set<string>()
  for (const r of rows) s.add(r.bid_id)
  return [...s]
}

/** Human label for a percentage (e.g. 40.123 → "40%"). Null → "—". */
export function formatBidEstimatorsCellPercent(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '\u2014'
  const rounded = Math.round(pct)
  return `${rounded}%`
}

/** 2.0 → "2.0h", 0.25 → "0.3h" (no leading zero stripping; matches dashboard style). */
export function formatBidEstimatorsCellHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0h'
  return `${hours.toFixed(1)}h`
}

/**
 * Compact dollar formatter for the Estimators tab Cost mode chip — `30000` → `"30k"`,
 * `1500` → `"2k"` (rounded), `0` → `"0k"`. Negative values get a leading `-`.
 * Below $1,000 the value is shown with a single decimal (`"0.5k"`) so non-zero rows
 * never collapse to `"0k"` and disappear visually.
 */
export function formatBidValueK(dollars: number): string {
  if (!Number.isFinite(dollars)) return '0k'
  if (dollars === 0) return '0k'
  const sign = dollars < 0 ? '-' : ''
  const abs = Math.abs(dollars)
  const k = abs / 1000
  if (abs < 1000) {
    const rounded = Math.round(k * 10) / 10
    return `${sign}${rounded}k`
  }
  return `${sign}${Math.round(k).toLocaleString('en-US')}k`
}

/**
 * One cost-mode chip suffix appended to a cell line when Cost mode is on:
 *   - bid value missing / non-finite / null → `{ kind: 'missing' }` → render "no bid value" in red.
 *   - bid value present → `{ kind: 'value', scaled, total }` → render `"{scaled}k | {total}k"`.
 *
 * `pctOfBidAllTime` is the per-cell number from `BidEstimatorsCellEntry` (0..100 or null).
 * When the percentage is null we treat scaled as 0 (no team total to scale against);
 * the right-hand total still renders so the cost mode is informative.
 */
export type BidEstimatorsCostModeChip =
  | { kind: 'missing' }
  | { kind: 'value'; scaledDollars: number; totalDollars: number }

export function buildBidEstimatorsCostModeChip(
  bidValueDollars: number | null | undefined,
  pctOfBidAllTime: number | null,
): BidEstimatorsCostModeChip {
  if (bidValueDollars == null || !Number.isFinite(bidValueDollars)) {
    return { kind: 'missing' }
  }
  const pct = pctOfBidAllTime == null || !Number.isFinite(pctOfBidAllTime) ? 0 : pctOfBidAllTime
  const scaled = bidValueDollars * (pct / 100)
  return { kind: 'value', scaledDollars: scaled, totalDollars: bidValueDollars }
}

/**
 * Searchable fields for a single bid on the Estimators tab. `ledgerLabel` is the
 * fully-formatted prefix + number string (e.g. `"BE249"` / `"B412"`), so search
 * matches against `"BE"`, `"BE2"`, `"249"`, etc.
 */
export type BidEstimatorsSearchFields = {
  ledgerLabel: string
  bidNumber: string | null
  projectName: string | null
  gcBuilderName: string | null
}

/** Normalizes a raw user search query: trims and lowercases. Empty when whitespace-only. */
export function normalizeBidEstimatorsSearchQuery(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().toLowerCase()
}

/**
 * Case-insensitive substring match across a bid's searchable fields. An empty
 * normalized query returns `true` (no filter applied) so callers can use this
 * predicate uniformly without branching first.
 */
export function bidEstimatorsBidMatchesSearch(
  query: string,
  fields: BidEstimatorsSearchFields,
): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  const haystacks: Array<string | null | undefined> = [
    fields.ledgerLabel,
    fields.bidNumber,
    fields.projectName,
    fields.gcBuilderName,
  ]
  for (const h of haystacks) {
    if (typeof h !== 'string') continue
    if (h.toLowerCase().includes(q)) return true
  }
  return false
}

/** Default max-chars of a project name shown next to the bid chip on the Estimators tab. */
export const BID_ESTIMATORS_PROJECT_CLIP_MAX = 10

/**
 * Trims a bid project name and clips to `max` characters with an ellipsis (`…` is **NOT** used —
 * the spec calls for three ASCII dots: `Take 5 Oil...`). Empty / nullish input → empty string.
 * Names of length ≤ max are returned without an ellipsis.
 */
export function formatBidEstimatorsProjectNameClip(
  name: string | null | undefined,
  max: number = BID_ESTIMATORS_PROJECT_CLIP_MAX,
): string {
  const trimmed = (name ?? '').trim()
  if (trimmed === '') return ''
  if (max <= 0) return ''
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}...`
}
