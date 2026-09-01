import { describe, expect, it } from 'vitest'
import {
  customerAddressLienGaps,
  customerAddressLienReady,
  lienPropertyOwnerDisplayName,
  resolveLienProperty,
  suggestCustomerAddressForJob,
  type CustomerAddressRow,
} from './lienProperty'
import { suggestTxCountyForCity, txCountyCadSearchUrl } from '../txCountyLookup'

function addressRow(overrides: Partial<CustomerAddressRow>): CustomerAddressRow {
  return {
    id: 'addr-1',
    customer_id: 'cust-1',
    address: '415 Springtown Way, San Marcos, TX 78666',
    note: null,
    sequence_order: 0,
    created_at: null,
    updated_at: null,
    county: '',
    legal_description: '',
    property_kind: '',
    homestead: false,
    owner_mode: '',
    owner_name: '',
    owner_company: '',
    owner_mailing_address: '',
    ...overrides,
  }
}

describe('resolveLienProperty', () => {
  const legalRow = addressRow({
    county: 'Hays',
    legal_description: 'Lot 3, Block A, Springtown Commercial Park',
    property_kind: 'non_residential',
    owner_mode: 'building_owner',
    owner_company: 'Springtown Holdings LLC',
    owner_mailing_address: 'PO Box 1420, San Marcos, TX 78667',
  })

  it('takes county/legal/kind from the address row, owner from its record', () => {
    const r = resolveLienProperty(legalRow, null)
    expect(r.county).toBe('Hays')
    expect(r.legalDescription).toContain('Lot 3')
    expect(r.propertyKind).toBe('non_residential')
    expect(r.owner.source).toBe('property_record')
    expect(r.owner.mailingAddress).toBe('PO Box 1420, San Marcos, TX 78667')
    expect(lienPropertyOwnerDisplayName(r.owner)).toBe('Springtown Holdings LLC')
  })

  it('the per-job owner override wins over the property record owner', () => {
    const r = resolveLienProperty(legalRow, {
      owner_mode: 'homeowner',
      owner_name: 'Jo Home',
      company_name: null,
      mailing_address: '9 Oak Ln, Kyle, TX 78640',
    })
    expect(r.owner.source).toBe('job_override')
    expect(lienPropertyOwnerDisplayName(r.owner)).toBe('Jo Home')
    // County/legal still come from the property record.
    expect(r.county).toBe('Hays')
  })

  it('no rows → nothing guessed', () => {
    const r = resolveLienProperty(null, null)
    expect(r.county).toBe('')
    expect(r.legalDescription).toBe('')
    expect(r.homestead).toBe(false)
    expect(r.owner.source).toBe('none')
    expect(lienPropertyOwnerDisplayName(r.owner)).toBe('')
  })

  it('an empty override does not shadow the property record', () => {
    const r = resolveLienProperty(legalRow, { owner_mode: 'homeowner', owner_name: '  ', company_name: '', mailing_address: null })
    expect(r.owner.source).toBe('property_record')
  })
})

describe('lien-ready + gaps', () => {
  it('ready needs county + legal description + named owner + mailing address', () => {
    expect(
      customerAddressLienReady(
        addressRow({ county: 'Hays', legal_description: 'Lot 3', owner_company: 'X LLC', owner_mailing_address: 'PO Box 1' }),
      ),
    ).toBe(true)
    expect(customerAddressLienReady(addressRow({ county: 'Hays', legal_description: 'Lot 3' }))).toBe(false)
  })
  it('gaps name what is missing', () => {
    expect(customerAddressLienGaps(addressRow({ county: 'Hays' }))).toEqual([
      'legal description',
      'owner of record',
      'owner mailing address',
    ])
    expect(customerAddressLienGaps(addressRow({ county: 'Hays', legal_description: 'L', owner_name: 'A', owner_mailing_address: 'M' }))).toEqual([])
  })
})

describe('suggestCustomerAddressForJob', () => {
  const rows = [
    addressRow({ id: 'a1', address: '415 Springtown Way, San Marcos, TX 78666' }),
    addressRow({ id: 'a2', address: '112 Hospital Way, San Marcos, TX' }),
  ]
  it('matches the full normalized address', () => {
    expect(suggestCustomerAddressForJob('  415 springtown  way, san marcos, tx 78666 ', rows)?.id).toBe('a1')
  })
  it('falls back to the street line when city/zip formatting differs', () => {
    expect(suggestCustomerAddressForJob('415 Springtown Way, San Marcos TX', rows)?.id).toBe('a1')
  })
  it('no match → null (never guesses)', () => {
    expect(suggestCustomerAddressForJob('9 Elm St, Dallas, TX', rows)).toBeNull()
    expect(suggestCustomerAddressForJob('', rows)).toBeNull()
  })
})

describe('txCountyLookup', () => {
  it('suggests counties for service-area cities, case-insensitively', () => {
    expect(suggestTxCountyForCity('San Marcos')).toBe('Hays')
    expect(suggestTxCountyForCity('  new   braunfels ')).toBe('Comal')
    expect(suggestTxCountyForCity('SCHERTZ')).toBe('Guadalupe')
    expect(suggestTxCountyForCity('Boerne')).toBe('Kendall')
    expect(suggestTxCountyForCity('Nowhereville')).toBe('')
    expect(suggestTxCountyForCity('')).toBe('')
  })
  it('returns a CAD search URL per county, tolerant of case', () => {
    expect(txCountyCadSearchUrl('Hays')).toContain('hayscad')
    expect(txCountyCadSearchUrl('bexar')).toContain('bexar')
    expect(txCountyCadSearchUrl('Unknown County')).toBe('')
  })
})
