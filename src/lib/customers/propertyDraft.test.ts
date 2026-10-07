import { describe, expect, it } from 'vitest'
import { emptyPropertyDraft, payloadFromDraft, precinctSourceWords } from './propertyDraft'

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
