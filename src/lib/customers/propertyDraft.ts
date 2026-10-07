import type { PropertyRecordDraft } from '../../components/customers/CustomerPropertyRecordPanel'
import type { CustomerAddressRow } from '../jobs/lienProperty'

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
  /** Present only when the draft carries the precinct (v2.4771): a typed value is `hand` and clears the on-the-line note; an empty value clears all three. */
  jp_precinct?: string
  jp_precinct_source?: string
  jp_precinct_note?: string
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
    ...precinctPayload(d),
  }
}

/** The precinct columns when the draft carries them: hand wins and clears the note; a map value passes through untouched. */
function precinctPayload(d: PropertyDraft): Pick<PropertyDraftPayload, 'jp_precinct' | 'jp_precinct_source' | 'jp_precinct_note'> | Record<string, never> {
  if (d.jp_precinct === undefined) return {}
  const v = d.jp_precinct.trim()
  if (!v) return { jp_precinct: '', jp_precinct_source: '', jp_precinct_note: '' }
  const source = d.jp_precinct_source === 'map' ? 'map' : 'hand'
  return source === 'hand' ? { jp_precinct: v, jp_precinct_source: 'hand', jp_precinct_note: '' } : { jp_precinct: v, jp_precinct_source: 'map' }
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
    jp_precinct: '',
    jp_precinct_source: '',
  }
}


/** A saved `customer_addresses` row as an editable draft (Edit customer's Properties, and the Lien desk's fix window, v2.4719). */
export function draftFromRow(a: CustomerAddressRow): PropertyDraft {
  return {
    address: a.address,
    note: a.note ?? '',
    county: a.county ?? '',
    county_source: a.county_source ?? '',
    legal_description: a.legal_description ?? '',
    property_kind: a.property_kind ?? '',
    homestead: a.homestead ?? false,
    owner_mode: a.owner_mode ?? '',
    owner_name: a.owner_name ?? '',
    owner_company: a.owner_company ?? '',
    owner_mailing_address: a.owner_mailing_address ?? '',
    parcel_id: a.parcel_id ?? '',
    parcel_source: a.parcel_source ?? '',
    parcel_tax_year: a.parcel_tax_year ?? '',
    parcel_looked_up_at: a.parcel_looked_up_at ?? '',
    jp_precinct: ((a as { jp_precinct?: string | null }).jp_precinct ?? '').trim(),
    jp_precinct_source: ((a as { jp_precinct_source?: string | null }).jp_precinct_source ?? '').trim(),
  }
}

/** What the record says beside its precinct: where it came from. */
export function precinctSourceWords(d: Pick<PropertyDraft, 'jp_precinct' | 'jp_precinct_source'>): string {
  if (!(d.jp_precinct ?? '').trim()) return "not yet — the office's court map fills it in nightly, or type it from the county's map"
  return d.jp_precinct_source === 'map' ? "from the office's court map · type over it to settle it by hand" : 'typed by hand · the map never changes it'
}
