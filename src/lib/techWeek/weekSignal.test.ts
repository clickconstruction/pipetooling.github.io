import { describe, expect, it } from 'vitest'
import { callbackRead, callbackWords, licenseHoursRead, licenseHoursWords, parseMyWeek, parseWeekSignal, suggestedSignalForRole, weekDots, weekRangeWords, yourWeekCard, type MyWeek, type MyWeekHour, type MyWeekJob } from './weekSignal'

const TODAY = '2026-11-06' // Friday; the pay week is Nov 1 to Nov 7
const WEEK = { start: '2026-11-01', end: '2026-11-07' }

const hour = (work_date: string, hours: number, approved = true, service_type_name = 'Plumbing', job: string | null = 'j1'): MyWeekHour => ({
  session_id: `${work_date}-${job}-${hours}`,
  work_date,
  clocked_in_at: '',
  clocked_out_at: '',
  hours,
  job_ledger_id: job,
  job_number: '1184',
  job_name: 'Water heater',
  job_address: '1208 Mesquite Ln',
  service_type_name,
  bid_id: null,
  notes: '',
  approved,
})

const job = (p: Partial<MyWeekJob> = {}): MyWeekJob => ({ jobId: 'j1', number: '1184', name: 'Water heater', finishedYmd: '2026-11-03', expectedHours: null, budgetHours: 40, crewHours: 36, myFirstYmd: '2026-11-02', ...p })

const my = (p: Partial<MyWeek> = {}): MyWeek => ({ signal: 'jobs_without_callback', name: 'Marcus Lee', role: 'primary', hours: [], licenses: [], targets: [], officeJobId: null, jobs: [], callbackJobIds: [], ...p })

describe('the signal', () => {
  it('parses the three signals and guesses one by role', () => {
    expect(parseWeekSignal('license_hours')).toBe('license_hours')
    expect(parseWeekSignal('points')).toBeNull()
    expect(suggestedSignalForRole('helpers')).toBe('license_hours')
    expect(suggestedSignalForRole('primary')).toBe('jobs_without_callback')
    expect(suggestedSignalForRole('superintendent')).toBe('crew_vs_target')
    expect(suggestedSignalForRole('assistant')).toBeNull()
  })
})

describe('parseMyWeek', () => {
  it('types the jsonb and reads the approved flag, the targets and the callbacks', () => {
    const m = parseMyWeek({
      signal: 'crew_vs_target',
      name: 'Luis Ortega',
      role: 'superintendent',
      hours: [{ session_id: 's1', work_date: '2026-11-02', clocked_in_at: 'a', clocked_out_at: 'b', hours: '8.5', approved: true, job_ledger_id: 'j1', job_number: '1184', job_name: 'Water heater', job_address: '', service_type_name: 'Plumbing', bid_id: null }],
      licenses: [{ license_type: 'Plumber Apprentice #191717', date_of_expiry: '2027-01-01' }],
      office_job_id: 'office',
      jobs: [{ job_id: 'j1', job_number: '1184', job_name: 'Water heater', finished_ymd: '2026-11-03', expected_hours: '96', budget_hours: null, crew_hours: '112.0', my_first_ymd: '2026-11-02' }],
      callbacks: [{ first_job_id: 'j1', second_job_id: 'j9' }],
    })
    expect(m).toMatchObject({ signal: 'crew_vs_target', name: 'Luis Ortega', officeJobId: 'office', callbackJobIds: ['j1'] })
    expect(m?.hours[0]).toMatchObject({ hours: 8.5, approved: true })
    expect(m?.jobs[0]).toMatchObject({ expectedHours: 96, budgetHours: null, crewHours: 112, finishedYmd: '2026-11-03' })
    expect(parseMyWeek(null)).toBeNull()
    expect(parseMyWeek([])).toBeNull()
  })
})

describe('license hours', () => {
  const apprentice = my({ signal: 'license_hours', role: 'helpers', licenses: [{ license_type: 'Plumber Apprentice #191717', date_of_expiry: '2027-08-31' }], hours: [hour('2026-10-20', 3400), hour('2026-11-02', 8), hour('2026-11-03', 8, false), hour('2026-11-04', 4, true, 'Electrical'), hour('2026-10-01', 10, true, 'Plumbing', 'office')], officeJobId: 'office' })

  it('counts approved hours toward the goal, hatches the waiting ones, and reads the week', () => {
    const r = licenseHoursRead(apprentice, WEEK, TODAY)!
    expect(r.title).toBe('Hours toward journeyman plumber')
    expect(r).toMatchObject({ done: 3408, need: 8000, waiting: 8, thisWeek: 16 })
    expect(r.nextMark).toEqual({ at: 3500, away: 92 })
    expect(r.bar).toMatchObject({ from: 3000, to: 3500 })
    expect(r.bar!.approvedPct).toBeCloseTo(0.816, 2)
    expect(r.bar!.waitingPct).toBeCloseTo(0.832, 2)
    const w = licenseHoursWords(r)
    expect(w.head).toBe('3,408 of 8,000')
    expect(w.sub).toBe('Approved · 8 h waiting for approval')
    expect(w.move).toEqual({ tone: 'up', text: '▲ 16 h this week' })
    expect(w.mark).toBe('Next mark 3,500 h. You are 92 hours away.')
  })

  it('adds the hours before the clock the office set, and takes the office’s class and number', () => {
    const r = licenseHoursRead(my({ ...apprentice, targets: [{ trade: 'plumbing', targetClass: 'journeyman', targetAmount: 7000, openingAmount: 1200, openingSource: 'Hours at Rio Plumbing' }] }), WEEK, TODAY)!
    expect(r).toMatchObject({ done: 4608, need: 7000, waiting: 8, thisWeek: 16 })
    expect(r.nextMark).toEqual({ at: 5000, away: 392 })
    expect(licenseHoursWords(r).head).toBe('4,608 of 7,000')
  })

  it('reads a flat week and nothing for a person with no ladder', () => {
    const w = licenseHoursWords(licenseHoursRead(my({ ...apprentice, hours: [hour('2026-10-20', 100)] }), WEEK, TODAY)!)
    expect(w.move).toEqual({ tone: 'flat', text: 'Same as last week' })
    expect(licenseHoursRead(my({ licenses: [] }), WEEK, TODAY)).toBeNull()
  })
})

describe('jobs without a callback', () => {
  const jobs = [
    ...Array.from({ length: 28 }, (_, i) => job({ jobId: `old${i}`, finishedYmd: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}` })),
    job({ jobId: 'back', finishedYmd: '2026-10-20' }),
    job({ jobId: 'a', finishedYmd: '2026-11-02' }),
    job({ jobId: 'b', finishedYmd: '2026-11-04' }),
    job({ jobId: 'open', finishedYmd: null }),
    job({ jobId: 'ancient', finishedYmd: '2026-01-01' }),
  ]

  it('counts the last 30 finished jobs, one callback costing one, and the week', () => {
    const r = callbackRead(my({ jobs, callbackJobIds: ['back', 'ancient'] }), WEEK)
    expect(r).toEqual({ counted: 30, clean: 29, thisWeek: 2, cameBackThisWeek: 0 })
    expect(callbackWords(r)).toEqual({ head: '29 of your last 30 jobs', move: { tone: 'up', text: '▲ 2 jobs this week, none came back' } })
  })

  it('names a return this week without a red arrow, a quiet week, and no jobs yet', () => {
    expect(callbackWords(callbackRead(my({ jobs, callbackJobIds: ['b'] }), WEEK)).move).toEqual({ tone: 'flat', text: '2 jobs this week, one came back' })
    expect(callbackWords(callbackRead(my({ jobs }), { start: '2026-11-08', end: '2026-11-14' })).move).toEqual({ tone: 'flat', text: 'Same as last week' })
    expect(callbackWords(callbackRead(my(), WEEK))).toEqual({ head: 'No finished job yet', move: { tone: 'none', text: '' } })
  })

  it('draws the rolling count at the end of each of the last eight weeks', () => {
    const dots = weekDots(my({ jobs, callbackJobIds: ['back'] }), 'jobs_without_callback', TODAY)
    expect(dots).toHaveLength(8)
    expect(dots[7]).toMatchObject({ week: WEEK, value: 29 })
    expect(dots[0]!.value).toBeLessThanOrEqual(29)
  })
})

describe('the card', () => {
  it('says nothing without a signal, and three things at most with one', () => {
    expect(yourWeekCard(my({ signal: null }), TODAY)).toBeNull()
    const c = yourWeekCard(my({ jobs: [job({ jobId: 'a' }), job({ jobId: 'b', finishedYmd: '2026-10-28' })] }), TODAY)!
    expect(c).toMatchObject({ signal: 'jobs_without_callback', title: 'Your week', range: 'Nov 1 to Nov 7', kicker: 'Jobs without a callback', head: '2 of your last 2 jobs' })
    expect(c.move).toEqual({ tone: 'up', text: '▲ 1 job this week, none came back' })
    expect(c.dots).toHaveLength(8)
  })

  it('reads the crew against the target with the dashed line and the no-target note', () => {
    const c = yourWeekCard(my({ signal: 'crew_vs_target', jobs: [job({ jobId: 'a', crewHours: 36, budgetHours: 40 }), job({ jobId: 'b', crewHours: 76, expectedHours: 84, budgetHours: 90 }), job({ jobId: 'c', budgetHours: null })] }), TODAY)!
    expect(c).toMatchObject({ kicker: 'Your crew against the target', head: '112 h for a 124 h target', dashed: true, note: 'One more job finished with no target, so it is not counted.' })
    expect(c.move).toEqual({ tone: 'up', text: '✓ 12 hours under on 2 jobs' })
    expect(c.dots[7]).toMatchObject({ value: 112, target: 124 })
  })

  it('reads the license bar and no dots for an apprentice, and null with no ladder', () => {
    const c = yourWeekCard(my({ signal: 'license_hours', licenses: [{ license_type: 'Plumber Apprentice #1', date_of_expiry: null }], hours: [hour('2026-11-02', 8)] }), TODAY)!
    expect(c).toMatchObject({ kicker: 'Hours toward journeyman plumber', head: '8 of 8,000', dots: [] })
    expect(c.bar).toMatchObject({ from: 0, to: 500 })
    expect(yourWeekCard(my({ signal: 'license_hours' }), TODAY)).toBeNull()
    expect(weekRangeWords(WEEK)).toBe('Nov 1 to Nov 7')
  })
})
