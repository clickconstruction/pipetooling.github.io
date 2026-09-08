import type { PropertyRecordDraft } from '../../components/customers/CustomerPropertyRecordPanel'

/** One property's editable fields on Edit customer (v2.3009): address + note + the legal record draft. */
export type PropertyDraft = PropertyRecordDraft & { address: string; note: string }

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

