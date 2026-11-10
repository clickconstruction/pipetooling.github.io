import { describe, expect, it } from 'vitest'
import { AUSTIN_READER, PERMIT_CITIES, PERMIT_CITY_NAMES, austinWhere, classifyAustin, feedsToPull, permitCity, permitRowFromAustin, shortDescription, texasPoint } from '../../../supabase/functions/_shared/permitCities'

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

describe('the cities the pull reads (punch list #292, revision 4)', () => {
  it('lists San Antonio first and Austin, each with its county and its own search pages', () => {
    expect(PERMIT_CITY_NAMES.slice(0, 2)).toEqual(['San Antonio', 'Austin'])
    expect(permitCity('austin')?.county).toBe('Travis')
    expect(permitCity(' San Antonio ')?.parcels).toBe(true)
    expect(permitCity('Austin')?.parcels).toBe(false)
    expect(permitCity('Nowhere')).toBeNull()
    for (const c of PERMIT_CITIES) {
      expect(c.permitSearch).toMatch(/^https:\/\//)
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
