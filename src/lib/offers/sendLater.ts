/**
 * Send later (v2.6774, punch list #291 PR 4). The owner, 2026-11-09: "when it comes to send in the morning I would like
 * for the user to be able to know exactly when that is and to potentially change the time". The Tell the customer
 * sheet's second press reads *Send later · Tomorrow 9:00 AM* and opens the picker: Now / Tomorrow 9:00 AM / Today
 * 6:00 PM, a Day and a Time (8 AM to 9 PM in 15-minute steps), the sentence *Goes Tuesday, Nov 10 at 9:00 AM Central, in
 * about 17 hours.* and the press *Send Tuesday 9:00 AM*. Pure: the default (as `morningSendOn`: today 9 AM before 9,
 * else tomorrow 9 AM), the chips, the fence, the words and the relative time. The window's hours are the run's too
 * (`supabase/functions/_shared/sendWindow.ts`). The picker is `components/customers/SendLaterPicker.tsx`.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { RUN_HOUR } from '../flows/nudgeRunLog'
import { SEND_STEP_MINUTES, SEND_WINDOW_CLOSE_HOUR, SEND_WINDOW_OPEN_HOUR, wallClockInAppTz, zonedTimeToMs } from '../../../supabase/functions/_shared/sendWindow'

export { SEND_STEP_MINUTES, SEND_WINDOW_CLOSE_HOUR, SEND_WINDOW_OPEN_HOUR, zonedTimeToMs }

/** A time of day as the field holds it: "09:00". */
export type Hm = `${string}:${string}`

/** "09:00" from an hour and a minute. */
export const hm = (hour: number, minute: number): Hm => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` as Hm

/** The field's bounds: min, max and step, as the `<input type="time">` takes them. */
export const TIME_FIELD = { min: hm(SEND_WINDOW_OPEN_HOUR, 0), max: hm(SEND_WINDOW_CLOSE_HOUR, 0), step: SEND_STEP_MINUTES * 60 } as const

/** The day after a YYYY-MM-DD. */
export function dayAfterYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10)
}

/** The default: today at 9 AM when it is still ahead, else tomorrow at 9 AM (the morning run's hour, as `morningSendOn`). */
export function defaultSendAt(nowMs: number): number {
  const { ymd, hour } = wallClockInAppTz(nowMs)
  if (hour < RUN_HOUR) return zonedTimeToMs(ymd, RUN_HOUR, 0)
  return zonedTimeToMs(dayAfterYmd(ymd), RUN_HOUR, 0)
}

/**
 * A time fenced to the window in whole steps: before 8:00 reads 8:00, after 21:00 reads 21:00, and a minute off the
 * quarter hour rounds to the nearest. A time the field cannot parse reads 9:00.
 */
export function fenceHm(value: string): Hm {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!m) return hm(RUN_HOUR, 0)
  let minutes = Number(m[1]) * 60 + Number(m[2])
  minutes = Math.round(minutes / SEND_STEP_MINUTES) * SEND_STEP_MINUTES
  minutes = Math.min(Math.max(minutes, SEND_WINDOW_OPEN_HOUR * 60), SEND_WINDOW_CLOSE_HOUR * 60)
  return hm(Math.floor(minutes / 60), minutes % 60)
}

/** The instant a Day and a Time name, the time fenced; null when the day is not a date. */
export function sendAtFrom(ymd: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return null
  const t = fenceHm(time)
  const [h, mi] = t.split(':').map(Number)
  return zonedTimeToMs(ymd.trim(), h ?? RUN_HOUR, mi ?? 0)
}

/** The Day and Time fields an instant fills: "2026-11-10" and "09:00". */
export function fieldsOf(sendAtMs: number): { ymd: string; time: Hm } {
  const w = wallClockInAppTz(sendAtMs)
  return { ymd: w.ymd, time: hm(w.hour, w.minute) }
}

/** An instant is in the past, or inside the next minute: the picker refuses it and the chip says Now instead. */
export function isPast(sendAtMs: number, nowMs: number): boolean {
  return sendAtMs <= nowMs + 60_000
}

/** "9:00 AM" */
export function clockOf(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/** "Tue" / "Tuesday" */
const weekdayOf = (ms: number, long: boolean) => new Date(ms).toLocaleDateString('en-US', { weekday: long ? 'long' : 'short', timeZone: APP_CALENDAR_TZ })
/** "Nov 10" */
const monthDayOf = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })

/** The relation of a day to today: today, tomorrow, or the weekday when further; `later` past six days. */
export function dayWord(sendAtMs: number, nowMs: number): 'today' | 'tomorrow' | 'weekday' | 'later' {
  const today = wallClockInAppTz(nowMs).ymd
  const day = wallClockInAppTz(sendAtMs).ymd
  if (day === today) return 'today'
  if (day === dayAfterYmd(today)) return 'tomorrow'
  const days = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000)
  return days > 0 && days < 7 ? 'weekday' : 'later'
}

/** "Tomorrow 9:00 AM", "Today 6:00 PM", "Tue 9:00 AM", "Nov 24 9:00 AM": the short name of a moment. */
export function shortWhen(sendAtMs: number, nowMs: number): string {
  const word = dayWord(sendAtMs, nowMs)
  const day = word === 'today' ? 'Today' : word === 'tomorrow' ? 'Tomorrow' : word === 'weekday' ? weekdayOf(sendAtMs, false) : monthDayOf(sendAtMs)
  return `${day} ${clockOf(sendAtMs)}`
}

/** "about 17 hours", "about 40 minutes", "about 3 days": how far off a moment is. */
export function relativeWords(sendAtMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.round((sendAtMs - nowMs) / 60_000))
  if (minutes < 60) return `about ${Math.max(minutes, 1)} ${minutes === 1 ? 'minute' : 'minutes'}`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `about ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const days = Math.round(hours / 24)
  return `about ${days} ${days === 1 ? 'day' : 'days'}`
}

/** The chips the picker offers: Now, Tomorrow 9:00 AM, and Today 6:00 PM while 6 PM is still ahead. */
export interface SendLaterChip {
  key: 'now' | 'tomorrow' | 'today-evening'
  label: string
  /** The instant; null for Now. */
  atMs: number | null
}

export function sendLaterChips(nowMs: number): SendLaterChip[] {
  const today = wallClockInAppTz(nowMs).ymd
  const tomorrow9 = zonedTimeToMs(dayAfterYmd(today), RUN_HOUR, 0)
  const today18 = zonedTimeToMs(today, 18, 0)
  const chips: SendLaterChip[] = [
    { key: 'now', label: SEND_LATER_WORDS.now, atMs: null },
    { key: 'tomorrow', label: shortWhen(tomorrow9, nowMs), atMs: tomorrow9 },
  ]
  if (!isPast(today18, nowMs)) chips.push({ key: 'today-evening', label: shortWhen(today18, nowMs), atMs: today18 })
  return chips
}

export const SEND_LATER_WORDS = {
  /** The sheet's second press: "Send later · Tomorrow 9:00 AM". */
  press: (defaultMs: number, nowMs: number) => `Send later · ${shortWhen(defaultMs, nowMs)}`,
  title: 'When it goes',
  subtitle: (first: string | null) => `From the company number to ${first ? `${first}’s` : 'their'} mobile.`,
  now: 'Now',
  day: 'Day',
  time: 'Time',
  /** "Goes Tuesday, Nov 10 at 9:00 AM Central, in about 17 hours." */
  goes: (sendAtMs: number, nowMs: number) => `Goes ${weekdayOf(sendAtMs, true)}, ${monthDayOf(sendAtMs)} at ${clockOf(sendAtMs)} Central, in ${relativeWords(sendAtMs, nowMs)}.`,
  fence: 'Texts go between 8 AM and 9 PM only, so the time field stops there.',
  where: 'Until it goes, the text waits on the Dashboard under Today’s sends. The time shows on its row. You can change it or take it back there.',
  /** "Send Tuesday 9:00 AM" */
  send: (sendAtMs: number, nowMs: number) => `Send ${dayWord(sendAtMs, nowMs) === 'today' ? 'today' : dayWord(sendAtMs, nowMs) === 'tomorrow' ? 'tomorrow' : weekdayOf(sendAtMs, true)} ${clockOf(sendAtMs)}`,
  back: 'Back',
  past: 'That time has passed. Pick a later one, or press Now.',
  /** The sheet's receipt once the text is handed to a time. */
  readyTitle: 'Ready to go later',
  /** "Goes Tuesday, Nov 10 at 9:00 AM Central from the company number." */
  readyLine: (sendAtMs: number) => `Goes ${weekdayOf(sendAtMs, true)}, ${monthDayOf(sendAtMs)} at ${clockOf(sendAtMs)} Central from the company number.`,
  /** Today's sends' row: "Goes Tue 9:00 AM". */
  rowGoes: (sendAtMs: number, nowMs: number) => `Goes ${shortWhen(sendAtMs, nowMs)}`,
  changeTime: 'Change the time',
  timeChanged: (sendAtMs: number, nowMs: number) => `It goes ${shortWhen(sendAtMs, nowMs)}.`,
  /** The toast after the sheet hands the text to a time. */
  toast: (sendAtMs: number, nowMs: number) => `It goes ${shortWhen(sendAtMs, nowMs)} from the company number.`,
} as const
