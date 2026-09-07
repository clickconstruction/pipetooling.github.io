import { afterEach, describe, expect, it } from 'vitest'
import {
  addressStreetKey,
  applyProposalToFields,
  cityStraddlesCounties,
  countyFromGoogleComponents,
  homesteadHint,
  normalizeCountyName,
  ownerLooksLikeCompany,
  parcelProvenanceLine,
  parseTxParcelIdentify,
  proposeCounty,
  proposePropertyRecord,
  titleCaseUpperWords,
  type ParcelRecord,
  type PropertyRecordFields,
} from './propertyRecord'
import { proposalFromLookupPayload } from './propertyLookupClient'
import { setExtraTxCountyMappings } from '../txCountyLookup'

afterEach(() => setExtraTxCountyMappings({}))

/** The exact shape TxGIO's identify returned for a Comal County parcel on 2026-09-07 (values altered). */
const IDENTIFY_HIT = {
  results: [
    {
      layerId: 0,
      layerName: 'StratMap Land Parcels 48 Most Recent',
      displayFieldName: 'OWNER_NAME',
      value: 'WHITFIELD DANA & MARCUS',
      attributes: {
        objectid: '2736088',
        PROP_ID: '178402',
        GEO_ID: '10000000000',
        OWNER_NAME: 'WHITFIELD DANA & MARCUS',
        NAME_CARE: ' ',
        LEGAL_DESC: 'GRUENE CROSSING 2, BLOCK 4, LOT 17',
        SITUS_ADDR: '412 GRUENE RD , NEW BRAUNFELS, TX 78130',
        SITUS_NUM: '412',
        SITUS_STRE: 'GRUENE',
        SITUS_ST_1: ' ',
        SITUS_ST_2: 'RD',
        SITUS_CITY: 'NEW BRAUNFELS',
        SITUS_STAT: 'TX',
        SITUS_ZIP: '78130',
        MAIL_ADDR: '412 GRUENE RD , NEW BRAUNFELS, TX 78130',
        MAIL_LINE1: ' ',
        MAIL_LINE2: '412 GRUENE RD',
        MAIL_CITY: 'NEW BRAUNFELS',
        MAIL_STAT: 'TX',
        MAIL_ZIP: '78130',
        SOURCE: 'COMAL APPRAISAL DISTRICT',
        DATE_ACQ: '20250201',
        FIPS: '48091',
        COUNTY: 'COMAL',
        TAX_YEAR: '2025',
      },
    },
  ],
}

function blankFields(over: Partial<PropertyRecordFields> = {}): PropertyRecordFields {
  return {
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
  }
}

describe('parseTxParcelIdentify', () => {
  it('reads the roll into a tidy record', () => {
    const p = parseTxParcelIdentify(IDENTIFY_HIT)
    expect(p).not.toBeNull()
    expect(p!.propId).toBe('178402')
    expect(p!.ownerName).toBe('WHITFIELD DANA & MARCUS')
    expect(p!.legalDescription).toBe('GRUENE CROSSING 2, BLOCK 4, LOT 17')
    expect(p!.county).toBe('Comal')
    expect(p!.source).toBe('Comal Appraisal District')
    expect(p!.taxYear).toBe('2025')
    // " ," from the roll is tidied; the mailing line stays one line.
    expect(p!.mailingAddress).toBe('412 GRUENE RD, NEW BRAUNFELS, TX 78130')
    expect(p!.situsAddress).toBe('412 GRUENE RD, NEW BRAUNFELS, TX 78130')
    expect(p!.nameCare).toBe('')
  })
  it('composes the mailing line from parts when MAIL_ADDR is blank, and skips substance-free results', () => {
    const raw = {
      results: [
        { attributes: { PROP_ID: ' ', OWNER_NAME: ' ', LEGAL_DESC: ' ' } },
        {
          attributes: {
            PROP_ID: '9',
            OWNER_NAME: 'ORTEGA HOLDINGS LLC',
            LEGAL_DESC: 'PECAN PARK SEC 3, BLOCK C, LOT 12',
            MAIL_ADDR: ' , ,',
            MAIL_LINE1: 'PO BOX 1180',
            MAIL_LINE2: ' ',
            MAIL_CITY: 'SAN MARCOS',
            MAIL_STAT: 'TX',
            MAIL_ZIP: '78667',
            COUNTY: 'HAYS',
            SOURCE: 'HAYS CENTRAL APPRAISAL DISTRICT',
            TAX_YEAR: '2025',
          },
        },
      ],
    }
    const p = parseTxParcelIdentify(raw)
    expect(p!.propId).toBe('9')
    expect(p!.mailingAddress).toBe('PO BOX 1180, SAN MARCOS, TX 78667')
    expect(p!.source).toBe('Hays Central Appraisal District')
  })
  it('is null for nothing under the pin or an error payload', () => {
    expect(parseTxParcelIdentify({ results: [] })).toBeNull()
    expect(parseTxParcelIdentify({ error: { code: 400 } })).toBeNull()
    expect(parseTxParcelIdentify(null)).toBeNull()
    expect(parseTxParcelIdentify('x')).toBeNull()
  })
})

describe('county names', () => {
  it('normalizes the roll and Google spellings to one form', () => {
    expect(normalizeCountyName('COMAL')).toBe('Comal')
    expect(normalizeCountyName('Comal County')).toBe('Comal')
    expect(normalizeCountyName('SAN PATRICIO COUNTY')).toBe('San Patricio')
    expect(normalizeCountyName('  ')).toBe('')
    expect(titleCaseUpperWords('DeWitt')).toBe('DeWitt') // mixed case left alone
  })
  it('reads the county out of Google address components', () => {
    expect(
      countyFromGoogleComponents([
        { long_name: 'New Braunfels', types: ['locality', 'political'] },
        { long_name: 'Comal County', short_name: 'Comal County', types: ['administrative_area_level_2', 'political'] },
        { long_name: 'Texas', types: ['administrative_area_level_1'] },
      ]),
    ).toBe('Comal')
    expect(countyFromGoogleComponents([{ long_name: 'Texas', types: ['administrative_area_level_1'] }])).toBe('')
    expect(countyFromGoogleComponents(undefined)).toBe('')
  })
})

describe('proposeCounty — the ladder', () => {
  it('parcel wins, then geocoder, then the city table', () => {
    expect(proposeCounty({ parcelCounty: 'BEXAR', geocoderCounty: 'Bexar County', cityCounty: 'Guadalupe', city: 'Schertz' })).toMatchObject({
      county: 'Bexar',
      source: 'parcel',
      disagreement: true,
      straddles: true,
    })
    expect(proposeCounty({ parcelCounty: '', geocoderCounty: 'Hays County', cityCounty: 'Hays', city: 'San Marcos' })).toMatchObject({
      county: 'Hays',
      source: 'geocoder',
      disagreement: false,
      candidates: [{ county: 'Hays', source: 'geocoder' }],
    })
    expect(proposeCounty({ parcelCounty: '', geocoderCounty: '', cityCounty: 'Kendall', city: 'Boerne' })).toMatchObject({
      county: 'Kendall',
      source: 'city',
      straddles: false,
    })
    expect(proposeCounty({ parcelCounty: '', geocoderCounty: '', cityCounty: '', city: 'Kingsbury' })).toMatchObject({ county: '', source: '' })
  })
  it('lists every distinct answer best-rung-first so the sheet can offer pills', () => {
    const p = proposeCounty({ parcelCounty: 'Bexar', geocoderCounty: 'Bexar', cityCounty: 'Guadalupe', city: 'schertz' })
    expect(p.candidates).toEqual([
      { county: 'Bexar', source: 'parcel' },
      { county: 'Guadalupe', source: 'city' },
    ])
  })
  it('knows which cities straddle county lines', () => {
    expect(cityStraddlesCounties('Schertz')).toEqual(['Bexar', 'Guadalupe', 'Comal'])
    expect(cityStraddlesCounties('NEW  BRAUNFELS')).toEqual(['Comal', 'Guadalupe'])
    expect(cityStraddlesCounties('Boerne')).toEqual([])
    expect(cityStraddlesCounties('Canyon Lake')).toEqual([]) // one county listed = not a straddler
  })
})

describe('owner and homestead heuristics', () => {
  it('tells entities from people', () => {
    expect(ownerLooksLikeCompany('ORTEGA HOLDINGS LLC')).toBe(true)
    expect(ownerLooksLikeCompany('NEW BRAUNFELS CITY OF')).toBe(true)
    expect(ownerLooksLikeCompany('COMAL ISD')).toBe(true)
    expect(ownerLooksLikeCompany('WHITFIELD DANA & MARCUS')).toBe(false)
    expect(ownerLooksLikeCompany('GARZA ELENA M')).toBe(false)
    expect(ownerLooksLikeCompany('CO HOLDER JANE')).toBe(true) // "CO" alone reads as company — a person confirms
  })
  it('keys an address by number + first street token', () => {
    expect(addressStreetKey('412 Gruene Rd, New Braunfels, TX 78130')).toBe('412 gruene')
    expect(addressStreetKey('412 GRUENE RD , NEW BRAUNFELS, TX')).toBe('412 gruene')
    expect(addressStreetKey('PO BOX 1180, SAN MARCOS, TX')).toBe('')
    expect(addressStreetKey('')).toBe('')
  })
  it('homestead: likely when a person gets mail at the property, unlikely for entities or elsewhere, unknown without data', () => {
    const p = parseTxParcelIdentify(IDENTIFY_HIT)!
    expect(homesteadHint(p, '412 Gruene Rd, New Braunfels, TX 78130')).toBe('likely')
    expect(homesteadHint({ ...p, mailingAddress: 'PO BOX 2210, NEW BRAUNFELS, TX 78131' }, '412 Gruene Rd')).toBe('unlikely')
    expect(homesteadHint({ ...p, ownerName: 'ORTEGA HOLDINGS LLC' }, '412 Gruene Rd')).toBe('unlikely')
    expect(homesteadHint({ ...p, ownerName: '' }, '412 Gruene Rd')).toBe('unknown')
    expect(homesteadHint({ ...p, mailingAddress: '' }, '412 Gruene Rd')).toBe('unknown')
    // No typed address: the roll's own situs line stands in.
    expect(homesteadHint(p, '')).toBe('likely')
  })
})

describe('proposePropertyRecord + applyProposalToFields', () => {
  const parcel = parseTxParcelIdentify(IDENTIFY_HIT)!
  it('a found parcel proposes every lien field with provenance; a person owner is a homeowner', () => {
    const pr = proposePropertyRecord({ address: '412 Gruene Rd, New Braunfels, TX 78130', parcel, geocoderCounty: '', cityCounty: 'Comal', city: 'New Braunfels' })
    expect(pr.found).toBe(true)
    expect(pr.county).toMatchObject({ county: 'Comal', source: 'parcel', disagreement: false, straddles: true })
    expect(pr.ownerName).toBe('WHITFIELD DANA & MARCUS')
    expect(pr.ownerCompany).toBe('')
    expect(pr.ownerMode).toBe('homeowner')
    expect(pr.homestead).toBe('likely')
    expect(pr.provenance).toEqual({ source: 'Comal Appraisal District', taxYear: '2025', propId: '178402' })
  })
  it('an entity owner becomes the company with building-owner mode', () => {
    const pr = proposePropertyRecord({
      address: '55 Pecan Ct, San Marcos, TX',
      parcel: { ...parcel, ownerName: 'ORTEGA HOLDINGS LLC', mailingAddress: 'PO BOX 1180, SAN MARCOS, TX 78667' },
      geocoderCounty: '',
      cityCounty: 'Hays',
      city: 'San Marcos',
    })
    expect(pr.ownerCompany).toBe('ORTEGA HOLDINGS LLC')
    expect(pr.ownerName).toBe('')
    expect(pr.ownerMode).toBe('building_owner')
    expect(pr.homestead).toBe('unlikely')
  })
  it('no parcel still proposes the county from the lower rungs', () => {
    const pr = proposePropertyRecord({ address: '55 Pecan Ct, San Marcos, TX', parcel: null, geocoderCounty: 'Hays County', cityCounty: 'Hays', city: 'San Marcos' })
    expect(pr.found).toBe(false)
    expect(pr.county).toMatchObject({ county: 'Hays', source: 'geocoder' })
    expect(pr.provenance).toBeNull()
  })
  it('fill-blanks never overwrites what a person typed; replace does', () => {
    const pr = proposePropertyRecord({ address: '412 Gruene Rd, New Braunfels, TX', parcel, geocoderCounty: '', cityCounty: 'Comal', city: 'New Braunfels' })
    const typed = blankFields({ legal_description: 'LOT 17 BLK 4 GRUENE CROSSING (typed)', county: 'Guadalupe', county_source: 'manual' })
    const filled = applyProposalToFields(typed, pr, 'fill-blanks')
    expect(filled.legal_description).toBe('LOT 17 BLK 4 GRUENE CROSSING (typed)')
    expect(filled.county).toBe('Guadalupe')
    expect(filled.county_source).toBe('manual')
    expect(filled.owner_name).toBe('WHITFIELD DANA & MARCUS')
    expect(filled.owner_mode).toBe('homeowner')
    expect(filled.owner_mailing_address).toBe('412 GRUENE RD, NEW BRAUNFELS, TX 78130')
    expect(filled.property_kind).toBe('residential')
    expect(filled.homestead).toBe(true)
    expect(filled.parcel_id).toBe('178402')
    expect(filled.parcel_source).toBe('Comal Appraisal District')
    expect(filled.parcel_tax_year).toBe('2025')
    const replaced = applyProposalToFields(typed, pr, 'replace')
    expect(replaced.legal_description).toBe('GRUENE CROSSING 2, BLOCK 4, LOT 17')
    expect(replaced.county).toBe('Comal')
    expect(replaced.county_source).toBe('parcel')
  })
  it('an entity owner marks the parcel non-residential unless the kind was already chosen; homestead is only ever set, never cleared', () => {
    const pr = proposePropertyRecord({
      address: '55 Pecan Ct',
      parcel: { ...parcel, ownerName: 'ORTEGA HOLDINGS LLC', mailingAddress: 'PO BOX 1' },
      geocoderCounty: '',
      cityCounty: '',
      city: '',
    })
    expect(applyProposalToFields(blankFields(), pr, 'fill-blanks').property_kind).toBe('non_residential')
    const chosen = blankFields({ property_kind: 'residential', homestead: true })
    const out = applyProposalToFields(chosen, pr, 'fill-blanks')
    expect(out.property_kind).toBe('residential')
    expect(out.homestead).toBe(true)
  })
  it('a not-found proposal only touches the county', () => {
    const pr = proposePropertyRecord({ address: '1 Nowhere', parcel: null, geocoderCounty: 'Hays', cityCounty: '', city: '' })
    const out = applyProposalToFields(blankFields({ owner_name: 'kept' }), pr, 'replace')
    expect(out.county).toBe('Hays')
    expect(out.county_source).toBe('geocoder')
    expect(out.owner_name).toBe('kept')
    expect(out.parcel_id).toBe('')
  })
  it('prints provenance for the sheet', () => {
    expect(parcelProvenanceLine({ parcel_source: 'Comal Appraisal District', parcel_tax_year: '2025', parcel_id: '178402' })).toBe('Comal Appraisal District · 2025 · Prop ID 178402')
    expect(parcelProvenanceLine({ parcel_source: '', parcel_tax_year: '', parcel_id: '' })).toBe('')
  })
})

describe('proposalFromLookupPayload (client side of the edge function)', () => {
  const parcel: ParcelRecord = parseTxParcelIdentify(IDENTIFY_HIT)!
  it('folds the city table into the ladder and keeps the parcel', () => {
    const out = proposalFromLookupPayload('412 Gruene Rd, New Braunfels, TX 78130', {
      ok: true,
      address_normalized: '412 gruene rd, new braunfels, tx 78130',
      lat: 29.7,
      lng: -98.1,
      geocode_source: 'google',
      county_geocoder: 'Comal',
      parcel,
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.proposal.county.candidates.map((c) => c.source)).toEqual(['parcel'])
    expect(out.parcel?.propId).toBe('178402')
    expect(out.parcelError).toBeNull()
  })
  it('org extras feed the city rung, and a parcel-service failure is surfaced but not fatal', () => {
    setExtraTxCountyMappings({ kingsbury: 'Guadalupe' })
    const out = proposalFromLookupPayload('1207 Kingsbury Ln, Kingsbury, TX 78638', {
      ok: true,
      county_geocoder: '',
      parcel: null,
      parcel_error: 'parcel service timed out',
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.proposal.found).toBe(false)
    expect(out.proposal.county).toMatchObject({ county: 'Guadalupe', source: 'city' })
    expect(out.parcelError).toBe('parcel service timed out')
  })
  it('passes failures through by code', () => {
    expect(proposalFromLookupPayload('x', { ok: false, error: 'not_found', detail: 'Google: not_found' })).toEqual({ ok: false, error: 'not_found' })
    expect(proposalFromLookupPayload('x', null)).toEqual({ ok: false, error: 'empty response' })
  })
})
