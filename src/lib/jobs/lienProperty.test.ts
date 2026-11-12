import { describe, expect, it } from 'vitest'
import {
  customerAddressLienGaps,
  customerAddressLienReady,
  lienAttentionLine,
  lienPropertyOwnerDisplayName,
  resolveLienProperty,
  suggestCustomerAddressForJob,
  type CustomerAddressRow,
} from './lienProperty'
import {
  formatExtraTxCountyMappingsText,
  parseExtraTxCountyMappingsText,
  setExtraTxCountyMappings,
  suggestTxCountyForCity,
  txCountyCadSearchUrl,
} from '../txCountyLookup'

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
    homestead_answered_at: null,
    owner_mode: '',
    owner_name: '',
    owner_company: '',
    owner_mailing_address: '',
    owner_email: '',
    owner_phone: '',
    county_source: '',
    parcel_id: '',
    parcel_source: '',
    parcel_tax_year: '',
    jp_precinct: '',
    jp_precinct_at: null,
    jp_precinct_note: '',
    jp_precinct_source: '',
    parcel_looked_up_at: null,
    owner_confirmed_at: null,
    owner_confirmed_by: null,
    is_primary: false,
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

  it('the owner’s email and phone come from the source that names the owner, a blank there from the record (v2.6497)', () => {
    // The record carries the columns once migration 20261104163131 lands; the test row carries them as the generated type will.
    const contactRow = { ...legalRow, owner_email: 'office@springtown.example', owner_phone: '(512) 555-0142' } as CustomerAddressRow
    expect(resolveLienProperty(contactRow, null).owner).toMatchObject({ source: 'property_record', email: 'office@springtown.example', phone: '(512) 555-0142' })
    // The override names the owner and gives its own email: that email, and the record's phone where the override has none.
    const override = { owner_mode: 'building_owner', owner_name: '', company_name: 'Typed Owner LLC', mailing_address: '1 Main St', owner_email: ' typed@owner.example ' }
    expect(resolveLienProperty(contactRow, override).owner).toMatchObject({ source: 'job_override', email: 'typed@owner.example', phone: '(512) 555-0142' })
    expect(resolveLienProperty(contactRow, { ...override, owner_phone: '512-555-0199' }).owner.phone).toBe('512-555-0199')
    // An older row without the columns, and no row at all: nothing is guessed.
    expect(resolveLienProperty(legalRow, null).owner).toMatchObject({ email: '', phone: '' })
    expect(resolveLienProperty(null, null).owner).toMatchObject({ email: '', phone: '', source: 'none' })
  })

  it('an empty override does not shadow the property record', () => {
    const r = resolveLienProperty(legalRow, { owner_mode: 'homeowner', owner_name: '  ', company_name: '', mailing_address: null })
    expect(r.owner.source).toBe('property_record')
  })
})

describe('resolveLienProperty · the homestead answer (punch list #305)', () => {
  const legalRow = { county: 'Bexar', legal_description: 'LOT 1', property_kind: 'residential', homestead: false, owner_mode: 'homeowner', owner_name: 'Pat Owner', owner_company: '', owner_mailing_address: '4 Owner Ct' } as never
  it('says whether a person answered, and nothing off a row without the column or with no record at all', () => {
    expect(resolveLienProperty({ ...(legalRow as object), homestead_answered_at: null } as never, null).homesteadAnswered).toBe(false)
    expect(resolveLienProperty({ ...(legalRow as object), homestead_answered_at: '2026-11-17T15:00:00Z' } as never, null).homesteadAnswered).toBe(true)
    expect(resolveLienProperty(legalRow, null).homesteadAnswered).toBeNull()
    expect(resolveLienProperty(null, null).homesteadAnswered).toBeNull()
  })
})

describe('an attention line is never the owner (punch list #314)', () => {
  const owner = (over: Partial<Parameters<typeof lienPropertyOwnerDisplayName>[0]>) => ({ ownerMode: 'building_owner', ownerName: 'SAMPLE CITY OF', ownerCompany: 'ATTN REAL ESTATE MANAGER', mailingAddress: '1 Civic Dr', email: '', phone: '', source: 'property_record' as const, ...over })
  it('a building owner whose company box holds ATTN prints the owner’s name', () => {
    expect(lienPropertyOwnerDisplayName(owner({}))).toBe('SAMPLE CITY OF')
    expect(lienPropertyOwnerDisplayName(owner({ ownerCompany: 'c/o Sample Management' }))).toBe('SAMPLE CITY OF')
    expect(lienPropertyOwnerDisplayName(owner({ ownerCompany: 'Sample Holdings LLC' }))).toBe('Sample Holdings LLC')
    expect(lienPropertyOwnerDisplayName(owner({ ownerMode: 'homeowner', ownerName: 'Attention: Billing', ownerCompany: 'Sample Holdings LLC' }))).toBe('Sample Holdings LLC')
  })
  it('knows an attention line by how it opens, not by a word inside a name', () => {
    for (const line of ['ATTN REAL ESTATE MANAGER', 'Attn: Tax Dept', 'attention accounts payable', 'C/O Sample Trust', '% Sample Agent']) expect(lienAttentionLine(line), line).toBe(true)
    for (const name of ['Attnang Holdings LLC', 'Sample Attention Media', '', null]) expect(lienAttentionLine(name), String(name)).toBe(false)
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

  it('org extras (v2.2638): parse "City = County" lines, extras override built-ins', () => {
    expect(parseExtraTxCountyMappingsText('Devine = Medina\n\njunk line\nPoteet=Atascosa\n San Marcos = Comal ')).toEqual({
      devine: 'Medina',
      poteet: 'Atascosa',
      'san marcos': 'Comal',
    })
    try {
      setExtraTxCountyMappings(parseExtraTxCountyMappingsText('Devine = Medina\nSan Marcos = Comal'))
      expect(suggestTxCountyForCity('Devine')).toBe('Medina')
      expect(suggestTxCountyForCity('San Marcos')).toBe('Comal') // override wins
      expect(suggestTxCountyForCity('Boerne')).toBe('Kendall') // built-ins untouched
    } finally {
      setExtraTxCountyMappings({})
    }
    expect(formatExtraTxCountyMappingsText({ devine: 'Medina', 'san marcos': 'Comal' })).toBe(
      'Devine = Medina\nSan Marcos = Comal',
    )
  })
})
