/**
 * A bid's promised schedule (punch list #367): a start and an end that a person types, or a start with no
 * end date. Nothing is counted from the day the bid was sent (the owner, 2026-11-16). An empty start means
 * the bid has no schedule. The columns are `bids.schedule_start`, `schedule_end` and `schedule_open_ended`
 * (migration 20261117070000), whose checks this file's rules mirror, so a draft that passes here saves.
 * Pure: the Edit Bid row, the Development page's sheet and the By date view all read it.
 */

export type BidScheduleDraft = { start: string; end: string; noEnd: boolean }

/** The three columns, as an update writes them. */
export type BidScheduleColumns = { schedule_start: string | null; schedule_end: string | null; schedule_open_ended: boolean }

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

/** A date box caught half typed: the year "2026" arrives as `0002-…`, `0020-…`, `0202-…`. */
function unfinished(ymd: string): boolean {
  const m = YMD.exec(ymd)
  return !m || Number(m[1]) < 1900
}

const dayNumber = (ymd: string) => Math.round(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) / 86_400_000)

export function scheduleDraftOf(bid: { schedule_start?: string | null; schedule_end?: string | null; schedule_open_ended?: boolean | null }): BidScheduleDraft {
  return { start: bid.schedule_start ?? '', end: bid.schedule_end ?? '', noEnd: bid.schedule_open_ended === true }
}

export const EMPTY_SCHEDULE: BidScheduleDraft = { start: '', end: '', noEnd: false }

/**
 * What a draft still needs before it saves; null when it can. No start, no end and no tick is the bid with
 * no schedule, which saves. A start needs an end or the tick, so a schedule is never left half said.
 */
export function scheduleDraftProblem(d: BidScheduleDraft): string | null {
  const start = d.start.trim()
  const end = d.end.trim()
  if (!start) return end || d.noEnd ? 'Type the day the schedule starts.' : null
  if (unfinished(start)) return 'Finish the start date.'
  if (d.noEnd) return null
  if (!end) return 'Type the day the schedule ends, or tick No end date.'
  if (unfinished(end)) return 'Finish the end date.'
  if (end < start) return 'The end is before the start.'
  return null
}

/** The columns a draft writes. Call it only on a draft with no problem. A ticked *No end date* drops whatever end was typed. */
export function scheduleColumns(d: BidScheduleDraft): BidScheduleColumns {
  const start = d.start.trim()
  if (!start) return { schedule_start: null, schedule_end: null, schedule_open_ended: false }
  return d.noEnd ? { schedule_start: start, schedule_end: null, schedule_open_ended: true } : { schedule_start: start, schedule_end: d.end.trim() || null, schedule_open_ended: false }
}

export const sameSchedule = (a: BidScheduleDraft, b: BidScheduleDraft): boolean => a.start === b.start && a.noEnd === b.noEnd && (a.noEnd || a.end === b.end)

/** *18 months*, *6 weeks*, *12 days*: how long a schedule is, in the unit a person would say. */
export function scheduleLengthWords(start: string, end: string): string {
  if (!YMD.test(start) || !YMD.test(end) || end < start) return ''
  const days = dayNumber(end) - dayNumber(start)
  const months = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7)) + (Number(end.slice(8, 10)) - Number(start.slice(8, 10)) >= 15 ? 1 : Number(end.slice(8, 10)) - Number(start.slice(8, 10)) <= -15 ? -1 : 0)
  if (days >= 60 && months >= 2) return `${months} months`
  if (days >= 14) return `${Math.round(days / 7)} weeks`
  return days === 1 ? '1 day' : `${days} days`
}

export type ScheduleStanding = { words: string; over: boolean }

/**
 * Where a schedule stands today: *45 days left*, *ends today*, *34 days over*, *starts in 12 days*,
 * *no end date*. `over` is true once today is past the end, the one state drawn in red.
 */
export function scheduleStanding(s: { start: string; end: string | null }, today: string): ScheduleStanding {
  if (YMD.test(s.start) && today < s.start) {
    const n = dayNumber(s.start) - dayNumber(today)
    return { words: n === 1 ? 'starts tomorrow' : `starts in ${n} days`, over: false }
  }
  if (!s.end || !YMD.test(s.end)) return { words: 'no end date', over: false }
  const left = dayNumber(s.end) - dayNumber(today)
  if (left === 0) return { words: 'ends today', over: false }
  if (left > 0) return { words: left === 1 ? '1 day left' : `${left} days left`, over: false }
  return { words: left === -1 ? '1 day over' : `${-left} days over`, over: true }
}

/** The quiet words beside the two dates: *18 months · 45 days left*; empty while the draft has a problem or no schedule. */
export function scheduleDraftWords(d: BidScheduleDraft, today: string): string {
  if (!d.start.trim() || scheduleDraftProblem(d)) return ''
  if (d.noEnd) return scheduleStanding({ start: d.start, end: null }, today).words
  return [scheduleLengthWords(d.start, d.end), scheduleStanding({ start: d.start, end: d.end }, today).words].filter(Boolean).join(' · ')
}
