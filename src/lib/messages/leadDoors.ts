/**
 * Punch list #140 PR 8: a lead's two doors, **Book a visit** and **Start an estimate**, above the words of a lead's
 * thread and on their Needs a reply row. Either makes a customer from the lead (their name, number, address and the
 * words they wrote), re-points the thread at them through `name_contact` so nothing is lost, and then opens Add Job
 * with the three fields filled or a new estimate on them. Pure: the words, the facts read off the thread, the rows the
 * two writes take. The writes are `leadDoorsIo.ts`; the presses `components/messages/useLeadDoors.ts`.
 * "Add to Prospects" stays unbuilt (decision 5 as revised): a lead stays on Messages until booked.
 */
import type { Contact } from '../contacts/kernel'
import type { ThreadMessage } from './thread'

export const LEAD_DOOR_WORDS = {
  book: 'Book a visit',
  estimate: 'Start an estimate',
  hint: 'Either takes them off Leads.',
  bookTip: 'Makes them a customer and opens Add Job with their name, number and words filled in.',
  estimateTip: 'Makes them a customer and opens a new estimate on them. The thread comes with them.',
  converted: (first: string) => `${first} is a customer now. The thread came with them.`,
  noName: 'Give the lead a name first. Press Who is this? and name them.',
  noSignIn: 'Sign in to book a visit.',
  gone: 'That conversation is not there.',
  noJobForm: 'They are a customer now. Add Job did not open here, so book them from Jobs.',
} as const

/** What the doors read off a lead: who they are and what they wrote. */
export interface LeadFacts {
  contactId: string
  name: string
  phone: string | null
  email: string | null
  /** Their newest words to us, for the job's name and the estimate. */
  words: string | null
}

export function leadFacts(contact: Pick<Contact, 'id' | 'name' | 'channels'>, words: string | null): LeadFacts {
  const phone = contact.channels.find((ch) => ch.kind === 'phone')?.value ?? null
  const email = contact.channels.find((ch) => ch.kind === 'email')?.value ?? null
  return { contactId: contact.id, name: contact.name.trim(), phone, email, words: words?.trim() || null }
}

/** A lead named by a person, not a number nobody has named: a customer's row never reads as a phone number. */
export function leadHasName(facts: Pick<LeadFacts, 'name'>): boolean {
  return /[A-Za-z]/.test(facts.name)
}

/** The newest words they wrote us: a text, an email's first line or a voicemail's words. Null when none. */
export function newestInboundWords(lines: ReadonlyArray<Pick<ThreadMessage, 'contactId' | 'direction' | 'channel' | 'body' | 'at'>>, contactId: string): string | null {
  let best: Pick<ThreadMessage, 'body' | 'channel' | 'at'> | null = null
  for (const m of lines) {
    if (m.contactId !== contactId || m.direction !== 'in') continue
    if (m.channel !== 'text' && m.channel !== 'email' && m.channel !== 'voicemail') continue
    if (!best || Date.parse(m.at) > Date.parse(best.at)) best = m
  }
  if (!best) return null
  const words = best.channel === 'email' ? (best.body.trim().split(/\r?\n/)[0] ?? '') : best.body
  return words.trim() || null
}

/** The row `customers` takes for a lead: a homeowner met today, their number and address as they gave them. */
export interface LeadCustomerInsert {
  name: string
  address: null
  contact_info: { phone: string | null; email: string | null } | null
  customer_type: 'residential'
  date_met: string
  master_user_id: string
}

export function customerPayloadFrom(facts: LeadFacts, ownerUserId: string, todayYmd: string): LeadCustomerInsert {
  return {
    name: facts.name,
    address: null,
    contact_info: facts.phone || facts.email ? { phone: facts.phone, email: facts.email } : null,
    customer_type: 'residential',
    date_met: todayYmd,
    master_user_id: ownerUserId,
  }
}

/** What Add Job opens with for them (`OpenNewJobOptions.prefillCustomer`). */
export interface NewJobCustomerPrefill {
  name: string
  phone: string | null
  email: string | null
  /** The job's name to start with: their words, cut to a line. Null for none. */
  note: string | null
}

/** The most of their words a job's name takes. */
export const JOB_NAME_MAX = 60

function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,!?;:]+$/, '')}…`
}

export function jobPrefillFrom(facts: LeadFacts): NewJobCustomerPrefill {
  const words = facts.words?.replace(/\s+/g, ' ').trim() ?? ''
  return { name: facts.name, phone: facts.phone, email: facts.email, note: words ? cutAtWord(words, JOB_NAME_MAX) : null }
}

/** Their first name for the toast: the first word of the name they were given. */
export function leadFirstName(facts: Pick<LeadFacts, 'name'>): string {
  return facts.name.trim().split(/\s+/)[0] || 'They'
}
