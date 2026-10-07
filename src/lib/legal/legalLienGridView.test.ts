import { describe, expect, it } from 'vitest'
import { buildLienTimelineBook, type LienTimelineBookInput, type LienBookJob } from '../jobs/lienTimelineBook'
import { filterLegalLienGrid, findLegalLienGcs, legalLienGcCountWords, legalLienGridCells, legalLienGridGcs, LEGAL_LIEN_NO_GC } from './legalLienGridView'

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
    const rail = legalLienGridGcs(book, 'all', null)
    expect(rail.map((e) => [e.id, e.name, e.count, e.open])).toEqual([
      ['', 'All GCs', 4, 56_793],
      ['gc1', 'Knight Contracting', 2, 47_846],
      ['gc2', 'Michael Palmer', 1, 7_152],
      [LEGAL_LIEN_NO_GC, 'No GC · with the owner', 1, 1_795],
    ])
    expect(rail.map((e) => e.kind)).toEqual(['all', 'gc', 'gc', 'none'])
  })

  it('follows the view, keeps a selected GC at 0 jobs, and filters the grid the same way', () => {
    const due = legalLienGridGcs(book, 'due', 'gc2')
    expect(due[0]!.count).toBe(book.counts.due)
    expect(due.find((e) => e.id === 'gc2')).toBeTruthy()
    expect(filterLegalLienGrid(book, { gcId: 'gc1', show: 'all' }).map((r) => r.jobId).sort()).toEqual(['j702', 'j878'])
    expect(filterLegalLienGrid(book, { gcId: LEGAL_LIEN_NO_GC, show: 'all' }).map((r) => r.jobId)).toEqual(['j1101'])
    expect(filterLegalLienGrid(book, { gcId: null, show: 'all' })).toHaveLength(4)
  })

  it('a find keeps All and the selected entry, and matches the rest by name', () => {
    const rail = legalLienGridGcs(book, 'all', 'gc2')
    expect(findLegalLienGcs(rail, 'knight', 'gc2').map((e) => e.id)).toEqual(['', 'gc1', 'gc2'])
    expect(findLegalLienGcs(rail, '', 'gc2')).toHaveLength(4)
    expect(legalLienGcCountWords(1)).toBe('1 job')
    expect(legalLienGcCountWords(0)).toBe('0 jobs')
  })
})
