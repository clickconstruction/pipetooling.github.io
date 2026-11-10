import { describe, expect, it } from 'vitest'
import {
  bcadDetailUrl,
  builderKeyOf,
  companyFactsFromPlaces,
  companyLookupKey,
  contactParts,
  lookupIsFresh,
  nameKey,
  parcelFactsFromCounty,
  parcelLookupKey,
  placesQuery,
  situsWhere,
} from '../../../supabase/functions/_shared/permitLookup'

describe('contactParts', () => {
  it('splits a person and a company on the comma', () => {
    expect(contactParts('Raymond GUASCO, Wit-Con')).toEqual({ person: 'Raymond GUASCO', company: 'Wit-Con' })
    expect(contactParts('Milton G. Ramirez, Synergy Construction, LLC')).toEqual({ person: 'Milton G. Ramirez', company: 'Synergy Construction, LLC' })
    expect(contactParts('Mary Carrillo, Northside ISD')).toEqual({ person: 'Mary Carrillo', company: 'Northside ISD' })
  })
  it('reads a lone company and a lone person', () => {
    expect(contactParts('BOSSTX INC.')).toEqual({ person: null, company: 'BOSSTX INC.' })
    expect(contactParts('D Barnes Construction LLC')).toEqual({ person: null, company: 'D Barnes Construction LLC' })
    expect(contactParts('Richard Kenly')).toEqual({ person: 'Richard Kenly', company: null })
    expect(contactParts('Luis S. Faraklas, P.E., PLLC').company).toBe('Luis S. Faraklas, P.E., PLLC')
    expect(contactParts('')).toEqual({ person: null, company: null })
  })
  it('asks Places for the company when there is one, keyed the database way', () => {
    expect(placesQuery('Raymond GUASCO, Wit-Con', 'San Antonio')).toBe('Wit-Con San Antonio TX')
    expect(placesQuery('Richard Kenly', 'San Antonio')).toBe('Richard Kenly San Antonio TX')
    expect(companyLookupKey('Milton G. Ramirez, Synergy Construction, LLC')).toBe('synergyconstruction')
    expect(nameKey('Synergy Construction, LLC')).toBe('synergyconstruction')
  })
})

describe('companyFactsFromPlaces', () => {
  const body = {
    places: [
      { id: 'a', displayName: { text: 'Some Other Builders' }, formattedAddress: '1 Elsewhere Rd, San Antonio, TX', nationalPhoneNumber: '(210) 555-0100' },
      { id: 'b', displayName: { text: 'Synergy Construction LLC' }, formattedAddress: '100 Sample St, San Antonio, TX 78245', nationalPhoneNumber: '(210) 555-0199', websiteUri: 'https://example.com', primaryTypeDisplayName: { text: 'General contractor' }, googleMapsUri: 'https://maps.google.com/?cid=1' },
    ],
  }
  it('prefers the result whose name keys the same as what was asked', () => {
    const f = companyFactsFromPlaces(body, 'synergyconstruction')
    expect(f).toMatchObject({ name: 'Synergy Construction LLC', phone: '(210) 555-0199', website: 'https://example.com', kind: 'General contractor', match: 'exact', place_id: 'b' })
  })
  it("falls back to Google's first as a loose match, and null on nothing", () => {
    expect(companyFactsFromPlaces(body, 'nobody')?.match).toBe('loose')
    expect(companyFactsFromPlaces({ places: [] }, 'x')).toBeNull()
    expect(companyFactsFromPlaces(null, 'x')).toBeNull()
  })
})

describe('the parcel lookup', () => {
  it('builds the where clause from the street, upper-cased and quote-safe', () => {
    expect(situsWhere("100 Sample St, San Antonio, TX 78245")).toBe("UPPER(Situs) LIKE '100 SAMPLE ST%'")
    expect(situsWhere("2939 Cameron's Way")).toBe("UPPER(Situs) LIKE '2939 CAMERON''S WAY%'")
    expect(situsWhere('')).toBeNull()
    expect(parcelLookupKey('San Antonio', '100 SAMPLE ST')).toBe('san antonio|100 sample st')
  })
  it('reads the owner, the mailing address and the values off the first parcel', () => {
    const f = parcelFactsFromCounty({
      features: [
        { attributes: { PropID: 1234567, Situs: '100 SAMPLE ST \r\nSAN ANTONIO, TX 78245', Owner: 'RIDGEWAY HOLDINGS LLC', AddrLn1: 'PO BOX 1', AddrLn2: null, AddrLn3: null, AddrCity: 'SAN ANTONIO', AddrSt: 'TX', Zip: '78201', DBA: 'SAMPLE PLAZA', LandVal: 1000, ImprVal: 2000, TotVal: 3000, PropUse: '205', YrBlt: '2001', GBA: 6200, Acres: 0.9 } },
      ],
    })
    expect(f).toMatchObject({ prop_id: '1234567', owner: 'RIDGEWAY HOLDINGS LLC', owner_address: 'PO BOX 1, SAN ANTONIO TX 78201', dba: 'SAMPLE PLAZA', total_value: 3000, building_sf: 6200, year_built: '2001' })
    expect(f?.detail_url).toBe(bcadDetailUrl('1234567'))
    expect(parcelFactsFromCounty({ features: [] })).toBeNull()
  })
  it('keeps a cached row for thirty days', () => {
    const now = Date.parse('2026-11-09T12:00:00Z')
    expect(lookupIsFresh('2026-11-01T00:00:00Z', now)).toBe(true)
    expect(lookupIsFresh('2026-09-01T00:00:00Z', now)).toBe(false)
  })
})

describe('builderKeyOf (punch list #302)', () => {
  it('keys a contact line on its company, else on the person', () => {
    expect(builderKeyOf('Dana Whitlock, Ridgeway Builders, LLC')).toBe('ridgewaybuilders')
    expect(builderKeyOf('RIDGEWAY BUILDERS LLC')).toBe('ridgewaybuilders')
    expect(builderKeyOf('Dana Whitlock')).toBe('danawhitlock')
    expect(builderKeyOf('  ')).toBeNull()
    expect(builderKeyOf(null)).toBeNull()
  })
})
