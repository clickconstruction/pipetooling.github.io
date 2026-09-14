import type { PropertyRecordDraft } from '../../components/customers/CustomerPropertyRecordPanel'

/** One property's editable fields on Edit customer (v2.3009): address + note + the legal record draft. */
export type PropertyDraft = PropertyRecordDraft & { address: string; note: string }

/** The `customer_addresses` columns a draft writes (shared by Edit customer's Properties and the job form's add-from-job sheet, v2.3401). */
export type PropertyDraftPayload = {
  address: string
  note: string | null
  county: string
  county_source: string
  legal_description: string
  property_kind: string
  homestead: boolean
  owner_mode: string
  owner_name: string
  owner_company: string
  owner_mailing_address: string
  parcel_id: string
  parcel_source: string
  parcel_tax_year: string
  parcel_looked_up_at: string | null
  updated_at: string
}

/**
 * Trim the draft into the row payload. A county source only means something
 * with a county beside it; an empty note or lookup stamp writes NULL, not ''.
 */
export function payloadFromDraft(d: PropertyDraft, now: Date = new Date()): PropertyDraftPayload {
  return {
    address: d.address.trim(),
    note: d.note.trim() || null,
    county: d.county.trim(),
    county_source: d.county.trim() ? d.county_source : '',
    legal_description: d.legal_description.trim(),
    property_kind: d.property_kind,
    homestead: d.homestead,
    owner_mode: d.owner_mode,
    owner_name: d.owner_name.trim(),
    owner_company: d.owner_company.trim(),
    owner_mailing_address: d.owner_mailing_address.trim(),
    parcel_id: d.parcel_id.trim(),
    parcel_source: d.parcel_source.trim(),
    parcel_tax_year: d.parcel_tax_year.trim(),
    parcel_looked_up_at: d.parcel_looked_up_at.trim() || null,
    updated_at: now.toISOString(),
  }
}

export function emptyPropertyDraft(address = ''): PropertyDraft {
  return {
    address,
    note: '',
    county: '',
    county_source: '',
    legal_description: '',
    property_kind: '',
    homestead: false,
    owner_mode: '',
    owner_name: '',
    owner_company: '',
    owner_mailing_address: '',
    parcel_id: '',
    parcel_source: '',
    parcel_tax_year: '',
    parcel_looked_up_at: '',
  }
}

