import { describe, expect, it } from 'vitest'
import { buildLienTimelineBook, type LienTimelineBookInput, type LienBookJob } from '../jobs/lienTimelineBook'
import { filterLegalLienGrid, findLegalLienCourts, findLegalLienGcs, legalLienCountyName, legalLienCourtOf, legalLienCourtSections, legalLienGcCountWords, legalLienGridCells, legalLienGridCourts, legalLienGridGcs, legalLienSectionWords, LEGAL_LIEN_NO_COUNTY, LEGAL_LIEN_NO_GC } from './legalLienGridView'

const TODAY = '2026-10-06'

const job = (id: string, over: Partial<LienBookJob> = {}): LienBookJob => ({
  id,
  label: `${id.slice(1)} · Job ${id}`,
  address: `${id.slice(1)} Main St, Kyle, TX`,
  gcId: 'gc1',
  gcName: 'Knight Contracting',
  propertyKind: 'non_residential',
  homestead: false,
  county: 'Hays',
  ownerName: 'Elbel Holdings LLC',
  openBalance: 10_000,
  lastWorkDate: '2026-09-20',
  isSub: true,
  ...over,
})

const month = (job_id: string, work_month: string, deadline: string, over: Partial<LienTimelineBookInput['rows'][number]> = {}): LienTimelineBookInput['rows'][number] => ({
  job_id,
  work_month,
  approved_hours: 10,
  deadline,
  noticed: false,
  open_balance: 10_000,
  customer_id: 'own1',
  gc_customer_id: 'gc1',
  property_kind: 'non_residential',
  has_owner: true,
  desk_item_id: null,
  desk_status: null,
  desk_months: null,
  month_source: 'hours',
  ...over,
})

function input(): LienTimelineBookInput {
  return {
    todayYmd: TODAY,
    rows: [
      // j878: June's window closed on Sep 15, July to Sep still open.
      month('j878', '2026-06', '2026-09-15'),
      month('j878', '2026-07', '2026-10-15'),
      month('j878', '2026-08', '2026-11-16'),
      month('j878', '2026-09', '2026-12-15'),
      // j843: a homestead with a GC, two open months.
      month('j843', '2026-08', '2026-10-15', { gc_customer_id: 'gc2', property_kind: 'residential' }),
      month('j843', '2026-09', '2026-11-16', { gc_customer_id: 'gc2', property_kind: 'residential' }),
      // j702: every window closed.
      month('j702', '2026-05', '2026-08-15'),
      month('j702', '2026-06', '2026-09-15'),
      // j1101: no GC — contracted with the owner.
      month('j1101', '2026-08', '2026-10-15', { gc_customer_id: null, property_kind: 'residential' }),
    ],
    affidavitRows: [],
    items: [],
    filingsByJob: {},
    jobs: {
      j878: job('j878', { openBalance: 38_625 }),
      j843: job('j843', { gcId: 'gc2', gcName: 'Michael Palmer', propertyKind: 'residential', homestead: true, openBalance: 7_152, ownerName: 'LAGAN JOEL C & SHANNON' }),
      j702: job('j702', { openBalance: 9_221, propertyKind: '' }),
      j1101: job('j1101', { gcId: null, gcName: '', isSub: false, propertyKind: 'residential', openBalance: 1_795, ownerName: 'Sam Whitfield' }),
    },
    policyByCustomer: {},
  }
}

describe('legalLienGridCells', () => {
  const book = buildLienTimelineBook(input())
  const cells = legalLienGridCells(book.rows, TODAY)
  const cell = (id: string) => cells.find((c) => c.jobId === id)!

  it('spells the property out, puts the total before the months and leaves the closed windows off', () => {
    const c = cell('j878')
    expect(c.job).toBe('878 · Job j878')
    expect(c.address).toBe('878 Main St, Kyle, TX')
    expect(c.street).toBe('878 Main St')
    expect(c.cityLine).toBe('Kyle, TX')
    expect(c.kind).toBe('Commercial')
    expect(c.kindUnknown).toBe(false)
    expect(c.homestead).toBe('')
    expect(c.total).toBe('$38,625')
    expect(c.months).toBe('Jun, Jul, Aug, Sep')
    expect(c.notices).toEqual([
      { month: 'Jul', date: 'Oct 15', sent: false },
      { month: 'Aug', date: 'Nov 16', sent: false },
      { month: 'Sep', date: 'Dec 15', sent: false },
    ])
    expect(c.allClosed).toBe(false)
    expect(c.noticeNote).toBe('')
  })

  it('an address with no comma is one street line; the extras after the state stay on the city line', () => {
    const src = input()
    src.jobs = { ...src.jobs, j843: { ...src.jobs['j843']!, address: '214 Beechwood Avenue, Universal City, TX (Lock Box Code 5068)' }, j702: { ...src.jobs['j702']!, address: '8275 Broussard' } }
    const cells = legalLienGridCells(buildLienTimelineBook(src).rows, TODAY)
    expect(cells.find((c) => c.jobId === 'j843')).toMatchObject({ street: '214 Beechwood Avenue', cityLine: 'Universal City, TX (Lock Box Code 5068)' })
    expect(cells.find((c) => c.jobId === 'j702')).toMatchObject({ street: '8275 Broussard', cityLine: '' })
  })

  it('reads Residential with Homestead or No homestead beneath', () => {
    expect(cell('j843')).toMatchObject({ kind: 'Residential', homestead: 'Homestead', owner: 'LAGAN JOEL C & SHANNON' })
    expect(cell('j1101')).toMatchObject({ kind: 'Residential', homestead: 'No homestead' })
  })

  it('marks a kind the office has not entered, and a job whose every window closed', () => {
    const c = cell('j702')
    expect(c.kind).toBe('Commercial')
    expect(c.kindUnknown).toBe(true)
    expect(c.notices).toEqual([])
    expect(c.allClosed).toBe(true)
    expect(c.months).toBe('May, Jun')
  })

  it('a job with the owner needs no notice', () => {
    const c = cell('j1101')
    expect(c.notices).toEqual([])
    expect(c.noticeNote).toBe('none needed (with the owner)')
    expect(c.allClosed).toBe(false)
  })
})

describe('the rail', () => {
  const book = buildLienTimelineBook(input())

  it('lists All first, then the GCs largest first with their count and dollars, then the jobs with no GC', () => {
    const rail = legalLienGridGcs(book, 'all')
    expect(rail.map((e) => [e.id, e.name, e.count, e.open])).toEqual([
      ['', 'All GCs', 4, 56_793],
      ['gc1', 'Knight Contracting', 2, 47_846],
      ['gc2', 'Michael Palmer', 1, 7_152],
      [LEGAL_LIEN_NO_GC, 'No GC · with the owner', 1, 1_795],
    ])
    expect(rail.map((e) => e.kind)).toEqual(['all', 'gc', 'gc', 'none'])
  })

  it('follows the view, leaves an empty entry off, and filters the grid the same way', () => {
    const due = legalLienGridGcs(book, 'due')
    expect(due[0]!.count).toBe(book.counts.due)
    // The homeowner's month is due Oct 15, inside the lead: No GC stays. Push it out and the entry is left off (v2.4751).
    expect(due.some((e) => e.id === LEGAL_LIEN_NO_GC)).toBe(true)
    const later = buildLienTimelineBook({ ...input(), rows: input().rows.map((r) => (r.job_id === 'j1101' ? { ...r, deadline: '2027-01-15' } : r)) })
    expect(legalLienGridGcs(later, 'due').some((e) => e.id === LEGAL_LIEN_NO_GC)).toBe(false)
    expect(legalLienGridGcs(later, 'all').some((e) => e.id === LEGAL_LIEN_NO_GC)).toBe(true)
    expect(filterLegalLienGrid(book, { gcId: 'gc1', show: 'all' }).map((r) => r.jobId).sort()).toEqual(['j702', 'j878'])
    expect(filterLegalLienGrid(book, { gcId: LEGAL_LIEN_NO_GC, show: 'all' }).map((r) => r.jobId)).toEqual(['j1101'])
    expect(filterLegalLienGrid(book, { gcId: null, show: 'all' })).toHaveLength(4)
  })

  it('a find keeps All and the selected entry, and matches the rest by name', () => {
    const rail = legalLienGridGcs(book, 'all')
    expect(findLegalLienGcs(rail, 'knight', 'gc2').map((e) => e.id)).toEqual(['', 'gc1', 'gc2'])
    expect(findLegalLienGcs(rail, '', 'gc2')).toHaveLength(4)
    expect(legalLienGcCountWords(1)).toBe('1 job')
    expect(legalLienGcCountWords(0)).toBe('0 jobs')
  })
})

describe('by court (v2.4825)', () => {
  // Hays: one precinct, one on a line, one not named yet, one over the limit. Guadalupe (written with "County"): one precinct. No county: one.
  function courtInput(): LienTimelineBookInput {
    const base = input()
    return {
      ...base,
      rows: [
        ...base.rows,
        month('j900', '2026-08', '2026-11-16'),
        month('j901', '2026-08', '2026-11-16'),
      ],
      jobs: {
        j878: job('j878', { openBalance: 38_625 }),
        j843: job('j843', { gcId: 'gc2', gcName: 'Michael Palmer', county: 'Guadalupe County', precinct: '2', openBalance: 7_152 }),
        j702: job('j702', { precinct: '2', openBalance: 9_221 }),
        j1101: job('j1101', { gcId: null, gcName: '', isSub: false, county: '', openBalance: 1_795 }),
        j900: job('j900', { precinct: '1', precinctNote: '1 or 2 — on the line', openBalance: 4_000 }),
        j901: job('j901', { openBalance: 3_000 }),
      },
    }
  }
  const book = buildLienTimelineBook(courtInput())

  it('reads a job\'s court from its county, precinct and balance', () => {
    expect(legalLienCourtOf({ county: ' Hays County ', precinct: '2', openBalance: 20_000 })).toMatchObject({ id: 'court:hays|precinct|2', countyId: 'county:hays', county: 'Hays', kind: 'precinct', name: 'Precinct 2', title: 'Hays County · Justice Court, Precinct 2', short: 'Hays · Pct 2' })
    expect(legalLienCourtOf({ county: 'Hays', precinct: '2', openBalance: 20_000.01 })).toMatchObject({ kind: 'over', name: 'Over $20,000 · county court', title: 'Hays County · over $20,000, county or district court' })
    expect(legalLienCourtOf({ county: 'Hays', precinct: '1', precinctNote: '1 or 2 — on the line', openBalance: 10 })).toMatchObject({ kind: 'line', precinct: '1 or 2', name: 'Precinct 1 or 2 · on the line' })
    expect(legalLienCourtOf({ county: 'Hays', openBalance: 10 })).toMatchObject({ kind: 'pending', name: 'Precinct not named yet', title: 'Hays County · justice precinct not named yet' })
    expect(legalLienCourtOf({ county: '', precinct: '2', openBalance: 10 })).toMatchObject({ id: LEGAL_LIEN_NO_COUNTY, kind: 'none', name: 'County not on the record' })
    expect(legalLienCountyName('guadalupe county')).toBe('guadalupe')
  })

  it('lists All, then each county by its dollars with its courts in precinct order, then the jobs with no county', () => {
    const rail = legalLienGridCourts(book, 'all')
    expect(rail.map((e) => [e.id, e.kind, e.name, e.count, e.open])).toEqual([
      ['', 'all', 'All courts', 6, 63_793],
      ['county:hays', 'county', 'Hays County', 4, 54_846],
      ['court:hays|precinct|2', 'court', 'Precinct 2', 1, 9_221],
      ['court:hays|line|1 or 2', 'court', 'Precinct 1 or 2 · on the line', 1, 4_000],
      ['court:hays|pending|', 'court', 'Precinct not named yet', 1, 3_000],
      ['court:hays|over|', 'court', 'Over $20,000 · county court', 1, 38_625],
      ['county:guadalupe', 'county', 'Guadalupe County', 1, 7_152],
      ['court:guadalupe|precinct|2', 'court', 'Precinct 2', 1, 7_152],
      [LEGAL_LIEN_NO_COUNTY, 'none', 'County not on the record', 1, 1_795],
    ])
    expect(rail.find((e) => e.id === 'court:hays|over|')!.courtKind).toBe('over')
    expect(legalLienGridCourts(book, 'due')[0]!.count).toBe(book.counts.due)
  })

  it('filters by a county, a court or no county, and bands the rows in the rail\'s order', () => {
    expect(filterLegalLienGrid(book, { gcId: null, courtId: 'county:hays', show: 'all' }).map((r) => r.jobId).sort()).toEqual(['j702', 'j878', 'j900', 'j901'])
    expect(filterLegalLienGrid(book, { gcId: null, courtId: 'court:hays|precinct|2', show: 'all' }).map((r) => r.jobId)).toEqual(['j702'])
    expect(filterLegalLienGrid(book, { gcId: null, courtId: LEGAL_LIEN_NO_COUNTY, show: 'all' }).map((r) => r.jobId)).toEqual(['j1101'])
    const sections = legalLienCourtSections(filterLegalLienGrid(book, { gcId: null, courtId: null, show: 'all' }))
    expect(sections.map((s) => [s.title, s.rows.map((r) => r.jobId)])).toEqual([
      ['Hays County · Justice Court, Precinct 2', ['j702']],
      ['Hays County · Justice Court, Precinct 1 or 2 · on the line', ['j900']],
      ['Hays County · justice precinct not named yet', ['j901']],
      ['Hays County · over $20,000, county or district court', ['j878']],
      ['Guadalupe County · Justice Court, Precinct 2', ['j843']],
      ['County not on the record', ['j1101']],
    ])
    expect(legalLienSectionWords(sections[0]!)).toBe('Hays County · Justice Court, Precinct 2 · 1 job · $9,221')
  })

  it('a find keeps All and the selected entry, and matches the rest by their full words', () => {
    const rail = legalLienGridCourts(book, 'all')
    expect(findLegalLienCourts(rail, 'guadalupe', null).map((e) => e.id)).toEqual(['', 'county:guadalupe', 'court:guadalupe|precinct|2'])
    expect(findLegalLienCourts(rail, 'guadalupe', 'court:hays|over|').map((e) => e.id)).toEqual(['', 'court:hays|over|', 'county:guadalupe', 'court:guadalupe|precinct|2'])
  })
})
