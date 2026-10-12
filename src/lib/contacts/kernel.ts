/**
 * Messages, cut 1 (the spine): who a contact is. A contact is a view over a person the app already has, never a fifth
 * list of people. It points at exactly one record, or at none for a number nobody has named yet, and its thread hangs off
 * it. Lifted from the Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178:
 * `cById`, `firstName`, `initials`, `kindWord`, `whoIsThis`) and `BUILD_PLAN.md`'s cut 1.
 *
 * Where the people are: a customer, an architect and a property owner are `customers` rows, with the phone and the email
 * in `contact_info`, and the people at one are its `customer_contact_persons`; a trade partner's main contact is its
 * `gc_companies` row, and anyone else it named is a `gc_company_people` row; the roster is `people`.
 * `customer_contacts` and `gc_customer_contacts` are logs of calls, not people, so nothing points at them.
 */
import { normalizeCustomerEmail, normalizeCustomerPhone } from '../customerSimilarity'

export type ContactKind = 'customer' | 'trade' | 'arch' | 'unknown'

/** The record a contact is. Null: a number nobody has named yet, the one contact with no record. */
export type ContactRecord =
  /** A customer who is one person. */
  | { table: 'customers'; id: string }
  /** A person at a customer: Elena at Cibolo Creek Partners. */
  | { table: 'customer_contact_persons'; id: string }
  /** A trade partner's main contact. */
  | { table: 'gc_companies'; id: string }
  | { table: 'gc_company_people'; id: string }
  | { table: 'people'; id: string }
  | null

export type ChannelKind = 'phone' | 'email'

/** A number or an address that is theirs. A STOP marks the number that sent it, never the person. */
export interface ContactChannel {
  id: string
  kind: ChannelKind
  /** As it was given: "(210) 555-0113", "greg@hillside.example". */
  value: string
  /** When this number texted STOP. Null: it can be texted. An address is never stopped. */
  optedOutAt: string | null
}

export interface Contact {
  id: string
  kind: ContactKind
  /**
   * Their name: the contact's own when it has one (the person at a company that has no row for them, such as a new
   * cell named by *Who is this?*), else the record's. An unknown number's name is the number.
   */
  name: string
  /** What they asked to be called. It wins over every rule in `firstName`. */
  goesBy: string | null
  /** The company under the name. '' for one person, or a number nobody has named. */
  company: string
  /** A trade partner's trade, "Sitework". */
  trade?: string
  record: ContactRecord
  channels: ContactChannel[]
  /** The jobs they are on, in the rail's order. */
  jobIds: string[]
  /** Where a new message from them lands until someone moves the star. Null: on the person, no job. */
  defaultJobId: string | null
}

export function contactById(contacts: readonly Contact[], id: string): Contact | undefined {
  return contacts.find((c) => c.id === id)
}

const TITLE = /^(Dr|Mr|Mrs|Ms)\.?$/i

/**
 * What a greeting calls a full name: the first name, or a title with the last name ("Dr. Priya Raman" is "Dr. Raman",
 * the Board's rule). '' for no name. Owner Billing's `customerGreeting` reads the same rule.
 */
export function greetingName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const titled = words.length > 1 && TITLE.test(words[0]!)
  return titled ? `${words[0]} ${words[words.length - 1]}` : words[0]!
}

/**
 * What we call them, in a greeting and in a sentence: what they go by, else `greetingName`, so a title on the record is
 * never dropped. '' for a number nobody has named; a sentence says "they" there.
 */
export function firstName(c: { name: string; goesBy?: string | null; kind?: ContactKind }): string {
  const goesBy = c.goesBy?.trim()
  if (goesBy) return goesBy
  if (c.kind === 'unknown') return ''
  return greetingName(c.name)
}

/** The face's two letters, a title skipped: "PR" for Dr. Priya Raman. "?" for a number nobody has named. */
export function initials(c: { name: string; kind?: ContactKind }): string {
  if (c.kind === 'unknown') return '?'
  return c.name
    .split(/\s+/)
    .filter((w) => w && !TITLE.test(w))
    .map((w) => w[0]!)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const KIND_WORD: Record<ContactKind, string> = {
  customer: 'customer',
  trade: 'trade partner',
  arch: 'architect',
  unknown: 'who is this?',
}

/** "trade partner": what they are to us, for the line under a name. */
export function kindWord(kind: ContactKind): string {
  return KIND_WORD[kind]
}

/** A number as ten digits, an address in lower case; '' when it is neither. "+1 (210) 555-0113" is "2105550113". */
export function normalizeChannel(kind: ChannelKind, raw: string): string {
  return kind === 'phone' ? normalizeCustomerPhone(raw) : normalizeCustomerEmail(raw)
}

export type ChannelMatch =
  /** One person has it. */
  | { match: 'one'; contact: Contact; channel: ContactChannel }
  /** Several people have it. The message lands on `contact`, the one who last wrote or was written on it. */
  | { match: 'many'; contact: Contact; channel: ContactChannel; others: Contact[] }
  /** Nobody has it: the message makes a contact with this one channel, and a *Who is this?* row. */
  | { match: 'none'; value: string }

/**
 * Whose number or address this is, the rule a call, a text and an email are matched by. Compared normalized, so a
 * webhook's "+12105550113" finds a record's "(210) 555-0113". Pass the messages to settle a number two people share.
 */
export function matchChannel(
  contacts: readonly Contact[],
  kind: ChannelKind,
  raw: string,
  messages: readonly { contactId: string; channelId?: string | null; at: string }[] = [],
): ChannelMatch {
  const value = normalizeChannel(kind, raw)
  if (!value) return { match: 'none', value: '' }
  const hits: { contact: Contact; channel: ContactChannel }[] = []
  for (const contact of contacts) {
    const channel = contact.channels.find((ch) => ch.kind === kind && normalizeChannel(kind, ch.value) === value)
    if (channel) hits.push({ contact, channel })
  }
  if (hits.length === 0) return { match: 'none', value }
  if (hits.length === 1) return { match: 'one', ...hits[0]! }
  // Two people on one number: the one the number last carried a message for.
  const lastOn = (h: { contact: Contact; channel: ContactChannel }) =>
    messages.reduce((latest, m) => (m.contactId === h.contact.id && m.channelId === h.channel.id ? Math.max(latest, Date.parse(m.at)) : latest), 0)
  const ranked = [...hits].sort((a, b) => lastOn(b) - lastOn(a))
  const [first, ...rest] = ranked
  return { match: 'many', contact: first!.contact, channel: first!.channel, others: rest.map((h) => h.contact) }
}

/** The numbers we may text: each one that has not sent STOP. */
export function textableNumbers(c: Pick<Contact, 'channels'>): ContactChannel[] {
  return c.channels.filter((ch) => ch.kind === 'phone' && !ch.optedOutAt)
}

/**
 * True when there is no way left to answer them in writing: every number they have sent STOP and there is no address.
 * A STOP from one number leaves their other numbers and their email open.
 */
export function isOptedOut(c: Pick<Contact, 'channels'>): boolean {
  const phones = c.channels.filter((ch) => ch.kind === 'phone')
  const emails = c.channels.filter((ch) => ch.kind === 'email')
  return phones.length > 0 && phones.every((ch) => Boolean(ch.optedOutAt)) && emails.length === 0
}

/** Who a number nobody knew turns out to be, as *Who is this?* names it. */
export interface NameTarget {
  record: NonNullable<ContactRecord>
  kind: Exclude<ContactKind, 'unknown'>
  name: string
  company: string
  trade?: string
  /** The job the office tied it to while naming it. Null: no job yet. */
  jobId?: string | null
}

export type NamePlan =
  /** Nobody had this record: the contact becomes that person and keeps its thread. */
  | { way: 'repoint'; contact: Contact; jobId: string | null }
  /** The person already had a contact: the number and the thread move onto it, and the empty contact goes. */
  | { way: 'merge'; into: Contact; dropId: string; jobId: string | null }

const sameRecord = (a: ContactRecord, b: ContactRecord) => Boolean(a && b && a.table === b.table && a.id === b.id)

/** A customer and a trade partner's company row can hold more people than their own, each by name: Dee at Alamo Concrete. */
const COMPANY_TABLES: ReadonlySet<string> = new Set(['customers', 'gc_companies'])
const nameKey = (name: string) => name.trim().toLowerCase()

/**
 * The contact that already is this person: on a person's row, whoever points at it; on a company's row, whoever points
 * at it under the same name, since the company's own person and the others it holds by name are each one contact.
 */
function samePerson(c: Contact, target: NameTarget): boolean {
  if (!sameRecord(c.record, target.record)) return false
  return !COMPANY_TABLES.has(target.record.table) || nameKey(c.name) === nameKey(target.name)
}

/**
 * *Who is this?*: re-points a contact at a record and keeps its thread. When someone already is that person, one person
 * keeps one contact, so the unknown one folds into theirs. Null when the contact is not an unknown number.
 */
export function nameContact(contacts: readonly Contact[], unknownId: string, target: NameTarget): NamePlan | null {
  const unknown = contactById(contacts, unknownId)
  if (!unknown || unknown.kind !== 'unknown') return null
  const jobId = target.jobId ?? null
  const existing = contacts.find((c) => c.id !== unknownId && samePerson(c, target))
  if (existing) {
    const known = new Set(existing.channels.map((ch) => `${ch.kind}:${normalizeChannel(ch.kind, ch.value)}`))
    const added = unknown.channels.filter((ch) => !known.has(`${ch.kind}:${normalizeChannel(ch.kind, ch.value)}`))
    const jobIds = jobId && !existing.jobIds.includes(jobId) ? [...existing.jobIds, jobId] : existing.jobIds
    return {
      way: 'merge',
      into: { ...existing, channels: [...existing.channels, ...added], jobIds, defaultJobId: existing.defaultJobId ?? jobId },
      dropId: unknownId,
      jobId,
    }
  }
  return {
    way: 'repoint',
    contact: {
      ...unknown,
      kind: target.kind,
      name: target.name,
      company: target.company,
      ...(target.trade ? { trade: target.trade } : {}),
      record: target.record,
      jobIds: jobId ? [jobId] : [],
      defaultJobId: jobId,
    },
    jobId,
  }
}

/**
 * The contacts and the messages after a `NamePlan`: the thread follows the person, and a line that had no job takes the
 * one picked while naming.
 */
export function applyNamePlan<M extends { contactId: string; jobId: string | null }>(
  contacts: readonly Contact[],
  messages: readonly M[],
  plan: NamePlan,
): { contacts: Contact[]; messages: M[] } {
  const next = plan.way === 'merge' ? plan.into : plan.contact
  const fromId = plan.way === 'merge' ? plan.dropId : plan.contact.id
  return {
    contacts: contacts.filter((c) => c.id !== fromId || fromId === next.id).map((c) => (c.id === next.id ? next : c)),
    messages: messages.map((m) => (m.contactId === fromId ? { ...m, contactId: next.id, jobId: m.jobId ?? plan.jobId } : m)),
  }
}
