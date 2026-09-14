import { describe, expect, it } from 'vitest'
import { emptyPropertyDraft, payloadFromDraft } from './propertyDraft'

describe('payloadFromDraft', () => {
  it('trims every text field and nulls an empty note and lookup stamp', () => {
    const payload = payloadFromDraft(
      { ...emptyPropertyDraft('  628 Terrell Rd, San Antonio, TX 78209 '), owner_name: ' Jane Doe ', parcel_id: ' 12345 ' },
      new Date('2026-09-14T15:00:00Z'),
    )
    expect(payload.address).toBe('628 Terrell Rd, San Antonio, TX 78209')
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
