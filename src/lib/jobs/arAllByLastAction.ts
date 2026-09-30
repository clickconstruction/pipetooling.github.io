/**
 * Accounts Receivable's All list, by last action (punch list #74 PR 3).
 *
 * All was the whole history by bank date, so a cheque applied today on a
 * deposit banked three weeks ago sat three weeks down. The office's question
 * — "what did we do with the cheques lately?" — reads down the days: the
 * deposits touched in the last 30 days, newest action first under a heading
 * for its day, then everything older by bank date as before.
 *
 * "Last action" is the trail's `lastTouchedAt` (applied, moved, taken off,
 * returned, the bank's failure); a deposit nothing happened to counts its
 * bank date. Pure; the caller passes `now` and the calendar zone.
 * Unit-tested in arAllByLastAction.test.ts.
 */

export type ArAllRowSlice = { mercury_transaction_id: string; posted_at: string | null }

export type ArAllGroup<T> = { heading: string; rows: T[] }

export const AR_ALL_WINDOW_DAYS = 30
export const AR_ALL_OLDER_HEADING = 'Older · by bank date'

const ms = (iso: string | null | undefined): number => {
  if (!iso) return Number.NaN
  const n = new Date(iso).getTime()
  return Number.isFinite(n) ? n : Number.NaN
}

const dayKey = (d: Date, timeZone: string): string => d.toLocaleDateString('en-CA', { timeZone })

/** "Today", "Yesterday", else "Mon 9/28". */
export function arAllDayHeading(iso: string, now: Date, timeZone: string): string {
  const d = new Date(iso)
  const key = dayKey(d, timeZone)
  if (key === dayKey(now, timeZone)) return 'Today'
  if (key === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000), timeZone)) return 'Yesterday'
  const weekday = d.toLocaleDateString('en-US', { timeZone, weekday: 'short' })
  const date = d.toLocaleDateString('en-US', { timeZone, month: 'numeric', day: 'numeric' })
  return `${weekday} ${date}`
}

export function orderArAllByLastAction<T extends ArAllRowSlice>(args: {
  rows: ReadonlyArray<T>
  /** The trail's lastTouchedAt for a deposit, null when unknown or nothing happened. */
  lastTouchedOf: (mercuryTransactionId: string) => string | null
  now: Date
  timeZone: string
  windowDays?: number
}): ArAllGroup<T>[] {
  const windowMs = (args.windowDays ?? AR_ALL_WINDOW_DAYS) * 24 * 60 * 60 * 1000
  const floor = args.now.getTime() - windowMs
  const touched = (r: T): number => {
    const t = ms(args.lastTouchedOf(r.mercury_transaction_id))
    return Number.isFinite(t) ? t : ms(r.posted_at)
  }
  const recent: Array<{ row: T; at: number }> = []
  const older: Array<{ row: T; at: number }> = []
  for (const row of args.rows) {
    const at = touched(row)
    if (Number.isFinite(at) && at >= floor) recent.push({ row, at })
    else older.push({ row, at: Number.isFinite(ms(row.posted_at)) ? ms(row.posted_at) : Number.NEGATIVE_INFINITY })
  }
  recent.sort((a, b) => b.at - a.at)
  older.sort((a, b) => b.at - a.at)

  const groups: ArAllGroup<T>[] = []
  for (const { row, at } of recent) {
    const heading = arAllDayHeading(new Date(at).toISOString(), args.now, args.timeZone)
    const last = groups[groups.length - 1]
    if (last && last.heading === heading) last.rows.push(row)
    else groups.push({ heading, rows: [row] })
  }
  if (older.length) groups.push({ heading: AR_ALL_OLDER_HEADING, rows: older.map((o) => o.row) })
  return groups
}
