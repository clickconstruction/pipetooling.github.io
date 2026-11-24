/**
 * Send a paper's **Who is it with?** window, its reads and writes (punch list #403, step 3). The short lists are read
 * whole when the window opens: every supply house with its reps, and the people on file at customers. A customer is
 * asked of the database by name as the office types. A party's contact is found, and made when the record has none,
 * through `paper_party_contact`. Someone on no list is a contact made from the address they are sent at, as Messages
 * makes one. Each table's own row security answers. Browser io, not pure; the rules are `paperPartyPick.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { PaperPartyKind } from '../contracts/paperParty'
import type { PartyBusiness, PartyCustomer, PartyCustomerPerson, PartyRecordTable, PartyRep, PartySupplyHouse } from './paperPartyPick'
import { PARTY_CONTACT_COLUMN, partyContactsToLook, type PartyContactRow, type PartyCopyOut } from './partyPaperOut'
import type { ListRecordTable, TradeBusiness } from './paperPartyList'

// `paper_party_contact` joins the generated types with the types PR after its push; until then the client is cast once.
const db = supabase as unknown as SupabaseClient

/** The most rows a short list is read at: past it the list is not short, and the find box is the way in. */
const SHORT_LIST = 500

export type PartyShortLists = { customerPeople: PartyCustomerPerson[]; supplyHouses: PartySupplyHouse[]; reps: PartyRep[] }

function embeddedName(v: unknown): string {
  const row = Array.isArray(v) ? v[0] : v
  return ((row as { name?: string | null } | null | undefined)?.name ?? '').trim()
}

/** The lists the window holds whole: the people on file at customers, the supply houses and their reps. Throws with the reason. */
export async function readPartyShortLists(): Promise<PartyShortLists> {
  const [people, houses, reps] = await Promise.all([
    withSupabaseRetry(async () => supabase.from('customer_contact_persons').select('id, name, email, customer_id, customers(name)').order('name').limit(SHORT_LIST), 'read the people at customers'),
    withSupabaseRetry(async () => supabase.from('supply_houses').select('id, name').order('name').limit(SHORT_LIST), 'read the supply houses'),
    withSupabaseRetry(
      async () => supabase.from('supply_house_contacts').select('id, name, label, email, supply_house_id, supply_houses(name)').is('archived_at', null).not('supply_house_id', 'is', null).limit(SHORT_LIST),
      'read the reps',
    ),
  ])
  return {
    customerPeople: ((people ?? []) as unknown as Array<{ id: string; name: string | null; email: string | null; customer_id: string; customers: unknown }>)
      .filter((p) => (p.name ?? '').trim() !== '')
      .map((p) => ({ id: p.id, name: (p.name ?? '').trim(), email: p.email, customerId: p.customer_id, customerName: embeddedName(p.customers) || 'A customer' })),
    supplyHouses: ((houses ?? []) as unknown as Array<{ id: string; name: string | null }>).map((h) => ({ id: h.id, name: (h.name ?? '').trim() })).filter((h) => h.name !== ''),
    reps: ((reps ?? []) as unknown as Array<{ id: string; name: string | null; label: string | null; email: string | null; supply_house_id: string; supply_houses: unknown }>).map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      email: r.email,
      houseId: r.supply_house_id,
      houseName: embeddedName(r.supply_houses) || 'A supply house',
    })),
  }
}

/** Customers whose name holds what was typed, a few. Throws with the reason. */
export async function searchPartyCustomers(typed: string): Promise<PartyCustomer[]> {
  const q = typed.trim()
  if (q.length < 2) return []
  const like = `%${q.replace(/[%_,()]/g, ' ')}%`
  const rows = await withSupabaseRetry(async () => supabase.from('customers').select('id, name').ilike('name', like).is('archived_at', null).order('name').limit(12), 'find the customers')
  return ((rows ?? []) as unknown as Array<{ id: string; name: string | null }>).map((c) => ({ id: c.id, name: (c.name ?? '').trim() })).filter((c) => c.name !== '')
}

/** The contact that is one record, made when the record has none (`paper_party_contact`). Throws with the function's own reason. */
export async function readPartyContact(record: { table: PartyRecordTable; id: string }): Promise<string> {
  const id = await withSupabaseRetry(async () => db.rpc('paper_party_contact', { p_record_table: record.table, p_record_id: record.id }), 'find who the paper is with')
  if (typeof id !== 'string' || !id) throw new Error('The app could not find who the paper is with.')
  return id
}

/**
 * The contacts a record's papers are filed under, when it has any. A read alone: nothing is made here, where
 * `readPartyContact` makes one. A company's are its own contact, which carries no name as `paper_party_contact` finds
 * it, and each named person's that points at the company (`partyContactsToLook`). A person on file has one.
 */
export async function findPartyContacts(record: { table: PartyRecordTable; id: string }): Promise<string[]> {
  const column = PARTY_CONTACT_COLUMN[record.table]
  const rows = await withSupabaseRetry(async () => db.from('contacts').select('id, name').eq(column, record.id).order('created_at').limit(50), 'look for who the paper is with')
  return partyContactsToLook(record.table, (rows ?? []) as PartyContactRow[])
}

/** Who each copy that is out went to, in the order asked. A copy that went away since is left out. */
export async function readCopiesOut(docIds: readonly string[]): Promise<PartyCopyOut[]> {
  if (docIds.length === 0) return []
  const rows = await withSupabaseRetry(
    async () => db.from('person_contract_documents').select('id, signer_name, signer_title, signer_email, sent_at, status').in('id', [...docIds]),
    'read who has the paper out',
  )
  const byId = new Map(((rows ?? []) as Array<{ id: string; signer_name: string | null; signer_title: string | null; signer_email: string | null; sent_at: string | null; status: string }>).map((r) => [r.id, r]))
  const out: PartyCopyOut[] = []
  for (const id of docIds) {
    const r = byId.get(id)
    if (!r || r.status !== 'sent') continue
    out.push({ docId: r.id, signerName: (r.signer_name ?? '').trim(), signerTitle: (r.signer_title ?? '').trim(), signerEmail: (r.signer_email ?? '').trim(), sentAt: r.sent_at })
  }
  return out
}

export type KnownAddress = {
  contactId: string
  /** The name Messages shows for them. */
  name: string
  /** What their contact points at. */
  party: PaperPartyKind
}

type ContactRow = {
  id: string
  customer_id: string | null
  customer_contact_person_id: string | null
  supply_house_id: string | null
  supply_house_contact_id: string | null
  gc_company_id: string | null
  gc_company_person_id: string | null
  person_id: string | null
  prospect_id: string | null
  team_prospect_id: string | null
}

/** What a contact points at, as the view's SQL decides it. */
export function partyKindOfContact(c: Omit<ContactRow, 'id'>): PaperPartyKind {
  if (c.customer_id || c.customer_contact_person_id) return 'customer'
  if (c.supply_house_id || c.supply_house_contact_id) return 'supply_house'
  if (c.gc_company_id || c.gc_company_person_id) return 'trade'
  if (c.person_id) return 'person'
  if (c.prospect_id || c.team_prospect_id) return 'other'
  return 'none'
}

/** Whose an address is, or null when nobody holds it. Reads only. Throws with the reason. */
export async function readContactForAddress(email: string): Promise<KnownAddress | null> {
  const value = email.trim()
  if (!value) return null
  const contactId = await withSupabaseRetry(async () => supabase.rpc('contact_for_channel', { p_kind: 'email', p_value: value }), 'look the address up')
  if (typeof contactId !== 'string' || !contactId) return null
  const [row, name] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase
          .from('contacts')
          .select('id, customer_id, customer_contact_person_id, supply_house_id, supply_house_contact_id, gc_company_id, gc_company_person_id, person_id, prospect_id, team_prospect_id')
          .eq('id', contactId)
          .maybeSingle(),
      'read whose address it is',
    ),
    withSupabaseRetry(async () => supabase.rpc('contact_display_name', { p_contact_id: contactId }), 'read their name'),
  ])
  if (!row) return null
  return { contactId, name: typeof name === 'string' ? name.trim() : '', party: partyKindOfContact(row as unknown as ContactRow) }
}

/**
 * The contact of someone on no list: the one that holds the address, else a new one made from it and named. Called from
 * Send email only, so closing the window leaves nothing behind. Throws with the reason.
 */
export async function makeContactForAddress(email: string, name: string): Promise<string> {
  const contactId = await withSupabaseRetry(async () => supabase.rpc('contact_make_for_channel', { p_kind: 'email', p_value: email.trim() }), 'start their record')
  if (typeof contactId !== 'string' || !contactId) throw new Error('The app could not start their record.')
  const named = name.trim()
  if (named) {
    // Only a contact with no record takes the name: one that is someone already keeps the name they have.
    await withSupabaseRetry(async () => supabase.from('contacts').update({ name: named.slice(0, 200) }).eq('id', contactId).eq('kind', 'unknown'), 'name them')
  }
  return contactId
}

/** Keep a person the office typed with the company, as a person on file there. Returns the record a contact is found through. */
export async function keepSignerWithBusiness(business: PartyBusiness, signer: { name: string; email: string }, addedBy: string | null | undefined): Promise<{ table: PartyRecordTable; id: string }> {
  const name = signer.name.trim()
  const email = signer.email.trim()
  if (business.table === 'customers') {
    const row = await withSupabaseRetry(async () => supabase.from('customer_contact_persons').insert({ customer_id: business.id, name, email }).select('id').single(), 'keep them with the customer')
    return { table: 'customer_contact_persons', id: (row as unknown as { id: string }).id }
  }
  const row = await withSupabaseRetry(
    async () => supabase.from('supply_house_contacts').insert({ supply_house_id: business.id, name, email, label: '', created_by: addedBy ?? null }).select('id').single(),
    'keep them with the supply house',
  )
  return { table: 'supply_house_contacts', id: (row as unknown as { id: string }).id }
}

// ── Add to a list (punch list #403, step 3, the second PR) ────────────────────────────────────────────────────────────

/** Who a paper's party is, for Add to a list: the signer the paper kept, the company typed for them, and their contact. */
export type ListPersonRead = { contactId: string; name: string; email: string; company: string }

type ListPaperRow = { party_contact_id: string | null; party_name: string | null; signer_name: string | null; signer_email: string | null; signing_for: string | null }

/** Read who one paper's party is. Throws with the reason, and when the paper is no party's. */
export async function readListPerson(documentId: string): Promise<ListPersonRead> {
  const row = (await withSupabaseRetry(
    async () => supabase.from('person_contract_documents').select('party_contact_id, party_name, signer_name, signer_email, signing_for').eq('id', documentId).single(),
    'read the paper',
  )) as unknown as ListPaperRow
  if (!row.party_contact_id) throw new Error('This paper is filed under a person, so there is nobody to add.')
  const name = (row.signer_name ?? '').trim()
  const party = (row.party_name ?? '').trim()
  // The company is the business they sign for. A paper that kept none names the party, unless the party is the signer.
  const company = (row.signing_for ?? '').trim() || (party && party.toLowerCase() !== name.toLowerCase() ? party : '')
  return { contactId: row.party_contact_id, name: name || party, email: (row.signer_email ?? '').trim(), company }
}

/** The names of the papers a party holds, which come with them onto a list. Throws with the reason. */
export async function readPartyPaperNames(contactId: string): Promise<string[]> {
  const rows = await withSupabaseRetry(
    async () => supabase.from('person_contract_documents').select('document_name, status').eq('party_contact_id', contactId).in('status', ['sent', 'signed']).order('created_at', { ascending: false }),
    'read their papers',
  )
  return ((rows ?? []) as unknown as Array<{ document_name: string | null }>).map((r) => (r.document_name ?? '').trim()).filter(Boolean)
}

/** A new supply house or vendor, by its name alone. Its kind and its details are set on Materials. Returns its id. */
export async function addSupplyHouse(name: string): Promise<string> {
  const row = await withSupabaseRetry(async () => supabase.from('supply_houses').insert({ name: name.trim() }).select('id').single(), 'add the supply house')
  return (row as unknown as { id: string }).id
}

// ── A trade company on Add to a list (punch list #403, step 6) ────────────────────────────────────────────────────────

/** Trade companies whose name holds what was typed, a few. The GC office team reads them; anyone else finds none. Throws with the reason. */
export async function searchTradeCompanies(typed: string): Promise<TradeBusiness[]> {
  const q = typed.trim()
  if (q.length < 2) return []
  const like = `%${q.replace(/[%_,()]/g, ' ')}%`
  const rows = await withSupabaseRetry(async () => supabase.from('gc_companies').select('id, name').ilike('name', like).order('name').limit(12), 'find the trade companies')
  return ((rows ?? []) as unknown as Array<{ id: string; name: string | null }>)
    .map((c): TradeBusiness => ({ table: 'gc_companies', id: c.id, name: (c.name ?? '').trim(), party: 'trade' }))
    .filter((c) => c.name !== '')
}

/**
 * A new trade company with its trade, and the person as someone there who gets its contracts, through
 * `gc_add_company` as Add a company makes one. Returns the company and the person's own row there. Throws with the reason.
 */
export async function addTradeCompany(name: string, trades: readonly string[], person: { name: string; email: string }): Promise<{ companyId: string; personRowId: string }> {
  const companyId = await withSupabaseRetry(
    async () =>
      supabase.rpc('gc_add_company', {
        company: { name: name.trim(), trades: [...trades], known: true, people: [{ name: person.name.trim(), email: person.email.trim(), gets: ['contracts'] }] },
      }),
    'add the trade company',
  )
  if (typeof companyId !== 'string' || !companyId) throw new Error('The trade company was not added.')
  const row = await withSupabaseRetry(
    async () => supabase.from('gc_company_people').select('id').eq('company_id', companyId).is('removed_at', null).order('created_at').limit(1).single(),
    'read them at the trade company',
  )
  return { companyId, personRowId: (row as unknown as { id: string }).id }
}

/** Keep a person the office typed at a trade company we keep, as someone there who gets its contracts. Returns their row. */
export async function keepSignerWithTradeCompany(companyId: string, signer: { name: string; email: string }): Promise<{ table: 'gc_company_people'; id: string }> {
  const row = await withSupabaseRetry(
    async () =>
      supabase
        .from('gc_company_people')
        .insert({ company_id: companyId, name: signer.name.trim(), email: signer.email.trim(), role: '', gets: ['contracts'], added_by: 'office' })
        .select('id')
        .single(),
    'keep them at the trade company',
  )
  return { table: 'gc_company_people', id: (row as unknown as { id: string }).id }
}

/**
 * Say what a contact with no record is: Messages' *Who is this?* (`name_contact`). The contact then points at the
 * record, or folds into the contact that already is that record, and its papers follow either way. Returns the contact
 * that holds the papers now. Throws with words the office can act on.
 */
export async function namePartyContact(contactId: string, record: { table: ListRecordTable; id: string }, kind: 'customer' | 'supply_house' | 'trade', name?: string): Promise<string> {
  try {
    // On a company's own row a name says which person there this is: someone the row has no person record for.
    const named = (name ?? '').trim()
    const id = await withSupabaseRetry(
      async () => supabase.rpc('name_contact', { p_contact_id: contactId, p_record_table: record.table, p_record_id: record.id, p_kind: kind, ...(named ? { p_name: named } : {}) }),
      'add them to the list',
    )
    return typeof id === 'string' && id ? id : contactId
  } catch (e) {
    const words = formatErrorMessage(e, '')
    if (words.includes('namedAlready')) throw new Error('Someone has already said who they are. Close this and read the list again.')
    if (words.includes('notFound')) throw new Error('Their record is gone. Close this and read the list again.')
    throw e
  }
}
