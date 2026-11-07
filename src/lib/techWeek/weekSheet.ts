/**
 * The sheet after the week's last clock-out (punch list #255, v2.6606; the train's PR 7). The article behind the card
 * says the reward system needs feeding every week, and the end of the week's last shift is when a tech asks whether
 * the week counted. So once, at that clock-out, a sheet says the week: the signal, the move, the customer's words.
 * Then "Have a good weekend". It skips a day the crew deck deals, and deals once a week.
 *
 * Pure: is this the week's last clock-out, the sheet's lines, the once-a-week key.
 */
import type { MyWeek, YourWeekCard } from './weekSignal'
import type { MyCustomerWord } from '../ratings/ratingCredit'
import { customerFirstName, dayWord } from '../ratings/ratingCredit'
import type { PayWeek } from '../payWeekAnchor'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type LastClockOutInput = {
  todayYmd: string
  week: PayWeek
  /** The person's schedule block days inside the pay week (any day of it). */
  blockDays: readonly string[]
}

const weekdayOf = (ymd: string): number => {
  const [y = 1970, m = 1, d = 1] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * The week's last clock-out: the tech has no block on their schedule for the rest of the pay week. With no schedule
 * at all this week, it is Friday's clock-out (or Saturday's, for a Saturday shift). Never before Friday without a
 * schedule, so a mid-week day off does not deal it.
 */
export function isLastClockOutOfWeek({ todayYmd, week, blockDays }: LastClockOutInput): boolean {
  const inWeek = blockDays.filter((d) => d >= week.start && d <= week.end)
  if (inWeek.length === 0) return weekdayOf(todayYmd) >= 5
  return !inWeek.some((d) => d > todayYmd)
}

/** One sheet a week a person: the key the dealt sheet is remembered under on this device. */
export const weekSheetSeenKey = (userId: string, weekStartYmd: string): string => `your_week_sheet_seen_${userId}_${weekStartYmd}`

const round1 = (n: number) => Math.round(n * 10) / 10
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** The person's closed hours inside the pay week, approved or waiting: what the sheet's first line counts. */
export function hoursThisWeek(my: Pick<MyWeek, 'hours'>, week: PayWeek): number {
  return round1(my.hours.filter((h) => h.work_date >= week.start && h.work_date <= week.end).reduce((s, h) => s + h.hours, 0))
}

/** "5:31 PM" on the company clock. */
export function clockOutTime(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

export type WeekSheetWords = {
  title: string
  /** "Clocked out at 5:31 PM. 41.5 hours this week." */
  clockLine: string
  kicker: string
  head: string
  sub: string
  move: YourWeekCard['move']
  mark: string
  note: string
  /** The customer's words of the week, when a customer wrote some. */
  quote: { stars: number; words: string; who: string } | null
  closing: string
  button: string
}

/** The week said once: the signal and where it stands, the move, the words. The closing is the week's. */
export function weekSheetWords(card: YourWeekCard, words: MyCustomerWord | null, clockedOutIso: string, hours: number, todayYmd: string, now: Date = new Date()): WeekSheetWords {
  const at = clockOutTime(clockedOutIso)
  const h = `${fmt(hours)} ${hours === 1 ? 'hour' : 'hours'} this week`
  const clockLine = at ? `Clocked out at ${at}. ${h}.` : `${h[0]!.toUpperCase()}${h.slice(1)}.`
  const quote = words
    ? {
        stars: words.score,
        words: words.words,
        who: `${customerFirstName(words.customerName)}${words.customerName.trim().split(/\s+/)[1] ? ` ${words.customerName.trim().split(/\s+/)[1]![0]}.` : ''} · ${words.jobName.trim().toLowerCase() || `job ${words.jobNumber}`} · ${dayWord(words.answeredAt, now)}`,
      }
    : null
  const closing = weekdayOf(todayYmd) >= 5 ? 'Have a good weekend' : 'Have a good one'
  return { title: card.title, clockLine, kicker: card.kicker, head: card.head, sub: card.sub, move: card.move, mark: card.mark, note: card.note, quote, closing, button: closing }
}
