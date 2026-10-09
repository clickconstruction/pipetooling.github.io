/**
 * GC mode, the real build, Owner Billing's O4b: our emails to a GC project's customer and its architect, in words. The
 * pay application's lines are the prototype's own (`customerMessages` in `gcOwnerBillingMessages.ts`, branch
 * spike/gc-mode), and the architect's ask is new, since the architect certifies by email (decision 4).
 * `gc-customer-email` frames them (`supabase/functions/_shared/gcCustomerEmails.ts`). Pure: built from plain facts,
 * so the customer journeys' sample emails use the same words.
 */
import type { CustomerEmailErrorKey } from '../../../supabase/functions/_shared/gcCustomerEmails'
import { customerGreeting } from './ownerBillingRemind'
import type { GcProject, GcState, OwnerPayAppSent } from './types'
import { money, shortDate } from './words'

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

export function payAppMailFacts(state: GcState, project: GcProject, app: OwnerPayAppSent): PayAppMailFacts {
  return {
    job: project.name,
    greeting: customerGreeting(state.customers.find((c) => c.id === project.customerId), project.owner || 'there'),
    owner: project.owner,
    architect: project.architect,
    number: app.number,
    final: app.final === true,
    due: app.due,
    periodTo: app.periodTo,
    retainagePct: app.retainagePct,
  }
}

function billWords(f: PayAppMailFacts): { name: string; Name: string } {
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

/** What `gc-customer-email` answered: who it went to, or the refusal's key. */
export type CustomerEmailAnswer = { ok: true; to: string; email: string } | { ok: false; key: CustomerEmailErrorKey | 'failed'; detail?: string }

const KEYS: readonly string[] = ['signIn', 'moneyTeamOnly', 'readOnly', 'badRequest', 'notFound', 'notSent', 'noEmail', 'sendFailed', 'failed']

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
  notFound: 'That pay application is not there any more.',
  notSent: 'That pay application is not this job’s.',
  noEmail: 'There is no email address on file for them. Add one on the customer, then send it again.',
  sendFailed: 'The email service said no. Try again in a minute.',
  failed: 'The email was not sent.',
}

/** A refusal in the window's words. */
export function gcCustomerEmailRefusal(key: CustomerEmailErrorKey | 'failed'): string {
  return REFUSALS[key]
}
