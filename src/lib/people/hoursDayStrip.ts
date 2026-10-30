/**
 * Hours as days (punch list #217, people-docs-6 and people-docs-15). The person desk's Hours &
 * approvals read four lines of prose — *Waiting · 1 session · 8.5h · oldest Thu 10/29*, *This
 * week · 8.5h closed*, *Reviewed through · never* — and People → Hours' banner read a sentence,
 * *Pending: 3 people · 12.50 h not yet in payroll across 4 days. +7 sessions in earlier weeks*.
 * This kernel turns clock sessions into days a strip can draw: a filled dot per approved day,
 * an amber ring per day with a session waiting, the hours under each day, a grey rule at
 * *reviewed through*, today outlined; and, for the Hours tab's clock strip, the pending hours
 * by day and the stub for the sessions in earlier weeks. Pure: rows in, days and words out.
 * Days are `work_date`, the company day the grid already keys on.
 */
import { shiftWorkDateYmd } from '../peopleHoursClockStripSelectedDay'

export type HoursStripSession = {
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  approved_at: string | null
  rejected_at?: string | null
  revoked_at?: string | null
}

/** `waiting` outranks `approved` on a day with both; `open` only on a day with nothing closed. */
export type HoursStripDayKind = 'approved' | 'waiting' | 'open' | 'none'

export type HoursStripDay = {
  ymd: string
  approvedHours: number
  waitingHours: number
  /** Approved and waiting together, to a tenth. */
  hours: number
  /** A session still running that day. */
  open: boolean
  kind: HoursStripDayKind
  today: boolean
  weekend: boolean
}

/** The desk's strip: the last fourteen days, today at the right. */
export const PERSON_HOURS_STRIP_DAYS = 14

/** A closed session's hours; 0 for an open, backwards or unreadable one. */
export function sessionHours(s: Pick<HoursStripSession, 'clocked_in_at' | 'clocked_out_at'>): number {
  if (!s.clocked_out_at) return 0
  const a = Date.parse(s.clocked_in_at)
  const b = Date.parse(s.clocked_out_at)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0
  return (b - a) / 3_600_000
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** The first of the last `n` days ending on `todayYmd`. */
export function firstOfLastDays(todayYmd: string, n: number): string {
  return shiftWorkDateYmd(todayYmd, -(n - 1))
}

export function isWeekendYmd(ymd: string): boolean {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay()
  return dow === 0 || dow === 6
}

/**
 * One day from `firstYmd` to `todayYmd`, oldest first. Rejected and revoked sessions are left
 * out; a closed session counts as approved when `approved_at` is set and as waiting otherwise;
 * an open session marks its day `open`. Sessions outside the days are ignored.
 */
export function hoursStripDays(sessions: ReadonlyArray<HoursStripSession>, opts: { firstYmd: string; todayYmd: string }): HoursStripDay[] {
  const days: HoursStripDay[] = []
  const byYmd = new Map<string, HoursStripDay>()
  for (let ymd = opts.firstYmd; ymd <= opts.todayYmd; ymd = shiftWorkDateYmd(ymd, 1)) {
    const day: HoursStripDay = { ymd, approvedHours: 0, waitingHours: 0, hours: 0, open: false, kind: 'none', today: ymd === opts.todayYmd, weekend: isWeekendYmd(ymd) }
    days.push(day)
    byYmd.set(ymd, day)
    if (days.length > 400) break
  }
  for (const s of sessions) {
    if (s.rejected_at || s.revoked_at) continue
    const day = byYmd.get(s.work_date)
    if (!day) continue
    if (!s.clocked_out_at) {
      day.open = true
      continue
    }
    const h = sessionHours(s)
    if (h <= 0) continue
    if (s.approved_at) day.approvedHours += h
    else day.waitingHours += h
  }
  for (const day of days) {
    day.approvedHours = round1(day.approvedHours)
    day.waitingHours = round1(day.waitingHours)
    day.hours = round1(day.approvedHours + day.waitingHours)
    day.kind = day.waitingHours > 0 ? 'waiting' : day.approvedHours > 0 ? 'approved' : day.open ? 'open' : 'none'
  }
  return days
}

/** "8", "8.5"; '' for nothing. */
export function formatStripHours(hours: number): string {
  if (!(hours > 0)) return ''
  const r = round1(hours)
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** "Oct 18" for a company day. */
export function shortDayWords(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Tue, Oct 28" for a company day. */
export function longDayWords(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** A day's hover: "Tue, Oct 28 · 8.5 h approved", "· 8.5 h waiting on approval", "· on the clock", or the day alone. */
export function hoursStripDayTitle(day: HoursStripDay): string {
  const parts = [longDayWords(day.ymd)]
  if (day.approvedHours > 0) parts.push(`${formatStripHours(day.approvedHours)} h approved`)
  if (day.waitingHours > 0) parts.push(`${formatStripHours(day.waitingHours)} h waiting on approval`)
  if (day.open) parts.push('on the clock')
  return parts.join(' · ')
}

/**
 * Where the grey *reviewed through* rule sits: after the last day on or before `reviewedThrough`
 * (`index`, the rule at that cell's right edge), before the first day when the review is older
 * than the strip, or nowhere when no review is recorded.
 */
export type ReviewedRule = { kind: 'after'; index: number } | { kind: 'before' } | { kind: 'none' }

export function reviewedThroughRule(days: ReadonlyArray<Pick<HoursStripDay, 'ymd'>>, reviewedThrough: string | null | undefined): ReviewedRule {
  if (!reviewedThrough || days.length === 0) return { kind: 'none' }
  if (reviewedThrough < days[0]!.ymd) return { kind: 'before' }
  let index = -1
  for (let i = 0; i < days.length; i++) if (days[i]!.ymd <= reviewedThrough) index = i
  return index < 0 ? { kind: 'before' } : { kind: 'after', index }
}

/** The rule's hover and the legend's words: "reviewed through Oct 18", or "no review yet". */
export function reviewedThroughWords(reviewedThrough: string | null | undefined): string {
  return reviewedThrough ? `reviewed through ${shortDayWords(reviewedThrough)}` : 'no review yet'
}

export type HoursHeadChip = { words: string; tone: 'amber' | 'green' | 'grey' }

/** The desk header's one chip: what waits, else the clock, else nothing waiting. */
export function personHoursHeadChip(queue: { count: number; hours: number }, onTheClock: boolean): HoursHeadChip {
  if (queue.count > 0) return { words: `${queue.count} waiting · ${formatStripHours(queue.hours) || '0'} h`, tone: 'amber' }
  if (onTheClock) return { words: 'on the clock', tone: 'green' }
  return { words: 'nothing waiting', tone: 'grey' }
}

/** The strip's one sentence for a screen reader: "14 days · 5 approved · 1 waiting · on the clock today · reviewed through Oct 18". */
export function hoursStripWords(days: ReadonlyArray<HoursStripDay>, reviewedThrough: string | null | undefined): string {
  const approved = days.filter((d) => d.approvedHours > 0).length
  const waiting = days.filter((d) => d.waitingHours > 0).length
  const parts = [`${days.length} days`, `${approved} approved`, `${waiting} waiting`]
  if (days.some((d) => d.today && d.open)) parts.push('on the clock today')
  parts.push(reviewedThroughWords(reviewedThrough))
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// People → Hours: the pending days on the clock strip, and the earlier weeks.
// ---------------------------------------------------------------------------

/** Closed sessions waiting on approval, their hours summed by `work_date`. */
export function pendingHoursByWorkDate(sessions: ReadonlyArray<HoursStripSession>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sessions) {
    if (!s.clocked_out_at || s.approved_at || s.rejected_at || s.revoked_at) continue
    const h = sessionHours(s)
    if (h <= 0) continue
    out[s.work_date] = round1((out[s.work_date] ?? 0) + h)
  }
  return out
}

/** The sessions the strip's days do not show: the all-weeks count less the closed pending ones on the strip; null while the count is unknown. */
export function earlierPendingCount(allWeeksTotal: number | null | undefined, onStrip: number): number | null {
  if (allWeeksTotal == null) return null
  return Math.max(0, allWeeksTotal - onStrip)
}

/** "7 earlier ›" — the stub at the strip's left edge; '' at zero. */
export function earlierPendingStubWords(n: number | null): string {
  return n != null && n > 0 ? `${n} earlier ›` : ''
}

/** "Review & approve · 12.5 h" — the banner's press with its hours. */
export function reviewApproveLabel(hours: number): string {
  const h = formatStripHours(hours)
  return h ? `Review & approve · ${h} h` : 'Review & approve'
}

/**
 * The Hours tab's Review Hours press (people-docs-6, a plain fix): the ✓ only when every person
 * shown has a review on record, the date the earliest of their newest reviews, so the words
 * never claim a review that does not exist.
 */
export function reviewHoursButtonWords(newestEndDateByPerson: ReadonlyArray<string | null>): { label: string; checked: boolean; title: string } {
  const dates = newestEndDateByPerson.filter((d): d is string => typeof d === 'string' && d !== '')
  if (dates.length === 0) return { label: 'Review Hours', checked: false, title: 'No review is recorded for anyone shown. Opens Review Hours.' }
  const through = dates.reduce((a, b) => (a < b ? a : b))
  const missing = newestEndDateByPerson.length - dates.length
  if (missing > 0) {
    return {
      label: `Reviewed through ${shortDayWords(through)}`,
      checked: false,
      title: `Everyone with a review is reviewed through ${shortDayWords(through)}. ${missing} shown ${missing === 1 ? 'has' : 'have'} no review. Opens Review Hours.`,
    }
  }
  return { label: `Reviewed through ${shortDayWords(through)}`, checked: true, title: `Everyone shown is reviewed through ${shortDayWords(through)}. Opens Review Hours.` }
}

/** The per-person switch keys the two hours prototypes use (`useShapeView`). */
export const PERSON_DESK_HOURS_STRIP_KEY = 'person-desk-hours-strip'
export const PEOPLE_HOURS_PENDING_STRIP_KEY = 'people-hours-pending-strip'
