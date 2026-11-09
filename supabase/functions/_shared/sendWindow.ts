/**
 * The hours a text may go (v2.6774, punch list #291 PR 4): 8 AM to 9 PM Central, the window Send later's picker fences
 * its time to and the run (`messages-nudge-dispatch`) holds a due office text outside of. One file for both sides, read
 * from `src` as `replyBox.ts` reads `messagesEmail.ts`; `src/lib/offers/sendLater.test.ts` holds it. The clock is the
 * app's zone (`APP_CALENDAR_TZ`), never the machine's.
 */
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

/** The first hour a text may go, in the app's zone. */
export const SEND_WINDOW_OPEN_HOUR = 8
/** The hour texts stop: a text at 21:00 is the last; one at 21:15 waits. */
export const SEND_WINDOW_CLOSE_HOUR = 21
/** The picker's time field steps by this many minutes. */
export const SEND_STEP_MINUTES = 15

/** An instant's wall clock in the app's zone: the civil day, the hour (0 to 23) and the minute. */
export function wallClockInAppTz(ms: number): { ymd: string; hour: number; minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(ms))
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return { ymd: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')) % 24, minute: Number(g('minute')), weekday: Math.max(0, weekdays.indexOf(g('weekday'))) }
}

/** The zone's offset from UTC at an instant, in minutes (Central: -360 in winter, -300 in summer). */
function offsetMinutesAt(ms: number): number {
  const w = wallClockInAppTz(ms)
  const [y, m, d] = w.ymd.split('-').map(Number)
  const asUtc = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, w.hour, w.minute)
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000)
}

/**
 * The instant a wall-clock time in the app's zone names: `zonedTimeToMs('2026-11-10', 9, 0)` is 9:00 AM Central on
 * November 10 as a UTC millisecond count. Two passes, so a day the clocks change still lands on the wall time.
 */
export function zonedTimeToMs(ymd: string, hour: number, minute: number): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const naive = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hour, minute)
  let guess = naive - offsetMinutesAt(naive) * 60_000
  guess = naive - offsetMinutesAt(guess) * 60_000
  return guess
}

/** Whether a text may go at this instant: the wall clock is 8:00 AM to 9:00 PM Central, the last minute included. */
export function inSendWindow(ms: number): boolean {
  const { hour, minute } = wallClockInAppTz(ms)
  if (hour < SEND_WINDOW_OPEN_HOUR) return false
  if (hour > SEND_WINDOW_CLOSE_HOUR) return false
  return !(hour === SEND_WINDOW_CLOSE_HOUR && minute > 0)
}

/** The next moment the window opens at or after an instant: 8:00 AM today when it is still ahead, else 8:00 AM tomorrow. */
export function nextWindowOpen(ms: number): number {
  const { ymd, hour } = wallClockInAppTz(ms)
  if (hour < SEND_WINDOW_OPEN_HOUR) return zonedTimeToMs(ymd, SEND_WINDOW_OPEN_HOUR, 0)
  const [y, m, d] = ymd.split('-').map(Number)
  const tomorrow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10)
  return zonedTimeToMs(tomorrow, SEND_WINDOW_OPEN_HOUR, 0)
}

/** Why a text outside the window waits, for Today's sends; the run moves it to the next 8 AM and says so. */
export const SEND_WINDOW_HELD = 'Texts go between 8 AM and 9 PM. It goes at 8 AM.'
