/**
 * Messages, cut 1 (the spine): the contacts as the screens load them. Pure mappers from the rows `contacts`,
 * `contact_channels` and `contact_jobs` hold (migration 20261012010000_messages_spine.sql), with the records they point
 * at, to `Contact`. No client here: the hooks that fetch the rows come with the screens (wave 2). Every row is the
 * generated types' own, picked to the columns the mappers read.
 */
import type { Tables } from '../../types/database'
import { jobKeyOfRow } from '../messages/load'
import type { ChannelKind, Contact, ContactChannel, ContactKind, ContactRecord } from './kernel'

/**
 * The id columns of the four kinds of 2026-10-13: a lead, a supply house's counter, a rep at a supply house and a
 * candidate. R0's SQL PR adds them to `contacts`; until it is pushed and the types regenerate they are optional here,
 * and the fetchers select them only after that push, since a column the database lacks fails the whole read.
 */
type NewRecordColumns = Partial<Record<'prospect_id' | 'supply_house_id' | 'supply_house_contact_id' | 'team_prospect_id', string | null>>

/** A `contacts` row as the client reads it. */
export type ContactRow = Pick<
  Tables<'contacts'>,
  | 'id'
  | 'kind'
  | 'customer_id'
  | 'customer_contact_person_id'
  | 'gc_company_id'
  | 'gc_company_person_id'
  | 'person_id'
  | 'name'
  | 'goes_by'
  | 'off_since'
  | 'off_why'
  | 'off_by'
> &
  NewRecordColumns

/** A `contact_channels` row. Its `key` is the database's own, matched there. */
export type ContactChannelRow = Pick<Tables<'contact_channels'>, 'id' | 'contact_id' | 'kind' | 'value' | 'opted_out_at' | 'created_at'>

/** A `contact_jobs` row. */
export type ContactJobRow = Pick<Tables<'contact_jobs'>, 'contact_id' | 'bid_id' | 'project_id' | 'jobs_ledger_id' | 'is_default' | 'created_at'>

/** The records the contacts point at, as much of each as a name, a company and a trade need. */
export interface ContactRecordRows {
  customers?: readonly Pick<Tables<'customers'>, 'id' | 'name'>[]
  customerContactPersons?: readonly Pick<Tables<'customer_contact_persons'>, 'id' | 'customer_id' | 'name'>[]
  gcCompanies?: readonly Pick<Tables<'gc_companies'>, 'id' | 'name' | 'contact_name' | 'trades'>[]
  gcCompanyPeople?: readonly Pick<Tables<'gc_company_people'>, 'id' | 'company_id' | 'name'>[]
  people?: readonly Pick<Tables<'people'>, 'id' | 'name'>[]
  prospects?: readonly Pick<Tables<'prospects'>, 'id' | 'contact_name' | 'company_name'>[]
  supplyHouses?: readonly Pick<Tables<'supply_houses'>, 'id' | 'name'>[]
  supplyHouseContacts?: readonly Pick<Tables<'supply_house_contacts'>, 'id' | 'supply_house_id' | 'name'>[]
  teamProspects?: readonly Pick<Tables<'team_prospects'>, 'id' | 'name'>[]
}

const KINDS: ReadonlySet<string> = new Set<ContactKind>(['customer', 'trade', 'arch', 'lead', 'supply_house', 'candidate', 'sub', 'unknown'])
const CHANNEL_KINDS: ReadonlySet<string> = new Set<ChannelKind>(['phone', 'email'])

/** The record a row points at: the one of its nine columns that is set. Null: a number nobody has named. */
export function contactRecordOfRow(row: ContactRow): ContactRecord {
  if (row.customer_id) return { table: 'customers', id: row.customer_id }
  if (row.customer_contact_person_id) return { table: 'customer_contact_persons', id: row.customer_contact_person_id }
  if (row.gc_company_id) return { table: 'gc_companies', id: row.gc_company_id }
  if (row.gc_company_person_id) return { table: 'gc_company_people', id: row.gc_company_person_id }
  if (row.person_id) return { table: 'people', id: row.person_id }
  if (row.prospect_id) return { table: 'prospects', id: row.prospect_id }
  if (row.supply_house_id) return { table: 'supply_houses', id: row.supply_house_id }
  if (row.supply_house_contact_id) return { table: 'supply_house_contacts', id: row.supply_house_contact_id }
  if (row.team_prospect_id) return { table: 'team_prospects', id: row.team_prospect_id }
  return null
}

const byId = <T extends { id: string }>(rows: readonly T[] | undefined, id: string | null | undefined): T | undefined =>
  id ? rows?.find((r) => r.id === id) : undefined
const trimmed = (s: string | null | undefined) => s?.trim() || ''

/** Who the record says the person is, their company, and a trade partner's trade. Blank where the record says nothing. */
function fromRecord(record: ContactRecord, named: boolean, records: ContactRecordRows): { name: string; company: string; trade: string } {
  const none = { name: '', company: '', trade: '' }
  if (!record) return none
  const tradesOf = (c: { trades: string[] } | undefined) => (c?.trades ?? []).filter(Boolean).join(', ')
  switch (record.table) {
    case 'customers': {
      const c = byId(records.customers, record.id)
      // The customer's own person is the customer; someone it holds by name is at it.
      return { name: trimmed(c?.name), company: named ? trimmed(c?.name) : '', trade: '' }
    }
    case 'customer_contact_persons': {
      const p = byId(records.customerContactPersons, record.id)
      return { name: trimmed(p?.name), company: trimmed(byId(records.customers, p?.customer_id)?.name), trade: '' }
    }
    case 'gc_companies': {
      const c = byId(records.gcCompanies, record.id)
      return { name: trimmed(c?.contact_name) || trimmed(c?.name), company: trimmed(c?.name), trade: tradesOf(c) }
    }
    case 'gc_company_people': {
      const p = byId(records.gcCompanyPeople, record.id)
      const c = byId(records.gcCompanies, p?.company_id)
      return { name: trimmed(p?.name), company: trimmed(c?.name), trade: tradesOf(c) }
    }
    // Someone on the roster, a sub among them: the kind is the contact's own, and `kindOf` gives it from the roster.
    case 'people':
      return { ...none, name: trimmed(byId(records.people, record.id)?.name) }
    case 'prospects': {
      // A lead is the person Prospects names at a company, or the company itself when it names nobody.
      const p = byId(records.prospects, record.id)
      const person = trimmed(p?.contact_name)
      const company = trimmed(p?.company_name)
      return { name: person || company, company: person || named ? company : '', trade: '' }
    }
    case 'supply_houses': {
      // The counter is the house's own person; someone it holds by name is at it, as at a trade partner.
      const h = byId(records.supplyHouses, record.id)
      return { name: trimmed(h?.name), company: named ? trimmed(h?.name) : '', trade: '' }
    }
    case 'supply_house_contacts': {
      const r = byId(records.supplyHouseContacts, record.id)
      return { name: trimmed(r?.name), company: trimmed(byId(records.supplyHouses, r?.supply_house_id)?.name), trade: '' }
    }
    case 'team_prospects':
      return { ...none, name: trimmed(byId(records.teamProspects, record.id)?.name) }
  }
}

/**
 * A contact as the thread reads it. Its name is its own when it has one (a person a company's row has no room for, or
 * a number that kept a deleted person's name), else the record's, else its first number or address. Its numbers come
 * first, then its addresses; its jobs in the order the office added them, with the star apart. Null for a kind this
 * build does not know.
 */
export function contactFromRows(
  row: ContactRow,
  channels: readonly ContactChannelRow[],
  jobs: readonly ContactJobRow[],
  records: ContactRecordRows = {},
): Contact | null {
  if (!KINDS.has(row.kind)) return null
  const record = contactRecordOfRow(row)
  const own = trimmed(row.name)
  const rec = fromRecord(record, Boolean(own), records)
  const mine: ContactChannel[] = channels
    .filter((ch) => ch.contact_id === row.id && CHANNEL_KINDS.has(ch.kind))
    .sort((a, b) => (a.kind === b.kind ? a.created_at.localeCompare(b.created_at) : a.kind === 'phone' ? -1 : 1))
    .map((ch) => ({ id: ch.id, kind: ch.kind as ChannelKind, value: ch.value, optedOutAt: ch.opted_out_at }))
  const myJobs = jobs.filter((j) => j.contact_id === row.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const star = myJobs.find((j) => j.is_default)
  const customerId = row.customer_id ?? byId(records.customerContactPersons, row.customer_contact_person_id)?.customer_id ?? null
  const gcCompanyId = row.gc_company_id ?? byId(records.gcCompanyPeople, row.gc_company_person_id)?.company_id ?? null
  return {
    id: row.id,
    kind: row.kind as ContactKind,
    name: own || rec.name || mine[0]?.value || '',
    goesBy: trimmed(row.goes_by) || null,
    company: rec.company,
    ...(rec.trade ? { trade: rec.trade } : {}),
    record,
    channels: mine,
    jobIds: myJobs.map(jobKeyOfRow).filter((k): k is string => k !== null),
    defaultJobId: star ? jobKeyOfRow(star) : null,
    customerId,
    gcCompanyId,
  }
}

/** The contacts as the thread reads them; a row of a kind this build does not know is left out. */
export function contactsFromRows(
  rows: readonly ContactRow[],
  channels: readonly ContactChannelRow[],
  jobs: readonly ContactJobRow[],
  records: ContactRecordRows = {},
): Contact[] {
  return rows.map((r) => contactFromRows(r, channels, jobs, records)).filter((c): c is Contact => c !== null)
}

/** Off the flow (cut 4's `OffFlow`): since when, why, and who said so, by name. Null: on it. */
export function offFlowFromRow(
  row: Pick<ContactRow, 'off_since' | 'off_why' | 'off_by'>,
  userNames: Readonly<Record<string, string>> = {},
): { since: string; why: string; by: string } | null {
  if (!row.off_since) return null
  return { since: row.off_since, why: trimmed(row.off_why), by: row.off_by ? (userNames[row.off_by] ?? '') : '' }
}
