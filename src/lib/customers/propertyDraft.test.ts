import { describe, expect, it } from 'vitest'
import { draftFromRow, emptyPropertyDraft, payloadFromDraft, precinctSourceWords } from './propertyDraft'
import type { CustomerAddressRow } from '../jobs/lienProperty'

describe('payloadFromDraft', () => {
  it('trims every text field and nulls an empty note and lookup stamp', () => {
    const payload = payloadFromDraft(
      { ...emptyPropertyDraft('  628 Tarrow Rd, San Antonio, TX 78209 '), owner_name: ' Jane Doe ', parcel_id: ' 12345 ' },
      new Date('2026-09-14T15:00:00Z'),
    )
    expect(payload.address).toBe('628 Tarrow Rd, San Antonio, TX 78209')
    expect(payload.owner_name).toBe('Jane Doe')
    expect(payload.parcel_id).toBe('12345')
    expect(payload.note).toBeNull()
    expect(payload.parcel_looked_up_at).toBeNull()
    expect(payload.updated_at).toBe('2026-09-14T15:00:00.000Z')
  })

  it('keeps the county source only when a county is beside it', () => {
    const withCounty = payloadFromDraft({ ...emptyPropertyDraft('1 Main St'), county: 'Bexar', county_source: 'parcel' })
    expect(withCounty.county_source).toBe('parcel')
    const blankCounty = payloadFromDraft({ ...emptyPropertyDraft('1 Main St'), county: '  ', county_source: 'parcel' })
    expect(blankCounty.county).toBe('')
    expect(blankCounty.county_source).toBe('')
  })
})

describe('the justice precinct on the draft (v2.4771)', () => {
  it('a typed precinct is hand and clears the note; a map value passes through; an empty one clears all three; an old draft writes none', () => {
    const base = emptyPropertyDraft('1 Main St')
    expect(payloadFromDraft({ ...base, jp_precinct: ' 2 ', jp_precinct_source: '' })).toMatchObject({ jp_precinct: '2', jp_precinct_source: 'hand', jp_precinct_note: '' })
    expect(payloadFromDraft({ ...base, jp_precinct: '1-2', jp_precinct_source: 'map' })).toMatchObject({ jp_precinct: '1-2', jp_precinct_source: 'map' })
    expect(payloadFromDraft({ ...base, jp_precinct: '1-2', jp_precinct_source: 'map' })).not.toHaveProperty('jp_precinct_note')
    expect(payloadFromDraft({ ...base, jp_precinct: '', jp_precinct_source: 'map' })).toMatchObject({ jp_precinct: '', jp_precinct_source: '', jp_precinct_note: '' })
    const { jp_precinct: _p, jp_precinct_source: _s, ...old } = base
    void _p
    void _s
    expect(payloadFromDraft(old as typeof base)).not.toHaveProperty('jp_precinct')
    expect(precinctSourceWords({ jp_precinct: '', jp_precinct_source: '' })).toContain('not yet')
    expect(precinctSourceWords({ jp_precinct: '2', jp_precinct_source: 'map' })).toContain("from the office's court map")
    expect(precinctSourceWords({ jp_precinct: '2', jp_precinct_source: 'hand' })).toContain('typed by hand')
  })
})

describe('the owner’s email and phone on the draft (v2.6497)', () => {
  const row = {
    id: 'addr-1', customer_id: 'cust-1', address: '4110 N Main St, Taylor, TX 76574', note: null, sequence_order: 0, created_at: null, updated_at: null,
    county: 'Williamson', county_source: 'parcel', legal_description: '', property_kind: '', homestead: false, owner_mode: 'building_owner', owner_name: 'Dave Novy Rentals', owner_company: '',
    owner_mailing_address: 'PO Box 28054, Austin, TX 78755', parcel_id: '', parcel_source: '', parcel_tax_year: '', parcel_looked_up_at: null, jp_precinct: '', jp_precinct_at: null, jp_precinct_note: '', jp_precinct_source: '',
    owner_confirmed_at: null, owner_confirmed_by: null, is_primary: false,
  } as CustomerAddressRow
  it('a row that carries the columns reads them onto the draft and writes them back trimmed, a cleared one as empty', () => {
    const d = draftFromRow({ ...row, owner_email: ' owner@novy.example ', owner_phone: '(512) 555-0142' } as CustomerAddressRow)
    expect(d).toMatchObject({ owner_email: 'owner@novy.example', owner_phone: '(512) 555-0142' })
    expect(payloadFromDraft(d)).toMatchObject({ owner_email: 'owner@novy.example', owner_phone: '(512) 555-0142' })
    expect(payloadFromDraft({ ...d, owner_email: '' })).toMatchObject({ owner_email: '', owner_phone: '(512) 555-0142' })
  })
  it('the homestead answer rides the draft only off a row that carries its column, and an empty one writes NULL (punch list #305)', () => {
    // Before migration 20261112080000: no column on the row, nothing on the draft, nothing written.
    expect(draftFromRow(row)).not.toHaveProperty('homestead_answered_at')
    expect(payloadFromDraft(draftFromRow(row))).not.toHaveProperty('homestead_answered_at')
    expect(payloadFromDraft(emptyPropertyDraft('1 Main St'))).not.toHaveProperty('homestead_answered_at')
    // After it: nobody answered reads '' and writes NULL back; an answer is kept as it is.
    const unasked = draftFromRow({ ...row, homestead_answered_at: null } as never)
    expect(unasked.homestead_answered_at).toBe('')
    expect(payloadFromDraft(unasked).homestead_answered_at).toBeNull()
    const answered = draftFromRow({ ...row, homestead_answered_at: '2026-11-17T15:00:00.000Z' } as never)
    expect(payloadFromDraft(answered).homestead_answered_at).toBe('2026-11-17T15:00:00.000Z')
    // A yes or no pressed on a draft that never carried the column still goes, as a typed owner email does.
    expect(payloadFromDraft({ ...emptyPropertyDraft('1 Main St'), homestead: true, homestead_answered_at: '2026-11-17T16:00:00.000Z' })).toMatchObject({ homestead: true, homestead_answered_at: '2026-11-17T16:00:00.000Z' })
  })
  it('an older row without the columns, and an empty draft, write neither — the save never names a column that is not there yet', () => {
    const d = draftFromRow(row)
    expect(d).not.toHaveProperty('owner_email')
    expect(payloadFromDraft(d)).not.toHaveProperty('owner_email')
    expect(payloadFromDraft(d)).not.toHaveProperty('owner_phone')
    expect(payloadFromDraft(emptyPropertyDraft('1 Main St'))).not.toHaveProperty('owner_email')
    // Typed on an empty draft: both go, the untyped one as empty.
    expect(payloadFromDraft({ ...emptyPropertyDraft('1 Main St'), owner_phone: ' 512-555-0199 ' })).toMatchObject({ owner_email: '', owner_phone: '512-555-0199' })
  })
})
