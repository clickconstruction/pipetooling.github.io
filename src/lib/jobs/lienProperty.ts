import type { Database } from '../../types/database'

/**
 * Property resolution for lien documents (v2.2614, Lien Instruments phase 1).
 * A job's lien-relevant facts come from, in order:
 *   1. the per-job `job_property_owners` override (owner block only — still wins),
 *   2. the linked `customer_addresses` row (county, legal description,
 *      kind/homestead, owner of record),
 *   3. nothing — legal identity is never guessed.
 * Pure kernel; callers fetch the rows.
 */

export type CustomerAddressRow = Database['public']['Tables']['customer_addresses']['Row']

export type LienPropertyOwner = {
  ownerMode: string
  ownerName: string
  ownerCompany: string
  mailingAddress: string
  /** Which record supplied the owner block. */
  source: 'job_override' | 'property_record' | 'none'
}

export type ResolvedLienProperty = {
  county: string
  legalDescription: string
  /** '' | 'residential' | 'non_residential' */
  propertyKind: string
  homestead: boolean
  owner: LienPropertyOwner
}

export type JobPropertyOwnerLike = {
  owner_mode: string | null
  owner_name: string | null
  company_name: string | null
  mailing_address: string | null
  /** Present when the caller selected it — used for courtesy email sends. */
  owner_email?: string | null
} | null

const NO_OWNER: LienPropertyOwner = { ownerMode: '', ownerName: '', ownerCompany: '', mailingAddress: '', source: 'none' }

export function resolveLienProperty(
  addressRow: CustomerAddressRow | null,
  jobOwnerOverride: JobPropertyOwnerLike,
): ResolvedLienProperty {
  const overrideName = (jobOwnerOverride?.owner_name ?? '').trim()
  const overrideCompany = (jobOwnerOverride?.company_name ?? '').trim()
  const overrideMailing = (jobOwnerOverride?.mailing_address ?? '').trim()
  let owner: LienPropertyOwner = NO_OWNER
  if (overrideName || overrideCompany || overrideMailing) {
    owner = {
      ownerMode: (jobOwnerOverride?.owner_mode ?? '').trim(),
      ownerName: overrideName,
      ownerCompany: overrideCompany,
      mailingAddress: overrideMailing,
      source: 'job_override',
    }
  } else if (addressRow) {
    const rowName = (addressRow.owner_name ?? '').trim()
    const rowCompany = (addressRow.owner_company ?? '').trim()
    const rowMailing = (addressRow.owner_mailing_address ?? '').trim()
    if (rowName || rowCompany || rowMailing) {
      owner = {
        ownerMode: (addressRow.owner_mode ?? '').trim(),
        ownerName: rowName,
        ownerCompany: rowCompany,
        mailingAddress: rowMailing,
        source: 'property_record',
      }
    }
  }
  return {
    county: (addressRow?.county ?? '').trim(),
    legalDescription: (addressRow?.legal_description ?? '').trim(),
    propertyKind: (addressRow?.property_kind ?? '').trim(),
    homestead: addressRow?.homestead ?? false,
    owner,
  }
}

/** Company-first for building owners, person-first otherwise. '' when no owner. */
export function lienPropertyOwnerDisplayName(owner: LienPropertyOwner): string {
  return owner.ownerMode === 'building_owner'
    ? owner.ownerCompany || owner.ownerName
    : owner.ownerName || owner.ownerCompany
}

/**
 * "Lien-ready" = everything a mechanic's lien affidavit needs from the
 * property record: county, legal description, and an owner of record with a
 * mailing address. (Notices and role logic are checked elsewhere.)
 */
export function customerAddressLienReady(row: Pick<CustomerAddressRow, 'county' | 'legal_description' | 'owner_name' | 'owner_company' | 'owner_mailing_address'>): boolean {
  const ownerNamed = Boolean((row.owner_name ?? '').trim() || (row.owner_company ?? '').trim())
  return Boolean((row.county ?? '').trim()) && Boolean((row.legal_description ?? '').trim()) && ownerNamed && Boolean((row.owner_mailing_address ?? '').trim())
}

/** Same trim/lowercase/collapse rule as the duplicate-address finder. */
export function normalizeAddressForMatch(address: string): string {
  return (address ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Suggest which property record a job sits at: exact normalized match on the
 * full address, else a street-line match (address up to the first comma).
 * Suggestion only — a person confirms the link.
 */
export function suggestCustomerAddressForJob(
  jobAddress: string,
  rows: CustomerAddressRow[],
): CustomerAddressRow | null {
  const key = normalizeAddressForMatch(jobAddress)
  if (!key) return null
  const exact = rows.find((r) => normalizeAddressForMatch(r.address) === key)
  if (exact) return exact
  const street = key.split(',')[0]?.trim() ?? ''
  if (!street) return null
  return rows.find((r) => (normalizeAddressForMatch(r.address).split(',')[0]?.trim() ?? '') === street) ?? null
}

/** What's still missing for the lien-ready chip's tooltip/summary. */
export function customerAddressLienGaps(row: Pick<CustomerAddressRow, 'county' | 'legal_description' | 'owner_name' | 'owner_company' | 'owner_mailing_address'>): string[] {
  const gaps: string[] = []
  if (!(row.county ?? '').trim()) gaps.push('county')
  if (!(row.legal_description ?? '').trim()) gaps.push('legal description')
  if (!((row.owner_name ?? '').trim() || (row.owner_company ?? '').trim())) gaps.push('owner of record')
  if (!(row.owner_mailing_address ?? '').trim()) gaps.push('owner mailing address')
  return gaps
}
