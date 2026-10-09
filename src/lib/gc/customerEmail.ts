/**
 * GC mode, the real build, Owner Billing's O4b: our emails to a GC project's customer and its architect, in words. The
 * pay application's, the certified bill's and the change order's lines are the prototype's own (`customerMessages` in
 * `gcOwnerBillingMessages.ts`, branch spike/gc-mode), with no Pay and no portal signing yet: they answer by reply. The
 * architect's ask is new, since the architect certifies by email (decision 4).
 * `gc-customer-email` frames them (`supabase/functions/_shared/gcCustomerEmails.ts`). Pure: built from plain facts,
 * so the customer journeys' sample emails use the same words.
 */
import { CUSTOMER_EMAIL_ERRORS, type CustomerEmailErrorKey } from '../../../supabase/functions/_shared/gcCustomerEmails'
import { changeOrderDays, daysWords, ownerExpectPaidOn } from './ownerBilling'
import { customerGreeting } from './ownerBillingRemind'
import { isTimeExtension } from './timeExtension'
import type { ChangeOrder, GcProject, GcState, OwnerPayAppSent } from './types'
import { money, shortDate, weekdayDate } from './words'

/** What a pay application's emails say, read off the job and the bill. */
export interface PayAppMailFacts {
  job: string
  /** The customer as the greeting names them: "Dr. Raman", "Elena". */
  greeting: string
  /** The customer's name, for the architect. */
  owner: string
  architect: string
  number: number
  final: boolean
  due: number
  periodTo: string
  retainagePct: number
}

/** The customer as every email greets them: "Dr. Raman", "Elena". */
function greetingOf(state: GcState, project: GcProject): string {
  return customerGreeting(state.customers.find((c) => c.id === project.customerId), project.owner || 'there')
}

export function payAppMailFacts(state: GcState, project: GcProject, app: OwnerPayAppSent): PayAppMailFacts {
  return {
    job: project.name,
    greeting: greetingOf(state, project),
    owner: project.owner,
    architect: project.architect,
    number: app.number,
    final: app.final === true,
    due: app.due,
    periodTo: app.periodTo,
    retainagePct: app.retainagePct,
  }
}

function billWords(f: { final: boolean; number: number }): { name: string; Name: string } {
  const name = f.final ? 'our final pay application' : `pay application ${f.number}`
  return { name, Name: name.charAt(0).toUpperCase() + name.slice(1) }
}

/** Our pay application to the customer, the form attached. Our conditional waiver goes in its own email. */
export function payAppMail(f: PayAppMailFacts): { subject: string; lines: string[] } {
  const { Name } = billWords(f)
  return {
    subject: `${Name} for ${f.job}, ${money(f.due)}`,
    lines: [
      `Hello ${f.greeting},`,
      f.final
        ? `${Name} for ${f.job} asks for the ${money(f.due)} you held. Every line is done.`
        : `${Name} for ${f.job} asks for ${money(f.due)}. It bills the work done through ${shortDate(f.periodTo)}, less the ${f.retainagePct}% you hold and the bills before it.`,
      `${f.architect || 'The architect'} certifies it first. We will tell you when they do.`,
      'Our conditional lien waiver comes in its own email.',
      'The pay application is attached.',
    ],
  }
}

/** The ask to the architect to certify it, the same form attached. They answer by email (decision 4). */
export function certifyAskMail(f: PayAppMailFacts): { subject: string; lines: string[] } {
  const { name, Name } = billWords(f)
  return {
    subject: `Please certify ${name} for ${f.job}`,
    lines: [
      `Hello ${f.architect || 'there'},`,
      `${Name} for ${f.job} asks ${f.owner || 'the customer'} for ${money(f.due)}, for the work done through ${shortDate(f.periodTo)}.`,
      'The G702 and G703 are attached.',
      'Please certify it, or tell us what you would change. Reply to this email with your certificate.',
    ],
  }
}

/** What the certified bill's email says: what the architect certified on a pay application, and when we expect it. */
export interface CertifiedMailFacts {
  job: string
  greeting: string
  architect: string
  number: number
  final: boolean
  /** What the pay application asked. */
  asked: number
  certified: number
  /** The day we expect them to pay (`ownerExpectPaidOn`). Null: we cannot say yet. */
  expectOn: string | null
}

/** The facts as the certificate is recorded: the pay application as it went, with what was certified and the day. */
export function certifiedMailFacts(state: GcState, project: GcProject, app: OwnerPayAppSent, certified: number, on: string): CertifiedMailFacts {
  return {
    job: project.name,
    greeting: greetingOf(state, project),
    architect: project.architect,
    number: app.number,
    final: app.final === true,
    asked: app.due,
    certified,
    expectOn: ownerExpectPaidOn(state, project, { ...app, certified, certifiedOn: on }),
  }
}

/**
 * The bill the architect certified, to the customer. No Pay: the bill is not on Stripe, so they reply with their day,
 * and `gc-customer-email` adds their portal link when they have one. What was cut comes back on the next bill.
 */
export function certifiedMail(f: CertifiedMailFacts): { subject: string; lines: string[] } {
  const { name } = billWords(f)
  const architect = f.architect || 'The architect'
  const less = f.asked - f.certified
  return {
    subject: `${architect} certified ${name}, ${money(f.certified)}`,
    lines: [
      `Hello ${f.greeting},`,
      `${architect} certified ${name} for ${f.job} at ${money(f.certified)}.`,
      ...(less > 0.5
        ? [f.final ? `That is ${money(less)} less than we asked.` : `That is ${money(less)} less than we asked. It comes back on the next bill once the work is done.`]
        : []),
      ...(f.expectOn ? [`We expect it by ${weekdayDate(f.expectOn)}.`] : []),
      'Reply with the day you will pay.',
    ],
  }
}

/** What a change order's email says: the change, its price and its days. */
export interface ChangeOrderMailFacts {
  job: string
  greeting: string
  number: number
  description: string
  /** What it adds to their price; below zero, what it takes off. */
  price: number
  /** The days it adds to the job. */
  days: number
  /** A time extension: days only, no change to the price. */
  timeOnly: boolean
}

export function changeOrderMailFacts(state: GcState, project: GcProject, co: ChangeOrder): ChangeOrderMailFacts {
  return {
    job: project.name,
    greeting: greetingOf(state, project),
    number: co.number,
    description: co.description,
    price: co.price,
    days: changeOrderDays(co),
    timeOnly: isTimeExtension(co),
  }
}

/** A change order for the customer to sign, by reply until the portal signs them (no form yet: the words carry it). */
export function changeOrderMail(f: ChangeOrderMailFacts): { subject: string; lines: string[] } {
  const credit = f.price < 0
  const what = f.description.trim().replace(/[.\s]+$/, '')
  return {
    subject: `Change order ${f.number} for ${f.job}, ${f.timeOnly ? `${daysWords(f.days)} more` : `${credit ? '−' : '+'}${money(Math.abs(f.price))}`}`,
    lines: [
      `Hello ${f.greeting},`,
      `Change order ${f.number} for ${f.job} is ready for your signature: ${what}.`,
      f.timeOnly ? 'It does not change your price.' : `It ${credit ? 'takes' : 'adds'} ${money(Math.abs(f.price))} ${credit ? 'off' : 'to'} your price.`,
      ...(f.days > 0 ? [`It adds ${daysWords(f.days)} to the job.`] : []),
      'Reply to sign it, or with any questions.',
    ],
  }
}

/** What an interest bill's email says (O6b-2): the job, what it comes to, and the rate. */
export interface InterestBillMailFacts {
  job: string
  greeting: string
  amount: number
  pctPerMonth: number | null
}

export function interestBillMailFacts(state: GcState, project: GcProject, amount: number): InterestBillMailFacts {
  return { job: project.name, greeting: greetingOf(state, project), amount, pctPerMonth: project.ownerLateInterest?.pctPerMonth ?? null }
}

/**
 * Our bill for the interest on late bills, in the prototype's words but two: the bills went past the day they were
 * due (some are still open, not all paid late), and no Pay, so they reply with their day.
 */
export function interestBillMail(f: InterestBillMailFacts): { subject: string; lines: string[] } {
  return {
    subject: `Interest on late bills for ${f.job}, ${money(f.amount)}`,
    lines: [
      `Hello ${f.greeting},`,
      `Some of your bills on ${f.job} went past the day they were due by the contract.`,
      `The interest on them comes to ${money(f.amount)}${f.pctPerMonth ? `, at ${f.pctPerMonth}% a month` : ''}.`,
      'Reply with the day you will pay.',
    ],
  }
}

/** One email about a sent pay application, from its sent copy: the pay application's own, or the certified bill. */
export interface BillEmailed {
  what: 'payApp' | 'certified'
  to: string
  on: string
}

/** "Emailed to A and B on Oct 8.": each name once, on the first day. Null when none went. */
export function emailedTo(sent: { to: string; on: string }[], lead = 'Emailed to'): string | null {
  return sent.length === 0 ? null : `${lead} ${[...new Set(sent.map((e) => e.to))].join(' and ')} on ${shortDate(sent[0]!.on)}.`
}

/** A sent bill's lines, oldest first: "Emailed to A and B on Oct 8.", then "The certified bill was emailed to A on Oct 12." */
export function emailedWords(emailed: BillEmailed[]): string[] {
  return [emailedTo(emailed.filter((e) => e.what === 'payApp')), emailedTo(emailed.filter((e) => e.what === 'certified'), 'The certified bill was emailed to')].filter(
    (w): w is string => w !== null,
  )
}

/** What `gc-customer-email` answered: who it went to, or the refusal's key. */
export type CustomerEmailAnswer = { ok: true; to: string; email: string } | { ok: false; key: CustomerEmailErrorKey | 'failed'; detail?: string }

const KEYS: readonly string[] = Object.keys(CUSTOMER_EMAIL_ERRORS)

/** The function's answer, or its refusal from the error body. */
export function readCustomerEmailAnswer(data: unknown, errorBody: unknown): CustomerEmailAnswer {
  if (errorBody) {
    const e = errorBody as { error?: unknown; detail?: unknown }
    const key = typeof e.error === 'string' && KEYS.includes(e.error) ? (e.error as CustomerEmailErrorKey) : 'failed'
    return { ok: false, key, ...(typeof e.detail === 'string' ? { detail: e.detail } : {}) }
  }
  const d = data as { to?: unknown; email?: unknown } | null
  if (!d || typeof d.email !== 'string') return { ok: false, key: 'failed' }
  return { ok: true, to: typeof d.to === 'string' ? d.to : '', email: d.email }
}

const REFUSALS: Record<CustomerEmailErrorKey, string> = {
  signIn: 'Sign in again to send the email.',
  moneyTeamOnly: 'Emailing the customer is for the owner, the leaders and the controller.',
  readOnly: 'A training account sends no email.',
  badRequest: 'The email was not sent: something in it did not read right.',
  notFound: 'That is not there any more.',
  otherProject: 'That belongs to another job.',
  notCertified: 'That pay application has no certified bill to send.',
  notSent: 'That change order is not waiting on their signature.',
  alreadySent: 'That reminder went already.',
  noEmail: 'There is no email address on file for them. Add one on the customer, then send it again.',
  sendFailed: 'The email service said no. Try again in a minute.',
  failed: 'The email was not sent.',
}

/** A refusal in the window's words. */
export function gcCustomerEmailRefusal(key: CustomerEmailErrorKey | 'failed'): string {
  return REFUSALS[key]
}
