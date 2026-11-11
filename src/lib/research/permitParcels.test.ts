import { describe, expect, it } from 'vitest'
import {
  addressQuery,
  askablePoint,
  askedBexarLayer,
  askedOtherQuestion,
  COMAL_PARCELS,
  GUADALUPE_PARCELS,
  HAYS_PARCELS,
  interstateOf,
  nameSpellings,
  ordinalOf,
  parcelFactsByAddress,
  parcelFactsByPoint,
  parcelSourceFor,
  pickParcel,
  pointQuery,
  streetParts,
  TRAVIS_PARCELS,
} from '../../../supabase/functions/_shared/permitParcels'

// Every name, address and number here is made up.
const rows = (...attributes: Array<Record<string, unknown>>) => ({ features: attributes.map((a) => ({ attributes: a })) })

describe('a street address in the parts a county keeps apart', () => {
  it('splits the number, the direction and the name, and drops the suffix and the unit', () => {
    expect(streetParts('2700 E 5TH ST, Austin')).toEqual({ num: '2700', prefix: 'E', name: '5TH' })
    expect(streetParts('1125 West Sample Creek Blvd')).toEqual({ num: '1125', prefix: 'W', name: 'SAMPLE CREEK' })
    expect(streetParts('550 Landa St.')).toEqual({ num: '550', prefix: null, name: 'LANDA' })
    expect(streetParts('9801 W PARMER LN BLDG REC')).toEqual({ num: '9801', prefix: 'W', name: 'PARMER' })
    expect(streetParts('400 Main St N #210')).toEqual({ num: '400', prefix: null, name: 'MAIN' })
    expect(streetParts("12 O'Brien Way Suite 4")).toEqual({ num: '12', prefix: null, name: "O'BRIEN" })
  })
  it('keeps a street whose name is a direction or a suffix word', () => {
    expect(streetParts('321 W COURT ST')).toEqual({ num: '321', prefix: 'W', name: 'COURT' })
    expect(streetParts('100 COURT')).toEqual({ num: '100', prefix: null, name: 'COURT' })
    expect(streetParts('100 WEST AVE')).toEqual({ num: '100', prefix: null, name: 'WEST' })
    expect(streetParts('1500 HWY 46 W')).toEqual({ num: '1500', prefix: null, name: 'HWY 46' })
  })
  it('drops a LOOP suffix and writes an interstate one way', () => {
    expect(streetParts('7201 SAMPLE LOOP BLDG D')).toEqual({ num: '7201', prefix: null, name: 'SAMPLE' })
    expect(streetParts('2210 IH 10 W')).toEqual({ num: '2210', prefix: null, name: 'IH 10' })
    expect(streetParts('500 N I-35')).toEqual({ num: '500', prefix: 'N', name: 'IH 35' })
    expect(streetParts('500 Interstate Highway 35 S')).toEqual({ num: '500', prefix: null, name: 'IH 35' })
    expect(interstateOf('I H 10')).toBe(10)
    expect(interstateOf('IH 10')).toBe(10)
    expect(interstateOf('LOOP 410')).toBeNull()
    expect(nameSpellings('IH 10')).toEqual(['IH 10', 'I H 10', 'I-10', 'INTERSTATE HIGHWAY 10', 'INTERSTATE 10'])
  })
  it('holds an address with no house number or no street', () => {
    expect(streetParts('MAIN ST')).toBeNull()
    expect(streetParts('2700')).toBeNull()
    expect(streetParts('')).toBeNull()
    expect(streetParts(null)).toBeNull()
  })
  it('spells a numbered street every way a county writes it', () => {
    expect(ordinalOf('5TH')).toBe(5)
    expect(ordinalOf('51ST')).toBe(51)
    expect(ordinalOf('MAIN')).toBeNull()
    expect(nameSpellings('5TH')).toEqual(['5TH', '5', 'FIFTH'])
    expect(nameSpellings('51ST')).toEqual(['51ST', '51'])
    expect(nameSpellings('LANDA')).toEqual(['LANDA'])
  })
})

describe('what each county is asked', () => {
  it('finds the layer by the county, and none for Bexar or a county not read', () => {
    expect(parcelSourceFor('Travis')).toBe(TRAVIS_PARCELS)
    expect(parcelSourceFor('hays')).toBe(HAYS_PARCELS)
    expect(parcelSourceFor('Comal')).toBe(COMAL_PARCELS)
    expect(parcelSourceFor('Guadalupe')).toBe(GUADALUPE_PARCELS)
    expect(parcelSourceFor('Bexar')).toBeNull()
    expect(parcelSourceFor(null)).toBeNull()
  })
  it('asks Travis for the number and the name, a numbered street by its bare number too', () => {
    expect(TRAVIS_PARCELS.where({ num: '1125', prefix: 'W', name: 'SAMPLE CREEK' })).toBe("situs_num = '1125' AND UPPER(situs_street) LIKE 'SAMPLE CREEK%'")
    expect(TRAVIS_PARCELS.where({ num: '2700', prefix: 'E', name: '5TH' })).toBe("situs_num = '2700' AND (situs_street = '5' OR UPPER(situs_street) LIKE '5TH%')")
    expect(TRAVIS_PARCELS.where({ num: '12', prefix: null, name: "O'BRIEN" })).toContain("LIKE 'O''BRIEN%'")
  })
  it('asks the other three for the name every way, with the direction in the name too', () => {
    expect(HAYS_PARCELS.where({ num: '625', prefix: 'E', name: 'HOPKINS' })).toBe("situs_num = '625' AND (UPPER(situs_street) LIKE 'HOPKINS%' OR UPPER(situs_street) LIKE 'E HOPKINS%')")
    expect(COMAL_PARCELS.where({ num: '200', prefix: null, name: '1ST' })).toBe("situs_num = '200' AND (UPPER(situs_street) LIKE '1ST%' OR UPPER(situs_street) LIKE 'FIRST%')")
  })
  it('builds the address query and the point query', () => {
    const q = addressQuery(GUADALUPE_PARCELS, { num: '321', prefix: 'W', name: 'COURT' })
    expect(q.get('returnGeometry')).toBe('false')
    expect(q.get('outFields')).toContain('file_as_name')
    expect(q.get('f')).toBe('json')
    const p = pointQuery(TRAVIS_PARCELS, { lat: 30.25, lng: -97.75 })
    expect(p.get('geometry')).toBe('-97.75,30.25')
    expect(p.get('inSR')).toBe('4326')
    expect(p.get('spatialRel')).toBe('esriSpatialRelIntersects')
    expect(askablePoint(30.25, -97.75)).toEqual({ lat: 30.25, lng: -97.75 })
    expect(askablePoint(null, -97.75)).toBeNull()
    expect(askablePoint(0, 0)).toBeNull()
    expect(askablePoint('30.25', '-97.75')).toBeNull()
  })
  it("knows a kept answer that came from Bexar's layer, to ask the right county again", () => {
    expect(askedBexarLayer("UPPER(Situs) LIKE '100 SAMPLE LN%'")).toBe(true)
    expect(askedBexarLayer(TRAVIS_PARCELS.where({ num: '100', prefix: null, name: 'SAMPLE' }))).toBe(false)
    expect(askedBexarLayer(HAYS_PARCELS.where({ num: '100', prefix: null, name: 'SAMPLE' }))).toBe(false)
    expect(askedBexarLayer(null)).toBe(false)
  })
})

describe('the row that is picked', () => {
  const parts = { num: '256', prefix: 'N', name: 'KRUEGER' }
  it('takes the side of town that was asked for', () => {
    const body = rows({ prop_id: 1, situs_num: '256', situs_street_prefx: 'S', situs_street: 'KRUEGER', file_as_name: 'SOUTH SAMPLE LLC' }, { prop_id: 2, situs_num: '256', situs_street_prefx: 'N', situs_street: 'KRUEGER', file_as_name: 'NORTH SAMPLE LLC' })
    expect(pickParcel(COMAL_PARCELS, body, parts)?.prop_id).toBe(2)
  })
  it('never answers with another street that starts the same', () => {
    const body = rows({ prop_id: 1, situs_num: '100', situs_street_prefx: null, situs_street: 'MAINE', file_as_name: 'SAMPLE LLC' })
    expect(pickParcel(COMAL_PARCELS, body, { num: '100', prefix: null, name: 'MAIN' })).toBeNull()
    expect(parcelFactsByAddress(COMAL_PARCELS, body, { num: '100', prefix: null, name: 'MAIN' })).toBeNull()
  })
  it('reads a name that carries its direction in front or its suffix behind', () => {
    const hays = rows({ prop_id: 7, situs_num: '625', situs_street_prefx: null, situs_street: 'E HOPKINS', file_as_name: 'SAMPLE LLC' })
    expect(pickParcel(HAYS_PARCELS, hays, { num: '625', prefix: 'E', name: 'HOPKINS' })?.prop_id).toBe(7)
    const guadalupe = rows({ prop_id: 8, situs_num: '321', situs_street_prefx: 'W', situs_street: 'COURT ST', file_as_name: 'SAMPLE LLC' })
    expect(pickParcel(GUADALUPE_PARCELS, guadalupe, { num: '321', prefix: 'W', name: 'COURT' })?.prop_id).toBe(8)
  })
  it('matches a numbered street as the county spells it', () => {
    const travis = rows({ PROP_ID: 9, situs_num: '2700', situs_street_prefx: 'E', situs_street: '5', py_owner_name: 'SAMPLE LLC' })
    expect(pickParcel(TRAVIS_PARCELS, travis, { num: '2700', prefix: 'E', name: '5TH' })?.PROP_ID).toBe(9)
    const comal = rows({ prop_id: 10, situs_num: '200', situs_street_prefx: 'W', situs_street: 'FIRST', file_as_name: 'SAMPLE LLC' }, { prop_id: 11, situs_num: '200', situs_street_prefx: 'W', situs_street: '10TH', file_as_name: 'OTHER LLC' })
    expect(pickParcel(COMAL_PARCELS, comal, { num: '200', prefix: 'W', name: '1ST' })?.prop_id).toBe(10)
  })
  it('matches an interstate the county writes with a space and a trailing side', () => {
    const body = rows({ prop_id: 12, situs_num: '22110', situs_street_prefx: null, situs_street: 'I H 10 W', file_as_name: 'SAMPLE LLC' })
    expect(pickParcel(GUADALUPE_PARCELS, body, { num: '22110', prefix: null, name: 'IH 10' })?.prop_id).toBe(12)
    expect(GUADALUPE_PARCELS.where({ num: '22110', prefix: null, name: 'IH 10' })).toContain("UPPER(situs_street) LIKE 'I H 10%'")
    expect(TRAVIS_PARCELS.where({ num: '500', prefix: null, name: 'IH 35' })).toBe(
      "situs_num = '500' AND (UPPER(situs_street) LIKE 'IH 35%' OR UPPER(situs_street) LIKE 'I H 35%' OR UPPER(situs_street) LIKE 'I-35%' OR UPPER(situs_street) LIKE 'INTERSTATE HIGHWAY 35%' OR UPPER(situs_street) LIKE 'INTERSTATE 35%')",
    )
  })
  it('asks a kept "no parcel" again when today\'s question is a different one', () => {
    const oldLoop = "situs_num = '7201' AND UPPER(situs_street) LIKE 'SAMPLE LOOP%'"
    expect(askedOtherQuestion(TRAVIS_PARCELS, oldLoop, '7201 SAMPLE LOOP BLDG D')).toBe(true)
    const today = TRAVIS_PARCELS.where({ num: '7201', prefix: null, name: 'SAMPLE' })
    expect(askedOtherQuestion(TRAVIS_PARCELS, today, '7201 SAMPLE LOOP BLDG D')).toBe(false)
    expect(askedOtherQuestion(TRAVIS_PARCELS, `${today} | point -97.7,30.2`, '7201 SAMPLE LOOP')).toBe(false)
    expect(askedOtherQuestion(TRAVIS_PARCELS, oldLoop, 'NO NUMBER ST')).toBe(false)
  })
  it('takes a row with an owner over a blank one', () => {
    const body = rows({ prop_id: 1, situs_num: '550', situs_street_prefx: null, situs_street: 'LANDA', file_as_name: null }, { prop_id: 2, situs_num: '550', situs_street_prefx: null, situs_street: 'LANDA', file_as_name: 'SAMPLE LLC' })
    expect(pickParcel(COMAL_PARCELS, body, { num: '550', prefix: null, name: 'LANDA' })?.prop_id).toBe(2)
  })
})

describe('the facts off a row', () => {
  it("reads Travis's row: the two building values added, the district's own link", () => {
    const f = parcelFactsByAddress(
      TRAVIS_PARCELS,
      rows({ PROP_ID: 123456, situs_address: '2700  E 5  ST     78702', situs_num: '2700', situs_street_prefx: 'E', situs_street: '5', py_owner_name: 'SAMPLE HOLDINGS LLC', py_address: 'PO BOX 1, AUSTIN, TX, 78701', land_homesite_val: 1000, imprv_homesite_val: 200, imprv_non_homesite_val: 300, market_value: 1500, land_state_cd: 'F1', F1year_imprv: 2004, tcad_acres: 1.6789, hyperlink: 'https://travis.prodigycad.com/property-detail/123456' }),
      { num: '2700', prefix: 'E', name: '5TH' },
    )
    expect(f).toEqual({
      prop_id: '123456',
      situs: '2700 E 5 ST 78702',
      owner: 'SAMPLE HOLDINGS LLC',
      owner_address: 'PO BOX 1, AUSTIN, TX, 78701',
      dba: null,
      land_value: 1000,
      improvement_value: 500,
      total_value: 1500,
      use_code: 'F1',
      year_built: '2004',
      building_sf: null,
      acres: 1.68,
      detail_url: 'https://travis.prodigycad.com/property-detail/123456',
    })
  })
  it("reads the other three's row: the address built from its parts, the total from its parts when the county gives none", () => {
    const row = { prop_id: 71000, file_as_name: 'SAMPLE HOLDINGS LLC', addr_line1: null, addr_line2: 'PO BOX 1', addr_line3: null, addr_city: 'SAN MARCOS', addr_state: 'TX', zip: '78666', situs_num: '625', situs_street_prefx: 'E', situs_street: 'HOPKINS', situs_street_sufix: 'ST', situs_city: 'SAN MARCOS', situs_zip: '78666', land_val: 1000, imprv_val: 2000, market: null, legal_acreage: 25.1449 }
    const parts = { num: '625', prefix: 'E', name: 'HOPKINS' }
    const hays = parcelFactsByAddress(HAYS_PARCELS, rows(row), parts)
    expect(hays).toMatchObject({ prop_id: '71000', situs: '625 E HOPKINS ST, SAN MARCOS 78666', owner: 'SAMPLE HOLDINGS LLC', owner_address: 'PO BOX 1, SAN MARCOS TX 78666', dba: null, land_value: 1000, improvement_value: 2000, total_value: 3000, use_code: null, year_built: null, building_sf: null, acres: 25.14 })
    expect(hays?.detail_url).toBe('https://esearch.hayscad.com/Property-Detail/PropertyQuickRefID/R71000')
    expect(hays?.matched_by).toBeUndefined()
    // Comal's suffix column holds unit junk, so it stays off the address.
    const comal = parcelFactsByAddress(COMAL_PARCELS, rows({ ...row, situs_street_sufix: 'UNIT 4', market: 5000 }), parts)
    expect(comal).toMatchObject({ situs: '625 E HOPKINS, SAN MARCOS 78666', total_value: 5000, detail_url: 'https://esearch.comalad.org/Property/View/71000' })
    expect(parcelFactsByAddress(GUADALUPE_PARCELS, rows(row), parts)?.detail_url).toBe('https://esearch.guadalupead.org/Property/View/71000')
  })
  it('marks a parcel read at the point, and skips a polygon with no owner', () => {
    const body = rows({ prop_id: 0, file_as_name: null }, { prop_id: 28000, file_as_name: 'SAMPLE COUNTY', situs_num: '210', situs_street_prefx: 'W', situs_street: 'COURT ST' })
    expect(parcelFactsByPoint(GUADALUPE_PARCELS, body)).toMatchObject({ prop_id: '28000', owner: 'SAMPLE COUNTY', situs: '210 W COURT ST', matched_by: 'point' })
    expect(parcelFactsByPoint(GUADALUPE_PARCELS, rows({ prop_id: 0, file_as_name: null }))).toBeNull()
    expect(parcelFactsByPoint(GUADALUPE_PARCELS, {})).toBeNull()
  })
})
