import { describe, expect, it } from 'vitest'
import { addMonths, buildVectorDayCells, buildVectorGrid, foldBuckets, monthEndOf, vectorAnchorStep, vectorColumnsFor, vectorRangeFor, vectorRangeLabel, vectorVerdict, ymdAddDays, ymdWeekday } from './vectorDays'
import type { VectorPerson, VectorSession, VectorWage } from './vectors'

// September 2026: the 1st is a Tuesday, the 30th a Wednesday.
const TODAY = '2026-09-30'

const people: VectorPerson[] = [
  { userId: 'u-abraham', name: 'Abraham', role: 'helpers', archived: false },
  { userId: 'u-tristen', name: 'Tristen', role: 'helpers', archived: false },
  { userId: 'u-kevin', name: 'Kevin', role: 'helpers', archived: false },
  { userId: 'u-office', name: 'Wendi', role: 'assistant', archived: false },
]
const wages: VectorWage[] = [
  { userId: 'u-abraham', fieldWage: 40, officeWage: null, isSalary: false },
  { userId: 'u-tristen', fieldWage: 38, officeWage: 30, isSalary: false },
  { userId: 'u-kevin', fieldWage: 34, officeWage: null, isSalary: true },
  { userId: 'u-office', fieldWage: null, officeWage: 28, isSalary: false },
]
const rates = new Map<string, number>([
  ['j-good', 92], // priced well over every wage
  ['j-low', 31], // priced under Tristen's $38 (no % complete → guessed)
])
const assumedHalf = new Set(['j-low'])
const labels = new Map([
  ['j-good', 'J878 Shavano dental'],
  ['j-low', 'J1044 Cielo Vista'],
  ['j-free', 'J523 T&M repipe'],
])

const field = (userId: string, workDate: string, hours: number, jobId: string, o: Partial<VectorSession> = {}): VectorSession => ({ userId, workDate, hours, jobId, onBid: false, officeJob: false, approved: true, pending: false, ...o })
const office = (userId: string, workDate: string, hours: number): VectorSession => ({ userId, workDate, hours, jobId: 'j-office', onBid: false, officeJob: true, approved: true, pending: false })

describe('date arithmetic', () => {
  it('walks days, months and weekdays on the civil calendar', () => {
    expect(ymdAddDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(ymdAddDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(ymdWeekday('2026-09-01')).toBe(2) // Tuesday
    expect(monthEndOf('2026-02-10')).toBe('2026-02-28')
    expect(monthEndOf('2028-02-10')).toBe('2028-02-29')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-09-01', -11)).toBe('2025-10-01')
  })
})

describe('vectorRangeFor / vectorAnchorStep / vectorRangeLabel', () => {
  it('days = the anchor month; weeks = 13 pay weeks ending with the anchor week; months = 12 months ending with the anchor month', () => {
    expect(vectorRangeFor('days', '2026-09-14')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(vectorRangeFor('weeks', '2026-09-30')).toEqual({ start: '2026-07-05', end: '2026-10-03' })
    expect(vectorRangeFor('months', '2026-09-30')).toEqual({ start: '2025-10-01', end: '2026-09-30' })
  })
  it('steps a month, thirteen weeks or twelve months at a time', () => {
    expect(vectorAnchorStep('days', '2026-09-14', -1)).toBe('2026-08-01')
    expect(vectorAnchorStep('days', '2026-09-14', 1)).toBe('2026-10-01')
    expect(vectorAnchorStep('weeks', '2026-09-30', -1)).toBe('2026-06-28')
    expect(vectorAnchorStep('months', '2026-09-30', -1)).toBe('2025-09-01')
  })
  it('labels the period in words', () => {
    expect(vectorRangeLabel('days', vectorRangeFor('days', '2026-09-14'))).toBe('September 2026')
    expect(vectorRangeLabel('weeks', vectorRangeFor('weeks', '2026-09-30'))).toBe('Jul 5 – Oct 3')
    expect(vectorRangeLabel('months', vectorRangeFor('months', '2026-09-30'))).toBe('Oct 2025 – Sep 2026')
  })
})

describe('vectorColumnsFor', () => {
  it('draws September as 30 days with a week sum after every Saturday and after the 30th', () => {
    const cols = vectorColumnsFor('days', { start: '2026-09-01', end: '2026-09-30' }, TODAY)
    expect(cols.filter((c) => c.kind === 'day')).toHaveLength(30)
    const sums = cols.filter((c) => c.kind === 'weekSum')
    expect(sums.map((c) => [c.start, c.end])).toEqual([
      ['2026-09-01', '2026-09-05'],
      ['2026-09-06', '2026-09-12'],
      ['2026-09-13', '2026-09-19'],
      ['2026-09-20', '2026-09-26'],
      ['2026-09-27', '2026-09-30'],
    ])
    // The first week is cut by the month's edge (part); the last one is cut by the month AND still running (part, not so far — the month ends today).
    expect(sums[0]?.partial).toBe(true)
    expect(sums[0]?.sub).toBe('part')
    expect(sums[1]?.partial).toBe(false)
    expect(sums[1]?.sub).toBe('')
    expect(cols.find((c) => c.key === '2026-09-05')?.weekend).toBe(true)
    expect(cols.find((c) => c.key === '2026-09-30')?.future).toBe(false)
  })
  it('marks a running week "so far" and days past today as future', () => {
    const cols = vectorColumnsFor('days', { start: '2026-09-01', end: '2026-09-30' }, '2026-09-15')
    const wk = cols.find((c) => c.kind === 'weekSum' && c.start === '2026-09-13')
    expect(wk?.sub).toBe('so far')
    expect(wk?.partial).toBe(true)
    expect(cols.find((c) => c.key === '2026-09-16')?.future).toBe(true)
    expect(cols.find((c) => c.kind === 'weekSum' && c.start === '2026-09-20')?.future).toBe(true)
  })
  it('draws 13 pay weeks and 12 months, the first month with its year', () => {
    const weeks = vectorColumnsFor('weeks', vectorRangeFor('weeks', TODAY), TODAY)
    expect(weeks).toHaveLength(13)
    expect(weeks[0]?.label).toBe('Jul 5')
    expect(weeks[12]?.sub).toBe('so far')
    const months = vectorColumnsFor('months', vectorRangeFor('months', TODAY), TODAY)
    expect(months).toHaveLength(12)
    expect(months.map((c) => c.label)).toEqual(['Oct 25', 'Nov', 'Dec', 'Jan 26', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'])
    expect(months[11]?.partial).toBe(false) // September ends today
  })
})

describe('buildVectorDayCells', () => {
  const base = { start: '2026-09-01', end: '2026-09-30', wages, ratePerHourByJob: rates, assumedHalfJobs: assumedHalf, jobLabels: labels }

  it('a day on a priced job: earned at the job rate, costed at the wage, green', () => {
    const cells = buildVectorDayCells({ ...base, mode: 'approved', sessions: [field('u-abraham', '2026-09-02', 8, 'j-good')] })
    const c = cells.get('u-abraham')?.get('2026-09-02')
    expect(c?.earnedUsd).toBe(8 * 92)
    expect(c?.laborUsd).toBe(8 * 40)
    expect(c?.contributionUsd).toBe(8 * 92 - 8 * 40)
    expect(c?.contributionPerHour).toBe(52)
    expect(c?.redDays).toBe(0)
    expect(c?.fieldDays).toBe(1)
    expect(c?.jobs).toEqual([{ jobId: 'j-good', label: 'J878 Shavano dental', hours: 8, ratePerHour: 92, guessed: false, earnedUsd: 736, redDays: 0 }])
  })

  it('a day on a job with no contract price earns nothing: unrated hours, contribution = −labor, red', () => {
    const cells = buildVectorDayCells({ ...base, mode: 'approved', sessions: [field('u-abraham', '2026-09-02', 6, 'j-free')] })
    const c = cells.get('u-abraham')?.get('2026-09-02')
    expect(c?.unratedHours).toBe(6)
    expect(c?.earnedUsd).toBe(0)
    expect(c?.contributionUsd).toBe(-240)
    expect(c?.redDays).toBe(1)
    expect(c?.jobs[0]).toMatchObject({ jobId: 'j-free', ratePerHour: null, redDays: 1 })
  })

  it('a day on an assumed-half job is a guess, and red when its rate is under the wage', () => {
    const cells = buildVectorDayCells({ ...base, mode: 'approved', sessions: [field('u-tristen', '2026-09-02', 8, 'j-low')] })
    const c = cells.get('u-tristen')?.get('2026-09-02')
    expect(c?.guessedEarnedUsd).toBe(8 * 31)
    expect(c?.contributionUsd).toBe(8 * 31 - 8 * 38)
    expect(c?.redDays).toBe(1)
    expect(c?.jobs[0]).toMatchObject({ guessed: true, redDays: 1 })
  })

  it('a day split over two jobs judges each job against the wage and the day as a whole', () => {
    const cells = buildVectorDayCells({ ...base, mode: 'approved', sessions: [field('u-tristen', '2026-09-02', 6, 'j-low'), field('u-tristen', '2026-09-02', 2, 'j-good')] })
    const c = cells.get('u-tristen')?.get('2026-09-02')
    expect(c?.contributionUsd).toBe(6 * 31 + 2 * 92 - 8 * 38) // +66: the day is green
    expect(c?.redDays).toBe(0)
    expect(c?.jobs.find((j) => j.jobId === 'j-low')?.redDays).toBe(1) // but the low job still cost more than it earned
    expect(c?.jobs.find((j) => j.jobId === 'j-good')?.redDays).toBe(0)
    expect(c?.jobs[0]?.jobId).toBe('j-low') // most hours first
  })

  it('a pending day is skipped in approved mode and counted, marked pending, in recorded mode', () => {
    const sessions = [field('u-abraham', '2026-09-28', 8, 'j-good', { approved: false, pending: true })]
    expect(buildVectorDayCells({ ...base, mode: 'approved', sessions }).get('u-abraham')).toBeUndefined()
    const c = buildVectorDayCells({ ...base, mode: 'recorded', sessions }).get('u-abraham')?.get('2026-09-28')
    expect(c?.pendingHours).toBe(8)
    expect(c?.contributionUsd).toBe(8 * 92 - 8 * 40)
  })

  it('a rejected or revoked session never counts in either mode', () => {
    const sessions = [field('u-abraham', '2026-09-28', 8, 'j-good', { approved: false, pending: false })]
    expect(buildVectorDayCells({ ...base, mode: 'recorded', sessions }).size).toBe(0)
  })

  it('an office day costs the office wage and earns nothing: no contribution, no verdict', () => {
    const cells = buildVectorDayCells({ ...base, mode: 'approved', sessions: [office('u-tristen', '2026-09-03', 7)] })
    const c = cells.get('u-tristen')?.get('2026-09-03')
    expect(c?.officeBidHours).toBe(7)
    expect(c?.officeLaborUsd).toBe(7 * 30)
    expect(c?.laborUsd).toBe(0)
    expect(c?.contributionUsd).toBeNull()
    expect(c?.fieldDays).toBe(0)
    expect(c?.redDays).toBe(0)
  })

  it('a bid session with no job is an office/bid day too', () => {
    const cells = buildVectorDayCells({ ...base, mode: 'approved', sessions: [{ userId: 'u-abraham', workDate: '2026-09-03', hours: 4, jobId: null, onBid: true, officeJob: false, approved: true, pending: false }] })
    expect(cells.get('u-abraham')?.get('2026-09-03')).toMatchObject({ officeBidHours: 4, officeLaborUsd: 160, contributionUsd: null })
  })

  it("a salaried person's field day costs the flat workday whatever the clock says, and a weekend day costs nothing", () => {
    const cells = buildVectorDayCells({ ...base, mode: 'approved', sessions: [field('u-kevin', '2026-09-02', 10, 'j-good'), field('u-kevin', '2026-09-05', 4, 'j-good')] })
    const weekday = cells.get('u-kevin')?.get('2026-09-02')
    expect(weekday?.laborUsd).toBe(8 * 34)
    expect(weekday?.contributionUsd).toBe(10 * 92 - 8 * 34)
    const saturday = cells.get('u-kevin')?.get('2026-09-05')
    expect(saturday?.laborUsd).toBe(0)
    expect(saturday?.contributionUsd).toBe(4 * 92)
  })

  it("a salaried person's office day carries the flat day on the office side", () => {
    const cells = buildVectorDayCells({ ...base, mode: 'approved', sessions: [office('u-kevin', '2026-09-03', 3)] })
    expect(cells.get('u-kevin')?.get('2026-09-03')).toMatchObject({ laborUsd: 0, officeLaborUsd: 8 * 34, contributionUsd: null })
  })

  it('sessions outside the range and zero-hour sessions are ignored', () => {
    const cells = buildVectorDayCells({ ...base, mode: 'approved', sessions: [field('u-abraham', '2026-08-31', 8, 'j-good'), field('u-abraham', '2026-09-02', 0, 'j-good')] })
    expect(cells.size).toBe(0)
  })
})

describe('foldBuckets', () => {
  it('sums the days, merges jobs by id and adds red days up', () => {
    const cells = buildVectorDayCells({
      start: '2026-09-01',
      end: '2026-09-30',
      mode: 'approved',
      wages,
      ratePerHourByJob: rates,
      assumedHalfJobs: assumedHalf,
      jobLabels: labels,
      sessions: [field('u-tristen', '2026-09-01', 8, 'j-low'), field('u-tristen', '2026-09-02', 8, 'j-low'), field('u-tristen', '2026-09-03', 8, 'j-good'), office('u-tristen', '2026-09-04', 6)],
    })
    const week = foldBuckets([...(cells.get('u-tristen')?.values() ?? [])], '2026-09-01', '2026-09-05')
    expect(week.fieldHours).toBe(24)
    expect(week.officeBidHours).toBe(6)
    expect(week.earnedUsd).toBe(16 * 31 + 8 * 92)
    expect(week.laborUsd).toBe(24 * 38)
    expect(week.officeLaborUsd).toBe(6 * 30)
    expect(week.contributionUsd).toBe(16 * 31 + 8 * 92 - 24 * 38)
    expect(week.fieldDays).toBe(3)
    expect(week.redDays).toBe(2)
    expect(week.jobs.map((j) => [j.jobId, j.hours, j.redDays])).toEqual([
      ['j-low', 16, 2],
      ['j-good', 8, 0],
    ])
    expect(week.guessedEarnedUsd).toBe(16 * 31)
  })
  it('an empty fold has no contribution', () => {
    expect(foldBuckets([], '2026-09-01', '2026-09-05')).toMatchObject({ fieldHours: 0, contributionUsd: null, jobs: [] })
  })
})

describe('buildVectorGrid', () => {
  const sessions: VectorSession[] = [
    field('u-abraham', '2026-09-01', 8, 'j-good'),
    field('u-abraham', '2026-09-02', 8, 'j-good'),
    field('u-abraham', '2026-09-08', 8, 'j-good'),
    field('u-tristen', '2026-09-01', 8, 'j-low'),
    field('u-tristen', '2026-09-02', 8, 'j-low'),
    field('u-tristen', '2026-09-03', 8, 'j-free'),
    field('u-tristen', '2026-09-08', 8, 'j-good'),
    office('u-tristen', '2026-09-09', 7),
    field('u-abraham', '2026-09-29', 8, 'j-good', { approved: false, pending: true }),
    office('u-office', '2026-09-02', 8), // office only — not a row
  ]
  const input = { zoom: 'days' as const, anchorYmd: '2026-09-14', todayYmd: TODAY, people, wages, sessions, ratePerHourByJob: rates, assumedHalfJobs: assumedHalf, jobLabels: labels }

  it('draws one row per person with field hours, best contribution first, and no row for an office-only person', () => {
    const g = buildVectorGrid({ ...input, mode: 'approved' })
    expect(g.start).toBe('2026-09-01')
    expect(g.end).toBe('2026-09-30')
    expect(g.rows.map((r) => r.name)).toEqual(['Abraham', 'Tristen'])
    expect(g.rows[0]?.cells).toHaveLength(g.columns.length)
  })

  it('a week-sum column folds only the days inside the month, and the person total equals the sum of the weeks', () => {
    const g = buildVectorGrid({ ...input, mode: 'approved' })
    const tristen = g.rows[1]
    if (!tristen) throw new Error('no Tristen row')
    const weekIdx = g.columns.map((c, i) => (c.kind === 'weekSum' ? i : -1)).filter((i) => i >= 0)
    const weekContribs = weekIdx.map((i) => tristen.cells[i]?.contributionUsd ?? 0)
    expect(weekContribs.reduce((a, b) => a + b, 0)).toBeCloseTo(tristen.total.contributionUsd ?? 0, 6)
    const firstWeek = tristen.cells[weekIdx[0] ?? -1]
    expect(firstWeek?.fieldHours).toBe(24)
    expect(firstWeek?.redDays).toBe(3) // two low days, one no-price day
    expect(tristen.cells[weekIdx[1] ?? -1]?.officeBidHours).toBe(7)
    expect(tristen.cells[weekIdx[2] ?? -1]).toBeNull() // nothing that week
  })

  it('names the jobs behind a person’s red days, most first, with their reason', () => {
    const g = buildVectorGrid({ ...input, mode: 'approved' })
    expect(g.rows[1]?.redByJob).toEqual([
      { jobId: 'j-low', label: 'J1044 Cielo Vista', days: 2, noPrice: false, guessed: true },
      { jobId: 'j-free', label: 'J523 T&M repipe', days: 1, noPrice: true, guessed: false },
    ])
    expect(g.rows[0]?.redByJob).toEqual([])
    expect(g.rows[1]?.wage).toBe(38)
  })

  it('the company row is the fold of every row, cell by cell and in total', () => {
    const g = buildVectorGrid({ ...input, mode: 'approved' })
    const sep1 = g.columns.findIndex((c) => c.key === '2026-09-01')
    expect(g.company.cells[sep1]?.contributionUsd).toBe(8 * 92 - 8 * 40 + (8 * 31 - 8 * 38))
    expect(g.company.total.contributionUsd).toBeCloseTo(g.rows.reduce((s, r) => s + (r.total.contributionUsd ?? 0), 0), 6)
    expect(g.company.total.redDays).toBe(3)
    const sep20 = g.columns.findIndex((c) => c.key === '2026-09-20')
    expect(g.company.cells[sep20]).toBeNull()
  })

  it('recorded mode brings the pending day in, and the person total grows by it', () => {
    const approved = buildVectorGrid({ ...input, mode: 'approved' })
    const recorded = buildVectorGrid({ ...input, mode: 'recorded' })
    const sep29 = recorded.columns.findIndex((c) => c.key === '2026-09-29')
    const approvedAbraham = approved.rows.find((r) => r.name === 'Abraham')
    const recordedAbraham = recorded.rows.find((r) => r.name === 'Abraham')
    expect(approvedAbraham?.cells[sep29]).toBeNull()
    expect(recordedAbraham?.cells[sep29]?.pendingHours).toBe(8)
    expect((recordedAbraham?.total.contributionUsd ?? 0) - (approvedAbraham?.total.contributionUsd ?? 0)).toBe(8 * 92 - 8 * 40)
    expect(recordedAbraham?.total.pendingHours).toBe(8)
  })

  it('the weeks zoom folds the same days into pay weeks and agrees with the days zoom on the month', () => {
    const days = buildVectorGrid({ ...input, mode: 'approved' })
    const weeks = buildVectorGrid({ ...input, zoom: 'weeks', anchorYmd: TODAY, mode: 'approved' })
    expect(weeks.columns).toHaveLength(13)
    const tristenWeeks = weeks.rows.find((r) => r.name === 'Tristen')
    const aug30 = weeks.columns.findIndex((c) => c.key === '2026-08-30') // Aug 30 – Sep 5 holds Sep 1–3
    expect(tristenWeeks?.cells[aug30]?.fieldHours).toBe(24)
    const tristenDays = days.rows.find((r) => r.name === 'Tristen')
    expect(tristenWeeks?.total.contributionUsd).toBeCloseTo(tristenDays?.total.contributionUsd ?? 0, 6)
  })

  it('the months zoom draws twelve months with September last', () => {
    const months = buildVectorGrid({ ...input, zoom: 'months', anchorYmd: TODAY, mode: 'approved' })
    expect(months.columns).toHaveLength(12)
    const abraham = months.rows.find((r) => r.name === 'Abraham')
    expect(abraham?.cells[11]?.fieldHours).toBe(24)
    expect(abraham?.cells[10]).toBeNull()
  })
})

describe('the ↻ mark (v2.4220)', () => {
  const base = { start: '2026-09-01', end: '2026-09-30', mode: 'approved' as const, wages, ratePerHourByJob: rates, assumedHalfJobs: assumedHalf, jobLabels: labels }
  it('flags a day whose verdict differs under last week’s rates, and only then', () => {
    // j-low reads red today ($31 < $38); a week ago it was priced at $60 — green then.
    const prior = new Map([
      ['j-low', 60],
      ['j-good', 92],
    ])
    const cells = buildVectorDayCells({ ...base, sessions: [field('u-tristen', '2026-09-02', 8, 'j-low'), field('u-tristen', '2026-09-03', 8, 'j-good')], priorRatePerHourByJob: prior })
    expect(cells.get('u-tristen')?.get('2026-09-02')?.flippedDays).toBe(1)
    expect(cells.get('u-tristen')?.get('2026-09-03')?.flippedDays).toBe(0)
    const week = foldBuckets([...(cells.get('u-tristen')?.values() ?? [])], '2026-09-01', '2026-09-05')
    expect(week.flippedDays).toBe(1)
  })
  it('a job with no prior rate on file is read at today’s rate — no flip; no prior map at all — no flips', () => {
    const cells = buildVectorDayCells({ ...base, sessions: [field('u-tristen', '2026-09-02', 8, 'j-low')], priorRatePerHourByJob: new Map([['j-good', 1]]) })
    expect(cells.get('u-tristen')?.get('2026-09-02')?.flippedDays).toBe(0)
    const none = buildVectorDayCells({ ...base, sessions: [field('u-tristen', '2026-09-02', 8, 'j-low')] })
    expect(none.get('u-tristen')?.get('2026-09-02')?.flippedDays).toBe(0)
  })
  it('a rate that moved without changing the verdict is not a flip', () => {
    const cells = buildVectorDayCells({ ...base, sessions: [field('u-tristen', '2026-09-02', 8, 'j-good')], priorRatePerHourByJob: new Map([['j-good', 70]]) })
    expect(cells.get('u-tristen')?.get('2026-09-02')?.flippedDays).toBe(0)
  })
})

describe('vectorVerdict (v2.4220)', () => {
  const base = { start: '2026-09-01', end: '2026-09-30', mode: 'approved' as const, wages, ratePerHourByJob: rates, assumedHalfJobs: assumedHalf, jobLabels: labels }
  const cellFor = (sessions: VectorSession[], user = 'u-tristen', day = '2026-09-02') => buildVectorDayCells({ ...base, sessions }).get(user)?.get(day)
  it('a red day names the job, its rate against the wage, and the % gap', () => {
    const b = cellFor([field('u-tristen', '2026-09-02', 8, 'j-low')])
    if (!b) throw new Error('no cell')
    const v = vectorVerdict(b, 'Tristen', 38)
    expect(v.tone).toBe('red')
    expect(v.sentence).toContain('Red because J1044 Cielo Vista earns $31 an hour and Tristen costs $38.')
    expect(v.sentence).toContain('everyone on it reads the same')
    expect(v.sentence).toContain('J1044 Cielo Vista has no % complete')
  })
  it('a no-price day says the price is missing', () => {
    const b = cellFor([field('u-tristen', '2026-09-02', 6, 'j-free')])
    if (!b) throw new Error('no cell')
    const v = vectorVerdict(b, 'Tristen', 38)
    expect(v.tone).toBe('red')
    expect(v.sentence).toContain('earns nothing and Tristen costs $38')
    expect(v.sentence).toContain('J523 T&M repipe has no contract price yet')
  })
  it('a green day says every job cleared the wage; a mixed day says which did not', () => {
    const g = cellFor([field('u-tristen', '2026-09-02', 8, 'j-good')])
    if (!g) throw new Error('no cell')
    expect(vectorVerdict(g, 'Tristen', 38)).toEqual({ tone: 'green', sentence: "Green: every job that day earned over Tristen's $38 wage — $736 earned against $304 of labor." })
    const m = cellFor([field('u-tristen', '2026-09-02', 6, 'j-low'), field('u-tristen', '2026-09-02', 2, 'j-good')])
    if (!m) throw new Error('no cell')
    const v = vectorVerdict(m, 'Tristen', 38)
    expect(v.tone).toBe('green')
    expect(v.sentence).toContain('Green on balance')
    expect(v.sentence).toContain('J1044 Cielo Vista paid under Tristen\'s wage')
  })
  it('an office day has no verdict', () => {
    const b = cellFor([office('u-tristen', '2026-09-02', 7)])
    if (!b) throw new Error('no cell')
    expect(vectorVerdict(b, 'Tristen', 38).tone).toBe('none')
  })
  it('a folded period speaks of the period', () => {
    const cells = buildVectorDayCells({ ...base, sessions: [field('u-tristen', '2026-09-01', 8, 'j-low'), field('u-tristen', '2026-09-02', 8, 'j-low')] })
    const week = foldBuckets([...(cells.get('u-tristen')?.values() ?? [])], '2026-09-01', '2026-09-05')
    expect(vectorVerdict(week, 'Tristen', 38).sentence).toContain('not how fast the period went')
  })
})

