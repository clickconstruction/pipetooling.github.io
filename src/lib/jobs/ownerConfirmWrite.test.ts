import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { draftForNewRow, mergeForExistingRow, planOwnerConfirmWrites } from './ownerConfirmWrite'
import type { ProposedPropertyRecord, PropertyRecordFields } from '../customers/propertyRecord'
import { emptyPropertyDraft } from '../customers/propertyDraft'

const proposal = (over: Partial<ProposedPropertyRecord> = {}): ProposedPropertyRecord => ({
  found: true,
  county: { county: 'Guadalupe', source: 'parcel', candidates: [{ county: 'Guadalupe', source: 'parcel' }], disagreement: false, straddles: true },
  legalDescription: 'LOT 1 BLK 2',
  ownerName: '',
  ownerCompany: 'SCHERTZ STATION LTD',
  ownerMode: 'building_owner',
  ownerMailingAddress: '4040 BROADWAY STE 600, SAN ANTONIO, TX 78209',
  homestead: 'unlikely',
  provenance: { source: 'Guadalupe Appraisal District', taxYear: '2025', propId: '12345' },
  ...over,
})

const fields = (over: Partial<PropertyRecordFields> = {}): PropertyRecordFields => ({
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
  ...over,
})

describe('planOwnerConfirmWrites', () => {
  it('linked jobs update their row; unlinked jobs insert one row per home (customer, else GC) and link every job with that home', () => {
    const plan = planOwnerConfirmWrites([
      { jobId: 'a', customerId: 'c1', gcCustomerId: 'g1', customerAddressId: 'addr-1' },
      { jobId: 'b', customerId: 'c1', gcCustomerId: 'g1', customerAddressId: 'addr-1' },
      { jobId: 'c', customerId: null, gcCustomerId: 'g1', customerAddressId: null },
      { jobId: 'd', customerId: null, gcCustomerId: 'g1', customerAddressId: null },
      { jobId: 'e', customerId: 'c2', gcCustomerId: 'g1', customerAddressId: null },
      { jobId: 'f', customerId: null, gcCustomerId: null, customerAddressId: null },
    ])
    expect(plan.updates).toEqual([{ customerAddressId: 'addr-1', jobIds: ['a', 'b'] }])
    expect(plan.inserts).toEqual([
      { homeCustomerId: 'g1', jobIds: ['c', 'd'] },
      { homeCustomerId: 'c2', jobIds: ['e'] },
    ])
    expect(plan.skipped).toEqual(['f'])
  })
})

describe('mergeForExistingRow', () => {
  it('the roll fills blanks only — a typed owner survives and is what Use confirms; provenance rides along', () => {
    const next = mergeForExistingRow(fields({ owner_name: 'Typed Person', county: 'Bexar', county_source: 'manual' }), { kind: 'proposal', proposal: proposal() })
    expect(next.owner_name).toBe('Typed Person')
    expect(next.county).toBe('Bexar')
    expect(next.owner_company).toBe('SCHERTZ STATION LTD')
    expect(next.owner_mailing_address).toBe('4040 BROADWAY STE 600, SAN ANTONIO, TX 78209')
    expect(next.parcel_source).toBe('Guadalupe Appraisal District')
    expect(next.parcel_id).toBe('12345')
  })
  it('a pasted record fills blanks the same way', () => {
    const record = { ...emptyPropertyDraft('x'), owner_name: 'LAGAN JOEL C', owner_mailing_address: '102 JACOB ROBERTS', county: 'Blanco', county_source: 'city', parcel_source: 'Blanco CAD (pasted)', homestead: true, property_kind: 'residential' }
    const next = mergeForExistingRow(fields({ owner_mailing_address: 'PO BOX 1' }), { kind: 'record', record })
    expect(next.owner_name).toBe('LAGAN JOEL C')
    expect(next.owner_mailing_address).toBe('PO BOX 1')
    expect(next.county).toBe('Blanco')
    expect(next.county_source).toBe('city')
    expect(next.homestead).toBe(true)
    expect(next.parcel_source).toBe('Blanco CAD (pasted)')
  })
})

describe('draftForNewRow', () => {
  it('a new row takes the whole proposal on the job address, stamped looked-up', () => {
    const d = draftForNewRow('5498 Cibolo Valley Dr 200, Schertz', { kind: 'proposal', proposal: proposal() })
    expect(d.address).toBe('5498 Cibolo Valley Dr 200, Schertz')
    expect(d.owner_company).toBe('SCHERTZ STATION LTD')
    expect(d.owner_mode).toBe('building_owner')
    expect(d.property_kind).toBe('non_residential')
    expect(d.county).toBe('Guadalupe')
    expect(d.parcel_looked_up_at).not.toBe('')
  })
  it('a pasted record is copied field for field', () => {
    const record = { ...emptyPropertyDraft('x'), owner_name: 'LAGAN JOEL C', parcel_looked_up_at: '2026-09-14T00:00:00.000Z' }
    const d = draftForNewRow('102 Jacob Roberts, Blanco', { kind: 'record', record })
    expect(d.address).toBe('102 Jacob Roberts, Blanco')
    expect(d.owner_name).toBe('LAGAN JOEL C')
    expect(d.parcel_looked_up_at).toBe('2026-09-14T00:00:00.000Z')
  })
})
