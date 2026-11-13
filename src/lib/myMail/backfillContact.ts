/**
 * Mail we already have, onto its jobs (punch list #332): the customer's contact step. A tag lands each mail's line on
 * the contact that holds its party's address (`email_place_address`), and makes an unnamed sender, a *Who is this?*
 * row, when no contact does. A backfill that files a job's old mail must never do that for someone the office knows,
 * so before a conversation is planned this says who every line would be filed under, and holds the conversation when
 * one of them has no named contact, with the reason and the press that names them.
 *
 * The party of a mail is the tag's own reading (`tagPlan.ts`'s `partyOf` over `emailParty`): a mail in lands on its
 * sender; a mail of ours lands on the first person outside it was written to; a mail between teammates lands on its
 * sender's own thread. The run cannot see everything the tag sees: the app's own sender and a box kept in a secret are
 * not in any table, and an alias is ours to a person and outside to the tag. So an address at our domain that is
 * neither a teammate nor a box the run read is **unclear**, and every reading of it is kept: each address a line could
 * land on must be named, or the conversation is held. This holds too much sooner than too little, which is the point.
 *
 * Pure, and it makes nothing. `contact_for_customer` makes a customer's own contact, and it writes, so the seat's
 * read door refuses it: a person opens the customer's thread in the app, and the next plan reads the contact. The run
 * is `scripts/mail-backfill.ts`; the runbook is `docs/MAIL_BACKFILL.md`.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { domainOf } from '../emailIn/leftOutSenders'
import { MY_MAIL_NEVER_LABELS, MY_MAIL_SENT_LABEL } from './tagPlan'

/** The roles whose logins are the team to a tag: `gmail-mine`'s `STAFF_ROLES`, which `loadTeam` reads. A test holds the two level. */
export const BACKFILL_TEAM_ROLES: readonly string[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent']

/** One mail's headers, as a search hit or a whole read gives them. */
export interface ContactMail {
  from: string
  to: readonly string[]
  cc: readonly string[]
  labels: readonly string[]
}

/** Whose addresses are ours, as far as the run can read. */
export interface OurSide {
  /** The mailbox the conversation is filed from: the person a tag runs as. */
  account: string
  /** The team's own addresses, lower case (`BACKFILL_TEAM_ROLES`, walk testers left out, as the tag reads them). */
  team: ReadonlySet<string>
  /** The boxes' addresses the run could read from Settings, lower case. The app's sender is in no table. */
  boxes: ReadonlySet<string>
  /** Our own domains: an address at one that is neither a teammate nor a known box is unclear. */
  domains: ReadonlySet<string>
}

const ADDRESS = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g

/** Every address a header names, in its order, lower case. A name with a comma in it splits nothing. */
export function addressesOf(header: string | readonly string[] | null | undefined): string[] {
  const text = Array.isArray(header) ? header.join(', ') : String(header ?? '')
  return (text.match(ADDRESS) ?? []).map((a) => a.toLowerCase())
}

type Side = 'person' | 'box' | 'unclear' | 'outside'

function sideOf(address: string, ours: OurSide): Side {
  if (address === ours.account.trim().toLowerCase() || ours.team.has(address)) return 'person'
  if (ours.boxes.has(address)) return 'box'
  return ours.domains.has(domainOf(address)) ? 'unclear' : 'outside'
}

/**
 * Every address this mail's line could land on. One address when the run is sure, more when an unclear address is on
 * the way, none when the tag writes no line for it (a draft, Spam, Trash, a chat, a box's own copy).
 */
export function partyCandidates(mail: ContactMail, ours: OurSide): string[] {
  if (mail.labels.some((l) => MY_MAIL_NEVER_LABELS[l] !== undefined)) return []
  const from = addressesOf(mail.from)[0] ?? null
  if (!from) return []
  const sent = mail.labels.includes(MY_MAIL_SENT_LABEL)
  const side = sideOf(from, ours)
  if (!sent) {
    if (side === 'outside') return [from]
    if (side === 'box') return []
    // Unclear: the tag may know it as a box and write nothing, or not know it and land the line on it.
    if (side === 'unclear') return [from]
  }
  // Ours going out: the first person outside it was written to. An unclear address before them may be that person.
  const out: string[] = []
  let sure = false
  for (const a of [...addressesOf(mail.to), ...addressesOf(mail.cc)]) {
    if (a === from) continue
    const s = sideOf(a, ours)
    if (s === 'unclear' && !out.includes(a)) out.push(a)
    if (s === 'outside') {
      if (!out.includes(a)) out.push(a)
      sure = true
      break
    }
  }
  if (sure) return out
  // Nobody outside for sure: the line may land on its sender's own thread, or on the person's when an alias sent it.
  const own = side === 'person' ? from : ours.account.trim().toLowerCase()
  return out.includes(own) ? out : [...out, own]
}

/** A contact that holds an address, as the run read it. */
export interface KnownContact {
  id: string
  /** `contacts.kind`. `unknown` is a *Who is this?* row: an unnamed sender. */
  kind: string
  /** Its name as the thread reads it: its own, else its record's, else the address. */
  name: string
  /** The customer it is, or is a person at; null for anyone else. */
  customerId: string | null
}

/** A job's customer or GC, with the addresses its record holds. */
export interface JobParty {
  customerId: string
  role: 'customer' | 'gc'
  /** The address `contact_for_customer` puts on the customer's own contact when it makes one (`contact_info.email`). */
  own: string | null
  /** Every other address on the record: the billing address, the people at the customer. */
  others: readonly string[]
  /** Whether the customer's own contact is made already. Then nothing adds an address to it but a person. */
  hasContact: boolean
}

export interface ContactBook {
  /** The contacts that hold each address as an email, by the address in lower case. */
  byAddress: ReadonlyMap<string, readonly KnownContact[]>
  /** The job's customer and GC. */
  parties: readonly JobParty[]
}

export type ContactHeld = 'customerNoContact' | 'onRecordNoContact' | 'whoIsThis' | 'oursNoContact' | 'stranger'

/** Why a conversation is held for a contact, and the press that names the sender. */
export const BACKFILL_CONTACT_WORDS: Readonly<Record<ContactHeld, { why: string; door: string }>> = {
  customerNoContact: {
    why: 'The sender is the customer, and the customer has no contact yet.',
    door: 'Open the customer’s thread: the speech bubble beside their name. Then plan the job again.',
  },
  onRecordNoContact: {
    why: 'The sender’s address is on the customer’s record, and no contact holds it.',
    door: 'No press adds an address to a contact. Save the conversation from My email and name the sender in Who is this?, or leave it out.',
  },
  whoIsThis: {
    why: 'The sender is on Who is this? already, with no name.',
    door: 'Name them in Messages, Who is this? Then plan the job again.',
  },
  oursNoContact: {
    why: 'An address of ours is on the mail and has no contact: a teammate with no thread, an alias, or a box the run cannot see.',
    door: 'Leave it out, and say on the card which kind of address it was: the run may need to learn it.',
  },
  stranger: {
    why: 'Nobody the app knows holds the sender’s address.',
    door: 'Leave it out, or save it from My email and name the sender in Who is this?',
  },
}

/** The hardest reason first: the one a person has to deal with before the conversation can be filed. */
const HARDEST: readonly ContactHeld[] = ['stranger', 'oursNoContact', 'whoIsThis', 'onRecordNoContact', 'customerNoContact']

export type AddressVerdict =
  | { address: string; named: true; name: string; kind: string; relation: 'the job’s customer' | 'the job’s GC' | 'a contact' }
  | { address: string; named: false; reason: ContactHeld; customerId: string | null }

/** Who an address is filed under, or why nobody can be named. `ours` tells an address of our own from a stranger's. */
export function addressVerdict(address: string, book: ContactBook, ours?: OurSide): AddressVerdict {
  const held = book.byAddress.get(address) ?? []
  if (held.length > 0) {
    // Two contacts may hold one address, and the tag takes the one written to last. An unnamed one among them holds it.
    const unnamed = held.find((c) => c.kind === 'unknown')
    if (unnamed) return { address, named: false, reason: 'whoIsThis', customerId: null }
    const first = held[0]!
    const party = book.parties.find((p) => held.some((c) => c.customerId === p.customerId))
    const mine = party ? (held.find((c) => c.customerId === party.customerId) ?? first) : first
    return { address, named: true, name: mine.name.trim() || address, kind: mine.kind, relation: party ? (party.role === 'gc' ? 'the job’s GC' : 'the job’s customer') : 'a contact' }
  }
  const own = book.parties.find((p) => p.own === address)
  if (own && !own.hasContact) return { address, named: false, reason: 'customerNoContact', customerId: own.customerId }
  const record = own ?? book.parties.find((p) => p.others.includes(address))
  if (record) return { address, named: false, reason: 'onRecordNoContact', customerId: record.customerId }
  return { address, named: false, reason: ours && sideOf(address, ours) !== 'outside' ? 'oursNoContact' : 'stranger', customerId: null }
}

export type ContactVerdict =
  | { kind: 'named'; under: Extract<AddressVerdict, { named: true }>[] }
  | {
      kind: 'held'
      /** The hardest reason among the unnamed. */
      reason: ContactHeld
      unnamed: Extract<AddressVerdict, { named: false }>[]
      under: Extract<AddressVerdict, { named: true }>[]
      why: string
      door: string
    }

/**
 * Who a conversation's lines would be filed under: named when every address a line could land on has a named contact,
 * held otherwise. `mails` are the mails the tag would write: the seat's plan says which, and a count reads the ones
 * its searches found.
 */
export function contactVerdict(mails: readonly ContactMail[], ours: OurSide, book: ContactBook): ContactVerdict {
  const seen = new Set<string>()
  const all: AddressVerdict[] = []
  for (const m of mails) {
    for (const a of partyCandidates(m, ours)) {
      if (seen.has(a)) continue
      seen.add(a)
      all.push(addressVerdict(a, book, ours))
    }
  }
  const under = all.filter((v): v is Extract<AddressVerdict, { named: true }> => v.named)
  const unnamed = all.filter((v): v is Extract<AddressVerdict, { named: false }> => !v.named)
  if (unnamed.length === 0) return { kind: 'named', under }
  const reason = HARDEST.find((r) => unnamed.some((u) => u.reason === r))!
  return { kind: 'held', reason, unnamed, under, ...BACKFILL_CONTACT_WORDS[reason] }
}

/** Who a conversation is filed under, for a sheet: `Dana Reyes (the job’s customer) · Kai Brandt (a contact)`. */
export function filedUnderWords(under: readonly Extract<AddressVerdict, { named: true }>[]): string {
  return under.map((u) => `${u.name} (${u.relation})`).join(' · ')
}

/** Who is not named, for a sheet: each address with its reason. */
export function unnamedWords(unnamed: readonly Extract<AddressVerdict, { named: false }>[]): string {
  return unnamed.map((u) => `${u.address}: ${BACKFILL_CONTACT_WORDS[u.reason].why}`).join(' · ')
}

export interface ContactTally {
  named: number
  held: number
  /** Held conversations by their hardest reason. */
  by: Partial<Record<ContactHeld, number>>
  /** The customers whose thread one press opens, and how many conversations that press alone would name. */
  onePress: { customers: number; conversations: number }
}

/** The count of a run's contact verdicts. */
export function contactTally(verdicts: readonly ContactVerdict[]): ContactTally {
  const t: ContactTally = { named: 0, held: 0, by: {}, onePress: { customers: 0, conversations: 0 } }
  const customers = new Set<string>()
  for (const v of verdicts) {
    if (v.kind === 'named') {
      t.named += 1
      continue
    }
    t.held += 1
    t.by[v.reason] = (t.by[v.reason] ?? 0) + 1
    if (v.reason !== 'customerNoContact') continue
    t.onePress.conversations += 1
    for (const u of v.unnamed) if (u.customerId) customers.add(u.customerId)
  }
  t.onePress.customers = customers.size
  return t
}

// ---------- office hours ----------

/** A filing writes lines, contacts and files while the crew uses the app: none from six in the morning to seven at night, Monday to Saturday. */
export const OFFICE_HOURS = { fromHour: 6, toHour: 19 } as const

/** Whether a moment is inside office hours in the app's own time zone, Central: Monday to Saturday, 6 am to 7 pm. */
export function inOfficeHours(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now)
  const day = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN)
  if (!Number.isFinite(hour)) return true
  return day !== 'Sun' && hour >= OFFICE_HOURS.fromHour && hour < OFFICE_HOURS.toHour
}
