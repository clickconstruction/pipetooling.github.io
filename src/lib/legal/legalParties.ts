/**
 * The parties strip (punch list #219, v2.6172): the three facts an attorney asks first, read
 * from the packet into three cells under the account's name — who we have a contract with,
 * who owns the building, and the venue. Each cell is a name, one quiet line of what the
 * record says, and a door: the customer, the property record, or the map. The words are
 * the record's; nothing is guessed. An amber cell is a gap, and its door is the record that
 * fills it. Pure: no React, no supabase; the desk and the firm's portal read one rule.
 */
import type { JobContractCoverage } from '../jobs/jobContractCoverage'
import { joinSignerNames } from '../jobs/jobContractSigners'
import { countyWords } from './firmCounties'
import { cityOfAddress, type VenueCounty } from './firmForAccount'
import { justiceCourtCap } from './jpVenue'
import { formatLegalMoney } from './legalPacket'
import type { LegalPropertyLine } from './legalProperty'

export type PartyDoor =
  /** Edit customer (the payer's record). */
  | 'edit_customer'
  /** The payer is a name only: link the job to a customer record. */
  | 'link_customer'
  /** The property record on the customer's profile, where the owner of record is typed. */
  | 'property_record'
  /** The map. */
  | 'venue'

export type PartyCellKey = 'contract' | 'owner' | 'contract_owner' | 'venue'

export type PartyCell = {
  key: PartyCellKey
  /** The eyebrow: `Contract with` · `Owns the building` · `Contract with · owns the building` · `Owns the buildings` · `Venue`. */
  label: string
  /** The name, bold. */
  main: string
  /** One quiet line: what the record says. */
  quiet: string
  /** A gap: the main words name it and the door fills it. */
  amber: boolean
  door: PartyDoor
  /** The hover and screen-reader words for the door. */
  title: string
}

export type PartiesStrip = {
  cells: PartyCell[]
  /** The line under the account's name: the job numbers and the building's address, never the payer's office. */
  addressLine: string
}

export type PartiesProperty = Pick<LegalPropertyLine, 'address' | 'county' | 'precinct' | 'precinctNote' | 'owner' | 'ownerMailingAddress' | 'ownerSource' | 'propertyKind' | 'homestead' | 'source' | 'jobLabels'>

export type PartiesInput = {
  payer: { name: string; viaGc: boolean; customerId: string | null }
  /** `customers.customer_type`, '' when none. */
  customerType: string
  customerAddress: string
  /** The payer's county and precinct from its own record (the defendant's venue), '' when none. */
  customerCounty: string
  customerPrecinct: string
  agreements: ReadonlyArray<{ jobLabel: string; coverage: JobContractCoverage }>
  properties: ReadonlyArray<PartiesProperty>
  jobs: ReadonlyArray<{ label: string; address: string }>
  /** The venue counties as `firmForAccount` grouped them, largest balance first; '' county last. */
  counties: ReadonlyArray<Pick<VenueCounty, 'county' | 'balance'>>
  balance: number
}

export const PARTY_LABELS = {
  contract: 'Contract with',
  owner: 'Owns the building',
  owners: 'Owns the buildings',
  contract_owner: 'Contract with · owns the building',
  venue: 'Venue',
} as const

export const NO_PROPERTY_RECORD_WORDS = { main: 'No property record', quiet: 'Link the job to its property record.' } as const
export const OWNER_NOT_ON_RECORD_WORDS = { main: 'Not on the record', quiet: 'Add the owner to the property record.' } as const
export const COUNTY_UNKNOWN_WORDS = { main: 'County unknown', quiet: 'The same record names it.' } as const
export const NAME_ONLY_WORDS = 'name only, no customer record. Link a customer.'

/** `homeowner` · `commercial customer` · `customer` · `general contractor`. */
export function payerRoleWords(payer: { viaGc: boolean }, customerType: string): string {
  if (payer.viaGc) return 'general contractor'
  const t = customerType.trim().toLowerCase()
  if (t === 'residential') return 'homeowner'
  if (t === 'commercial') return 'commercial customer'
  return 'customer'
}

/** `subcontract signed by R. Vance` · `agreement signed` · `1 of 2 signed` · `agreement sent, not signed` · `no agreement of ours needed` · `no signed agreement`. */
export function contractStateWords(agreements: ReadonlyArray<{ coverage: JobContractCoverage }>, viaGc: boolean): string {
  const paper = viaGc ? 'subcontract' : 'agreement'
  const signed = agreements.filter((a) => a.coverage.kind === 'signed')
  if (agreements.length === 0) return `no signed ${paper}`
  if (signed.length === agreements.length) {
    const names = new Set<string>()
    for (const a of signed) {
      const c = a.coverage
      if (c.kind !== 'signed') continue
      const list = c.signerNames?.length ? c.signerNames : c.signerName ? [c.signerName] : []
      for (const n of list) if (n.trim()) names.add(n.trim())
    }
    const by = joinSignerNames([...names])
    const head = agreements.length === 1 ? paper : `${agreements.length} ${paper}s`
    return by ? `${head} signed by ${by}` : `${head} signed`
  }
  if (signed.length > 0) return `${signed.length} of ${agreements.length} signed`
  if (agreements.every((a) => a.coverage.kind === 'not_needed')) return 'no agreement of ours needed'
  if (agreements.some((a) => a.coverage.kind === 'sent')) return `${paper} sent, not signed`
  return `no signed ${paper}`
}

/** `Lubbock, TX` from a one-line address, '' when the line has no city. */
export function cityStateWords(address: string): string {
  const city = cityOfAddress(address)
  return city ? `${city}, TX` : ''
}

/** `Denver, CO` from an owner's mailing address: the city and the state after the last comma pair; '' when the line has no such shape. */
export function mailsToWords(address: string): string {
  const m = /,\s*([^,]+?)\s*,\s*([A-Z]{2})\b/i.exec(address.trim())
  if (m) return `${m[1]!.trim()}, ${m[2]!.toUpperCase()}`
  const tx = cityOfAddress(address)
  return tx ? `${tx}, TX` : ''
}

/** `residential` · `commercial` · `homestead`, as the record says; '' when it does not. */
export function propertyKindWords(p: Pick<PartiesProperty, 'propertyKind' | 'homestead'>): string {
  if (p.homestead) return 'homestead'
  const k = (p.propertyKind ?? '').trim()
  if (k === 'residential') return 'residential'
  if (k === 'non_residential') return 'commercial'
  return ''
}

/** `Justice Court, Precinct 2` · `justice precinct not yet`. */
export function precinctWords(p: { precinct?: string; precinctNote?: string } | null): string {
  const note = (p?.precinctNote ?? '').trim()
  const n = (p?.precinct ?? '').trim()
  if (note) return `Justice Court, Precinct ${note}`
  if (n) return `Justice Court, Precinct ${n}`
  return 'justice precinct not yet'
}

function join(parts: ReadonlyArray<string>): string {
  return parts.filter(Boolean).join(' · ')
}

function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return Boolean(a.trim()) && norm(a) === norm(b)
}

/** The payer's short name for a sentence: the first word of a company, the surname of a person is not guessed, so the whole name under four words. */
export function payerShortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 3) return name.trim()
  return words.slice(0, 2).join(' ')
}

export function partiesStrip(input: PartiesInput): PartiesStrip {
  const { payer } = input
  const role = payerRoleWords(payer, input.customerType)
  const contract = contractStateWords(input.agreements, payer.viaGc)
  const city = cityStateWords(input.customerAddress)

  // The buildings: every property with a record, the distinct owners of record.
  const recorded = input.properties.filter((p) => p.source !== 'job_address')
  const owned = recorded.filter((p) => p.owner.trim())
  const owners = [...new Set(owned.map((p) => p.owner.trim()))]
  const lead = owned[0] ?? recorded[0] ?? null

  const cells: PartyCell[] = []

  const contractCell = (): PartyCell =>
    payer.customerId
      ? { key: 'contract', label: PARTY_LABELS.contract, main: payer.name, quiet: join([role, contract, city]), amber: false, door: 'edit_customer', title: 'Opens Edit customer' }
      : { key: 'contract', label: PARTY_LABELS.contract, main: payer.name, quiet: NAME_ONLY_WORDS, amber: true, door: 'link_customer', title: 'Link the job to a customer record' }

  if (owners.length === 1 && !payer.viaGc && payer.customerId && sameName(owners[0]!, payer.name)) {
    // A direct job whose customer is the owner of record: one cell, since the two facts are one person.
    cells.push({
      key: 'contract_owner',
      label: PARTY_LABELS.contract_owner,
      main: payer.name,
      quiet: join([role, 'owner of record', lead ? propertyKindWords(lead) : '', contract, city]),
      amber: false,
      door: 'edit_customer',
      title: 'Opens Edit customer, where the property record is',
    })
  } else {
    cells.push(contractCell())
    if (recorded.length === 0) {
      cells.push({ key: 'owner', label: PARTY_LABELS.owner, main: NO_PROPERTY_RECORD_WORDS.main, quiet: NO_PROPERTY_RECORD_WORDS.quiet, amber: true, door: 'property_record', title: 'Opens Edit customer, where the property record is linked' })
    } else if (owners.length === 0) {
      cells.push({ key: 'owner', label: PARTY_LABELS.owner, main: OWNER_NOT_ON_RECORD_WORDS.main, quiet: OWNER_NOT_ON_RECORD_WORDS.quiet, amber: true, door: 'property_record', title: 'Opens Edit customer, where the owner of record is typed' })
    } else if (owners.length === 1) {
      const p = owned[0]!
      const mails = mailsToWords(p.ownerMailingAddress)
      cells.push({
        key: 'owner',
        label: owned.length > 1 ? PARTY_LABELS.owners : PARTY_LABELS.owner,
        main: owners[0]!,
        quiet: join([owned.length > 1 ? `owner of record on ${owned.length} buildings` : 'owner of record', mails ? `mails to ${mails}` : '', propertyKindWords(p)]),
        amber: false,
        door: 'property_record',
        title: 'Opens Edit customer, where the property record is',
      })
    } else {
      cells.push({
        key: 'owner',
        label: PARTY_LABELS.owners,
        main: `${owned.length} buildings · ${owners.length} owners`,
        quiet: owners.join(' · '),
        amber: false,
        door: 'property_record',
        title: 'Opens Edit customer, where the property records are',
      })
    }
  }

  // The venue: the county where the work was done, then the defendant's county when it differs.
  const known = input.counties.filter((c) => c.county.trim())
  if (known.length === 0) {
    cells.push({ key: 'venue', label: PARTY_LABELS.venue, main: COUNTY_UNKNOWN_WORDS.main, quiet: COUNTY_UNKNOWN_WORDS.quiet, amber: true, door: 'property_record', title: 'Opens Edit customer, where the property record names the county' })
  } else {
    const leadCounty = known[0]!.county
    const leadProperty = input.properties.find((p) => p.county.trim().toLowerCase() === leadCounty.trim().toLowerCase()) ?? null
    const main = known.length === 1
      ? `${countyWords(leadCounty)} · ${precinctWords(leadProperty)}`
      : known.map((c) => `${countyWords(c.county)} (${formatLegalMoney(c.balance).replace(/\.00$/, '')})`).join(' · ')
    const defendant = input.customerCounty.trim()
    const they = payer.viaGc ? 'are' : input.customerType.trim().toLowerCase() === 'residential' ? 'live' : 'are'
    const where = !defendant
      ? 'where the work was done'
      : known.some((c) => c.county.trim().toLowerCase() === defendant.toLowerCase())
        ? `where the work was done and where they ${they}`
        : `where the work was done · or ${countyWords(defendant)}, where ${payerShortName(payer.name)} is`
    cells.push({
      key: 'venue',
      label: PARTY_LABELS.venue,
      main,
      quiet: join([where, justiceCourtCap(input.balance).chip]),
      amber: false,
      door: 'venue',
      title: 'Brings up the map on this county',
    })
  }

  // The line under the name: the job numbers, then the building's address.
  const labels = input.jobs.map((j) => j.label.trim()).filter(Boolean)
  const addresses = [...new Set(input.jobs.map((j) => j.address.trim()).filter(Boolean))]
  const first = addresses[0] ?? ''
  const more = addresses.length > 1 ? `${addresses.length - 1} more` : ''
  const addressLine = join([labels.join(' · '), first, more])

  return { cells, addressLine }
}
