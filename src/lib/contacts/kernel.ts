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
 *
 * Seven kinds of contact (the owner's call of 2026-10-13, `RESIDENTIAL_BUILD_PLAN.md` R0): a customer, a trade
 * partner and an architect, and four more. A lead is a `prospects` row until they book; a supply house is its
 * `supply_houses` row, the counter, and a rep at it is a `supply_house_contacts` row; a candidate is a row on the Team
 * hiring board, `team_prospects`; a sub is a `people` row whose roster kind is `sub`, so a sub and a roster person
 * point at the same table and `kindOf` tells them apart.
 */
import { normalizeCustomerEmail, normalizeCustomerPhone } from '../customerSimilarity'
import type { ContactKind } from './names'

// What a contact is called lives in `names.ts`, light enough to run on the edge. It is the kernel's too.
export * from './names'

/** The record a contact is. Null: a number nobody has named yet, the one contact with no record. */
export type ContactRecord =
  /** A customer who is one person. */
  | { table: 'customers'; id: string }
  /** A person at a customer: Elena at Cibolo Creek Partners. */
  | { table: 'customer_contact_persons'; id: string }
  /** A trade partner's main contact. */
  | { table: 'gc_companies'; id: string }
  | { table: 'gc_company_people'; id: string }
  /** Someone on the roster: a sub when their roster kind is `sub`. */
  | { table: 'people'; id: string }
  /** A lead on Prospects, until they book and become a customer. */
  | { table: 'prospects'; id: string }
  /** A supply house: its counter, or someone named on its row. */
  | { table: 'supply_houses'; id: string }
  /** A rep at a supply house, as the RFQ desk keeps them. */
  | { table: 'supply_house_contacts'; id: string }
  /** A candidate on the Team hiring board. */
  | { table: 'team_prospects'; id: string }
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
  /** The customer they are, or are at: a customer's own row, or the customer of a person at one. The loader fills it. */
  customerId?: string | null
  /** The trade partner they are, or are at: its main contact, or someone it named. The loader fills it. */
  gcCompanyId?: string | null
}

export function contactById(contacts: readonly Contact[], id: string): Contact | undefined {
  return contacts.find((c) => c.id === id)
}

/** The roster kind that makes someone on `people` a sub (`people_kind_check`). */
export const SUB_ROSTER_KIND = 'sub'

/**
 * What a record makes them, the first answer *Who is this?* offers: a customer's row and a person at one are a
 * customer, since an architect is the office's pick; a trade partner and the people it named are a trade partner; a
 * prospect is a lead, a supply house and its reps a supply house, a hiring board row a candidate. On the roster, `rosterKind` is
 * the `people.kind` column: `sub` is a sub, and anyone else on the roster is a trade partner, as the picker has said.
 */
export function kindOf(record: NonNullable<ContactRecord>, rosterKind?: string | null): Exclude<ContactKind, 'unknown'> {
  switch (record.table) {
    case 'customers':
    case 'customer_contact_persons':
      return 'customer'
    case 'gc_companies':
    case 'gc_company_people':
      return 'trade'
    case 'people':
      return rosterKind === SUB_ROSTER_KIND ? 'sub' : 'trade'
    case 'prospects':
      return 'lead'
    case 'supply_houses':
    case 'supply_house_contacts':
      return 'supply_house'
    case 'team_prospects':
      return 'candidate'
  }
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

/**
 * A customer, a trade partner and a supply house are company rows that can hold more people than their own, each by
 * name: Dee at Alamo Concrete, Ray at the supply house's counter.
 */
const COMPANY_TABLES: ReadonlySet<string> = new Set(['customers', 'gc_companies', 'supply_houses'])
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
