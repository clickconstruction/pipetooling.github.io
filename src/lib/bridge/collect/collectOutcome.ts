/**
 * The Collect desk, PR D (v2.5855): after the call. Four answers cover a
 * collections call, and each becomes the record the app already keeps: a
 * payment where money lives, a promise with its date and the Payment Chase
 * touch of the matching kind with a note. Nothing new in the record. The
 * rules the owner settled on the boards: "the check went out Friday" is a
 * promise dated by the mail, the mail day plus five; "approved, on the next
 * run" is a promise for the run's date; no answer or a wrong contact is could
 * not reach, spoke with no day named is a note with their words; a pay app
 * they rejected is the dispute, a pending one is a promise. Pure.
 */
import type { ChaseTouchOutcome } from '../../jobs/paymentChase'
import { ymdAddDays } from '../../../utils/dateUtils'

export type CollectAnswer = 'paid' | 'promised' | 'nodate' | 'dispute'

export const COLLECT_ANSWERS: ReadonlyArray<{ key: CollectAnswer; label: string; sub: string }> = [
  { key: 'paid', label: 'Money is in the bank', sub: 'a payment you can see, or a check in hand' },
  { key: 'promised', label: 'They named a date', sub: 'a promise, with a day' },
  { key: 'nodate', label: 'No date', sub: 'no answer, or they would not name a day' },
  { key: 'dispute', label: 'They dispute it', sub: 'the amount or the work' },
]

export type CollectNoDateReason = 'no_answer' | 'no_day' | 'vague' | 'wrong_contact'
export const COLLECT_NO_DATE_REASONS: ReadonlyArray<{ key: CollectNoDateReason; label: string }> = [
  { key: 'no_answer', label: 'No answer, left a message' },
  { key: 'no_day', label: 'Spoke, they would not name a day' },
  { key: 'vague', label: 'Spoke, a vague answer, no day' },
  { key: 'wrong_contact', label: 'Wrong contact' },
]

export type CollectDisputeReason = 'amount' | 'work' | 'who' | 'payapp_rejected'
export const COLLECT_DISPUTE_REASONS: ReadonlyArray<{ key: CollectDisputeReason; label: string }> = [
  { key: 'amount', label: 'The amount' },
  { key: 'work', label: 'The work' },
  { key: 'who', label: 'Who owes it' },
  { key: 'payapp_rejected', label: 'A pay app they rejected' },
]

/** Days a mailed check takes to arrive: the mail day plus this. */
export const MAILED_CHECK_DAYS = 5

/** "The check went out Friday": a promise dated by the mail. */
export function mailedCheckYmd(mailDayYmd: string, days = MAILED_CHECK_DAYS): string {
  return ymdAddDays(mailDayYmd, days)
}

export type CollectOutcomeInput =
  | { answer: 'paid'; words?: string | null }
  | { answer: 'promised'; ymd: string; saidBy?: string | null; words?: string | null }
  | { answer: 'nodate'; reason: CollectNoDateReason; words?: string | null; resend?: boolean }
  | { answer: 'dispute'; reason: CollectDisputeReason; words?: string | null }

/** One write the sheet makes, in the app's own records. */
export type CollectOutcomeWrite =
  | { kind: 'touch'; outcome: ChaseTouchOutcome; note: string | null }
  | { kind: 'promise'; ymd: string; saidBy: string | null; note: string | null }

export type CollectOutcomePlan = {
  /** The writes, in order; a payment is recorded where money lives, so `paid` writes only its note. */
  writes: CollectOutcomeWrite[]
  /** Why there is no payment write: the door to record the money. */
  recordPaymentFirst: boolean
  /** What the app then does, one sentence each, for the sheet's grey line. */
  then: string[]
  /** Friday's bucket. */
  friday: 'landed' | 'dated' | 'no_date' | 'on_the_owner'
}

const trim = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim()
  return t ? t : null
}

export function collectOutcomePlan(input: CollectOutcomeInput, opts: { graceDays: number; quietDays: number; dayLabel: (ymd: string) => string }): CollectOutcomePlan {
  switch (input.answer) {
    case 'paid':
      return {
        writes: [{ kind: 'touch', outcome: 'note', note: `Paid after the call.${trim(input.words) ? ` ${trim(input.words)}` : ''}` }],
        recordPaymentFirst: true,
        then: ['The pile falls by what landed once the payment is recorded.', 'Friday counts it under landed, after a call.', 'The payer gets a pay speed on record, and the next bill reads at that pace.'],
        friday: 'landed',
      }
    case 'promised': {
      // Before a date is picked the words name the day to come, never "Invalid Date" (v2.5873).
      const day = /^\d{4}-\d{2}-\d{2}$/.test(input.ymd) ? opts.dayLabel(input.ymd) : 'the day they name'
      return {
        writes: [{ kind: 'promise', ymd: input.ymd, saidBy: trim(input.saidBy), note: trim(input.words) }],
        recordPaymentFirst: false,
        then: [`The forecast moves the money to ${day}.`, 'Until then the payer waits off the call sheet, unless other bills are late.', 'Friday counts this call under ended with a date.', `If ${day} passes unpaid, the row turns to past a promise after the ${opts.graceDays}-day grace. The broken promise is then this payer's call.`, 'A second miss on the account puts the owner on the next call.', 'The Lien desk’s clock does not move. It counts from the work month, never from a promise.'],
        friday: 'dated',
      }
    }
    case 'nodate': {
      const couldNotReach = input.reason === 'no_answer' || input.reason === 'wrong_contact'
      const reasonWords = COLLECT_NO_DATE_REASONS.find((r) => r.key === input.reason)?.label ?? ''
      const writes: CollectOutcomeWrite[] = [{ kind: 'touch', outcome: couldNotReach ? 'cant_reach' : 'note', note: trim(input.words) ? `${reasonWords}. ${trim(input.words)}` : reasonWords }]
      if (input.resend) writes.push({ kind: 'touch', outcome: 'resend', note: 'The bill, sent again after the call.' })
      return {
        writes,
        recordPaymentFirst: false,
        then: [couldNotReach ? 'Recorded as could not reach.' : 'Recorded as a note with their words, so the next caller knows they spoke.', `The row keeps its state and is back on the sheet after ${opts.quietDays} quiet days.`, 'A second miss on the account, a no-answer or a broken date, puts the owner on the next call.', 'Friday counts it under no date. The forecast does not move, so the weeks stay honest.'],
        friday: 'no_date',
      }
    }
    case 'dispute': {
      const reasonWords = COLLECT_DISPUTE_REASONS.find((r) => r.key === input.reason)?.label ?? ''
      return {
        writes: [{ kind: 'touch', outcome: 'dispute', note: trim(input.words) ? `${reasonWords}. ${trim(input.words)}` : reasonWords }],
        recordPaymentFirst: false,
        then: ['The row leaves the call sheet and reaches the owner with their words, under Only you can decide.', 'The bills stay in the pile, marked disputed, so the weeks do not flatter.', 'The Lien desk keeps its clock running.', 'Friday counts it under on the owner.'],
        friday: 'on_the_owner',
      }
    }
  }
}
