/**
 * The customer's pay-by promise drawn as a strip of days on the bill's row (punch list #217,
 * outside-12, a prototype). Today the statement says *You told us to expect payment by Nov 6,
 * 2026. Changed?* and *We'll hold off on reminders until then*: a promise about a process the
 * customer cannot see. The strip draws the three days that process is made of — *billed* Oct 27,
 * *your day* Fri Nov 6, and *we call* Nov 13 if it has not come — with today marked, so the
 * sentence becomes what the strip shows. Pure: it reads the bill, the promise and today and
 * returns the marks with where each sits; the component draws them.
 *
 * The call day is the office's own rule, not the page's: a promise still unpaid
 * `BROKEN_PROMISE_GRACE_DAYS` past its date re-enters the Payment Chase queue, where the office
 * calls. `customer-portal` sends it as `promise.callYmd`; a page on a function deployed before it
 * works the same day out here from the same constant.
 */
import { BROKEN_PROMISE_GRACE_DAYS } from '../jobs/paymentChaseTouches'
import { promiseDateChoices, promiseDaysBetween, type PromiseDateChoice } from '../../../supabase/functions/_shared/portalPromise'

export type PromiseStripMarkKind = 'billed' | 'today' | 'promised' | 'call'

export type PromiseStripMark = {
  kind: PromiseStripMarkKind
  ymd: string
  /** The word over the mark: *billed*, *today*, *your day*, *we call*. */
  word: string
  /** The day under it: *Oct 27*, *Fri Nov 6*, *Nov 13, if not in*; '' under today. */
  day: string
  /** Where it sits along the strip, 0 to 100. */
  x: number
}

export type PromiseStrip = {
  startYmd: string
  endYmd: string
  promisedYmd: string
  callYmd: string
  /** Left to right. */
  marks: PromiseStripMark[]
  /** The strip in a few short sentences, for the hover and the screen reader. */
  words: string
  /** The promised day has gone by. */
  passed: boolean
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** The marks keep off the strip's two ends, so a word over the first or last one still fits. */
const INSET = 6

function addDays(ymd: string, n: number): string {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) + n))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** "Nov 6". */
export function promiseStripMonthDay(ymd: string): string {
  return `${MONTH[Number(ymd.slice(5, 7)) - 1] ?? '?'} ${Number(ymd.slice(8, 10))}`
}

/** "Fri Nov 6". */
export function promiseStripWeekday(ymd: string): string {
  const dow = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))).getUTCDay()
  return `${WEEKDAY[dow]} ${promiseStripMonthDay(ymd)}`
}

/** The day the office calls if the money has not come: the promise plus the chase queue's grace. */
export function promiseCallYmd(promisedYmd: string): string {
  return addDays(promisedYmd, BROKEN_PROMISE_GRACE_DAYS)
}

/**
 * The strip for one bill. Null when the promise or today is not a date. A bill with no billed
 * day draws without the *billed* mark; a call day from the payload wins over the rule here.
 */
export function promiseStrip(args: { billedOn: string | null; promisedYmd: string; callYmd?: string | null; todayYmd: string }): PromiseStrip | null {
  const { promisedYmd, todayYmd } = args
  if (!YMD.test(promisedYmd) || !YMD.test(todayYmd)) return null
  const billedOn = args.billedOn && YMD.test(args.billedOn) ? args.billedOn : null
  const callYmd = args.callYmd && YMD.test(args.callYmd) ? args.callYmd : promiseCallYmd(promisedYmd)
  const days = [billedOn, todayYmd, promisedYmd, callYmd].filter((d): d is string => d != null).sort()
  const startYmd = days[0]!
  const endYmd = days[days.length - 1]!
  const span = Math.max(1, promiseDaysBetween(startYmd, endYmd) ?? 1)
  const x = (ymd: string) => Math.round((INSET + ((100 - 2 * INSET) * (promiseDaysBetween(startYmd, ymd) ?? 0)) / span) * 10) / 10
  const marks: PromiseStripMark[] = []
  if (billedOn) marks.push({ kind: 'billed', ymd: billedOn, word: 'billed', day: promiseStripMonthDay(billedOn), x: x(billedOn) })
  marks.push({ kind: 'today', ymd: todayYmd, word: 'today', day: '', x: x(todayYmd) })
  marks.push({ kind: 'promised', ymd: promisedYmd, word: 'your day', day: promiseStripWeekday(promisedYmd), x: x(promisedYmd) })
  marks.push({ kind: 'call', ymd: callYmd, word: 'we call', day: `${promiseStripMonthDay(callYmd)}, if not in`, x: x(callYmd) })
  marks.sort((a, b) => a.x - b.x || a.ymd.localeCompare(b.ymd))
  const passed = todayYmd > promisedYmd
  const words = [
    billedOn ? `Billed ${promiseStripMonthDay(billedOn)}.` : null,
    passed ? `Your day was ${promiseStripWeekday(promisedYmd)}.` : `Your day is ${promiseStripWeekday(promisedYmd)}.`,
    `We call ${promiseStripMonthDay(callYmd)} if it has not come.`,
  ]
    .filter(Boolean)
    .join(' ')
  return { startYmd, endYmd, promisedYmd, callYmd, marks, words, passed }
}

/** The *Changed?* chips under the strip: the page's three Fridays, less the day already promised. */
export function promiseChangeChips(todayYmd: string, promisedYmd: string): PromiseDateChoice[] {
  return promiseDateChoices(todayYmd).filter((c) => c.ymd !== promisedYmd)
}
