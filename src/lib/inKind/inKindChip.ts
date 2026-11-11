/**
 * The chip beside a customer's name (punch list #301, mock-up 2): where a customer stands on paying in kind, in a
 * few words. One chip says one of three things: a month's credit is due, so much is still to come on the bills, or
 * more was given than is billed and we owe work. It is quiet unless a month is waiting on a person.
 *
 * A customer's open balance splits in two with it: the part an open deal pays, which nobody chases, and the money.
 */
import { money2, monthName } from './inKindLedger'
import type { InKindListRow } from './inKindList'
import { usd } from './inKindWords'

const CENT = 0.005

export interface InKindStanding {
  customerId: string
  /** The customer's open deals, the one with a month due first. */
  arrangementIds: string[]
  /** Still open on the deals' bills. */
  left: number
  /** Given beyond what is billed: work we owe. */
  ahead: number
  paidInKind: number
  /** The oldest month with no credit entered, YYYY-MM-01. */
  dueMonth: string | null
  dueCount: number
}

/** Each customer with an open deal. An ended deal gives no standing. */
export function inKindStandings(rows: readonly InKindListRow[]): Map<string, InKindStanding> {
  const out = new Map<string, InKindStanding>()
  for (const r of rows) {
    if (r.ended || !r.customerId) continue
    const s = out.get(r.customerId) ?? { customerId: r.customerId, arrangementIds: [], left: 0, ahead: 0, paidInKind: 0, dueMonth: null, dueCount: 0 }
    if (r.dueMonth) s.arrangementIds.unshift(r.id)
    else s.arrangementIds.push(r.id)
    s.left = money2(s.left + r.left)
    s.ahead = money2(s.ahead + r.ahead)
    s.paidInKind = money2(s.paidInKind + r.paidInKind)
    s.dueCount += r.dueCount
    if (r.dueMonth && (!s.dueMonth || r.dueMonth < s.dueMonth)) s.dueMonth = r.dueMonth
    out.set(r.customerId, s)
  }
  return out
}

export type InKindChipTone = 'quiet' | 'due'
export type InKindChipForm = 'full' | 'short'

/** The chip's words. The short form is for a phone and for a job, where the amount is not the subject. */
export function inKindChipWords(s: InKindStanding, form: InKindChipForm = 'full'): { text: string; tone: InKindChipTone } {
  const tone: InKindChipTone = s.dueCount > 0 ? 'due' : 'quiet'
  if (form === 'short') return { text: 'In kind', tone }
  if (s.dueCount > 1) return { text: `In kind · ${s.dueCount} months due`, tone }
  if (s.dueMonth) return { text: `In kind · ${monthName(s.dueMonth)} due`, tone }
  if (s.left > CENT) return { text: `In kind · ${usd(s.left)} to come`, tone }
  if (s.ahead > CENT) return { text: `In kind · we owe ${usd(s.ahead)} of work`, tone }
  return { text: 'In kind', tone }
}

/** What the chip says to a screen reader and on hover. */
export function inKindChipTitle(s: InKindStanding): string {
  const parts = ['Pays in kind.']
  if (s.dueCount > 1) parts.push(`${s.dueCount} months have no credit entered.`)
  else if (s.dueMonth) parts.push(`${monthName(s.dueMonth)}’s credit is not entered.`)
  if (s.left > CENT) parts.push(`${usd(s.left)} is still to come on its bills.`)
  if (s.ahead > CENT) parts.push(`We owe ${usd(s.ahead)} of work.`)
  parts.push('Opens the ledger.')
  return parts.join(' ')
}

/** The ledger of the deal that needs a person first. */
export const inKindChipHref = (s: InKindStanding): string => `/customers/${s.customerId}?inKind=${s.arrangementIds[0] ?? ''}`

/** An open balance split in two: what an open deal pays in kind, and the money still owed. */
export function moneyApart(openBalance: number, s: InKindStanding | null | undefined): { money: number; inKind: number } {
  const open = Math.max(0, openBalance)
  const inKind = s ? money2(Math.min(open, Math.max(0, s.left))) : 0
  return { money: money2(open - inKind), inKind }
}

/** The line under a total that leaves the in kind part out. Null when nothing is scheduled in kind. */
export const scheduledInKindWords = (inKind: number): string | null => (inKind > CENT ? `${usd(inKind)} more is scheduled in kind` : null)

// ---------- a job of a customer who pays in kind ----------

/** A job the deal could pay and does not: its customer has an open deal, the job is not on it, and it is not paid. */
export function jobIsOffTheDeal(job: { in_kind_arrangement_id?: string | null; status?: string | null } | null | undefined, s: InKindStanding | null | undefined): boolean {
  return Boolean(job && s && s.arrangementIds.length > 0 && !job.in_kind_arrangement_id && job.status !== 'paid')
}

/** A job an open deal of its customer already pays, and that is not paid off. */
export function jobIsOnTheDeal(job: { in_kind_arrangement_id?: string | null; status?: string | null } | null | undefined, s: InKindStanding | null | undefined): boolean {
  return Boolean(job && s && job.in_kind_arrangement_id && s.arrangementIds.includes(job.in_kind_arrangement_id) && job.status !== 'paid')
}

/** The strip on such a job. */
export const jobOffTheDealWords = (customerName: string): { lead: string; rest: string } => ({
  lead: `${customerName.trim() || 'This customer'} pays in kind.`,
  rest: 'This job is not on that arrangement. Its bill will be sent and chased as money.',
})

export const JOB_PUT_ON_DEAL_PRESS = 'Put it on the arrangement'
export const JOB_PICK_DEAL_PRESS = 'Open the arrangements'
export const JOB_ON_DEAL_SAVED = 'This job is on the arrangement. Its bill reads Scheduled in kind.'

// ---------- Bill Customer ----------

export type InKindBillAnswer = 'in_kind' | 'money'
export const billQuestionWords = (customerName: string): string => `${customerName.trim() || 'This customer'} pays in kind. How is this bill paid?`
export const BILL_IN_KIND_CHOICE = { title: 'In kind, on the arrangement', why: 'It joins the bills the arrangement pays down. It is recorded here and sent to nobody.' }
export const BILL_MONEY_CHOICE = { title: 'With money', why: 'It is sent and chased like any other bill.' }
export const BILL_PICK_FIRST = 'Pick how this bill is paid first.'

/** The In kind choice for a customer with more than one open deal: the window cannot know which one pays. */
export const BILL_IN_KIND_CHOICE_MANY = { title: 'In kind, on an arrangement', why: 'This customer has more than one. The job goes on one of them first, on the customer’s page.' }
/** Under that choice once it is picked: where to go, and that nothing is billed here until then. */
export const billPickDealWords = (customerName: string): { lead: string; rest: string } => ({
  lead: `${customerName.trim() || 'This customer'} has more than one arrangement.`,
  rest: 'Put this job on one of them under Change the terms. Then bill it here. Nothing is billed until then.',
})

/**
 * Where Bill Customer stands on a job off the deal. `asked` is the question itself (the job is off the deal and its
 * customer has an open one). With one open deal an In kind answer records the bill on it. With more than one the
 * window cannot know which deal pays, so In kind holds the window and sends the person to the customer's page, as
 * the job's strip does. A hold means nothing is sent and nothing is recorded: before v2.6934 two open deals asked
 * nothing, and the window billed for money a bill a deal was meant to pay.
 */
export function billQuestionState(
  s: InKindStanding | null | undefined,
  asked: boolean,
  answer: InKindBillAnswer | null,
): { asked: boolean; manyDeals: boolean; holds: boolean; recordsInKind: boolean; dealId: string | null } {
  if (!asked || !s || s.arrangementIds.length === 0) return { asked: false, manyDeals: false, holds: false, recordsInKind: false, dealId: null }
  const manyDeals = s.arrangementIds.length > 1
  const inKind = answer === 'in_kind'
  return {
    asked: true,
    manyDeals,
    holds: answer == null || (inKind && manyDeals),
    recordsInKind: inKind && !manyDeals,
    dealId: inKind && !manyDeals ? s.arrangementIds[0]! : null,
  }
}
export const BILL_IN_KIND_CHANNEL_NOTE = 'Paid in kind. Record the bill below. Nothing is sent to the customer.'
export const BILL_IN_KIND_RECORD_PRESS = 'Record the bill in kind'

/** Bill Customer on a job the deal already pays: no question, the one channel that sends nothing. */
export const billOnDealWords = (customerName: string): { lead: string; rest: string } => ({
  lead: `${customerName.trim() || 'This customer'} pays in kind.`,
  rest: 'This job is on the arrangement. To bill it for money, take it off the arrangement first.',
})
