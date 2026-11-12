import { describe, expect, it } from 'vitest'
import {
  addressQuery,
  askablePoint,
  askedBexarLayer,
  askedOtherQuestion,
  askedWithoutId,
  askedWithoutNeighbours,
  askedWithoutPoint,
  COMAL_PARCELS,
  factsInCounty,
  GUADALUPE_PARCELS,
  HAYS_PARCELS,
  idQuery,
  idWhere,
  interstateOf,
  nameSpellings,
  neighbourPointQuestion,
  neighbourSources,
  ordinalOf,
  parcelFactsByAddress,
  parcelFactsById,
  parcelFactsByPoint,
  parcelSourceFor,
  pickParcel,
  pointQuery,
  pointQueryOf,
  pointQuestion,
  sourceForId,
  streetParts,
  TRAVIS_PARCELS,
  WILLIAMSON_PARCELS,
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
  it('reads the address question past the id question that is asked in front of it', () => {
    const today = TRAVIS_PARCELS.where({ num: '7201', prefix: null, name: 'SAMPLE' })
    const id = "geo_id = '0000000001'"
    // A kept "no parcel" that asked the id, the address and the point is today's question: it waits out its month.
    expect(askedOtherQuestion(TRAVIS_PARCELS, `${id} | ${today} | point -97.7,30.2`, '7201 SAMPLE LOOP')).toBe(false)
    expect(askedOtherQuestion(TRAVIS_PARCELS, `${id} | ${today}`, '7201 SAMPLE LOOP')).toBe(false)
    // An old spelling behind the id question is still an old spelling.
    expect(askedOtherQuestion(TRAVIS_PARCELS, `${id} | situs_num = '7201' AND UPPER(situs_street) LIKE 'SAMPLE LOOP%'`, '7201 SAMPLE LOOP')).toBe(true)
    // The county failed on the id question, so the address was never asked: the failure is kept, not asked on every open.
    expect(askedOtherQuestion(TRAVIS_PARCELS, id, '7201 SAMPLE LOOP')).toBe(false)
    // A row kept with no question at all is asked, as before.
    expect(askedOtherQuestion(TRAVIS_PARCELS, '', '7201 SAMPLE LOOP')).toBe(true)
    expect(askedOtherQuestion(TRAVIS_PARCELS, null, '7201 SAMPLE LOOP')).toBe(true)
    // A county with no id column reads that question as an address question it no longer asks.
    expect(askedOtherQuestion(HAYS_PARCELS, id, '7201 SAMPLE LOOP')).toBe(true)
  })
  it('asks a kept answer again once when the permit names its lot and the id was never asked', () => {
    const address = TRAVIS_PARCELS.where({ num: '7201', prefix: null, name: 'SAMPLE' })
    // Found by the address before the id was asked: the owner may be a neighbour's, so it does not sit for its month.
    expect(askedWithoutId(TRAVIS_PARCELS, address, '0000000001')).toBe(true)
    expect(askedWithoutId(TRAVIS_PARCELS, `${address} | point -97.7,30.2`, '0000000001')).toBe(true)
    expect(askedWithoutId(TRAVIS_PARCELS, null, '0000000001')).toBe(true)
    // Asked by the id since, found or not: kept like any other row.
    expect(askedWithoutId(TRAVIS_PARCELS, "geo_id = '0000000001'", '0000000001')).toBe(false)
    expect(askedWithoutId(TRAVIS_PARCELS, `geo_id = '0000000001' | ${address} | point -97.7,30.2`, '0000000001')).toBe(false)
    // Kept for another lot's id: this permit's own is asked.
    expect(askedWithoutId(TRAVIS_PARCELS, "geo_id = '0000000002'", '0000000001')).toBe(true)
    expect(askedWithoutId(TRAVIS_PARCELS, "geo_id = '00000000010'", '0000000001')).toBe(true)
    // No id on the permit, a neighbouring county's id, a county with no id to ask: nothing to ask again.
    expect(askedWithoutId(TRAVIS_PARCELS, address, null)).toBe(false)
    expect(askedWithoutId(TRAVIS_PARCELS, address, '  ')).toBe(false)
    expect(askedWithoutId(TRAVIS_PARCELS, address, 'R000001')).toBe(false)
    expect(askedWithoutId(HAYS_PARCELS, address, '0000000001')).toBe(false)
  })
  it('takes a row with an owner over a blank one', () => {
    const body = rows({ prop_id: 1, situs_num: '550', situs_street_prefx: null, situs_street: 'LANDA', file_as_name: null }, { prop_id: 2, situs_num: '550', situs_street_prefx: null, situs_street: 'LANDA', file_as_name: 'SAMPLE LLC' })
    expect(pickParcel(COMAL_PARCELS, body, { num: '550', prefix: null, name: 'LANDA' })?.prop_id).toBe(2)
  })
})

describe('the parcel a permit names by its id', () => {
  it("asks Travis for the id as text, leading zeros kept, with the layer's own columns and no shape", () => {
    const q = idQuery(TRAVIS_PARCELS, '0000000001')
    expect(q?.get('where')).toBe("geo_id = '0000000001'")
    expect(q?.get('outFields')).toBe(TRAVIS_PARCELS.outFields)
    expect(q?.get('returnGeometry')).toBe('false')
    expect(q?.get('f')).toBe('json')
    expect(q?.has('geometry')).toBe(false)
    expect(idWhere(TRAVIS_PARCELS, ' 0000000001 ')).toBe("geo_id = '0000000001'")
    expect(idWhere(TRAVIS_PARCELS, 1234567)).toBe("geo_id = '1234567'")
  })
  it('doubles a quote, so an id is never more than a value', () => {
    expect(idWhere(TRAVIS_PARCELS, "0' OR '1'='1")).toBe("geo_id = '0'' OR ''1''=''1'")
  })
  it("asks nothing for a blank id, an id that is Williamson County's, or a county with no id column", () => {
    expect(idQuery(TRAVIS_PARCELS, '')).toBeNull()
    expect(idQuery(TRAVIS_PARCELS, null)).toBeNull()
    expect(idQuery(TRAVIS_PARCELS, undefined)).toBeNull()
    expect(idQuery(TRAVIS_PARCELS, { id: '0000000001' })).toBeNull()
    expect(idQuery(TRAVIS_PARCELS, 'R000001')).toBeNull()
    expect(idQuery(TRAVIS_PARCELS, 'r000001')).toBeNull()
    for (const source of [HAYS_PARCELS, COMAL_PARCELS, GUADALUPE_PARCELS]) expect(idQuery(source, '0000000001')).toBeNull()
    expect(TRAVIS_PARCELS.id?.permitKey).toBe('tcad_id')
  })
  it('reads the first parcel with an owner and marks it read by the id', () => {
    const body = rows({ PROP_ID: 0, py_owner_name: null }, { PROP_ID: 700001, situs_address: '100 SAMPLE LN 78701', py_owner_name: 'SAMPLE LOT LLC', market_value: 900 }, { PROP_ID: 700002, py_owner_name: 'OTHER LLC' })
    expect(parcelFactsById(TRAVIS_PARCELS, body)).toMatchObject({ prop_id: '700001', owner: 'SAMPLE LOT LLC', situs: '100 SAMPLE LN 78701', total_value: 900, matched_by: 'id' })
  })
  it('answers nothing when the layer does not hold the id, so the lookup falls back to the address', () => {
    expect(parcelFactsById(TRAVIS_PARCELS, rows())).toBeNull()
    expect(parcelFactsById(TRAVIS_PARCELS, rows({ PROP_ID: 0, py_owner_name: ' ' }))).toBeNull()
    expect(parcelFactsById(TRAVIS_PARCELS, {})).toBeNull()
    expect(parcelFactsById(TRAVIS_PARCELS, null)).toBeNull()
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

describe('the point, for a layer asked by its columns', () => {
  const at = { lat: 29.5, lng: -98.5 }
  it('asks for the parcel under the point with the columns it is given', () => {
    const q = pointQueryOf('PropID,Situs,Owner', at)
    expect(q.get('geometry')).toBe('-98.5,29.5')
    expect(q.get('geometryType')).toBe('esriGeometryPoint')
    expect(q.get('inSR')).toBe('4326')
    expect(q.get('spatialRel')).toBe('esriSpatialRelIntersects')
    expect(q.get('outFields')).toBe('PropID,Situs,Owner')
    expect(q.get('returnGeometry')).toBe('false')
    expect(q.has('where')).toBe(false)
    expect(pointQuery(HAYS_PARCELS, at).toString()).toBe(pointQueryOf(HAYS_PARCELS.outFields, at).toString())
  })
  it('asks a kept "no parcel" again once when the permit has a point that was never asked', () => {
    const address = "UPPER(Situs) LIKE '100 SAMPLE LN%'"
    expect(pointQuestion(at)).toBe('point -98.5,29.5')
    expect(askedWithoutPoint(address, at)).toBe(true)
    expect(askedWithoutPoint(null, at)).toBe(true)
    // Asked at the point since: kept like any other row.
    expect(askedWithoutPoint(`${address} | ${pointQuestion(at)}`, at)).toBe(false)
    expect(askedWithoutPoint(pointQuestion(at), at)).toBe(false)
    // The permit has no point: nothing more to ask.
    expect(askedWithoutPoint(address, null)).toBe(false)
  })
})

describe('the county the lot is in, when the city reaches over the county line', () => {
  const at = { lat: 29.7, lng: -98.1 }
  it('names the neighbours whose layers are read here', () => {
    expect(neighbourSources(COMAL_PARCELS).map((s) => s.county)).toEqual(['Guadalupe'])
    expect(neighbourSources(HAYS_PARCELS).map((s) => s.county)).toEqual(['Guadalupe', 'Comal'])
    expect(neighbourSources(GUADALUPE_PARCELS).map((s) => s.county)).toEqual(['Comal'])
    expect(neighbourSources(TRAVIS_PARCELS).map((s) => s.county)).toEqual(['Williamson', 'Hays'])
    expect(neighbourSources(WILLIAMSON_PARCELS).map((s) => s.county)).toEqual(['Travis'])
    // No county is its own neighbour.
    for (const source of [TRAVIS_PARCELS, HAYS_PARCELS, COMAL_PARCELS, GUADALUPE_PARCELS, WILLIAMSON_PARCELS]) expect(neighbourSources(source)).not.toContain(source)
  })
  it("reads the neighbour's parcel at the point and names its county", () => {
    const body = rows({ prop_id: 0, file_as_name: null }, { prop_id: 28000, file_as_name: 'SAMPLE TRACT LLC', situs_num: '210', situs_street_prefx: 'W', situs_street: 'COURT ST' })
    const read = parcelFactsByPoint(GUADALUPE_PARCELS, body)
    const facts = read ? factsInCounty(COMAL_PARCELS, GUADALUPE_PARCELS, read) : null
    expect(facts).toMatchObject({ prop_id: '28000', owner: 'SAMPLE TRACT LLC', matched_by: 'point', county: 'Guadalupe' })
    expect(facts?.detail_url).toBe('https://esearch.guadalupead.org/Property/View/28000')
    // The city's own county never names itself, even when it answers as the neighbour of the layer asked first.
    expect(read ? factsInCounty(GUADALUPE_PARCELS, GUADALUPE_PARCELS, read).county : null).toBeUndefined()
    expect(read?.county).toBeUndefined()
  })
  it('writes the question so that it is never read as the address question', () => {
    const question = neighbourPointQuestion(GUADALUPE_PARCELS, at)
    expect(question).toBe('point -98.1,29.7 in Guadalupe')
    const address = COMAL_PARCELS.where({ num: '550', prefix: null, name: 'LANDA' })
    expect(askedOtherQuestion(COMAL_PARCELS, `${address} | point -98.1,29.7 | ${question}`, '550 LANDA ST')).toBe(false)
    expect(askedOtherQuestion(COMAL_PARCELS, `point -98.1,29.7 | ${question}`, '550 LANDA ST')).toBe(true)
  })
  it('asks a kept "no parcel" again once when a neighbour was never asked', () => {
    const address = COMAL_PARCELS.where({ num: '550', prefix: null, name: 'LANDA' })
    expect(askedWithoutNeighbours(COMAL_PARCELS, `${address} | point -98.1,29.7`, at)).toBe(true)
    expect(askedWithoutNeighbours(COMAL_PARCELS, null, at)).toBe(true)
    expect(askedWithoutNeighbours(COMAL_PARCELS, `${address} | point -98.1,29.7 | ${neighbourPointQuestion(GUADALUPE_PARCELS, at)}`, at)).toBe(false)
    // Hays has two neighbours: both must have been asked.
    expect(askedWithoutNeighbours(HAYS_PARCELS, `point -98.1,29.7 | ${neighbourPointQuestion(GUADALUPE_PARCELS, at)}`, at)).toBe(true)
    expect(askedWithoutNeighbours(HAYS_PARCELS, `point -98.1,29.7 | ${neighbourPointQuestion(GUADALUPE_PARCELS, at)} | ${neighbourPointQuestion(COMAL_PARCELS, at)}`, at)).toBe(false)
    // No point on the permit: a neighbour cannot be asked.
    expect(askedWithoutNeighbours(COMAL_PARCELS, address, null)).toBe(false)
  })
})

describe('Williamson County, for Austin over the county line', () => {
  it('takes the R id an Austin permit carries, and leaves Travis its own', () => {
    expect(idWhere(WILLIAMSON_PARCELS, 'R000001')).toBe("QuickRefID = 'R000001'")
    expect(idWhere(WILLIAMSON_PARCELS, ' r000001 ')).toBe("QuickRefID = 'R000001'")
    expect(idWhere(WILLIAMSON_PARCELS, '0000000001')).toBeNull()
    expect(idWhere(WILLIAMSON_PARCELS, 'R00001X')).toBeNull()
    expect(idQuery(WILLIAMSON_PARCELS, 'R000001')?.get('outFields')).toBe(WILLIAMSON_PARCELS.outFields)
    expect(idWhere(TRAVIS_PARCELS, 'R000001')).toBeNull()
  })
  it('picks the county by the id the permit carries', () => {
    expect(sourceForId(TRAVIS_PARCELS, 'R000001')).toBe(WILLIAMSON_PARCELS)
    expect(sourceForId(TRAVIS_PARCELS, '0000000001')).toBe(TRAVIS_PARCELS)
    expect(sourceForId(TRAVIS_PARCELS, null)).toBe(TRAVIS_PARCELS)
    expect(sourceForId(TRAVIS_PARCELS, '')).toBe(TRAVIS_PARCELS)
    // A county with no id column, and a neighbour with none, stay themselves.
    expect(sourceForId(HAYS_PARCELS, 'R000001')).toBe(HAYS_PARCELS)
    expect(sourceForId(COMAL_PARCELS, '0000000001')).toBe(COMAL_PARCELS)
    expect(parcelSourceFor('Williamson')).toBe(WILLIAMSON_PARCELS)
  })
  it('asks for the number and the street name, every way the name is spelled', () => {
    expect(WILLIAMSON_PARCELS.where({ num: '1500', prefix: 'N', name: 'SAMPLE' })).toBe("SStreetNumber = '1500' AND (UPPER(SStreetName) LIKE 'SAMPLE%')")
    expect(WILLIAMSON_PARCELS.where({ num: '900', prefix: null, name: '5TH' })).toBe("SStreetNumber = '900' AND (UPPER(SStreetName) LIKE '5TH%' OR UPPER(SStreetName) LIKE 'FIFTH%')")
    const body = rows({ QuickRefID: 'R000002', SStreetNumber: '1500', SStreetDirectional: 'S', SStreetName: 'Sample', FullName: 'SOUTH SAMPLE LLC' }, { QuickRefID: 'R000003', SStreetNumber: '1500', SStreetDirectional: 'N', SStreetName: 'Sample', FullName: 'NORTH SAMPLE LLC' })
    expect(pickParcel(WILLIAMSON_PARCELS, body, { num: '1500', prefix: 'N', name: 'SAMPLE' })?.QuickRefID).toBe('R000003')
  })
  it("reads its row: the mailing address off its two lines, the district's own page, no year built", () => {
    const facts = parcelFactsById(
      WILLIAMSON_PARCELS,
      rows({ QuickRefID: 'R000001', FullName: 'SAMPLE HOLDINGS LLC', MailingAddress: 'PO BOX 1 \nSAMPLE CITY, TX 78600', SitusAddress: '1500 N SAMPLE BLVD, AUSTIN, TX 78700', SStreetNumber: '1500', SStreetDirectional: 'N', SStreetName: 'SAMPLE', DBA: 'SAMPLE SHOP', TotalLandMktValue: 1000.5, TotalImpMktValue: 2000, TotalPropMktValue: 3000.5, TotalSqFtLivingArea: 4200, Acres: '1.2345', USECD: 'C4' }),
    )
    expect(facts).toEqual({
      prop_id: 'R000001',
      situs: '1500 N SAMPLE BLVD, AUSTIN, TX 78700',
      owner: 'SAMPLE HOLDINGS LLC',
      owner_address: 'PO BOX 1, SAMPLE CITY, TX 78600',
      dba: 'SAMPLE SHOP',
      land_value: 1000.5,
      improvement_value: 2000,
      total_value: 3000.5,
      use_code: 'C4',
      year_built: null,
      building_sf: 4200,
      acres: 1.23,
      detail_url: 'https://search.wcad.org/Property-Detail/PropertyQuickRefID/R000001',
      matched_by: 'id',
    })
    // Asked for an Austin permit, the card names the county the lot is in.
    expect(facts ? factsInCounty(TRAVIS_PARCELS, WILLIAMSON_PARCELS, facts).county : null).toBe('Williamson')
  })
})
