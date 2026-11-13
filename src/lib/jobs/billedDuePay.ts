/**
 * A billed row's pay model with the payer's Pay calendar read in (punch list #323, PR 2).
 *
 * `billedExpectedPayModel` is the pace guess: the bill date plus how long this payer takes.
 * It stays as it is, and its edge copies with it. This wraps it. With no calendar the answer
 * is the pace guess, unchanged. With one:
 *
 *  - `dueYmd` is the day the contract makes the bill due (`dueDayFor`).
 *  - `expectedYmd` is the due day plus how late the payer usually runs against their own
 *    due days (`latenessAgainst` over their measured payments), and the due day itself when
 *    they have no payment on record. Never before the due day.
 *  - A date the customer named still wins the expected day; the due day rides along.
 *
 * The contract says when a bill is due. The record says when it lands. A screen that counts
 * money reads `expectedYmd`, as before. A screen that asks whether to call reads `dueYmd`
 * too: a bill can be past due while its money is not yet expected.
 *
 * The clock is the bill's reference day, `billedReferenceYmd`: the day it was billed, else
 * the estimated bill date. That is the day the record is measured from too, so the due day
 * and the lateness read one clock. No day a payer accepted a bill is recorded yet (PR 4).
 */
import { billedExpectedPayModel, billedReferenceYmd, daysBetweenYmd, formatYmdMonthDay, type ExpectedPayModel, type ExpectedPayPaceInput, type ExpectedPayRowInput, type ExpectedPaySource, type PaySpeedData, type PromisedPayDate } from './billedExpectedPay'
import { dueDayFor, expectedFromDue, latenessAgainst, latenessWords, payCalendarWords, type PayCalendar, type PayCalendarLateness } from './payCalendar'

export type BilledPaySource = ExpectedPaySource | 'terms'

export type BilledPayModel = Omit<ExpectedPayModel, 'source'> & {
  /** As `ExpectedPayModel`, plus `terms`: the day came from the payer's Pay calendar. */
  source: BilledPaySource
  /** The day the contract makes the bill due; null with no calendar. */
  dueYmd: string | null
  /** Calendar days past the due day; 0 while it is ahead, and with no calendar. */
  daysPastDue: number
  /** The payer's record against the calendar; null with no calendar or nothing measured. */
  lateness: PayCalendarLateness | null
  /** The calendar read; null when the row has none. */
  calendar: PayCalendar | null
}

const plain = (base: ExpectedPayModel | null): BilledPayModel | null => (base ? { ...base, dueYmd: null, daysPastDue: 0, lateness: null, calendar: null } : null)

/**
 * The pay model for one billed row. `calendar` is the row's Pay calendar from `calendarFor`
 * (its job's own, else its payer's); null or absent reads exactly as `billedExpectedPayModel`.
 */
export function billedPayModel(
  input: ExpectedPayRowInput,
  data: PaySpeedData | null,
  todayYmd: string,
  promise?: PromisedPayDate | null,
  pace?: ExpectedPayPaceInput | null,
  calendar?: PayCalendar | null,
): BilledPayModel | null {
  const base = billedExpectedPayModel(input, data, todayYmd, promise, pace)
  if (!calendar) return plain(base)
  const refYmd = billedReferenceYmd(input)
  const dueYmd = refYmd ? dueDayFor(refYmd, calendar) : null
  if (!refYmd || !dueYmd) return plain(base)
  const lateness = latenessAgainst(input.customerId ? data?.receipts[input.customerId] : null, calendar)
  const daysPastDue = Math.max(0, daysBetweenYmd(dueYmd, todayYmd) ?? 0)
  // Their word wins the expected day; the due day rides along for the line under it.
  if (base?.source === 'promised') return { ...base, dueYmd, daysPastDue, lateness, calendar }

  const expectedYmd = expectedFromDue(dueYmd, lateness)
  const sinceExpected = daysBetweenYmd(expectedYmd, todayYmd)
  if (sinceExpected == null) return plain(base)
  const late = sinceExpected > 0
  const daysLate = Math.max(0, sinceExpected)
  const lands = lateness && lateness.medianDays > 0 ? `lands ~${lateness.medianDays}d after their pay day` : 'their pay calendar'
  const due = `due ${formatYmdMonthDay(dueYmd)}`
  const label = late ? `${daysLate}d past expected · ${due}` : daysPastDue > 0 ? `${daysPastDue}d past due · ${lands}` : `Due ${formatYmdMonthDay(dueYmd)} · ${lands}`
  const who = (input.payerName ?? '').trim() || 'This customer'
  const clause = calendar.clause ? ` (${calendar.clause})` : ''
  const floor = calendar.payWhenPaid ? ' They pay when the owner pays them, so the due day is the earliest.' : ''
  const title = `Billed ${formatYmdMonthDay(refYmd)}. ${who} pays on a calendar${clause}: ${payCalendarWords(calendar)} Due ${formatYmdMonthDay(dueYmd)}.${floor} ${latenessWords(lateness)}${expectedYmd !== dueYmd ? ` Expected about ${formatYmdMonthDay(expectedYmd)}.` : ''}`
  return {
    expectedYmd,
    state: late ? 'late' : 'upcoming',
    source: 'terms',
    medianDays: lateness?.medianDays ?? 0,
    samples: lateness?.count ?? 0,
    payers: 0,
    daysLate,
    paceWords: lands,
    label,
    title,
    dueYmd,
    daysPastDue,
    lateness,
    calendar,
  }
}
