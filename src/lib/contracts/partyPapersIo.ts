/**
 * The party's own page (punch list #403, step 4): the reads. Three steps, each under its table's own row security: the
 * people at the party, the contacts that are the party or one of its people, and the papers with those contacts. Every
 * kind of paper and every state is read, since the page lists a W-9 and a paper that was never sent too. A long list
 * of people or contacts is asked in chunks and paged, so nothing is cut at 1,000 rows. Browser io, not pure; the rule
 * for which papers are a party's is `partyPapers.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { papersOfParty, partyContactIds, type PartyContactRow, type PartyPaperRow, type PartyRecord } from './partyPapers'

/**
 * The papers' three site columns are younger than the generated types (punch list #439), which would read them as
 * missing. The read of the papers goes through the client cast once here, and its rows are `PartyPaperRow`.
 */
const papersDb = supabase as unknown as SupabaseClient

const CONTACT_SELECT = 'id, customer_id, customer_contact_person_id, supply_house_id, supply_house_contact_id'

export const PARTY_PAPER_SELECT =
  'id, document_name, doc_type, status, party_contact_id, signer_name, signer_title, signer_printed_name, signing_for, signed_at, sent_at, created_at, signer_last_viewed_at, supersedes_person_contract_document_id, site_address, site_address_key, site_development_id'

/** The people at a party: the people on file at a customer, or the reps of a supply house, archived ones among them. */
async function readPartyPeopleIds(party: PartyRecord): Promise<string[]> {
  const rows =
    party.kind === 'customer'
      ? await fetchAllRows<{ id: string }>((from, to) => supabase.from('customer_contact_persons').select('id').eq('customer_id', party.id).order('id').range(from, to), 'read the people at the customer')
      : await fetchAllRows<{ id: string }>((from, to) => supabase.from('supply_house_contacts').select('id').eq('supply_house_id', party.id).order('id').range(from, to), 'read the reps')
  return rows.map((r) => r.id).filter(Boolean)
}

/** The contacts that are a party or one of its people. Reads only: a party with no contact yet has no paper. */
async function readPartyContacts(party: PartyRecord, peopleIds: string[]): Promise<PartyContactRow[]> {
  const own = party.kind === 'customer' ? 'customer_id' : 'supply_house_id'
  const person = party.kind === 'customer' ? 'customer_contact_person_id' : 'supply_house_contact_id'
  const [ownRows, peopleRows] = await Promise.all([
    withSupabaseRetry(async () => supabase.from('contacts').select(CONTACT_SELECT).eq(own, party.id), 'read who the papers are with'),
    fetchAllRowsChunkedIn<PartyContactRow, string>(peopleIds, (chunk, from, to) => supabase.from('contacts').select(CONTACT_SELECT).in(person, chunk).order('id').range(from, to), 'read who the papers are with'),
  ])
  return [...((ownRows ?? []) as PartyContactRow[]), ...peopleRows]
}

/** A party's papers, newest first: every kind and every state the reader's role is answered. Throws with the reason. */
export async function readPartyPapers(party: PartyRecord): Promise<PartyPaperRow[]> {
  if (!party.id) return []
  const peopleIds = await readPartyPeopleIds(party)
  const contactIds = partyContactIds(party, peopleIds, await readPartyContacts(party, peopleIds))
  const rows = await fetchAllRowsChunkedIn<PartyPaperRow, string>(
    contactIds,
    (chunk, from, to) => papersDb.from('person_contract_documents').select(PARTY_PAPER_SELECT).in('party_contact_id', chunk).order('id').range(from, to),
    'read their papers',
  )
  return papersOfParty(rows, contactIds)
}
