import { describe, expect, it } from 'vitest'
import type { LienCalendarJob } from './lienCalendar'
import { buildLienCalendarBoard, lienBucketOf, lienNextDate, lienNextDateCounts, lienPhoneLine } from './lienCalendarBuckets'
import { buildLienPayRunway, type LienRunwayInput } from './lienPayRunway'

// Today is Thursday 2026-10-01 unless a test says otherwise: Oct 15 is 14 days out, Nov 16 46, Dec 15 75.
const TODAY = '2026-10-01'

function job(over: Partial<LienCalendarJob> & { r?: Partial<LienRunwayInput> } = {}): LienCalendarJob {
  const { r, ...rest } = over
  const isSub = rest.isSub ?? Boolean(rest.gcId)
  return {
    jobId: 'j',
    number: '1046 PLUM',
    name: 'Pretest',
    customer: 'Randolph Field Reality',
    gcId: null,
    gcName: null,
    address: '214 Beechwood Ave',
    openBalance: 1000,
    isSub,
    runway: buildLienPayRunway({ todayYmd: TODAY, openBalance: rest.openBalance ?? 1000, lastWorkYmd: '2026-08-12', propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, isSub, ...r }),
    ...rest,
  }
}

const RMC = { gcId: 'gc-rmc', gcName: 'RMC · Dudley Mason' }
const KNIGHT = { gcId: 'gc-knight', gcName: 'Knight Contracting' }

const ROWS = [
  // This month: four notices due Oct 15 across three GCs
  job({ jobId: 'a', name: 'Dudley Mason', ...RMC, openBalance: 9800 }),
  job({ jobId: 'b', name: 'Service Visit', ...RMC, openBalance: 7902, r: { lastWorkYmd: '2026-08-20', propertyKind: '' } }),
  job({ jobId: 'c', name: 'Springtown', ...KNIGHT, openBalance: 15406, r: { lastWorkYmd: '2026-08-05' } }),
  // worked June to September on a commercial job: July's notice is the next date, not the Jan 15 lien
  job({ jobId: 'k', name: 'Take 5- Seguin', gcId: 'gc-sp', gcName: 'Southern Post Construction', openBalance: 38625, r: { propertyKind: 'non_residential', lastWorkYmd: '2026-09-21', workMonths: ['2026-06', '2026-07', '2026-08', '2026-09'] } }),
  // Next month: a notice and a lien, both Nov 16
  job({ jobId: 'd', name: 'Water Heater removal', gcId: 'gc-hi', gcName: 'H & I Construction', openBalance: 350, r: { lastWorkYmd: '2026-09-03' } }),
  job({ jobId: 'e', name: 'Mike Holub', openBalance: 5724, r: { expectedPayYmd: '2026-09-30' } }),
  // Later: liens Dec 15 and Jan 15, and a lien on file
  job({ jobId: 'f', name: 'Coe Trim', openBalance: 900, r: { lastWorkYmd: '2026-09-10' } }),
  job({ jobId: 'g', name: 'ATI Schertz', openBalance: 1400, r: { lastWorkYmd: '2026-09-10', propertyKind: 'non_residential' } }),
  job({ jobId: 'j', name: 'Filed one', openBalance: 2000, r: { filedYmd: '2026-09-03' } }),
  // Overdue: July's notice was due Sep 15 and never sent; May's lien window closed Aug 17
  job({ jobId: 'h', name: 'Dudley Mason', ...RMC, openBalance: 285, r: { lastWorkYmd: '2026-07-10' } }),
  job({ jobId: 'i', name: 'Samantha Coyle', openBalance: 5355, r: { lastWorkYmd: '2026-05-05' } }),
  // nothing open: not on the board
  job({ jobId: 'z', name: 'Paid', openBalance: 0 }),
]

const ids = (jobs: ReadonlyArray<{ jobId: string }>) => jobs.map((j) => j.jobId)

describe('each job counted once, at its next date', () => {
  const byId = new Map(ROWS.map((j) => [j.jobId, j]))
  it('the next date is the notice owed, else the lien date; none once the window closed or the lien is filed', () => {
    expect(lienNextDate(byId.get('a')!)).toEqual({ ymd: '2026-10-15', what: 'notice' })
    expect(lienNextDate(byId.get('k')!)).toEqual({ ymd: '2026-10-15', what: 'notice' })
    expect(byId.get('k')!.runway.lienByYmd).toBe('2027-01-15')
    expect(lienNextDate(byId.get('e')!)).toEqual({ ymd: '2026-11-16', what: 'lien' })
    expect(lienNextDate(byId.get('h')!)).toBeNull()
    expect(lienNextDate(byId.get('j')!)).toBeNull()
  })
  it('lands in the month its next date falls in', () => {
    expect(ROWS.map((j) => [j.jobId, lienBucketOf(j, TODAY)])).toEqual([
      ['a', 'this_month'],
      ['b', 'this_month'],
      ['c', 'this_month'],
      ['k', 'this_month'],
      ['d', 'next_month'],
      ['e', 'next_month'],
      ['f', 'later'],
      ['g', 'later'],
      ['j', 'later'],
      ['h', 'overdue'],
      ['i', 'overdue'],
      ['z', null],
    ])
  })
  it('the four buckets add up to the board: no job twice', () => {
    const board = buildLienCalendarBoard(ROWS, '', TODAY)
    expect(board.buckets.map((b) => b.key)).toEqual(['overdue', 'this_month', 'next_month', 'later'])
    expect(board.buckets.map((b) => b.jobs.length)).toEqual([2, 4, 2, 3])
    expect(board.count).toBe(11)
    expect(board.buckets.reduce((s, b) => s + b.total, 0)).toBe(board.total)
    expect(board.total).toBe(87747)
    const seen = board.buckets.flatMap((b) => ids(b.jobs))
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('what each bucket says', () => {
  const board = buildLienCalendarBoard(ROWS, '', TODAY)
  const [overdue, thisMonth, nextMonth, later] = board.buckets
  it('This month: one date, the days to it, the notices and their GCs, and the door to draft them', () => {
    expect(thisMonth).toMatchObject({ title: 'This month', dateLabel: 'Oct 15', total: 71733, notices: 4, liens: 0, dates: ['2026-10-15'] })
    expect(thisMonth!.facts).toBe('by Oct 15 · in 14 days · 4 notices across 3 GCs')
    // tightest first, then the bigger balance
    expect(thisMonth!.draft).toEqual({ ymd: '2026-10-15', jobIds: ['k', 'c', 'a', 'b'], label: 'Draft the 4' })
    expect(thisMonth!.groups.map((g) => g.name)).toEqual(['Southern Post Construction', 'RMC · Dudley Mason', 'Knight Contracting'])
    // the bar names the date, so a GC row under it says only what to send
    expect(thisMonth!.groups.map((g) => g.word)).toEqual(['send the notice', 'send 2 notices', 'send the notice'])
  })
  it('a GC row keeps its own date when its bucket holds more than one', () => {
    const rows = [
      job({ jobId: 'oct', ...RMC, r: { lastWorkYmd: '2026-10-01' } }),
      job({ jobId: 'oct-c', ...RMC, r: { lastWorkYmd: '2026-10-01', propertyKind: 'non_residential' } }),
    ]
    const later = buildLienCalendarBoard(rows, '', TODAY).buckets[3]!
    expect(later.dates).toEqual(['2026-12-15', '2027-01-15'])
    expect(later.groups[0]!.word).toBe('send 2 notices by Dec 15 · 75 d')
  })
  it('Next month: a notice to one GC and a lien to file; no door while the desk does not list them yet', () => {
    expect(nextMonth!.facts).toBe('by Nov 16 · in 46 days · 1 notice to H & I Construction · 1 lien to file')
    expect(nextMonth!.dateLabel).toBe('Nov 16')
    expect(nextMonth!.draft).toBeNull()
  })
  it('Later: more than one date reads "and after"; a filed lien waits here', () => {
    expect(later!.facts).toBe('Dec 15 and after · 2 liens to file · 1 lien filed')
    expect(later!.dateLabel).toBe('Dec 15 +')
    expect(later!.dates).toEqual(['2026-12-15', '2027-01-15'])
    expect(ids(later!.jobs)).toEqual(['f', 'g', 'j'])
  })
  it('Overdue: the closed windows, one lien-gone group, no door', () => {
    expect(overdue).toMatchObject({ title: 'Overdue', dateLabel: '', total: 5640, draft: null })
    expect(overdue!.facts).toBe('2 jobs · nothing left to file · money still owed')
    expect(overdue!.groups.map((g) => g.kind)).toEqual(['gone'])
  })
  it('each bucket covers its stretch of the axis', () => {
    expect(board.buckets.map((b) => b.span)).toEqual([
      { fromYmd: null, toYmd: '2026-10-01' },
      { fromYmd: '2026-10-01', toYmd: '2026-11-01' },
      { fromYmd: '2026-11-01', toYmd: '2026-12-01' },
      { fromYmd: '2026-12-01', toYmd: null },
    ])
  })
  it('counts the property kinds not set, and the date row counts each job once', () => {
    expect(board.kindsUnset).toBe(1)
    const counts = lienNextDateCounts(board.buckets)
    expect([...counts.values()].map((c) => [c.ymd, c.jobs, c.notices, c.liens])).toEqual([
      ['2026-10-15', 4, 4, 0],
      ['2026-11-16', 2, 1, 1],
      ['2026-12-15', 1, 0, 1],
      ['2027-01-15', 1, 0, 1],
    ])
    expect(counts.get('2026-10-15')!.total).toBe(71733)
  })
  it('search narrows every bucket', () => {
    const knight = buildLienCalendarBoard(ROWS, 'knight', TODAY)
    expect(knight.buckets.map((b) => ids(b.jobs))).toEqual([[], ['c'], [], []])
    expect(knight.count).toBe(1)
    expect(knight.buckets[1]!.facts).toBe('by Oct 15 · in 14 days · 1 notice to Knight Contracting')
    expect(knight.buckets[1]!.draft?.label).toBe('Draft the one')
  })
})

describe('a phone row’s line', () => {
  const byId = new Map(ROWS.map((j) => [j.jobId, j]))
  it('says the dates; keeps file first and the day a lien died', () => {
    expect(lienPhoneLine(byId.get('a')!)).toBe('notice by Oct 15 · lien by Nov 16')
    expect(lienPhoneLine(byId.get('e')!)).toBe('pay was due Sep 30 · file lien by Nov 16')
    expect(lienPhoneLine(byId.get('h')!)).toBe('lien gone · notice window closed Sep 15')
    expect(lienPhoneLine(byId.get('j')!)).toBe('lien filed Sep 3')
    const late = job({ jobId: 'ff', r: { expectedPayYmd: '2026-12-01' } })
    expect(lienPhoneLine(late)).toBe('file lien by Nov 16 → pay Dec 1 · file first')
  })
})

describe('late in the month and across the new year', () => {
  it('after the 15th This month is empty and says so; next month’s notices are inside the desk’s 30 days', () => {
    const OCT_20 = '2026-10-20'
    const rows = [
      job({ jobId: 'd', ...RMC, r: { todayYmd: OCT_20, lastWorkYmd: '2026-09-03' } }),
      job({ jobId: 'e', r: { todayYmd: OCT_20, lastWorkYmd: '2026-08-12' } }),
    ]
    const board = buildLienCalendarBoard(rows, '', OCT_20)
    const [overdue, thisMonth, nextMonth] = board.buckets
    expect(thisMonth!.jobs).toEqual([])
    expect(thisMonth!.empty).toBe('Nothing else falls due in October.')
    expect(thisMonth!.facts).toBe('')
    expect(overdue!.empty).toBe('No lien window has closed on a billed job.')
    expect(nextMonth!.facts).toBe('by Nov 16 · in 27 days · 1 notice to RMC · Dudley Mason · 1 lien to file')
    expect(nextMonth!.draft).toEqual({ ymd: '2026-11-16', jobIds: ['d'], label: 'Draft the one' })
  })
  it('in December, next month is January of the next year', () => {
    const DEC_2 = '2026-12-02'
    const rows = [
      job({ jobId: 'dec', r: { todayYmd: DEC_2, lastWorkYmd: '2026-09-10' } }),
      job({ jobId: 'jan', ...RMC, r: { todayYmd: DEC_2, lastWorkYmd: '2026-11-03' } }),
      job({ jobId: 'feb', r: { todayYmd: DEC_2, lastWorkYmd: '2026-11-03' } }),
    ]
    const board = buildLienCalendarBoard(rows, '', DEC_2)
    expect(board.buckets.map((b) => ids(b.jobs))).toEqual([[], ['dec'], ['jan'], ['feb']])
    expect(board.buckets[2]!.span).toEqual({ fromYmd: '2027-01-01', toYmd: '2027-02-01' })
    expect(board.buckets[2]!.facts).toBe('by Jan 15 · in 44 days · 1 notice to RMC · Dudley Mason')
    expect(board.buckets[3]!.empty).toBe('Nothing falls due after January.')
  })
})
