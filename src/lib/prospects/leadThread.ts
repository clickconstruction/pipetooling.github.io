/**
 * Messages, residential R8 · 9: a lead, someone who wrote the office for work and has not booked
 * (`RESIDENTIAL_BUILD_PLAN.md` → R8, card 9 of `customer-messages-integrations-mockups.html` v0.2 on branch
 * spike/gc-mode, with the lead's change of 2026-10-13). A lead lives in Messages: a contact of kind `lead` with no
 * record until they book, their thread on Follow up as any customer's is. Prospects is the cold-call deck of companies,
 * so a `prospects` row is written only when the office presses **Add to Prospects** on the lead's card.
 *
 * - *Who is this?* names a new number a lead: `leadFromWhoIsThis` re-points the contact and keeps its thread.
 * - **Add to Prospects**: `prospectRowFor` is the row the press writes, and `addedToProspects` points the lead at it.
 * - The lead's card: `leadCardThread`, the last three lines, whose move and when they wrote, and nothing of money.
 *   `leadNeeds` is its waiting flag. Follow up counts a lead already (`onFollowUp`), so this is no second count.
 * - Booking: `bookingRepoint` re-points the lead to the new customer and keeps every line. When a `prospects` row
 *   exists, the booking also closes it through `markProspectConverted`.
 *
 * Pure. Every re-point is a `NamePlan` the caller folds through the spine's `applyNamePlan`, as *Who is this?* folds one.
 * Adding a lead to Prospects and booking one are `nameContact`'s own rules (R0, #5570), so this calls it; only naming a
 * number a lead with no record is built here, since a `NameTarget` always has a record. The writes are R0's
 * `name_contact` and the Prospects page's own insert.
 */
import { nameContact, type Contact, type NamePlan } from '../contacts/kernel'
import { snippetOf, whenWords, type MessageChannel, type ThreadMessage } from '../messages/thread'


const byTime = (a: { at: string }, b: { at: string }) => Date.parse(a.at) - Date.parse(b.at)

const theirs = (messages: readonly ThreadMessage[], contactId: string) => messages.filter((m) => m.contactId === contactId).sort(byTime)

// ---------- Who is this? → a lead ----------

/**
 * *Who is this?* → **a new lead**: the contact nobody had named becomes a lead, under the name the line gives (R7's
 * `nameInText`, passed in) or still the number when it gives none, with no record and no job. Its thread stays whole.
 * Null when the contact is not a number nobody has named.
 */
export function leadFromWhoIsThis(contacts: readonly Contact[], unknownId: string, name: string | null): NamePlan | null {
  const unknown = contacts.find((c) => c.id === unknownId)
  if (!unknown || unknown.kind !== 'unknown') return null
  return {
    way: 'repoint',
    contact: { ...unknown, kind: 'lead', name: name?.trim() || unknown.name, company: '', record: null, jobIds: [], defaultJobId: null },
    jobId: null,
  }
}

// ---------- Add to Prospects ----------

/** The `prospects` row **Add to Prospects** writes for a lead: its insert's columns. */
export interface ProspectRow {
  /** Which lane of Prospects (v2.5563): a homeowner asking for work is a customer, one asking about a build a job to GC. */
  kind: 'customer' | 'gc_lead' | 'sub'
  contact_name: string | null
  company_name: null
  phone_number: string | null
  email: string | null
  /** How they came to us and their first words: "Texted the office: …". */
  notes: string
  /** Their newest line, either way. */
  last_contact: string | null
  prospect_fit_status: null
  created_by: string
  master_user_id: string
}

const CAME_IN: Readonly<Partial<Record<MessageChannel, string>>> = {
  text: 'Texted the office',
  email: 'Emailed the office',
  call: 'Called the office',
  voicemail: 'Left the office a voicemail',
  missed: 'Called the office',
}

/** True when a lead's name is still the number or address they wrote from. */
const nameIsChannel = (lead: Pick<Contact, 'name' | 'channels'>) => lead.channels.some((ch) => ch.value.trim() === lead.name.trim())

/** The row **Add to Prospects** writes: the lead's name, number and address, and their first line in the notes. */
export function prospectRowFor(
  lead: Contact,
  messages: readonly ThreadMessage[],
  by: { userId: string; masterUserId: string },
  kind: ProspectRow['kind'] = 'customer',
): ProspectRow {
  const lines = theirs(messages, lead.id)
  const first = lines.find((m) => m.direction === 'in')
  const how = (first && CAME_IN[first.channel]) || 'Wrote the office'
  const words = first ? (snippetOf(first).split(/\r?\n/)[0] ?? '').trim() : ''
  return {
    kind,
    contact_name: nameIsChannel(lead) ? null : lead.name,
    company_name: null,
    phone_number: lead.channels.find((ch) => ch.kind === 'phone')?.value ?? null,
    email: lead.channels.find((ch) => ch.kind === 'email')?.value ?? null,
    notes: words ? `${how}: ${words}` : `${how}.`,
    last_contact: lines.length ? lines[lines.length - 1]!.at : null,
    prospect_fit_status: null,
    created_by: by.userId,
    master_user_id: by.masterUserId,
  }
}

/**
 * Once the row is written, the lead points at it, so booking knows to close it: `nameContact`'s rule for a lead with no
 * record. Still a lead, the thread whole. Null when the contact is not a lead with no record.
 */
export function addedToProspects(contacts: readonly Contact[], leadId: string, prospectId: string): NamePlan | null {
  const lead = contacts.find((c) => c.id === leadId)
  if (!lead || lead.kind !== 'lead') return null
  return nameContact(contacts, leadId, { record: { table: 'prospects', id: prospectId }, kind: 'lead', name: lead.name, company: lead.company })
}

// ---------- the lead's card ----------

/** One line on the lead's card. */
export interface LeadCardLine {
  id: string
  direction: 'in' | 'out'
  channel: MessageChannel
  /** The row's words: an email's subject or first line, else the words. */
  words: string
  /** When, in words: "today at 8:41 AM", "yesterday". */
  when: string
}

/** What the lead's card shows of their thread. */
export interface LeadCardThread {
  /** The last three lines with them, oldest first. Team notes and events stay in the thread. */
  lines: LeadCardLine[]
  /** Opens their whole thread at its newest line. */
  threadLink: string
  /** Whose move: ours when their line is newest, theirs when ours is. */
  move: 'ours' | 'theirs' | 'none'
  /** When they last wrote, in words. Null when they never have. */
  wrote: string | null
}

/** A thread's link, as the thread window reads the URL (`useThreadWindow`'s `thread` and `at`). */
export function threadLink(contactId: string, atMessageId: string | null): string {
  const q = new URLSearchParams({ thread: contactId })
  if (atMessageId) q.set('at', atMessageId)
  return `/gc?${q.toString()}`
}

/** The lead's card: their last three lines, the thread's link, whose move, and when they wrote. Nothing of money. */
export function leadCardThread(lead: Pick<Contact, 'id'>, messages: readonly ThreadMessage[], nowIso: string): LeadCardThread {
  const said = theirs(messages, lead.id).filter((m) => m.direction === 'in' || m.direction === 'out')
  const last3 = said.slice(-3)
  const newest = said[said.length - 1]
  const lastIn = [...said].reverse().find((m) => m.direction === 'in')
  return {
    lines: last3.map((m) => ({ id: m.id, direction: m.direction as 'in' | 'out', channel: m.channel, words: snippetOf(m), when: whenWords(m.at, nowIso) })),
    threadLink: threadLink(lead.id, newest?.id ?? null),
    move: !newest ? 'none' : newest.direction === 'in' ? 'ours' : 'theirs',
    wrote: lastIn ? whenWords(lastIn.at, nowIso) : null,
  }
}

/** The leads waiting on us: their newest line is theirs. The card's flag, by contact id. */
export function leadNeeds(leads: readonly Pick<Contact, 'id' | 'kind'>[], messages: readonly ThreadMessage[]): ReadonlySet<string> {
  const waiting = new Set<string>()
  for (const lead of leads) {
    if (lead.kind !== 'lead') continue
    const said = theirs(messages, lead.id).filter((m) => m.direction === 'in' || m.direction === 'out')
    if (said[said.length - 1]?.direction === 'in') waiting.add(lead.id)
  }
  return waiting
}

// ---------- booking ----------

/** The customer a lead became: the row the booking made, or one that was already there. */
export interface BookedCustomer {
  id: string
  name: string
}

/** What booking does to a lead: the re-point, the prospect to close, and what the card reads after. */
export interface Booking {
  plan: NamePlan
  /** The `prospects` row to close with `markProspectConverted`. Null when the lead was never added to Prospects. */
  convertProspectId: string | null
  /** The card after: "Became a customer." and the customer's page. */
  card: { words: string; link: string }
}

/**
 * Booking: the lead becomes the customer, every line kept. It is `nameContact`'s rule for a lead who booked: when a
 * contact already is that customer by name, the lead folds into it. Null when the contact is not a lead.
 */
export function bookingRepoint(contacts: readonly Contact[], leadId: string, customer: BookedCustomer): Booking | null {
  const lead = contacts.find((c) => c.id === leadId)
  if (!lead || lead.kind !== 'lead') return null
  const plan = nameContact(contacts, leadId, { record: { table: 'customers', id: customer.id }, kind: 'customer', name: customer.name, company: '' })
  if (!plan) return null
  return {
    plan,
    convertProspectId: lead.record?.table === 'prospects' ? lead.record.id : null,
    card: { words: 'Became a customer.', link: `/customers/${encodeURIComponent(customer.id)}` },
  }
}
