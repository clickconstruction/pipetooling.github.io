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
 * A bill with a due day of its own (punch list #341, PR 4, `invoice_due_days`) reads that day and
 * no calendar: `dueYmd` and `expectedYmd` are the day itself, since no record is replayed against
 * a date the contract names once. A date the customer named still wins the expected day.
 *
 * The clock is the day the payer accepted the bill, when the office has recorded one (PR 4,
 * `invoice_payer_acceptances`), else the bill's reference day, `billedReferenceYmd`: the day
 * it was billed, else the estimated bill date. The reference day is what the record is
 * measured from too, so with no accepted day the due day and the lateness read one clock.
 */
import { billedExpectedPayModel, billedReferenceYmd, daysBetweenYmd, formatYmdMonthDay, type ExpectedPayModel, type ExpectedPayPaceInput, type ExpectedPayRowInput, type ExpectedPaySource, type PaySpeedData, type PromisedPayDate } from './billedExpectedPay'
import { BILL_OWN_DUE_WORDS, asPayCalendarRead, dueDayFor, expectedFromDue, payCalendarWords, payTermsNoun, paysDaysAfter, recordFor, recordWords, type BillOwnDue, type PayCalendar, type PayCalendarArg, type PayCalendarLateness, type PayCalendarRecord } from './payCalendar'

export type BilledPaySource = ExpectedPaySource | 'terms'

/** A billed row as the model reads it: the pace guess's row, plus the day the payer accepted the bill when one is recorded. */
export type BilledPayRowInput = ExpectedPayRowInput & {
  /** YYYY-MM-DD the payer accepted the bill (`invoice_payer_acceptances`); null or absent counts from the day it went in. */
  acceptedYmd?: string | null
}

/** Which day a calendar counted its cutoff from. */
export type PayClockFrom = 'accepted' | 'billed'

export type BilledPayModel = Omit<ExpectedPayModel, 'source'> & {
  /** As `ExpectedPayModel`, plus `terms`: the day came from the payer's Pay calendar. */
  source: BilledPaySource
  /** The day the contract makes the bill due; null with no calendar. */
  dueYmd: string | null
  /** Calendar days past the due day; 0 while it is ahead, and with no calendar. */
  daysPastDue: number
  /** The record against the calendar; null with no calendar or nothing measured. `record` says whose it is. */
  lateness: PayCalendarLateness | null
  /** The record and whose it is (punch list #341, PR 3): the payer's, this job's own once it has two payments, or the payer's standing in until then. Null with no calendar. */
  record: PayCalendarRecord | null
  /** The calendar read; null when the row has none. */
  calendar: PayCalendar | null
  /** The calendar is this job's own, not its payer's (punch list #341); false with none, or the payer's. */
  calendarOwn: boolean
  /** The due day is this bill's own (punch list #341, PR 4): no calendar was read. Null on every other bill. */
  ownDue: BillOwnDue | null
  /** The day the calendar counted its cutoff from, and which day that is; null with no calendar. */
  clockYmd: string | null
  clockFrom: PayClockFrom | null
}

const plain = (base: ExpectedPayModel | null): BilledPayModel | null => (base ? { ...base, dueYmd: null, daysPastDue: 0, lateness: null, record: null, calendar: null, calendarOwn: false, ownDue: null, clockYmd: null, clockFrom: null } : null)

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** The day a calendar counts a bill's cutoff from: the accepted day when one is recorded, else the bill's reference day. */
export function payClockFor(input: BilledPayRowInput): { ymd: string; from: PayClockFrom } | null {
  const accepted = (input.acceptedYmd ?? '').trim()
  if (YMD.test(accepted)) return { ymd: accepted, from: 'accepted' }
  const billed = billedReferenceYmd(input)
  return billed ? { ymd: billed, from: 'billed' } : null
}

/** The clock in the fewest words, for a dates row with little room: "Counted from Nov 3" · "Accepted Dec 2". */
export function payClockShort(clock: { ymd: string; from: PayClockFrom }): string {
  return clock.from === 'accepted' ? `Accepted ${formatYmdMonthDay(clock.ymd)}` : `Counted from ${formatYmdMonthDay(clock.ymd)}`
}

/** The clock in the row's words: "Counted from Nov 3, the day it went in" · "Counted from Dec 2, the day they accepted it". */
export function payClockWords(clock: { ymd: string; from: PayClockFrom }): string {
  return `Counted from ${formatYmdMonthDay(clock.ymd)}, the day ${clock.from === 'accepted' ? 'they accepted it' : 'it went in'}`
}

/** The day a bill is held to, for a screen that asks whether it is past due. */
export type BillHeldDay = {
  /** On a Pay calendar the due day; else the expected day, or the day the customer named. */
  ymd: string
  /** That day has gone by. */
  late: boolean
  /** Days past it; 0 while it is ahead. */
  daysLate: number
  /** The day is the calendar's due day. */
  onCalendar: boolean
}

/**
 * The day a screen holds a bill to when it asks *is this past due?* (v2.7140): a reminder's day, a
 * *past due* count. On a Pay calendar it is the due day, the day the contract names, so a bill is
 * never past due before it and is the day after. With no calendar it is the expected day, as
 * before. A day the customer named wins either way. A screen that counts money still reads
 * `expectedYmd`.
 */
export function billHeldDay(model: BilledPayModel | null | undefined): BillHeldDay | null {
  if (!model) return null
  if (model.source === 'terms' && model.dueYmd) return { ymd: model.dueYmd, late: model.daysPastDue > 0, daysLate: model.daysPastDue, onCalendar: true }
  return { ymd: model.expectedYmd, late: model.state === 'late', daysLate: model.daysLate, onCalendar: false }
}

/**
 * The pay model for one billed row. `calendar` is the row's Pay calendar (its job's own, else
 * its payer's); null or absent reads exactly as `billedExpectedPayModel`. Handed over as
 * `calendarSourceFor`'s read, the model also knows the calendar is the job's own, and its hover
 * says so (punch list #341); a bare calendar from `calendarFor` is taken as the payer's.
 */
export function billedPayModel(
  input: BilledPayRowInput,
  data: PaySpeedData | null,
  todayYmd: string,
  promise?: PromisedPayDate | null,
  pace?: ExpectedPayPaceInput | null,
  calendarArg?: PayCalendarArg,
): BilledPayModel | null {
  const base = billedExpectedPayModel(input, data, todayYmd, promise, pace)
  const read = asPayCalendarRead(calendarArg)
  if (read.ownDue) return ownDayModel(input, base, read.ownDue, todayYmd)
  const calendar = read.calendar
  const calendarOwn = read.from === 'job'
  if (!calendar) return plain(base)
  const clock = payClockFor(input)
  const refYmd = clock?.ymd ?? null
  const dueYmd = refYmd ? dueDayFor(refYmd, calendar) : null
  if (!clock || !refYmd || !dueYmd) return plain(base)
  const clockFields = { clockYmd: clock.ymd, clockFrom: clock.from }
  // A job on its own calendar is scored on its own payments once it has two; until then, and on the payer's calendar, on the payer's.
  const record = recordFor(input.customerId ? data?.receipts[input.customerId] : null, read)
  const lateness = record?.lateness ?? null
  const daysPastDue = Math.max(0, daysBetweenYmd(dueYmd, todayYmd) ?? 0)
  // Their word wins the expected day; the due day rides along for the line under it.
  if (base?.source === 'promised') return { ...base, dueYmd, daysPastDue, lateness, record, calendar, calendarOwn, ownDue: null, ...clockFields }

  const expectedYmd = expectedFromDue(dueYmd, lateness)
  const sinceExpected = daysBetweenYmd(expectedYmd, todayYmd)
  if (sinceExpected == null) return plain(base)
  const late = sinceExpected > 0
  const daysLate = Math.max(0, sinceExpected)
  // Terms in days after the bill (punch list #341, PR 5) have a due day and no pay day, and are terms, not a calendar.
  const daysAfter = paysDaysAfter(calendar)
  const lands = lateness && lateness.medianDays > 0 ? `lands ~${lateness.medianDays}d after their ${daysAfter ? 'due day' : 'pay day'}` : `their ${payTermsNoun(calendar)}`
  const due = `due ${formatYmdMonthDay(dueYmd)}`
  const label = late ? `${daysLate}d past expected · ${due}` : daysPastDue > 0 ? `${daysPastDue}d past due · ${lands}` : `Due ${formatYmdMonthDay(dueYmd)} · ${lands}`
  const who = (input.payerName ?? '').trim() || 'This customer'
  const clause = calendar.clause ? ` (${calendar.clause})` : ''
  const floor = calendar.payWhenPaid ? ' They pay when the owner pays them, so the due day is the earliest.' : ''
  const billedYmd = billedReferenceYmd(input)
  const opening = clock.from === 'accepted' ? `${billedYmd ? `Billed ${formatYmdMonthDay(billedYmd)}. ` : ''}They accepted it ${formatYmdMonthDay(clock.ymd)}, and the calendar counts from that day.` : `Billed ${formatYmdMonthDay(refYmd)}.`
  // A job's own calendar says so: the same payer can read two sets of days on two rows, and the hover is where the reason is.
  const whose = calendarOwn ? `This job is on its own ${daysAfter ? 'terms' : 'calendar'}${clause}` : daysAfter ? `${who} pays a set number of days after a bill${clause}` : `${who} pays on a calendar${clause}`
  const title = `${opening} ${whose}: ${payCalendarWords(calendar)} Due ${formatYmdMonthDay(dueYmd)}.${floor} ${recordWords(record, who)}${expectedYmd !== dueYmd ? ` Expected about ${formatYmdMonthDay(expectedYmd)}.` : ''}`
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
    record,
    calendar,
    calendarOwn,
    ownDue: null,
    ...clockFields,
  }
}

/**
 * The model for a bill with a due day of its own: the day the contract names is the due day and the
 * expected day. No calendar is read and no record is replayed. Their word still wins the expected day.
 */
function ownDayModel(input: BilledPayRowInput, base: ExpectedPayModel | null, ownDue: BillOwnDue, todayYmd: string): BilledPayModel | null {
  const dueYmd = ownDue.dueYmd
  const since = daysBetweenYmd(dueYmd, todayYmd)
  if (since == null) return plain(base)
  const daysPastDue = Math.max(0, since)
  const none = { lateness: null, record: null, calendar: null, calendarOwn: false, ownDue, clockYmd: null, clockFrom: null }
  if (base?.source === 'promised') return { ...base, dueYmd, daysPastDue, ...none }
  const billedYmd = billedReferenceYmd(input)
  const clause = ownDue.clause ? ` (${ownDue.clause})` : ''
  const said = ownDue.words ? ` ${/[.!?]$/.test(ownDue.words) ? ownDue.words : `${ownDue.words}.`}` : ''
  const lands = BILL_OWN_DUE_WORDS.replace(/^T/, 't')
  return {
    expectedYmd: dueYmd,
    state: daysPastDue > 0 ? 'late' : 'upcoming',
    source: 'terms',
    medianDays: 0,
    samples: 0,
    payers: 0,
    daysLate: daysPastDue,
    paceWords: lands,
    label: daysPastDue > 0 ? `${daysPastDue}d past due · ${lands}` : `Due ${formatYmdMonthDay(dueYmd)} · ${lands}`,
    title: `${billedYmd ? `Billed ${formatYmdMonthDay(billedYmd)}. ` : ''}This bill has a due day of its own${clause}.${said} Due ${formatYmdMonthDay(dueYmd)}. No pay calendar is read for it.`,
    dueYmd,
    daysPastDue,
    ...none,
  }
}
