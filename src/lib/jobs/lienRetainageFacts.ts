/**
 * The retainage pane's facts as values in place (punch list #399, the Lien desk's second screen). The rule is
 * `src/lib/valuesInPlace.ts`: a date, a count, a name or an amount is drawn apart from the words around it, a value a
 * person can change opens its own field where it sits, and a value the app works out is plain bold.
 *
 * Three facts on the pane are typed by a person: the day our contract on the job ended with how it ended, the
 * retainage the GC holds, and whether a payment bond is on the project. Until now each was changed in Edit Job, behind
 * *Change ›*. This file holds what the pane needs to change them where they sit: the choices, the words each value
 * reads as, the line under an open field that says what the draft would do, the window that asks first, and the
 * patch each one writes.
 *
 * The day our contract ended starts the 30-day § 53.057 clock, so a change to it asks first and says which day the
 * notice is then due (the card's rule for a lien date that moves a legal deadline). How it ended, the retainage and
 * the bond move no deadline and are saved on Keep.
 *
 * Nothing here rewrites a sentence a lien kernel wrote or works out a day of its own: the deadline is
 * `retainageDeadlineFor`'s, and the chip's words are `retainageDeadlineWords`'s with their value marked. Pure, and
 * not mirrored into the edge functions.
 */
import { val } from '../valuesInPlace'
import { daysBetweenYmd } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'
import { lienDayValues } from './lienDayValues'
import { retainageDeadlineFor } from './lienDeadlines'
import { LIEN_CONTRACT_ENDED_HOW, retainageDeadlineWords, type LienContractEndedHow, type LienPaymentBond, type LienRetainageEntry } from './lienDeskRetainage'

type FormatDay = (ymd: string) => string

// ---------- The values' names and choices ----------

/** What each value is, for its press's name and its field's. Lower case, as a sentence would say it. */
export const LIEN_RETAINAGE_VALUE_LABELS = {
  how: 'how our contract ended',
  day: 'the day our contract ended',
  held: 'retainage the GC holds',
  bond: 'payment bond on the project',
} as const

/** The choice that says our contract has not ended. It is no `LienContractEndedHow`: the job holds no word for it. */
export const LIEN_CONTRACT_STILL_OPEN = 'open'

/** The contract's state as its field lists it: still open first, then the three ways it ends. */
export const LIEN_CONTRACT_STATE_CHOICES: ReadonlyArray<{ value: string; label: string }> = [
  { value: LIEN_CONTRACT_STILL_OPEN, label: 'Still open' },
  ...LIEN_CONTRACT_ENDED_HOW.map((h) => ({ value: h.key, label: h.label })),
]

/** The contract's state as the line prints it: `complete`, or `still open`. */
export function lienContractStateText(how: LienContractEndedHow | null): string {
  return how ? (LIEN_CONTRACT_ENDED_HOW.find((h) => h.key === how)?.words ?? how) : 'still open'
}

/** The day's words while no day is on the job. */
export const LIEN_CONTRACT_NO_DAY_WORDS = 'no day yet'

export const LIEN_PAYMENT_BOND_CHOICES: ReadonlyArray<{ value: LienPaymentBond; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
]

/** The bond as the line prints it. */
export function lienPaymentBondText(bond: LienPaymentBond): string {
  return bond === 'yes' ? 'yes' : bond === 'no' ? 'no' : 'unknown'
}

/** The retainage as the line prints it: the dollars, or that none is recorded. */
export function lienRetainageHeldText(held: number | null): string {
  return held == null ? 'not recorded' : formatUsdNoCents(held)
}

/** The retainage as its field holds it: the plain number, or '' while none is recorded. */
export function lienRetainageHeldValue(held: number | string | null | undefined): string {
  if (held == null || held === '') return ''
  const n = Number(held)
  return Number.isFinite(n) ? String(n) : ''
}

// ---------- The chip ----------

/**
 * The deadline chip's words with their value marked: `mail in ⟪days|9d⟫`, `mail by ⟪day|Oct 3⟫`. The words are
 * `retainageDeadlineWords`'s own. *mail today*, *mail by tomorrow*, *window closed* and *clock not started* name no
 * day and no count, and come back as they are.
 */
export function retainageDeadlineValues(e: Pick<LienRetainageEntry, 'deadline' | 'daysLeft'>, formatDay: FormatDay): string {
  const words = retainageDeadlineWords(e, formatDay)
  const counted = words.replace(/\b\d+d\b/, (d) => val('days', d))
  return counted === words ? lienDayValues(words) : counted
}

// ---------- The line under an open field ----------

/**
 * What a drafted day would do, for the line under the open date box: the day the notice would be due, or that its
 * 30 days are already over. '' until the draft is a whole day.
 */
export function lienContractDayPreview(draft: string, todayYmd: string, formatDay: FormatDay): string {
  const deadline = retainageDeadlineFor(draft)
  if (!deadline) return ''
  const left = daysBetweenYmd(todayYmd, deadline)
  if (left != null && left < 0) return `The 30 days would have closed ${val('day', formatDay(deadline))}.`
  return `The § 53.057 notice would be due by ${val('day', formatDay(deadline))}.`
}

/** What a drafted figure would do, for the line under the open amount box. '' until the draft is a number. */
export function lienRetainageHeldPreview(draft: string): string {
  const t = draft.trim()
  if (t === '') return ''
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n === 0) return 'A 0 means the GC holds none. No notice goes then.'
  return `The notice would claim ${val('amount', formatUsdNoCents(n))}.`
}

/** The words beside the open amount box. */
export const LIEN_RETAINAGE_HELD_HINT = 'Dollars the GC holds back and has not paid.'

/** Why a figure read from a pay application has no press here, and where it is changed. */
export const LIEN_RETAINAGE_FROM_APPLICATION = { tag: 'pay application', why: 'The latest saved pay application is the source. Change it in the AIA window.' } as const

/**
 * The words beside the day's open box while a way of ending is picked and no day is saved yet. They name the last
 * approved clock day when the job has one, as Edit Job's row suggests it: the day is never filled in from it.
 */
export function lienContractStartHint(how: LienContractEndedHow, lastClockDay: string | null | undefined, formatDay: FormatDay): string {
  const last = (lastClockDay ?? '').slice(0, 10)
  return `The day our contract was ${lienContractStateText(how)}.${last ? ` The last approved clock day is ${formatDay(last)}.` : ''}`
}

/** The words beside a picked way of ending that has no day yet, after the day's box was closed. */
export const LIEN_CONTRACT_NOT_SAVED_WORDS = 'Not saved yet. Set the day.'

// ---------- The window that asks first ----------

export type LienContractAsk = { title: string; message: string; confirmLabel: string }

/**
 * The window a change to the day opens before anything is written, in the day's own words: what the day becomes and
 * which day the § 53.057 notice is then due. `was` is the day on the job, or '' while our contract is still open.
 */
export function lienContractEndedAsk(input: { how: LienContractEndedHow; day: string; was: string; todayYmd: string; formatDay: FormatDay }): LienContractAsk {
  const { how, day, was, todayYmd, formatDay } = input
  const deadline = retainageDeadlineFor(day)
  const left = deadline ? daysBetweenYmd(todayYmd, deadline) : null
  const due = deadline ? formatDay(deadline) : ''
  const passed = left != null && left < 0 ? ' That day has already passed.' : ''
  if (!was) {
    return {
      title: 'Start the 30-day clock?',
      message: `Our contract on this job was ${lienContractStateText(how)} on ${formatDay(day)}. The § 53.057 retainage notice is then due by ${due}.${passed}`,
      confirmLabel: 'Start the clock',
    }
  }
  const wasDeadline = retainageDeadlineFor(was)
  const moved = wasDeadline && wasDeadline !== deadline ? `The § 53.057 retainage notice is then due by ${due}. It was due by ${formatDay(wasDeadline)}.` : `The § 53.057 retainage notice is still due by ${due}.`
  return {
    title: 'Move the day our contract ended?',
    message: `The day moves from ${formatDay(was)} to ${formatDay(day)}. ${moved}${passed}`,
    confirmLabel: 'Move the day',
  }
}

/** The window that asks before an ended contract is marked still open: the day comes off, and the clock stops. */
export function lienContractStillOpenAsk(input: { was: string; formatDay: FormatDay }): LienContractAsk {
  const wasDeadline = retainageDeadlineFor(input.was)
  return {
    title: 'Mark our contract still open?',
    message: `The day our contract ended comes off the job, and the 30-day clock stops.${wasDeadline ? ` The § 53.057 retainage notice was due by ${input.formatDay(wasDeadline)}.` : ''}`,
    confirmLabel: 'Mark it still open',
  }
}

// ---------- The words after a save ----------

export function lienContractEndedSavedWords(how: LienContractEndedHow, day: string, formatDay: FormatDay): string {
  const deadline = retainageDeadlineFor(day)
  return `Our contract: ${lienContractStateText(how)} ${formatDay(day)}.${deadline ? ` The retainage notice is due by ${formatDay(deadline)}.` : ''}`
}

export const LIEN_CONTRACT_STILL_OPEN_SAVED_WORDS = 'Our contract is marked still open. The 30-day clock is stopped.'

export function lienRetainageHeldSavedWords(held: number): string {
  return `Retainage the GC holds: ${formatUsdNoCents(held)}.`
}

export function lienPaymentBondSavedWords(bond: LienPaymentBond): string {
  return `Payment bond on the project: ${lienPaymentBondText(bond)}.`
}

// ---------- The patches ----------

/** A patch to the job's lien facts. The columns are the ones Edit Job's *Our contract on this job* row writes. */
export type LienContractPatch = {
  lien_contract_ended_on?: string | null
  lien_contract_ended_how?: LienContractEndedHow | null
  lien_contract_ended_set_at?: string | null
  lien_contract_ended_set_by?: string | null
  lien_retainage_held?: number | null
  lien_payment_bond?: LienPaymentBond
}

/** The day and how our contract ended, with who said so and when: the dev seat's `contractEndedPatch`, column for column. */
export function lienContractEndedPatch(day: string, how: LienContractEndedHow, userId: string | null, nowIso: string): LienContractPatch {
  return { lien_contract_ended_on: day, lien_contract_ended_how: how, lien_contract_ended_set_at: nowIso, lien_contract_ended_set_by: userId }
}

/** Our contract is still open: the four ended columns go back to empty, as Edit Job's *Still open* writes them. */
export const LIEN_CONTRACT_STILL_OPEN_PATCH: LienContractPatch = { lien_contract_ended_on: null, lien_contract_ended_how: null, lien_contract_ended_set_by: null, lien_contract_ended_set_at: null }

export function lienRetainageHeldPatch(held: number): LienContractPatch {
  return { lien_retainage_held: held }
}

export function lienPaymentBondPatch(bond: LienPaymentBond): LienContractPatch {
  return { lien_payment_bond: bond }
}
