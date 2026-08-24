import { companyWeekStartSundayContaining, isoWeekNumberFromGregorianYmd, ymdAddDays } from '../../utils/dateUtils'

/**
 * "Who sends the bids" (v2.2218, dev-only Health block): share of sent bids by
 * person — weekly and monthly, by count and by $ — over the last six calendar
 * months. Pure shaping; the section renders 100%-stacked bars from these rows.
 *
 * Conventions shared with the neighbors: "who" is the bid's estimator (the
 * weekly labor table's and the Pulse's rule; no estimator → Unassigned), weeks
 * are the company's Chicago Sunday weeks labeled by ISO week number (the
 * Pulse's W-numbers, taken from the week's Thursday), months are the
 * `bid_date_sent` calendar month. People beyond the top MAX_NAMED (by
 * window $) fold into "Other"; Other and Unassigned always sort last.
 */

type SentShareEstimator = { name?: string | null; email?: string | null }

export type SentShareInputBid = {
  bid_date_sent: string | null
  bid_value: number | string | null
  estimator_id: string | null
  /** Supabase embed: object or one-element array, like WeeklySentInputBid. */
  estimator?: SentShareEstimator | SentShareEstimator[] | null
}

export type SentShareSegment = {
  key: string
  name: string
  count: number
  dollars: number
  /** 0–100, of the row's total. 0-total rows have no segments at all. */
  pctCount: number
  pctDollars: number
}

export type SentShareRow = {
  /** "W34" (weekly, from the week's Thursday) or "Aug" / "Aug '25" (monthly). */
  label: string
  /** Month short name on the first week of a month, for a quiet tick; null otherwise (weekly only). */
  monthTick: string | null
  totalCount: number
  totalDollars: number
  segments: SentShareSegment[]
}

export type SentSharePerson = {
  key: string
  name: string
  count: number
  dollars: number
  pctCount: number
  pctDollars: number
}

export type SentShareData = {
  /** Window totals per person, ordered by dollars desc with Other then Unassigned last. */
  people: SentSharePerson[]
  /** Newest first; exactly `months` calendar months, empties included. */
  monthly: SentShareRow[]
  /** Newest first; all company weeks in the window, empties included. */
  weekly: SentShareRow[]
}

export const SENT_SHARE_MONTHS = 6
export const SENT_SHARE_MAX_NAMED = 5
export const SENT_SHARE_UNASSIGNED_KEY = '__unassigned__'
export const SENT_SHARE_OTHER_KEY = '__other__'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

const round1 = (n: number) => Math.round(n * 10) / 10

function bidDollars(b: SentShareInputBid): number {
  const n = Number(b.bid_value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function personKeyAndName(b: SentShareInputBid): { key: string; name: string } {
  if (!b.estimator_id) return { key: SENT_SHARE_UNASSIGNED_KEY, name: 'Unassigned' }
  const u = b.estimator
  const one = Array.isArray(u) ? u[0] ?? null : u ?? null
  const name = (one?.name ?? '').trim() || (one?.email ?? '').trim() || 'Unknown'
  return { key: b.estimator_id, name }
}

function monthKeyOf(ymd: string): string {
  return ymd.slice(0, 7)
}

function monthLabel(monthKey: string, nowYear: number): string {
  const y = Number(monthKey.slice(0, 4))
  const m = MONTHS_SHORT[Number(monthKey.slice(5, 7)) - 1] ?? monthKey
  return y === nowYear ? m : `${m} '${String(y).slice(2)}`
}

/** First day of the month `months - 1` months before `now`'s month (local calendar). */
function windowStartYmd(now: Date, months: number): string {
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
}

type Tally = Map<string, { name: string; count: number; dollars: number }>

function addTally(t: Tally, key: string, name: string, dollars: number) {
  const cur = t.get(key) ?? { name, count: 0, dollars: 0 }
  cur.count += 1
  cur.dollars += dollars
  t.set(key, cur)
}

function rowFromTally(label: string, monthTick: string | null, t: Tally, keyToBucket: (key: string) => string, bucketNames: Map<string, string>): SentShareRow {
  const byBucket: Tally = new Map()
  for (const [key, v] of t) {
    const bucket = keyToBucket(key)
    const cur = byBucket.get(bucket) ?? { name: bucketNames.get(bucket) ?? v.name, count: 0, dollars: 0 }
    cur.count += v.count
    cur.dollars += v.dollars
    byBucket.set(bucket, cur)
  }
  const totalCount = [...byBucket.values()].reduce((s, v) => s + v.count, 0)
  const totalDollars = [...byBucket.values()].reduce((s, v) => s + v.dollars, 0)
  const order = [...bucketNames.keys()]
  const segments: SentShareSegment[] = order
    .filter((k) => byBucket.has(k))
    .map((k) => {
      const v = byBucket.get(k)!
      return {
        key: k,
        name: bucketNames.get(k) ?? v.name,
        count: v.count,
        dollars: v.dollars,
        pctCount: totalCount > 0 ? round1((v.count / totalCount) * 100) : 0,
        pctDollars: totalDollars > 0 ? round1((v.dollars / totalDollars) * 100) : 0,
      }
    })
  return { label, monthTick, totalCount, totalDollars, segments }
}

export function buildSentShareByPerson(
  bids: readonly SentShareInputBid[],
  now: Date,
  opts: { months?: number; maxNamed?: number } = {},
): SentShareData {
  const months = opts.months ?? SENT_SHARE_MONTHS
  const maxNamed = opts.maxNamed ?? SENT_SHARE_MAX_NAMED
  const startYmd = windowStartYmd(now, months)
  const nowYear = now.getFullYear()

  // Window tallies per person + per month + per week.
  const windowTally: Tally = new Map()
  const byMonth = new Map<string, Tally>()
  const byWeek = new Map<string, Tally>()
  for (const b of bids) {
    const sent = (b.bid_date_sent ?? '').slice(0, 10)
    if (!sent || sent < startYmd) continue
    const { key, name } = personKeyAndName(b)
    const dollars = bidDollars(b)
    addTally(windowTally, key, name, dollars)
    const mk = monthKeyOf(sent)
    if (!byMonth.has(mk)) byMonth.set(mk, new Map())
    addTally(byMonth.get(mk)!, key, name, dollars)
    const wk = companyWeekStartSundayContaining(sent)
    if (wk) {
      if (!byWeek.has(wk)) byWeek.set(wk, new Map())
      addTally(byWeek.get(wk)!, key, name, dollars)
    }
  }

  // Rank people by window dollars (count breaks ties); top N stay named.
  const ranked = [...windowTally.entries()]
    .filter(([k]) => k !== SENT_SHARE_UNASSIGNED_KEY)
    .sort((a, b) => b[1].dollars - a[1].dollars || b[1].count - a[1].count)
  const named = ranked.slice(0, maxNamed)
  const folded = ranked.slice(maxNamed)
  const keyToBucket = (key: string): string => {
    if (key === SENT_SHARE_UNASSIGNED_KEY) return SENT_SHARE_UNASSIGNED_KEY
    return named.some(([k]) => k === key) ? key : SENT_SHARE_OTHER_KEY
  }
  // Bucket order = named by $ desc, then Other, then Unassigned — this is also
  // the segment order in every row, so a person's color never moves.
  const bucketNames = new Map<string, string>()
  for (const [k, v] of named) bucketNames.set(k, v.name)
  if (folded.length > 0) bucketNames.set(SENT_SHARE_OTHER_KEY, 'Other')
  if (windowTally.has(SENT_SHARE_UNASSIGNED_KEY)) bucketNames.set(SENT_SHARE_UNASSIGNED_KEY, 'Unassigned')

  const windowCount = [...windowTally.values()].reduce((s, v) => s + v.count, 0)
  const windowDollars = [...windowTally.values()].reduce((s, v) => s + v.dollars, 0)
  const windowRow = rowFromTally('window', null, windowTally, keyToBucket, bucketNames)
  const people: SentSharePerson[] = windowRow.segments.map((s) => ({
    key: s.key,
    name: s.name,
    count: s.count,
    dollars: s.dollars,
    pctCount: windowCount > 0 ? round1((s.count / windowCount) * 100) : 0,
    pctDollars: windowDollars > 0 ? round1((s.dollars / windowDollars) * 100) : 0,
  }))

  // Monthly rows: exactly `months` calendar months, newest first, empties included.
  const monthly: SentShareRow[] = []
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthly.push(rowFromTally(monthLabel(mk, nowYear), null, byMonth.get(mk) ?? new Map(), keyToBucket, bucketNames))
  }

  // Weekly rows: every company week from the window start through now, newest
  // first, empties included; labeled by the ISO week of the week's Thursday
  // (the Pulse's convention) with a month tick where the month changes.
  const weekly: SentShareRow[] = []
  const firstWeek = companyWeekStartSundayContaining(startYmd)
  const nowYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  let cursor = companyWeekStartSundayContaining(nowYmd)
  while (cursor && firstWeek && cursor >= firstWeek) {
    const thu = ymdAddDays(cursor, 4)
    const n = isoWeekNumberFromGregorianYmd(thu)
    const label = n === null ? cursor.slice(5) : `W${n}`
    weekly.push(rowFromTally(label, null, byWeek.get(cursor) ?? new Map(), keyToBucket, bucketNames))
    cursor = ymdAddDays(cursor, -7)
  }
  // Month tick on the newest week of each month, reading down the list.
  for (const w of weekly) w.monthTick = null
  let seen: string | null = null
  let cursor2 = companyWeekStartSundayContaining(nowYmd)
  for (let i = 0; i < weekly.length && cursor2; i++) {
    const mk = monthKeyOf(cursor2)
    if (mk !== seen) {
      weekly[i]!.monthTick = MONTHS_SHORT[Number(mk.slice(5, 7)) - 1] ?? null
      seen = mk
    }
    cursor2 = ymdAddDays(cursor2, -7)
  }

  return { people, monthly, weekly }
}
