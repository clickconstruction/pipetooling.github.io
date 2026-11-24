import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AUSTIN_MAIN_MARK,
  AUSTIN_READER,
  ISSUED_AGAIN_LOOKBACK_DAYS,
  NEW_BRAUNFELS_READER,
  PERMIT_CITIES,
  PERMIT_CITY_NAMES,
  PULL_LOOKBACK_DAYS,
  SAN_MARCOS_READER,
  SEGUIN_READER,
  austinName,
  austinWhere,
  classifyAustin,
  classifyNewBraunfels,
  classifySanMarcos,
  classifySeguin,
  dayFromMs,
  dayFromUsDate,
  feedPasses,
  feedsToPull,
  heldPassStarts,
  issuedReadingRecord,
  layerDayWindow,
  passDayColumns,
  passStarts,
  permitCity,
  type KeptIssuedReading,
  type NewestHeldDays,
  permitRowFromAustin,
  permitRowFromNewBraunfels,
  permitRowFromSanMarcos,
  permitRowFromSeguin,
  preferNewBraunfels,
  newBraunfelsNameRank,
  shortDescription,
  texasPoint,
} from '../../../supabase/functions/_shared/permitCities'
import { SA_APPLIED_FEED } from '../../../supabase/functions/_shared/permitFeed'
import { HISTORY_CITIES } from './permitReach'

// Every name, street and number here is made up.
function austin(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    permittype: 'BP',
    permit_type_desc: 'Building Permit',
    permit_number: '2026-000001 BP',
    permit_class_mapped: 'Commercial',
    permit_class: 'C- 327 Stores & Customer Services',
    work_class: 'New',
    description: 'New one story retail shell building',
    applieddate: '2026-09-02T00:00:00.000',
    issue_date: '2026-11-05T00:00:00.000',
    original_address1: '100 SAMPLE  LN',
    original_zip: '78701',
    latitude: '30.27',
    longitude: '-97.74',
    total_job_valuation: '1400000',
    total_new_add_sqft: '6200',
    contractor_company_name: 'Tall Pine Builders, LLC',
    contractor_full_name: 'Jordan Vale',
    applicant_org: 'Sample Architects',
    ...over,
  }
}

describe('the phone on an Austin permit (v2.8296)', () => {
  it('keeps the contractor’s phone beside a contractor, as ten digits', () => {
    expect(permitRowFromAustin(austin({ contractor_phone: '(512) 555-0101', applicant_phone: '5125559999' }))?.contact_phone).toBe('5125550101')
    // No company, no applicant's firm, and the contractor named: still the contractor's.
    expect(permitRowFromAustin(austin({ contractor_company_name: null, applicant_org: null, contractor_phone: '15125550101', applicant_phone: '5125559999' }))?.contact_phone).toBe('5125550101')
  })

  it('keeps the applicant’s phone when the contact is the applicant', () => {
    expect(permitRowFromAustin(austin({ contractor_company_name: ' ', contractor_phone: '5125550101', applicant_phone: '512-555-0202 x12' }))?.contact_phone).toBe('5125550202')
    expect(permitRowFromAustin(austin({ contractor_company_name: null, applicant_org: null, contractor_full_name: null, applicant_full_name: 'Dana Whitlock', contractor_phone: '5125550101', applicant_phone: '5125550202' }))?.contact_phone).toBe('5125550202')
  })

  it('keeps nothing that is no phone, and nothing when nobody is named', () => {
    expect(permitRowFromAustin(austin({ contractor_phone: '512' }))?.contact_phone).toBeNull()
    expect(permitRowFromAustin(austin({ contractor_phone: '0000000000' }))?.contact_phone).toBeNull()
    expect(permitRowFromAustin(austin({}))?.contact_phone).toBeNull()
    const nobody = permitRowFromAustin(austin({ contractor_company_name: '', applicant_org: '', contractor_full_name: '  ', applicant_full_name: null, contractor_phone: '5125550101' }))
    expect(nobody?.contact).toBeNull()
    expect(nobody?.contact_phone).toBeNull()
  })

  it('is Austin’s alone: a city whose feed gives no phone writes no such column', () => {
    // One request writes one set of columns, so a city's rows carry the key or none does.
    expect('contact_phone' in (permitRowFromAustin(austin({})) ?? {})).toBe(true)
    const sanMarcos = permitRowFromSanMarcos({ TYPE: 'New Commercial', LANDUSE: 'Commercial', STATUS: 'In Review', ADDRESS: '100 SAMPLE ST', PROJECTNUMBER: '2026-00001', PERMITID: '1', APPLIED: Date.UTC(2026, 8, 2, 15), ISSUED: null, SQUAREFEET: 4300, ProjectName: 'Sample Retail Shell', _lat: 29.88, _lng: -97.94 })
    expect(sanMarcos).not.toBeNull()
    expect('contact_phone' in (sanMarcos ?? {})).toBe(false)
  })
})

describe('the cities the pull reads (punch list #292, revision 4)', () => {
  it('lists San Antonio first, then Austin and the three towns between, each with its county and its own search pages', () => {
    expect(PERMIT_CITY_NAMES).toEqual(['San Antonio', 'Austin', 'New Braunfels', 'San Marcos', 'Seguin'])
    expect(permitCity('new braunfels')?.county).toBe('Comal')
    expect(permitCity('San Marcos')?.county).toBe('Hays')
    expect(permitCity('Seguin')?.county).toBe('Guadalupe')
    expect(permitCity('austin')?.county).toBe('Travis')
    expect(permitCity(' San Antonio ')?.parcels).toBe(true)
    for (const c of PERMIT_CITIES) expect(c.parcels).toBe(true)
    expect(permitCity('Nowhere')).toBeNull()
    for (const c of PERMIT_CITIES) {
      expect(c.permitSearch).toMatch(/^https:\/\//)
      // Every city the pull reads has its county clerk's deed search.
      expect(c.deeds).toMatch(/^https:\/\//)
      expect(c.feeds.length).toBeGreaterThan(0)
      for (const f of c.feeds) expect(f.city).toBe(c.name)
    }
    // Every feed has its own source name: the pull's newest-day read and the upsert key stand on it.
    const sources = PERMIT_CITIES.flatMap((c) => c.feeds.map((f) => f.source))
    expect(new Set(sources).size).toBe(sources.length)
  })

  it('a pull runs one city when it is named and every city otherwise', () => {
    expect(feedsToPull('Austin').map((f) => f.source)).toEqual(['austin-issued'])
    expect(feedsToPull('San Antonio').map((f) => f.source)).toEqual(['sa-issued', 'sa-applied'])
    expect(feedsToPull(null).length).toBe(PERMIT_CITIES.reduce((n, c) => n + c.feeds.length, 0))
  })
})

describe("Austin's kinds of work", () => {
  it('keeps new buildings, shells, remodels and additions, and calls a structure that is not a building site work', () => {
    expect(classifyAustin(austin())).toEqual({ kind: 'building', residential: false, work: 'New commercial' })
    expect(classifyAustin(austin({ work_class: 'Shell' }))?.work).toBe('New commercial')
    expect(classifyAustin(austin({ work_class: 'Remodel' }))?.work).toBe('Commercial remodel')
    expect(classifyAustin(austin({ work_class: 'Addition and Remodel' }))?.work).toBe('Commercial addition')
    expect(classifyAustin(austin({ permit_class: 'C- 329 Com Structures Other Than Bldg' }))?.work).toBe('Commercial site work')
  })

  it('keeps a new house and a home addition as houses, and leaves out repairs and demolitions', () => {
    expect(classifyAustin(austin({ permit_class_mapped: 'Residential', work_class: 'New' }))).toEqual({ kind: 'building', residential: true, work: 'New house' })
    expect(classifyAustin(austin({ permit_class_mapped: 'Residential', work_class: 'Addition' }))?.work).toBe('Home addition')
    expect(classifyAustin(austin({ permit_class_mapped: 'Residential', work_class: 'Repair' }))).toBeNull()
    expect(classifyAustin(austin({ work_class: 'Demolition' }))).toBeNull()
    expect(classifyAustin(austin({ work_class: 'Interior Demo Non-Structural' }))).toBeNull()
  })

  it('keeps a plumbing permit as the plumber signal, and leaves out the lawn, the fire line and the other trades', () => {
    expect(classifyAustin(austin({ permittype: 'PP', work_class: 'New' }))).toEqual({ kind: 'plumbing', residential: false, work: 'Plumbing new' })
    expect(classifyAustin(austin({ permittype: 'PP', work_class: 'Plumbing Service Line' }))?.work).toBe('Plumbing service line')
    expect(classifyAustin(austin({ permittype: 'PP', work_class: 'Irrigation' }))).toBeNull()
    expect(classifyAustin(austin({ permittype: 'PP', work_class: 'Fireline' }))).toBeNull()
    expect(classifyAustin(austin({ permittype: 'EP' }))).toBeNull()
    expect(classifyAustin(austin({ permittype: 'MP' }))).toBeNull()
  })
})

describe('one Austin record as a permits row', () => {
  it('reads the number, the days, the street, the point, the money and who pulled it', () => {
    expect(permitRowFromAustin(austin())).toMatchObject({
      city: 'Austin',
      source: 'austin-issued',
      permit_number: '2026-000001 BP',
      permit_type: 'Building Permit',
      kind: 'building',
      stage: 'issued',
      residential: false,
      work_type: 'New commercial',
      project_name: 'New one story retail shell building',
      address: '100 SAMPLE LN',
      address_key: '100 sample ln',
      zip: '78701',
      lat: 30.27,
      lng: -97.74,
      submitted_on: '2026-09-02',
      issued_on: '2026-11-05',
      declared_value: 1_400_000,
      area_sf: 6200,
      contact: 'Tall Pine Builders, LLC',
      builder_key: 'tallpinebuilders',
    })
  })

  it('falls back down the names, and reads a zero as nothing declared', () => {
    const row = permitRowFromAustin(austin({ contractor_company_name: null, total_job_valuation: '0', total_new_add_sqft: null, latitude: null }))
    expect(row?.contact).toBe('Sample Architects')
    expect(row?.declared_value).toBeNull()
    expect(row?.area_sf).toBeNull()
    expect(row?.lat).toBeNull()
    expect(permitRowFromAustin(austin({ contractor_company_name: '', applicant_org: '', contractor_full_name: '  ' }))?.contact).toBeNull()
    expect(permitRowFromAustin(austin({ permit_number: '' }))).toBeNull()
    expect(permitRowFromAustin(austin({ permittype: 'EP' }))).toBeNull()
  })

  it('a plumbing permit carries the plumber and pairs with a building on its street', () => {
    const row = permitRowFromAustin(austin({ permittype: 'PP', permit_type_desc: 'Plumbing Permit', permit_number: '2026-000002 PP', work_class: 'New', contractor_company_name: 'Sample Plumbing Co' }))
    expect(row).toMatchObject({ kind: 'plumbing', permit_type: 'Plumbing Permit', contact: 'Sample Plumbing Co', address_key: '100 sample ln' })
  })

  it('cuts a long description at a word, and takes no point outside Texas', () => {
    const long = 'Interior remodel of an existing second floor office suite with new partitions, ceilings, lighting and two new restrooms'
    const cut = shortDescription(long)
    expect(cut?.endsWith('…')).toBe(true)
    expect(cut!.length).toBeLessThanOrEqual(91)
    expect(long.startsWith(cut!.slice(0, -1))).toBe(true)
    expect(shortDescription('  Short   one ')).toBe('Short one')
    expect(shortDescription(null)).toBeNull()
    expect(texasPoint('0', '0')).toBeNull()
    expect(texasPoint('30.27', '-97.74')).toEqual({ lat: 30.27, lng: -97.74 })
  })
})

describe("Austin's MAIN mark on a contractor's name", () => {
  // Every spelling the feed held on 2026-11-20, each after a made-up name.
  const STARRED = ['***MAIN***', '**MAIN**', '**Main**', '**MAIN***', '**MAIN', '***Main***', '*MAIN*', '***MAIN', '***Main', '***MAIN**', '*MAIN', '*** MAIN', '****Main*****', '*Main*', '*MAIN**']
  const BRACKETED = ['(MAIN)', '(Main)', '(Main GC account)']

  it.each([...STARRED, ...BRACKETED])('takes %s off the end of a name, glued on or after a space', (mark) => {
    expect(austinName(`Tall Pine Builders, LLC${mark}`)).toBe('Tall Pine Builders, LLC')
    expect(austinName(`Tall Pine Builders, LLC ${mark}`)).toBe('Tall Pine Builders, LLC')
    expect(austinName(`Cedar Fork Construction Inc.${mark}`)).toBe('Cedar Fork Construction Inc.')
    expect(austinName(`  Jordan   Vale ${mark} `)).toBe('Jordan Vale')
  })

  it('takes the mark out of the middle of a name and closes the gap', () => {
    expect(austinName('Vale/Reed (MAIN) Construction Company')).toBe('Vale/Reed Construction Company')
    expect(austinName('Vale Reed **MAIN** Construction')).toBe('Vale Reed Construction')
  })

  it('leaves a name that only holds the word', () => {
    for (const name of ['Main Street Builders, LLC', 'Hill Country Home Maintenance', 'Domain Construction', 'Mainstream Services', 'Cedar Fork (Formerly Main Line Restoration)', 'Vale * Reed Plumbing', 'Reed Plumbing (DBA: Vale Plumbing)', '**Mainland Homes']) {
      expect(austinName(name)).toBe(name)
    }
  })

  it('reads a name that was nothing but the mark as no name', () => {
    expect(austinName('**MAIN**')).toBeNull()
    expect(austinName(' (MAIN) ')).toBeNull()
    expect(austinName('')).toBeNull()
    expect(austinName(null)).toBeNull()
    expect(austinName(42)).toBeNull()
  })

  it('one company is one builder, with the mark and without it', () => {
    const plain = permitRowFromAustin(austin({ contractor_company_name: 'Cedar Fork Homes' }))
    for (const mark of STARRED) {
      const marked = permitRowFromAustin(austin({ contractor_company_name: `Cedar Fork Homes${mark}` }))
      expect(marked?.contact).toBe('Cedar Fork Homes')
      expect(marked?.builder_key).toBe(plain?.builder_key)
    }
  })

  it('a name with a comma keeps its own key, never the mark as the key', () => {
    // Before, the splitter took "Inc.**MAIN**" as the company and every such contractor keyed to "main".
    const a = permitRowFromAustin(austin({ contractor_company_name: 'Tall Pine Builders, Inc.**MAIN**' }))
    const b = permitRowFromAustin(austin({ contractor_company_name: 'Cedar Fork Homes, LLC(MAIN)' }))
    expect(a).toMatchObject({ contact: 'Tall Pine Builders, Inc.', builder_key: 'tallpinebuilders' })
    expect(b).toMatchObject({ contact: 'Cedar Fork Homes, LLC', builder_key: 'cedarforkhomes' })
  })

  it('reads past a name that was only the mark, and keeps the feed\'s own text in raw', () => {
    const record = austin({ contractor_company_name: '*MAIN', applicant_org: '*MAIN', contractor_full_name: 'Jordan Vale' })
    const row = permitRowFromAustin(record)
    expect(row?.contact).toBe('Jordan Vale')
    expect(row?.raw).toBe(record)
    const marked = austin({ contractor_company_name: 'Tall Pine Builders, LLC ***MAIN***' })
    expect((permitRowFromAustin(marked)?.raw as Record<string, unknown>)['contractor_company_name']).toBe('Tall Pine Builders, LLC ***MAIN***')
  })

  it('a plumbing permit loses the mark too, so it keys with the building permit', () => {
    const building = permitRowFromAustin(austin({ contractor_company_name: 'Sample Plumbing Co' }))
    const plumbing = permitRowFromAustin(austin({ permittype: 'PP', permit_type_desc: 'Plumbing Permit', permit_number: '2026-000002 PP', work_class: 'New', contractor_company_name: 'Sample Plumbing Co***MAIN**' }))
    expect(plumbing).toMatchObject({ kind: 'plumbing', contact: 'Sample Plumbing Co' })
    expect(plumbing?.builder_key).toBe(building?.builder_key)
  })

  it('the one-off for the rows already stored holds the same pattern', () => {
    const sql = readFileSync('supabase/migrations/20261120110000_permit_austin_main_mark.sql', 'utf8')
    expect(sql).toContain(`'${AUSTIN_MAIN_MARK}'`)
    expect(sql).toMatch(/WHERE p\.city = 'Austin'/)
  })
})

describe("Austin's door", () => {
  it('asks for the kept kinds issued since a day, oldest first, a page at a time', () => {
    const where = austinWhere('2026-09-01')
    expect(where).toContain("issue_date >= '2026-09-01T00:00:00'")
    expect(where).toContain("permittype = 'BP'")
    expect(where).toContain("work_class not in ('Irrigation', 'Fireline', 'Demolition')")
    expect(() => austinWhere('yesterday')).toThrow()
    const url = new URL(AUSTIN_READER.pageUrl('2026-09-01', 2000, 4000))
    expect(url.origin + url.pathname).toBe('https://data.austintexas.gov/resource/3syk-w9eu.json')
    expect(url.searchParams.get('$order')).toBe('issue_date ASC, permit_number ASC')
    expect(url.searchParams.get('$limit')).toBe('2000')
    expect(url.searchParams.get('$offset')).toBe('4000')
  })

  it("reads the door's answer, and says the door's own words when it refused", () => {
    expect(AUSTIN_READER.recordsOf([austin()])).toHaveLength(1)
    expect(() => AUSTIN_READER.recordsOf({ message: 'Invalid SoQL query' })).toThrow(/Invalid SoQL query/)
  })
})

// 2026-11-05T15:00:00Z and 2026-09-02T15:00:00Z, the way a map layer writes a day.
const NOV_5 = Date.UTC(2026, 10, 5, 15)
const SEP_2 = Date.UTC(2026, 8, 2, 15)

describe("a city's map layer as a door", () => {
  it('reads a day from the layer and from a written date', () => {
    expect(dayFromMs(NOV_5)).toBe('2026-11-05')
    expect(dayFromMs(null)).toBeNull()
    expect(dayFromMs(0)).toBeNull()
    expect(dayFromUsDate('10/7/2026 8:07:43 AM')).toBe('2026-10-07')
    expect(dayFromUsDate('')).toBeNull()
  })

  it('asks a page at a time, never more than the layer hands over, oldest first with the point in degrees', () => {
    const url = new URL(SAN_MARCOS_READER.pageUrl('2026-09-01', 2000, 1000))
    expect(url.pathname.endsWith('/CoSM_BuildingPermits/FeatureServer/0/query')).toBe(true)
    expect(url.searchParams.get('resultRecordCount')).toBe('1000')
    expect(url.searchParams.get('resultOffset')).toBe('1000')
    expect(url.searchParams.get('outSR')).toBe('4326')
    expect(url.searchParams.get('orderByFields')).toBe('APPLIED ASC, OBJECTID ASC')
    expect(url.searchParams.get('where')).toContain("APPLIED >= DATE '2026-09-01' OR ISSUED >= DATE '2026-09-01'")
    expect(SAN_MARCOS_READER.pageSize).toBe(1000)
    expect(() => SEGUIN_READER.pageUrl('last week', 1000, 0)).toThrow()
  })

  it("hands back each feature's attributes with its point, and says the layer's own words when it refused", () => {
    const recs = SEGUIN_READER.recordsOf({ features: [{ attributes: { USER_PERMITNUMBER: 'BCOM0926-0001' }, geometry: { x: -97.96, y: 29.57 } }, { attributes: { USER_PERMITNUMBER: 'BCOM0926-0002' }, geometry: null }] })
    expect(recs).toEqual([
      { USER_PERMITNUMBER: 'BCOM0926-0001', _lat: 29.57, _lng: -97.96 },
      { USER_PERMITNUMBER: 'BCOM0926-0002', _lat: null, _lng: null },
    ])
    expect(() => NEW_BRAUNFELS_READER.recordsOf({ error: { code: 400, message: 'Unable to complete operation.' } })).toThrow(/Unable to complete operation/)
    expect(() => NEW_BRAUNFELS_READER.recordsOf(null)).toThrow()
  })
})

describe('San Marcos', () => {
  const sm = (over: Record<string, unknown> = {}) => ({ TYPE: 'New Commercial', LANDUSE: 'Commercial', STATUS: 'In Review', ADDRESS: '100 SAMPLE ST', PROJECTNUMBER: '2026-00001', PERMITID: '1', APPLIED: SEP_2, ISSUED: null, SQUAREFEET: 4300, ProjectName: 'Sample Retail Shell', created_user: 'staff', _lat: 29.88, _lng: -97.94, ...over })

  it('keeps commercial new builds, finish outs, additions and site prep, and reads apartments as commercial work', () => {
    expect(classifySanMarcos(sm())?.work).toBe('New commercial')
    expect(classifySanMarcos(sm({ TYPE: 'Tenant Finish Out' }))?.work).toBe('Commercial remodel')
    expect(classifySanMarcos(sm({ TYPE: 'Addition' }))?.work).toBe('Commercial addition')
    expect(classifySanMarcos(sm({ TYPE: 'Site Prep.' }))?.work).toBe('Commercial site work')
    expect(classifySanMarcos(sm({ TYPE: 'New Residential', LANDUSE: 'Multi-Family' }))).toEqual({ kind: 'building', residential: false, work: 'New commercial' })
    expect(classifySanMarcos(sm({ TYPE: 'New Residential', LANDUSE: 'Single Family' }))).toEqual({ kind: 'building', residential: true, work: 'New house' })
    expect(classifySanMarcos(sm({ TYPE: 'Plumbing' }))?.kind).toBe('plumbing')
    expect(classifySanMarcos(sm({ TYPE: 'Remodel', LANDUSE: 'Single Family' }))).toBeNull()
    expect(classifySanMarcos(sm({ TYPE: 'Irrigation' }))).toBeNull()
    expect(classifySanMarcos(sm({ TYPE: 'Sign' }))).toBeNull()
  })

  it('makes a row with no name on it, the square feet, and the days as days', () => {
    const row = permitRowFromSanMarcos(sm({ ISSUED: NOV_5 }))
    expect(row).toMatchObject({ city: 'San Marcos', source: 'sm-permits', permit_number: '2026-00001', permit_type: 'New Commercial', stage: 'issued', address: '100 SAMPLE ST', address_key: '100 sample st', lat: 29.88, lng: -97.94, submitted_on: '2026-09-02', issued_on: '2026-11-05', area_sf: 4300, contact: null, builder_key: null, project_name: 'Sample Retail Shell' })
    expect(row?.raw).toMatchObject({ APPLIED: '2026-09-02', ISSUED: '2026-11-05' })
    expect(row?.raw).not.toHaveProperty('created_user')
    expect(row?.raw).not.toHaveProperty('_lat')
    expect(permitRowFromSanMarcos(sm())?.stage).toBe('applied')
    expect(permitRowFromSanMarcos(sm({ STATUS: 'Void' }))).toBeNull()
    expect(permitRowFromSanMarcos(sm({ SQUAREFEET: 0 }))?.area_sf).toBeNull()
  })
})

describe('Seguin', () => {
  const sg = (over: Record<string, unknown> = {}) => ({ USER_DESCRIPTION: 'Commercial Building New', USER_DESCRIPTION1: 'New restaurant with drive through', USER_PERMITNUMBER: 'BCOM0926-0001', USER_PERMITSTATUS: 'Issued', USER_NAME: 'Building Commercial', USER_APPLYDATE: SEP_2, USER_DATEISSUED: '10/7/2026 8:07:43 AM', USER_Address: '100 SAMPLE ST', USER_URL: 'https://city.example/permit/1', Last7Days: 'N', _lat: 29.57, _lng: -97.96, ...over })

  it('reads the kind off the start of the description', () => {
    expect(classifySeguin(sg())?.work).toBe('New commercial')
    expect(classifySeguin(sg({ USER_DESCRIPTION: 'Commercial Building New (Arch/Eng)' }))?.work).toBe('New commercial')
    expect(classifySeguin(sg({ USER_DESCRIPTION: 'Commercial Remodel - Finish Out' }))?.work).toBe('Commercial remodel')
    expect(classifySeguin(sg({ USER_DESCRIPTION: 'Commercial Add On' }))?.work).toBe('Commercial addition')
    expect(classifySeguin(sg({ USER_DESCRIPTION: 'Commercial Plumbing' }))?.kind).toBe('plumbing')
    expect(classifySeguin(sg({ USER_DESCRIPTION: 'Building Residental (2019) - New single-family dwelling.' }))).toEqual({ kind: 'building', residential: true, work: 'New house' })
    expect(classifySeguin(sg({ USER_DESCRIPTION: 'Commercial Mechanical' }))).toBeNull()
    expect(classifySeguin(sg({ USER_DESCRIPTION: 'Irrigation Permit' }))).toBeNull()
  })

  it("makes a row that names no one, since the layer's name is the desk, and keeps the city's link", () => {
    const row = permitRowFromSeguin(sg())
    expect(row).toMatchObject({ city: 'Seguin', source: 'seguin-permits', permit_number: 'BCOM0926-0001', permit_type: 'Commercial Building New', stage: 'issued', submitted_on: '2026-09-02', issued_on: '2026-10-07', contact: null, project_name: 'New restaurant with drive through', lat: 29.57 })
    expect(row?.raw).toMatchObject({ USER_URL: 'https://city.example/permit/1', USER_APPLYDATE: '2026-09-02' })
    expect(permitRowFromSeguin(sg({ USER_DESCRIPTION: 'Building Residental (2019) - New single-family dwelling. Was "Residential Building New".' }))?.permit_type).toBe('Building Residental')
    expect(permitRowFromSeguin(sg({ USER_DATEISSUED: null }))?.stage).toBe('applied')
    expect(permitRowFromSeguin(sg({ USER_PERMITNUMBER: null }))).toBeNull()
  })
})

describe('New Braunfels', () => {
  const nb = (over: Record<string, unknown> = {}) => ({ Permit_Group: 'Building', Permit_TYPE_DESC: 'Commercial  EPR', Permit_SUBTYPE_DESC: 'New Build', Permit_Type_Name: 'Commercial - New Build (epr)', Permit_Label: 'Sample Clinic', Permit_Status: 'IN REVIEW', Permit_Address: '100 SAMPLE ST', CoNB_Permit_Number: 'BP2026-001', Applicant_Name: 'Jordan Vale', Property_Owner_Name: 'Sample Holdings LLC', Contractor_Name: null, Permit_Submit_Date: SEP_2, Permit_Issue_Date: null, GlobalID: '{x}', _lat: 29.7, _lng: -98.12, ...over })

  it('reads the kind off the type and the subtype, a copied subtype included', () => {
    expect(classifyNewBraunfels(nb())?.work).toBe('New commercial')
    expect(classifyNewBraunfels(nb({ Permit_TYPE_DESC: 'Commercial', Permit_SUBTYPE_DESC: 'New Build (clone)' }))?.work).toBe('New commercial')
    expect(classifyNewBraunfels(nb({ Permit_SUBTYPE_DESC: 'Alteration-Remodel' }))?.work).toBe('Commercial remodel')
    expect(classifyNewBraunfels(nb({ Permit_SUBTYPE_DESC: 'Finish Out' }))?.work).toBe('Commercial remodel')
    expect(classifyNewBraunfels(nb({ Permit_SUBTYPE_DESC: 'Addition' }))?.work).toBe('Commercial addition')
    expect(classifyNewBraunfels(nb({ Permit_SUBTYPE_DESC: 'Sign' }))).toBeNull()
    expect(classifyNewBraunfels(nb({ Permit_TYPE_DESC: 'Commercial Plumbing', Permit_SUBTYPE_DESC: 'Plumbing' }))?.kind).toBe('plumbing')
    expect(classifyNewBraunfels(nb({ Permit_TYPE_DESC: 'Residential  EPR' }))).toEqual({ kind: 'building', residential: true, work: 'New house' })
    expect(classifyNewBraunfels(nb({ Permit_TYPE_DESC: 'Residential  EPR', Permit_SUBTYPE_DESC: 'Pool-Spa' }))).toBeNull()
  })

  it('names the contractor once the city has one, else the applicant, and keys the builder', () => {
    expect(permitRowFromNewBraunfels(nb())).toMatchObject({ city: 'New Braunfels', source: 'nb-permits', permit_number: 'BP2026-001', stage: 'applied', contact: 'Jordan Vale', submitted_on: '2026-09-02', project_name: 'Sample Clinic' })
    const built = permitRowFromNewBraunfels(nb({ Contractor_Name: 'Tall Pine Builders, LLC', Permit_Issue_Date: NOV_5 }))
    expect(built).toMatchObject({ stage: 'issued', issued_on: '2026-11-05', contact: 'Tall Pine Builders, LLC', builder_key: 'tallpinebuilders' })
    expect(built?.raw).toMatchObject({ Property_Owner_Name: 'Sample Holdings LLC', Permit_Submit_Date: '2026-09-02' })
    expect(built?.raw).not.toHaveProperty('GlobalID')
    expect(permitRowFromNewBraunfels(nb({ Permit_Status: 'WITHDRAWN' }))).toBeNull()
  })
})


describe('the day each reading starts from (punch list #405, v2.8328)', () => {
  const [issued, applied] = feedsToPull('San Antonio')
  const passes = feedPasses(applied!, false)
  const TODAY = '2026-11-22'

  it('looks back ten days on a feed’s own reading and thirty on the second', () => {
    expect([PULL_LOOKBACK_DAYS, ISSUED_AGAIN_LOOKBACK_DAYS]).toEqual([10, 30])
    expect(passes.map((p) => p.lookbackDays)).toEqual([10, 30])
    expect(feedPasses(applied!, true).map((p) => p.lookbackDays)).toEqual([10])
    for (const city of PERMIT_CITY_NAMES) {
      for (const feed of feedsToPull(city)) expect(feedPasses(feed, false)[0]!.lookbackDays).toBe(10)
    }
  })

  it('names each day column a run reads before it writes, once', () => {
    expect(passDayColumns(passes)).toEqual(['submitted_on', 'issued_on'])
    expect(passDayColumns(feedPasses(issued!, false))).toEqual(['issued_on'])
    expect(passDayColumns([...feedPasses(issued!, false), passes[1]!])).toEqual(['issued_on'])
    expect(passDayColumns([])).toEqual([])
  })

  it('starts each reading from the days held before the run wrote a row', () => {
    // A night like the one the gap opened on: the newest issued day held is the 13th, and a permit dated the 9th is still to read.
    const held = { submitted_on: '2026-11-20', issued_on: '2026-11-13' }
    const starts = passStarts(passes, held, TODAY)
    expect(starts).toEqual(['2026-11-10', '2026-10-14'])
    expect('2026-11-09' >= starts[1]!).toBe(true)
    // The first reading then writes a fresher issued day. Ten days back from that one starts past the 9th: the old fault.
    const afterTheFirstReading = { ...held, issued_on: '2026-11-20' }
    const tenDaysBack = passes.map((p) => ({ ...p, lookbackDays: 10 }))
    expect(passStarts(tenDaysBack, afterTheFirstReading, TODAY)[1]).toBe('2026-11-10')
    expect('2026-11-09' >= passStarts(tenDaysBack, afterTheFirstReading, TODAY)[1]!).toBe(false)
  })

  it('needs the days held before the run, thirty days or not: a pull that was down for weeks', () => {
    // Nothing ran from early October. The first reading catches up and writes an issued day of the 20th of November.
    const before = { submitted_on: '2026-10-02', issued_on: '2026-10-01' }
    const after = { submitted_on: '2026-11-21', issued_on: '2026-11-20' }
    const issuedWhileDown = '2026-10-05'
    expect(passStarts(passes, before, TODAY)).toEqual(['2026-09-22', '2026-09-01'])
    expect(issuedWhileDown >= passStarts(passes, before, TODAY)[1]!).toBe(true)
    // Counted from what the first reading had just written, the second would start past that permit.
    expect(passStarts(passes, after, TODAY)[1]).toBe('2026-10-21')
    expect(issuedWhileDown >= passStarts(passes, after, TODAY)[1]!).toBe(false)
  })

  it('reads a column with no day held as a first run, seventy-five days back from today', () => {
    expect(passStarts(passes, {}, TODAY)).toEqual(['2026-09-08', '2026-09-08'])
    expect(passStarts(passes, { submitted_on: null, issued_on: null }, TODAY)).toEqual(['2026-09-08', '2026-09-08'])
    // Applications held and none with a permit yet: the first reading goes on as usual, the second is a first run.
    expect(passStarts(passes, { submitted_on: '2026-11-20' }, TODAY)).toEqual(['2026-11-10', '2026-09-08'])
    expect(passStarts(passes, { submitted_on: '2026-11-20', issued_on: null }, TODAY)).toEqual(['2026-11-10', '2026-09-08'])
  })

  it('counts a newest day after today as today, so a day typed a year ahead stops no reading', () => {
    expect(passStarts(passes, { submitted_on: '2027-11-20', issued_on: '2027-11-09' }, TODAY)).toEqual(['2026-11-12', '2026-10-23'])
    // Today itself is a day like any other.
    expect(passStarts(passes, { submitted_on: TODAY, issued_on: TODAY }, TODAY)).toEqual(['2026-11-12', '2026-10-23'])
  })

  it('counts back across a month and a year', () => {
    expect(passStarts(passes, { submitted_on: '2027-01-05', issued_on: '2027-01-05' }, '2027-01-06')).toEqual(['2026-12-26', '2026-12-06'])
    expect(passStarts(passes, { submitted_on: '2028-03-05', issued_on: '2028-03-05' }, '2028-03-06')).toEqual(['2028-02-24', '2028-02-04'])
  })

  it('starts every reading on the day the body names, whatever is held', () => {
    expect(passStarts(passes, { submitted_on: '2026-11-20', issued_on: '2026-11-13' }, TODAY, '2026-06-01')).toEqual(['2026-06-01', '2026-06-01'])
    expect(passStarts(feedPasses(applied!, true), {}, TODAY, '2025-01-01')).toEqual(['2025-01-01'])
    expect(passStarts([], {}, TODAY)).toEqual([])
  })

  it('gives a feed read once the start it always had', () => {
    for (const city of PERMIT_CITY_NAMES) {
      for (const feed of feedsToPull(city)) {
        const one = feedPasses(feed, false)[0]!
        expect(passStarts([one], { [one.dayColumn]: '2026-11-06' }, '2026-11-09')).toEqual(['2026-10-27'])
        expect(passStarts([one], {}, '2026-11-09')).toEqual(['2026-08-26'])
      }
    }
  })

  it('has permit-pull work every start out before its first page, and nowhere else', () => {
    const src = readFileSync('supabase/functions/permit-pull/index.ts', 'utf8')
    const starts = src.indexOf('const starts = heldPassStarts(passes, passStarts(passes, newestHeld, today, sinceOverride), kept, sinceOverride)')
    const reads = src.indexOf('for (const col of passDayColumns(passes)) newestHeld[col] = await newestHeldDay(admin, feed.source, col)')
    const loop = src.indexOf('for (const [i, pass] of passes.entries()) {')
    const firstPage = src.indexOf('await readPage(feed, pass, since, size, offset, until)')
    const firstWrite = src.indexOf(".upsert(")
    expect(reads).toBeGreaterThan(-1)
    expect(starts).toBeGreaterThan(reads)
    expect(loop).toBeGreaterThan(starts)
    expect(firstPage).toBeGreaterThan(loop)
    expect(firstWrite).toBeGreaterThan(firstPage)
    // Inside the readings' loop nothing reads a newest day or counts a start again.
    const inLoop = src.slice(loop)
    expect(inLoop).toContain('const since = starts[i]!')
    expect(inLoop).not.toMatch(/newestHeldDay\(|passStarts\(|pullSinceDay\(|ascending: false/)
    expect(src).not.toContain('pullSinceDay')
    // One read of the newest day in the whole function.
    expect(src.split('newestHeldDay(').length - 1).toBe(2)
  })
})

describe('the second reading keeps its own start (punch list #405, v2.8402)', () => {
  const [issued, applied] = feedsToPull('San Antonio')
  const passes = feedPasses(applied!, false)

  /** One night: the starts from the days held, held to the kept start, and what the night keeps. */
  function night(today: string, held: NewestHeldDays, kept: KeptIssuedReading | null, readWhole: boolean) {
    const starts = heldPassStarts(passes, passStarts(passes, held, today), kept, null)
    const record = issuedReadingRecord(passes, starts, readWhole)
    return { starts, kept: { issuedSince: record.issued_since, issuedWhole: record.issued_whole } as KeptIssuedReading }
  }

  it('a month of failed second readings alone still reads the permits issued while it was down', () => {
    // 2026-10-01: the second reading starts 30 days before the 30th of September and fails.
    let n = night('2026-10-01', { submitted_on: '2026-09-30', issued_on: '2026-09-30' }, null, false)
    expect(n.starts).toEqual(['2026-09-20', '2026-08-31'])
    const firstFailure = n.starts[1]!
    // Every night after, the first reading runs and writes the newest issued day; the second fails again.
    for (let day = 2; day <= 31; day++) {
      const today = `2026-10-${String(day).padStart(2, '0')}`
      const yesterday = `2026-10-${String(day - 1).padStart(2, '0')}`
      n = night(today, { submitted_on: yesterday, issued_on: yesterday }, n.kept, false)
      // Without the kept start it would count from yesterday: past the 1st of October by the 31st.
      expect(passStarts(passes, { submitted_on: yesterday, issued_on: yesterday }, today)[1]! > firstFailure).toBe(true)
      expect(n.starts[1]).toBe(firstFailure)
      expect(n.starts[0]).toBe(passStarts(passes, { submitted_on: yesterday, issued_on: yesterday }, today)[0])
    }
    // A permit issued on the 2nd of October, the second night it was down, is inside the start on the 1st of November.
    n = night('2026-11-01', { submitted_on: '2026-10-31', issued_on: '2026-10-31' }, n.kept, true)
    expect('2026-10-02' >= n.starts[1]!).toBe(true)
    expect(n.starts[1]).toBe(firstFailure)
    // That reading read to its end: the next night counts from the days held again.
    n = night('2026-11-02', { submitted_on: '2026-11-01', issued_on: '2026-11-01' }, n.kept, true)
    expect(n.starts).toEqual(['2026-10-22', '2026-10-02'])
  })

  it('a kept start later than the one the days held give changes nothing', () => {
    const starts = passStarts(passes, { submitted_on: '2026-11-20', issued_on: '2026-11-13' }, '2026-11-22')
    expect(heldPassStarts(passes, starts, { issuedSince: '2026-11-01', issuedWhole: false })).toEqual(starts)
  })

  it('a whole reading, an older row with nothing kept, and a feed read once start as v2.8328 does', () => {
    const starts = passStarts(passes, { submitted_on: '2026-11-20', issued_on: '2026-11-13' }, '2026-11-22')
    expect(heldPassStarts(passes, starts, { issuedSince: '2026-09-01', issuedWhole: true })).toEqual(starts)
    expect(heldPassStarts(passes, starts, { issuedSince: null, issuedWhole: null })).toEqual(starts)
    expect(heldPassStarts(passes, starts, { issuedSince: null, issuedWhole: false })).toEqual(starts)
    expect(heldPassStarts(passes, starts, null)).toEqual(starts)
    const once = feedPasses(issued!, false)
    const onceStarts = passStarts(once, { issued_on: '2026-11-13' }, '2026-11-22')
    expect(heldPassStarts(once, onceStarts, { issuedSince: '2026-09-01', issuedWhole: false })).toEqual(onceStarts)
  })

  it('the body’s since starts every reading on its day and keeps nothing', () => {
    const starts = passStarts(passes, {}, '2026-11-22', '2026-06-01')
    expect(heldPassStarts(passes, starts, { issuedSince: '2026-01-01', issuedWhole: false }, '2026-06-01')).toEqual(['2026-06-01', '2026-06-01'])
    expect(issuedReadingRecord(passes, starts, true, '2026-06-01')).toEqual({ issued_since: null, issued_whole: null })
  })

  it('keeps the second reading’s start and its end on a feed read twice, nothing on a feed read once', () => {
    expect(issuedReadingRecord(passes, ['2026-11-10', '2026-10-14'], true)).toEqual({ issued_since: '2026-10-14', issued_whole: true })
    expect(issuedReadingRecord(passes, ['2026-11-10', '2026-10-14'], false)).toEqual({ issued_since: '2026-10-14', issued_whole: false })
    expect(issuedReadingRecord(feedPasses(issued!, false), ['2026-11-10'], true)).toEqual({ issued_since: null, issued_whole: null })
    expect(issuedReadingRecord(feedPasses(applied!, true), ['2026-11-10'], true)).toEqual({ issued_since: null, issued_whole: null })
  })

  it('has permit-pull read the kept start before the readings, write it on every run, and survive the column missing', () => {
    const src = readFileSync('supabase/functions/permit-pull/index.ts', 'utf8')
    const kept = src.indexOf('await keptIssuedReading(admin, feed.source)')
    const held = src.indexOf('const starts = heldPassStarts(passes, passStarts(passes, newestHeld, today, sinceOverride), kept, sinceOverride)')
    const loop = src.indexOf('for (const [i, pass] of passes.entries()) {')
    expect(kept).toBeGreaterThan(-1)
    expect(held).toBeGreaterThan(kept)
    expect(loop).toBeGreaterThan(held)
    expect(src).toContain('issuedReadingRecord(issued.passes, issued.starts, issuedWhole, sinceOverride)')
    // Deployed ahead of the migration the row still lands, without the two columns.
    expect(src).toContain("if (runError && /issued_(since|whole)/.test(runError.message)) await admin.from('permit_pulls').insert(run)")
  })
})

describe('a read back as history (punch list #307)', () => {
  it('reads San Antonio’s applications a second time by the day their permit was issued, and no other feed twice', () => {
    const [issued, applied] = feedsToPull('San Antonio')
    // An application is filed on one day and takes its permit's day weeks later: the second reading finds it then.
    const passes = feedPasses(applied!, false)
    expect(passes.map((p) => [p.dayColumn, p.issuedAgain])).toEqual([['submitted_on', false], ['issued_on', true]])
    const first = decodeURIComponent(passes[0]!.pageUrl('2026-11-03', 2000, 0))
    const second = decodeURIComponent(passes[1]!.pageUrl('2026-11-03', 2000, 4000))
    expect(first).toContain(`WHERE "DATE SUBMITTED" >= '2026-11-03' AND (`)
    expect(second).toContain(`FROM "${SA_APPLIED_FEED.resourceId}" WHERE "DATE ISSUED" >= '2026-11-03' AND (`)
    expect(second).toContain('ORDER BY "DATE ISSUED" ASC, "_id" ASC LIMIT 2000 OFFSET 4000')
    // The same rows are kept either way: the kinds of permit do not change with the day they are read by.
    expect(second.slice(second.indexOf(' AND ('), second.indexOf(' ORDER BY'))).toBe(first.slice(first.indexOf(' AND ('), first.indexOf(' ORDER BY')))
    // The issued feed is already read by its issued day, and a read back as history touches nothing held.
    expect(feedPasses(issued!, false)).toEqual([{ pageUrl: issued!.pageUrl, dayColumn: 'issued_on', issuedAgain: false, lookbackDays: 10 }])
    expect(feedPasses(applied!, true).map((p) => p.issuedAgain)).toEqual([false])
    for (const city of ['Austin', 'New Braunfels', 'San Marcos', 'Seguin']) {
      for (const feed of feedsToPull(city)) expect(feedPasses(feed, false)).toHaveLength(1)
    }
  })

  it('reads San Antonio’s two feeds up to a day', () => {
    const [issued, applied] = feedsToPull('San Antonio')
    const url = decodeURIComponent(issued!.pageUrlBefore!('2026-05-26', '2026-08-26', 2000, 0))
    expect(url).toContain(`"DATE ISSUED" >= '2026-05-26' AND "DATE ISSUED" < '2026-08-26'`)
    expect(decodeURIComponent(applied!.pageUrlBefore!('2026-05-26', '2026-08-26', 2000, 0))).toContain(`"DATE SUBMITTED" < '2026-08-26'`)
    // The usual page has no end.
    expect(decodeURIComponent(issued!.pageUrl('2026-05-26', 2000, 0))).not.toContain(' < ')
  })

  it('reads every other city up to a day too, each door in its own words (v2.8297)', () => {
    const before = (city: string) => new URL(feedsToPull(city)[0]!.pageUrlBefore!('2026-05-27', '2026-08-27', 2000, 4000))
    // Austin: the same $where with an end, the same order, the same paging.
    const austin = before('Austin')
    expect(austin.searchParams.get('$where')).toBe(austinWhere('2026-05-27', '2026-08-27'))
    expect(austinWhere('2026-05-27', '2026-08-27')).toContain(`issue_date >= '2026-05-27T00:00:00' AND issue_date < '2026-08-27T00:00:00' AND ((permittype = 'BP'`)
    expect(austin.searchParams.get('$order')).toBe('issue_date ASC, permit_number ASC')
    expect([austin.searchParams.get('$limit'), austin.searchParams.get('$offset')]).toEqual(['2000', '4000'])
    // The usual page is the page it always was.
    expect(austinWhere('2026-05-27')).not.toContain(' < ')
    expect(new URL(AUSTIN_READER.pageUrl('2026-05-27', 2000, 0)).searchParams.get('$where')).toBe(austinWhere('2026-05-27'))
    // A map layer holds each of its day columns to the window by itself.
    expect(before('San Marcos').searchParams.get('where')).toMatch(/^\(\(APPLIED >= DATE '2026-05-27' AND APPLIED < DATE '2026-08-27'\) OR \(ISSUED >= DATE '2026-05-27' AND ISSUED < DATE '2026-08-27'\)\) AND TYPE IN \(/)
    expect(before('Seguin').searchParams.get('where')).toMatch(/^\(USER_APPLYDATE >= DATE '2026-05-27' AND USER_APPLYDATE < DATE '2026-08-27'\) AND \(USER_DESCRIPTION LIKE /)
    expect(before('New Braunfels').searchParams.get('where')).toMatch(/^\(\(Permit_Submit_Date >= DATE '2026-05-27' AND Permit_Submit_Date < DATE '2026-08-27'\) OR \(Permit_Issue_Date >= DATE '2026-05-27' AND Permit_Issue_Date < DATE '2026-08-27'\)\) AND Permit_Group = 'Building' AND /)
    // A layer's page keeps its own size and order, and the daily page has no end.
    expect(before('San Marcos').searchParams.get('resultRecordCount')).toBe('1000')
    expect(before('San Marcos').searchParams.get('resultOffset')).toBe('4000')
    for (const reader of [SAN_MARCOS_READER, SEGUIN_READER, NEW_BRAUNFELS_READER]) expect(new URL(reader.pageUrl('2026-05-27', 2000, 0)).searchParams.get('where')).not.toContain(' < ')
    expect(layerDayWindow(['A', 'B'], '2026-05-27')).toBe(`(A >= DATE '2026-05-27' OR B >= DATE '2026-05-27')`)
    expect(layerDayWindow(['A'], '2026-05-27')).toBe(`A >= DATE '2026-05-27'`)
    // A day that is not a day is refused before it reaches a door.
    expect(() => feedsToPull('Seguin')[0]!.pageUrlBefore!('2026-05-27', 'Aug 27', 10, 0)).toThrow(/YYYY-MM-DD/)
    expect(() => austinWhere('2026-05-27', '8/27/2026')).toThrow(/YYYY-MM-DD/)
  })

  it('offers the read back in exactly the cities whose every feed can be read up to a day', () => {
    const can = PERMIT_CITIES.filter((c) => c.feeds.every((f) => f.pageUrlBefore != null)).map((c) => c.name)
    expect([...HISTORY_CITIES].sort()).toEqual([...can].sort())
    expect([...HISTORY_CITIES].sort()).toEqual([...PERMIT_CITY_NAMES].sort())
  })
})

describe('New Braunfels, one permit written once per person on it', () => {
  const nb = (over: Record<string, unknown> = {}) => ({ Permit_Group: 'Building', Permit_TYPE_DESC: 'Commercial  EPR', Permit_SUBTYPE_DESC: 'New Build', Permit_Type_Name: 'Commercial - New Build (epr)', Permit_Label: 'Sample Clinic', Permit_Status: 'IN REVIEW', Permit_Address: '100 SAMPLE ST', CoNB_Permit_Number: 'BP2026-001', Applicant_Name: 'Jordan Vale', Contractor_Name: null, Permit_Submit_Date: Date.UTC(2026, 8, 2, 15), Permit_Issue_Date: null, _lat: 29.7, _lng: -98.12, ...over })

  it('a permit written once per person keeps the row that names who is building it', () => {
    const applicant = permitRowFromNewBraunfels(nb({ OBJECTID: 10, Contractor_Type: null, Contractor_Name: null, Applicant_Name: 'Jordan Vale' }))!
    const second = permitRowFromNewBraunfels(nb({ OBJECTID: 11, Contractor_Type: null, Contractor_Name: null, Applicant_Name: 'Sample Architects' }))!
    const gc = permitRowFromNewBraunfels(nb({ OBJECTID: 12, Contractor_Type: 'General Contractor - Commercial', Contractor_Name: 'Tall Pine Builders, LLC' }))!
    const spark = permitRowFromNewBraunfels(nb({ OBJECTID: 13, Contractor_Type: 'Electrical Contractor', Contractor_Name: 'Sample Electric Co' }))!
    expect([gc, applicant, spark].map(newBraunfelsNameRank)).toEqual([0, 1, 2])
    // The general contractor wins whichever order the rows arrive in.
    expect(preferNewBraunfels(applicant, gc).contact).toBe('Tall Pine Builders, LLC')
    expect(preferNewBraunfels(gc, spark).contact).toBe('Tall Pine Builders, LLC')
    expect(preferNewBraunfels(spark, gc).contact).toBe('Tall Pine Builders, LLC')
    // No contractor yet: the applicant, not a trade; of two applicants, the one the city wrote first.
    expect(preferNewBraunfels(spark, applicant).contact).toBe('Jordan Vale')
    expect(preferNewBraunfels(second, applicant).contact).toBe('Jordan Vale')
    expect(preferNewBraunfels(applicant, second).contact).toBe('Jordan Vale')
    expect(NEW_BRAUNFELS_READER.prefer).toBe(preferNewBraunfels)
    // The other doors hand a permit over once: the pull keeps the later row, as before.
    expect(SEGUIN_READER.prefer).toBeUndefined()
    expect(AUSTIN_READER.prefer).toBeUndefined()
  })
})
