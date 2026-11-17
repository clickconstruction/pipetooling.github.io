import { addDaysYmd } from './taskDoerActs'

/**
 * Yesterday (punch list #369, step D3): a repeating task that was not ticked asks once, the day after, whether it was
 * done or skipped. Such a task drops off the list the next morning, so nobody learned why a day went unticked, and a
 * task done and not ticked read the same as a task not done.
 *
 * The question is asked for the last day that had an unticked repeating task, looking back three days, so Monday asks
 * about Friday. It is asked once: *Did it* finishes that day's row, and *Skipped* writes a `skipped` line that takes
 * the task off the question for good.
 */
export type MissedRow = { id: string; scheduled_date: string }

/** How many days back the question reaches. Past this a missed day is history. */
export const YESTERDAY_REACH_DAYS = 3

/**
 * The rows the question is about: the unticked repeating tasks of the latest day in reach, less the ones already
 * answered as skipped. `rows` are past, not done and not the kind that stays on the list.
 */
export function yesterdayMissed<T extends MissedRow>(rows: ReadonlyArray<T>, todayYmd: string, skippedIds: ReadonlySet<string>): { day: string | null; rows: T[] } {
  const from = addDaysYmd(todayYmd, -YESTERDAY_REACH_DAYS)
  const open = rows.filter((r) => r.scheduled_date < todayYmd && r.scheduled_date >= from && !skippedIds.has(r.id))
  if (open.length === 0) return { day: null, rows: [] }
  const day = open.reduce((latest, r) => (r.scheduled_date > latest ? r.scheduled_date : latest), open[0]!.scheduled_date)
  return { day, rows: open.filter((r) => r.scheduled_date === day) }
}

/** The day as the strip names it: *Yesterday*, or the weekday when it was further back. */
export function missedDayName(day: string, todayYmd: string): string {
  if (day === addDaysYmd(todayYmd, -1)) return 'Yesterday'
  const d = new Date(`${day}T12:00:00`)
  return isNaN(d.getTime()) ? 'Earlier' : d.toLocaleDateString('en-US', { weekday: 'long' })
}

/** The strip's label: *Yesterday · 2 not ticked*. */
export function missedLabel(day: string, todayYmd: string, count: number): string {
  return `${missedDayName(day, todayYmd)} · ${count} not ticked`
}

export const MISSED_ASK = 'Did you do it?'
export const MISSED_DID_LABEL = 'Did it'
export const MISSED_SKIPPED_LABEL = 'Skipped'
/** The quiet line under the strip's label. */
export const MISSED_WORDS = 'Say which, so the record is right. It asks once.'
/** The mark a skipped day wears in History. */
export const SKIPPED_CHIP = 'Skipped'
