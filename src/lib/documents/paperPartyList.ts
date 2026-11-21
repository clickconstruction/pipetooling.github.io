/**
 * Documents → Agreements, **Add to a list** (punch list #403, step 3, the second PR). A paper may go to someone on no
 * list, the owner's call 6: the office types a name, an email and a company, and sends. Their line then reads *Not on a
 * list*, and one press says what they are: a new customer, a new supply house or vendor, or someone at a company the
 * app already keeps. It is the act Messages calls *Who is this?* (`name_contact`). The paper points at their contact,
 * so it comes along and nothing is copied.
 *
 * Pure: no React, no supabase. The reads and writes are `paperPartyIo.ts`; the window is `PaperPartyAddToList.tsx`.
 */
import { pluralNoun } from '../batchWords'
import type { PartyBusiness } from './paperPartyPick'

export const ADD_TO_A_LIST_LABEL = 'Add to a list'

/** What someone on no list becomes. */
export type ListChoice = 'customer' | 'supply_house' | 'existing'

/** Who is being added: the signer the paper kept, and the company the office typed for them, if any. */
export type ListPerson = {
  /** The signer's name, as the paper keeps it. */
  name: string
  /** The address the paper went to. */
  email: string
  /** The company they sign for; '' when they sign for themselves. */
  company: string
}

/** The window's title: *Add Noor Haddad to a list*. */
export function addToListTitle(person: Pick<ListPerson, 'name'>): string {
  return `Add ${person.name.trim() || 'them'} to a list`
}

/** One choice of the window, as its row reads. */
export type ListOption = { choice: ListChoice; title: string; sub: string }

/**
 * The window's three choices, with what each will make. A person with a company becomes a person there; one with none
 * is the customer themselves. A supply house needs a company's name, so with none typed its row asks for one.
 */
export function listOptions(person: ListPerson): ListOption[] {
  const name = person.name.trim() || 'them'
  const company = person.company.trim()
  return [
    { choice: 'customer', title: 'A new customer', sub: company ? `${company}, with ${name} as a person there` : `${name}, as the customer` },
    { choice: 'supply_house', title: 'A new supply house or vendor', sub: company ? `${company}, with ${name} as a rep` : `Type the company’s name. ${name} is added as a rep.` },
    { choice: 'existing', title: 'Someone at a company we already have', sub: 'Search customers and supply houses' },
  ]
}

/** *1 paper comes with them: Mutual secrecy agreement.* The papers that follow the person onto the list. */
export function papersComeWords(paperNames: ReadonlyArray<string>): string {
  const names = paperNames.map((n) => n.trim()).filter(Boolean)
  if (names.length === 0) return ''
  const shown = names.slice(0, 3).join(', ')
  const more = names.length > 3 ? ` and ${names.length - 3} more` : ''
  return `${names.length} ${pluralNoun('paper', names.length)} ${names.length === 1 ? 'comes' : 'come'} with them: ${shown}${more}.`
}

/** Why the choice cannot be made yet, in the window's words; null when it can. */
export function listChoiceRefusal(choice: ListChoice, person: ListPerson, picked: PartyBusiness | null): string | null {
  if (!person.name.trim()) return 'The paper kept no name for them. Send it again with the signer’s name first.'
  if (choice === 'supply_house' && !person.company.trim()) return 'Type the supply house’s or the vendor’s name.'
  if (choice === 'existing' && !picked) return 'Pick the company they are at.'
  return null
}

/** The button's words: it names the act and where they go. */
export function listConfirmLabel(choice: ListChoice, picked: Pick<PartyBusiness, 'name'> | null): string {
  if (choice === 'customer') return 'Add as a customer'
  if (choice === 'supply_house') return 'Add as a supply house'
  return picked ? `Add to ${picked.name}` : 'Add to a company'
}

/** What the window does for a choice, in the order it does it. The record it makes is the one the contact is named as. */
export type ListPlan =
  /** The app's own New customer form opens on their name; the customer it makes is theirs. */
  | { kind: 'new-customer'; customerName: string; person: { name: string; email: string } | null }
  | { kind: 'new-supply-house'; houseName: string; person: { name: string; email: string } }
  | { kind: 'existing'; business: PartyBusiness; person: { name: string; email: string } }

/**
 * The plan for a choice. A new customer with no company is the person themselves, so no person is kept under it. A
 * person kept under a company is always a row of that company's own list.
 */
export function listPlan(choice: ListChoice, person: ListPerson, picked: PartyBusiness | null): ListPlan | null {
  if (listChoiceRefusal(choice, person, picked)) return null
  const who = { name: person.name.trim(), email: person.email.trim() }
  const company = person.company.trim()
  if (choice === 'customer') return { kind: 'new-customer', customerName: company || who.name, person: company ? who : null }
  if (choice === 'supply_house') return { kind: 'new-supply-house', houseName: company, person: who }
  return picked ? { kind: 'existing', business: picked, person: who } : null
}

/** The toast once they are on a list: where they went, and that the paper came along. */
export function addedToListWords(person: Pick<ListPerson, 'name'>, where: string, papers: number): string {
  const name = person.name.trim() || 'They'
  const tail = papers > 0 ? ` ${papers === 1 ? 'Their paper came' : 'Their papers came'} with them.` : ''
  return `${name} is with ${where} now.${tail}`
}

/** A record one press wrote: its table, its id, and the name it was saved under when the saving can change it. */
export type MadeRecord = { table: string; id: string; name?: string }

/**
 * What one write is known by: the step, then what it was for, trimmed and in any case. A press that fails after an
 * earlier write landed leaves the window open, and the next press finds that write by this key (the audit of punch
 * list #403, finding 10).
 */
export function listMadeKey(step: 'house' | 'customer' | 'kept', parts: ReadonlyArray<string>): string {
  return JSON.stringify([step, ...parts.map((p) => p.trim().toLowerCase())])
}

/**
 * Write once for a key. The first press writes and keeps the record. A later press with the same key gets that record
 * back and writes nothing, so a press after a failure never makes a second supply house, customer or person on file.
 * A write that fails keeps nothing, so the next press tries it again.
 */
export async function writeOnce<T extends MadeRecord>(made: Map<string, MadeRecord>, key: string, write: () => Promise<T>): Promise<T> {
  const had = made.get(key)
  if (had) return had as T
  const record = await write()
  made.set(key, record)
  return record
}
