import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { proposalFromLookupPayload, propertyLookupHoldLine } from './propertyLookupClient'

const TAYLOR = '123 ZZ Test Ln, Taylor, TX 76574'

describe('proposalFromLookupPayload', () => {
  it('carries the function’s pin_hold with an empty proposal and the county that still resolved (v2.6520)', () => {
    const out = proposalFromLookupPayload(TAYLOR, {
      ok: true,
      county_geocoder: 'Williamson',
      parcel: null,
      pin_hold: { kind: 'street_unknown', detail: 'the map matched only part of the address' },
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.hold).toEqual({ kind: 'street_unknown', detail: 'the map matched only part of the address' })
    expect(out.parcel).toBeNull()
    expect(out.proposal.found).toBe(false)
    expect(out.proposal.county.county).toBe('Williamson')
  })

  it('reads no hold from an older function’s payload, or from a kind it does not know', () => {
    const plain = proposalFromLookupPayload(TAYLOR, { ok: true, county_geocoder: 'Williamson', parcel: null })
    expect(plain.ok && plain.hold).toBeNull()
    const odd = proposalFromLookupPayload(TAYLOR, { ok: true, county_geocoder: '', parcel: null, pin_hold: { kind: 'moon', detail: '' } })
    expect(odd.ok && odd.hold).toBeNull()
  })

  it('says a hold with the typed address’s city', () => {
    expect(propertyLookupHoldLine({ kind: 'street_unknown', detail: '' }, TAYLOR)).toBe(
      'The map has no street by that name near Taylor, so the roll was not asked. Check the street name, then look up again.',
    )
    expect(propertyLookupHoldLine({ kind: 'situs_mismatch', detail: '313 MAIN ST, TAYLOR, TX 76574' }, TAYLOR)).toMatch(/^The parcel under the map pin is 313 MAIN ST, TAYLOR, TX 76574, not this address/)
  })
})
