/**
 * Documents → Agreements, **Send a paper**, its second window: **Who is it with?** (punch list #403, step 3). The
 * window stops being a roster search. It finds people and companies: a teammate, a sub, a customer and the people on
 * file there, a supply house and its reps. Its last row is **Someone not in any list**, the owner's call 6.
 *
 * One pick names both the party and the signer. A person at a company is the signer, and the company is the party. A
 * company with nobody picked has the signer named next, in the email window. A person on the roster signs for
 * themselves, as before, and their paper is filed under their name as People → Contracts files it.
 *
 * Pure: no React, no supabase. The reads are `paperPartyIo.ts`; the window is `PaperPartyPicker.tsx`.
 */
import { paperSaysLine, signingForOf, type PaperPartyKind } from '../contracts/paperParty'

// ── What the window is handed ─────────────────────────────────────────────────────────────────────────────────────────

/** A living person on the roster, by the name their papers are filed under. */
export type PartyRosterPerson = { name: string; sub: boolean }
export type PartyCustomer = { id: string; name: string }
export type PartyCustomerPerson = { id: string; name: string; email: string | null; customerId: string; customerName: string }
export type PartySupplyHouse = { id: string; name: string }
/** A rep or a desk at a supply house. `label` is the office's own words for them, such as a desk's name. */
export type PartyRep = { id: string; name: string | null; label: string | null; email: string | null; houseId: string; houseName: string }

/** The lists the window reads once, and the customers its find box asked the database for. */
export type PartyLists = {
  roster: ReadonlyArray<PartyRosterPerson>
  customerPeople: ReadonlyArray<PartyCustomerPerson>
  supplyHouses: ReadonlyArray<PartySupplyHouse>
  reps: ReadonlyArray<PartyRep>
  /** Customers whose name holds what was typed. Empty until two letters are typed. */
  customers: ReadonlyArray<PartyCustomer>
}

// ── The chips ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type PartyChip = 'all' | 'team' | 'subs' | 'customers' | 'supply'

export const PARTY_CHIPS: ReadonlyArray<{ key: PartyChip; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'team', label: 'Team' },
  { key: 'subs', label: 'Subs' },
  { key: 'customers', label: 'Customers' },
  { key: 'supply', label: 'Supply houses' },
]

/** The fewest letters the find box asks the database for customers with. */
export const PARTY_FIND_MIN = 2

/** What was typed, as lower-case words. */
export function partyFindWords(typed: string): string[] {
  return typed.toLowerCase().split(/\s+/).filter(Boolean)
}

/** Whether the find box asks the database for customers: two letters at least, and a chip that shows customers. */
export function partyFindAsksCustomers(typed: string, chip: PartyChip): boolean {
  return typed.trim().length >= PARTY_FIND_MIN && (chip === 'all' || chip === 'customers')
}

// ── A pick ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The record a party's contact is found through (`paper_party_contact`). */
export type PartyRecordTable = 'customers' | 'customer_contact_persons' | 'supply_houses' | 'supply_house_contacts'

/** A business that is a party, and the list it is kept in. */
export type PartyBusiness = { table: 'customers' | 'supply_houses'; id: string; name: string; party: Extract<PaperPartyKind, 'customer' | 'supply_house'> }

export type PartyPick =
  /** A teammate or a sub: their own paper, filed under their name. */
  | { kind: 'roster'; personName: string }
  /** A company, with the person on file who signs when one was picked. With none, the office names the signer next. */
  | { kind: 'record'; business: PartyBusiness; record: { table: PartyRecordTable; id: string }; signer: { name: string; title: string; email: string } | null }
  /** Someone on no list: the office types them next. */
  | { kind: 'unlisted' }

/** One row of the window. */
export type PartyRow = {
  key: string
  title: string
  /** The muted line under the title. */
  sub: string
  tag: string
  /** The tag's colours: the roster's amber, an outside company's teal, or an outline for someone on no list. */
  tone: 'people' | 'outside' | 'plain'
  pick: PartyPick
}

export const UNLISTED_ROW_TITLE = 'Someone not in any list'

const UNLISTED_ROW: PartyRow = { key: 'unlisted', title: UNLISTED_ROW_TITLE, sub: 'Type their name and email next.', tag: 'Not on a list', tone: 'plain', pick: { kind: 'unlisted' } }

function holds(words: ReadonlyArray<string>, ...texts: Array<string | null | undefined>): boolean {
  if (words.length === 0) return true
  const text = texts.map((t) => (t ?? '').toLowerCase()).join(' ')
  return words.every((w) => text.includes(w))
}

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name)
}

/** A rep's name as the window shows it: their name, else the desk's label. */
export function repName(rep: Pick<PartyRep, 'name' | 'label'>): string {
  return (rep.name ?? '').trim() || (rep.label ?? '').trim() || 'A desk'
}

/**
 * A rep's title as the window offers it: the office's label for them, when they have a name and the label says more
 * than it. The table's `role` is what the desk handles for us (price requests, job accounts), never a title.
 */
function repTitle(rep: Pick<PartyRep, 'name' | 'label'>): string {
  const label = (rep.label ?? '').trim()
  const name = (rep.name ?? '').trim()
  if (!name || !label) return ''
  // A label that is only a part of their name ("Lena" for Lena Park) adds nothing.
  return name.toLowerCase().includes(label.toLowerCase()) ? '' : label
}

function businessRows(business: PartyBusiness, people: ReadonlyArray<{ id: string; name: string; title: string; email: string; table: PartyRecordTable }>, words: ReadonlyArray<string>): PartyRow[] {
  const tag = business.party === 'customer' ? 'Customer' : 'Supply house'
  // The business was found by its own name: every person there is offered. Found by a person's name: that person alone.
  const byBusiness = holds(words, business.name)
  const shown = people.filter((p) => byBusiness || holds(words, p.name, p.title))
  if (!byBusiness && shown.length === 0) return []
  const rows: PartyRow[] = shown.map((p) => ({
    key: `${p.table}:${p.id}`,
    title: p.name,
    sub: p.title ? `${p.title} · ${business.name}` : business.name,
    tag,
    tone: 'outside',
    pick: { kind: 'record', business, record: { table: p.table, id: p.id }, signer: { name: p.name, title: p.title, email: p.email } },
  }))
  if (byBusiness) {
    rows.push({
      key: `${business.table}:${business.id}`,
      title: business.name,
      sub: people.length > 0 ? 'Someone not listed. You name the signer next.' : 'No one on file. You name the signer next.',
      tag,
      tone: 'outside',
      pick: { kind: 'record', business, record: { table: business.table, id: business.id }, signer: null },
    })
  }
  return rows
}

/**
 * The window's rows for what is typed and the chip that is on: each supply house with its reps, each customer with the
 * people on file there, then the roster, then **Someone not in any list** last, always. With nothing typed the list is
 * the short ones it holds whole: the roster and the supply houses. A customer is found by typing.
 */
export function partyRows(lists: PartyLists, typed: string, chip: PartyChip): PartyRow[] {
  const words = partyFindWords(typed)
  const rows: PartyRow[] = []

  if (chip === 'all' || chip === 'supply') {
    for (const house of [...lists.supplyHouses].sort(byName)) {
      const people = lists.reps
        .filter((r) => r.houseId === house.id)
        .map((r) => ({ id: r.id, name: repName(r), title: repTitle(r), email: (r.email ?? '').trim(), table: 'supply_house_contacts' as const }))
        .sort(byName)
      // With nothing typed under All the supply houses stay folded away: the roster is what the office sends to most.
      if (words.length === 0 && chip === 'all') continue
      rows.push(...businessRows({ table: 'supply_houses', id: house.id, name: house.name, party: 'supply_house' }, people, words))
    }
  }

  if (chip === 'all' || chip === 'customers') {
    // A customer the find box found, and one a person on file was found at.
    const customers = new Map<string, PartyCustomer>()
    for (const c of lists.customers) customers.set(c.id, c)
    if (words.length > 0) {
      for (const p of lists.customerPeople) if (holds(words, p.name) && !customers.has(p.customerId)) customers.set(p.customerId, { id: p.customerId, name: p.customerName })
    }
    for (const customer of [...customers.values()].sort(byName)) {
      const people = lists.customerPeople
        .filter((p) => p.customerId === customer.id)
        .map((p) => ({ id: p.id, name: p.name.trim(), title: '', email: (p.email ?? '').trim(), table: 'customer_contact_persons' as const }))
        .sort(byName)
      rows.push(...businessRows({ table: 'customers', id: customer.id, name: customer.name, party: 'customer' }, people, words))
    }
  }

  if (chip === 'all' || chip === 'team' || chip === 'subs') {
    for (const person of [...lists.roster].sort(byName)) {
      if (chip === 'team' && person.sub) continue
      if (chip === 'subs' && !person.sub) continue
      if (!holds(words, person.name)) continue
      rows.push({ key: `roster:${person.name}`, title: person.name, sub: 'Signs for themselves', tag: person.sub ? 'Sub' : 'Staff', tone: 'people', pick: { kind: 'roster', personName: person.name } })
    }
  }

  rows.push(UNLISTED_ROW)
  return rows
}

/** The line under the find box when the list is waiting on typing: a customer is found by name. */
export function partyFindHint(typed: string, chip: PartyChip): string {
  if (chip === 'customers' && typed.trim().length < PARTY_FIND_MIN) return 'Type a customer’s name to find them.'
  if (chip === 'all' && typed.trim().length < PARTY_FIND_MIN) return 'Type a name to find a customer or a supply house.'
  return ''
}

// ── What the email window opens on ────────────────────────────────────────────────────────────────────────────────────

/** A party as the Send for signature window shows it. */
export type SendWindowParty = {
  /** The party's name as the paper keeps it. '' for someone on no list, whose company the office may type. */
  name: string
  /** Someone on no list who is not written yet: the window asks for their company and looks their address up. */
  unlisted: boolean
  /** The company a typed signer can be kept with, by one tick; null when a person on file was picked, or there is no company. */
  keepWith: string | null
}

/** A record pick or the unlisted row, as the email window shows it. A roster pick is no party. */
export function sendWindowPartyOfPick(pick: Exclude<PartyPick, { kind: 'roster' }>): SendWindowParty {
  if (pick.kind === 'unlisted') return { name: '', unlisted: true, keepWith: null }
  return { name: pick.business.name, unlisted: false, keepWith: pick.signer ? null : pick.business.name }
}

/** *Keep Wren Castillo with Tallgrass Homes*: the tick's words. '' until a name is typed. */
export function keepSignerWords(signerName: string, businessName: string): string {
  const name = signerName.trim()
  return name ? `Keep ${name} with ${businessName}` : ''
}

/** The party's name frozen on the paper: the business, else the company the office typed, else the signer. */
export function partyNameToKeep(party: Pick<SendWindowParty, 'name'>, typedCompany: string, signerName: string): string {
  return party.name.trim() || typedCompany.trim() || signerName.trim()
}

/** The business the signer signs for, as the paper says it; null when they sign for themselves. */
export function partySigningFor(party: Pick<SendWindowParty, 'name'>, typedCompany: string, signerName: string): string | null {
  return signingForOf(partyNameToKeep(party, typedCompany, signerName), signerName)
}

/** *Lena Park, Branch manager, signing for Tallgrass Supply Co.*: what the paper will say. '' until a name is typed. */
export function partySaysLine(party: Pick<SendWindowParty, 'name'>, typedCompany: string, signerName: string, signerTitle: string): string {
  return paperSaysLine({ name: signerName, title: signerTitle, signingFor: partySigningFor(party, typedCompany, signerName) })
}

/** The line under the window's title: *Mutual secrecy agreement · Tallgrass Supply Co.*, or *· not on a list*. */
export function sendPartyHint(documentName: string, party: Pick<SendWindowParty, 'name' | 'unlisted'>): string {
  return `${documentName.trim()} · ${party.unlisted || !party.name.trim() ? 'not on a list' : party.name.trim()}`
}

/** What the window hands back right before the email goes, for the party's contact and its paper to be written. */
export type PartySendInput = { signerName: string; signerEmail: string; typedCompany: string; keep: boolean }

/**
 * Why an address a typed-in signer was given cannot take the paper, in the window's words; null when it can. Someone on
 * the roster signs their own papers, which are filed under their name: the office picks them from the list.
 */
export function knownAddressRefusal(known: { name: string; party: PaperPartyKind } | null): string | null {
  if (known?.party !== 'person') return null
  return `This address is ${known.name || 'someone'}, who is on the roster. Close this and pick them from the list.`
}

/** What the window says when the app already knows a typed-in signer's address, so nobody is added twice. '' when it does not. */
export function knownAddressWords(known: { name: string; party: PaperPartyKind } | null): string {
  if (!known || known.party === 'person') return ''
  const who = known.name || 'someone the app keeps'
  const what = known.party === 'customer' ? ', at a customer' : known.party === 'supply_house' ? ', at a supply house' : known.party === 'trade' ? ', at a trade company' : ''
  return `The app already keeps this address: ${who}${what}. The paper goes to that record, and nobody is added twice.`
}

/** What the window says when the look-up of a typed-in signer's address failed: nothing is sent on a guess. */
export const ADDRESS_NOT_CHECKED = 'The app could not check whose address this is, so nothing was sent.'

/** What follows the name of whoever already holds the address, when Send email was pressed before the office could read it. */
export const KNOWN_ADDRESS_PRESS_AGAIN = 'Press Send email again to send it to them.'

/**
 * What a press of **Send email** does once the look-up of a typed-in signer's address has answered. The look-up runs a
 * moment after the typing rests, so a quick press could beat it: the roster's refusal and the *already keeps this
 * address* note were skipped, and the paper went out filed under the wrong record. The press now waits for the answer.
 *
 * - Someone on the roster is refused, as before.
 * - Someone the app keeps, whom the window had not yet named when the press came (`namedBefore` false), is named and
 *   the press holds once: the office reads who the paper goes to, and presses again.
 * - Nobody, or someone the window had named already, sends.
 */
export function addressLookUpVerdict(known: { name: string; party: PaperPartyKind } | null, namedBefore: boolean): { kind: 'send' } | { kind: 'hold'; why: string } {
  const refusal = knownAddressRefusal(known)
  if (refusal) return { kind: 'hold', why: refusal }
  const words = knownAddressWords(known)
  if (words && !namedBefore) return { kind: 'hold', why: `${words} ${KNOWN_ADDRESS_PRESS_AGAIN}` }
  return { kind: 'send' }
}
