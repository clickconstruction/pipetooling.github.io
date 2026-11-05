import { describe, expect, it } from 'vitest'
import { geocodePinHold, parcelSitusHold, pinHoldWords, streetCore, typedHouseNumber, type GeocodePrecision } from './parcelPinMatch'

/** The address of 2026-11-04: a street Taylor does not have, which came back lien-ready with a downtown parcel. */
const TAYLOR = '123 ZZ Test Ln, Taylor, TX 76574'
const DOWNTOWN_SITUS = '313 MAIN ST, TAYLOR, TX 76574'

function pin(over: Partial<GeocodePrecision> = {}): GeocodePrecision {
  return { locationType: 'ROOFTOP', partialMatch: false, types: ['street_address'], streetNumber: '123', ...over }
}

describe('typedHouseNumber and streetCore', () => {
  it('reads the house number that starts a line and nothing when a word does', () => {
    expect(typedHouseNumber('415 Springtown Way, San Marcos, TX 78666')).toBe('415')
    expect(typedHouseNumber('123A Main St')).toBe('123a')
    expect(typedHouseNumber('Lot 5 FM 1234, Kyle, TX')).toBe('')
    expect(typedHouseNumber('')).toBe('')
  })

  it('keeps the street name alone: no number, unit, directional or suffix word', () => {
    expect(streetCore('123 N Main St, Taylor, TX')).toBe('main')
    expect(streetCore(DOWNTOWN_SITUS)).toBe('main')
    expect(streetCore('415 Springtown Way')).toBe('springtown')
    expect(streetCore('1000 S Old Hwy 81 Ste 4, Kyle, TX')).toBe('old 81')
    expect(streetCore('FM 1234')).toBe('1234')
    expect(streetCore('County Road 123')).toBe('123')
    expect(streetCore('9703 Lenox Hl # 2')).toBe('lenox hl')
    expect(streetCore('123')).toBe('')
  })
})

describe('geocodePinHold', () => {
  it('lets a rooftop or interpolated pin at the typed number through', () => {
    expect(geocodePinHold(TAYLOR, pin())).toBeNull()
    expect(geocodePinHold(TAYLOR, pin({ locationType: 'RANGE_INTERPOLATED' }))).toBeNull()
    expect(geocodePinHold(TAYLOR, pin({ locationType: 'GEOMETRIC_CENTER', types: ['premise'] }))).toBeNull()
  })

  it('holds the Taylor pin: a partial match for the city, an area, no street number', () => {
    const hold = geocodePinHold(TAYLOR, pin({ locationType: 'APPROXIMATE', partialMatch: true, types: ['locality', 'political'], streetNumber: '' }))
    expect(hold).toEqual({ kind: 'street_unknown', detail: 'the map matched only part of the address' })
  })

  it('holds an area pin and a centre-of-area pin even without the partial flag', () => {
    expect(geocodePinHold(TAYLOR, pin({ locationType: 'APPROXIMATE', types: ['postal_code'], streetNumber: '' }))?.kind).toBe('street_unknown')
    expect(geocodePinHold(TAYLOR, pin({ locationType: 'GEOMETRIC_CENTER', types: ['neighborhood', 'political'], streetNumber: '' }))?.kind).toBe('street_unknown')
  })

  it('holds a street the map has at a number it lacks, naming the number', () => {
    const hold = geocodePinHold('9999 Main St, Taylor, TX', pin({ locationType: 'GEOMETRIC_CENTER', partialMatch: true, types: ['route'], streetNumber: '' }))
    expect(hold).toEqual({ kind: 'number_unknown', detail: 'the map has the street but no number 9999' })
  })

  it('holds a pin at another number on the street, and a street-level pin that lost the number', () => {
    expect(geocodePinHold(TAYLOR, pin({ streetNumber: '125' }))).toEqual({ kind: 'number_unknown', detail: 'the map placed number 125, not 123' })
    expect(geocodePinHold(TAYLOR, pin({ streetNumber: '' }))?.kind).toBe('number_unknown')
  })

  it('holds a rooftop that is only a partial match (the right number on that street in another town)', () => {
    expect(geocodePinHold(TAYLOR, pin({ partialMatch: true }))?.kind).toBe('street_unknown')
  })

  it('lets an address with no house number through on a rooftop pin', () => {
    expect(geocodePinHold('Lot 5 FM 1234, Kyle, TX', pin({ streetNumber: '' }))).toBeNull()
  })
})

describe('parcelSitusHold', () => {
  it('says nothing about a parcel with no situs', () => {
    expect(parcelSitusHold(TAYLOR, { situsAddress: '' })).toBeNull()
  })

  it('accepts the same lot spelled the roll’s way', () => {
    expect(parcelSitusHold('415 Springtown Way, San Marcos, TX 78666', { situsAddress: '415 SPRINGTOWN WAY, SAN MARCOS, TX 78666' })).toBeNull()
    expect(parcelSitusHold('412 Gruene Rd, New Braunfels, TX', { situsAddress: '412 GRUENE ROAD' })).toBeNull()
    expect(parcelSitusHold('313 N Main St, Taylor, TX', { situsAddress: DOWNTOWN_SITUS })).toBeNull()
    expect(parcelSitusHold('100 FM 1234, Kyle, TX', { situsAddress: '100 F M 1234' })).toBeNull()
  })

  it('holds the Taylor parcel: the roll’s own address for it is another lot', () => {
    expect(parcelSitusHold(TAYLOR, { situsAddress: DOWNTOWN_SITUS })).toEqual({ kind: 'situs_mismatch', detail: DOWNTOWN_SITUS })
  })

  it('holds the same number on another street, and the same street at another number', () => {
    expect(parcelSitusHold('123 Oak St, Taylor, TX', { situsAddress: '123 MAIN ST, TAYLOR, TX' })?.kind).toBe('situs_mismatch')
    expect(parcelSitusHold('123 Main St, Taylor, TX', { situsAddress: '125 MAIN ST, TAYLOR, TX' })?.kind).toBe('situs_mismatch')
  })

  it('compares the street alone when one side has no number', () => {
    expect(parcelSitusHold('Lot 5 FM 1234, Kyle, TX', { situsAddress: '100 FM 1234, KYLE, TX' })).toBeNull()
    expect(parcelSitusHold('Lot 5 FM 1234, Kyle, TX', { situsAddress: '100 MAIN ST, KYLE, TX' })?.kind).toBe('situs_mismatch')
  })
})

describe('pinHoldWords', () => {
  it('names the street, the number or the roll’s parcel, with the next press', () => {
    expect(pinHoldWords({ kind: 'street_unknown', detail: '' }, 'Taylor')).toBe(
      'The map has no street by that name near Taylor, so the roll was not asked. Check the street name, then look up again.',
    )
    expect(pinHoldWords({ kind: 'street_unknown', detail: '' }, '')).toBe(
      'The map has no street by that name, so the roll was not asked. Check the street name, then look up again.',
    )
    expect(pinHoldWords({ kind: 'number_unknown', detail: '' }, 'Taylor')).toBe(
      'The map has that street but not that number, so the roll was not asked. Check the house number, then look up again.',
    )
    expect(pinHoldWords({ kind: 'situs_mismatch', detail: DOWNTOWN_SITUS }, 'Taylor')).toBe(
      `The parcel under the map pin is ${DOWNTOWN_SITUS}, not this address, so nothing was filled. Check the address, then look up again or paste the CAD page.`,
    )
  })
})
