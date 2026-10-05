import { describe, expect, it } from 'vitest'
import { buildOtherJobsLaborByDay, buildOverheadDailyLabor } from '../overheadDailyLabor'
import {
  buildManHoursEntries,
  buildManHoursPeriods,
  formatManHours,
  manHoursDayLabel,
  manHoursPeriodBounds,
  manHoursPeriodLabel,
  manHoursSide,
  type ManHoursEntry,
  type ManHoursSession,
} from './manHoursByPeriod'

const OFFICE = 'job-office'

/** A closed, approved session of `hours` on `day`, starting at 14:00 UTC. */
function sess(day: string, userId: string, hours: number, over: Partial<ManHoursSession> = {}): ManHoursSession {
  const start = new Date(`${day}T14:00:00.000Z`).getTime()
  return {
    user_id: userId,
    work_date: day,
    clocked_in_at: new Date(start).toISOString(),
    clocked_out_at: new Date(start + hours * 3600000).toISOString(),
    job_ledger_id: null,
    bid_id: null,
    approved_at: `${day}T23:00:00.000Z`,
    rejected_at: null,
    revoked_at: null,
    ...over,
  }
}

const entry = (workDate: string, side: ManHoursEntry['side'], hours: number, userId = 'u1', pending = false): ManHoursEntry => ({
  workDate,
  userId,
  side,
  hours,
  pending,
})

describe('manHoursSide', () => {
  it('reads the Office job as office, any other job as field, a bid as bid, nothing as unassigned', () => {
    expect(manHoursSide(OFFICE, OFFICE, null)).toBe('office')
    expect(manHoursSide(OFFICE, 'job-1', null)).toBe('field')
    expect(manHoursSide(OFFICE, null, 'bid-1')).toBe('bid')
    expect(manHoursSide(OFFICE, null, null)).toBe('unassigned')
    expect(manHoursSide(OFFICE, '', null)).toBe('unassigned')
  })

  it('counts a session on a field job and a bid once, as field', () => {
    expect(manHoursSide(OFFICE, 'job-1', 'bid-1')).toBe('field')
  })

  it('has no office side until an Office job is set', () => {
    expect(manHoursSide(null, OFFICE, null)).toBe('field')
  })
})

describe('buildManHoursEntries', () => {
  it('keeps closed sessions that were not rejected or revoked, and marks the ones waiting for approval', () => {
    const entries = buildManHoursEntries(
      [
        sess('2026-09-01', 'u1', 8, { job_ledger_id: 'job-1' }),
        sess('2026-09-01', 'u2', 4, { job_ledger_id: OFFICE, approved_at: null }),
        sess('2026-09-01', 'u3', 6, { job_ledger_id: 'job-1', rejected_at: '2026-09-02T00:00:00.000Z' }),
        sess('2026-09-01', 'u4', 6, { job_ledger_id: 'job-1', revoked_at: '2026-09-02T00:00:00.000Z' }),
        sess('2026-09-01', 'u5', 6, { job_ledger_id: 'job-1', clocked_out_at: null }),
        sess('2026-09-01', 'u6', 0, { job_ledger_id: 'job-1' }),
      ],
      OFFICE,
    )
    expect(entries).toEqual([
      { workDate: '2026-09-01', userId: 'u1', side: 'field', hours: 8, pending: false },
      { workDate: '2026-09-01', userId: 'u2', side: 'office', hours: 4, pending: true },
    ])
  })
})

describe('manHoursPeriodBounds', () => {
  it('a week is the Sunday to Saturday pay week', () => {
    expect(manHoursPeriodBounds('2026-09-30', 'week')).toEqual({ start: '2026-09-27', end: '2026-10-03' })
    expect(manHoursPeriodBounds('2026-09-27', 'week')).toEqual({ start: '2026-09-27', end: '2026-10-03' })
  })

  it('a month ends on its last day, leap February included', () => {
    expect(manHoursPeriodBounds('2026-09-15', 'month')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(manHoursPeriodBounds('2026-12-31', 'month')).toEqual({ start: '2026-12-01', end: '2026-12-31' })
    expect(manHoursPeriodBounds('2028-02-10', 'month')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })

  it('a quarter is three calendar months and a year is the calendar year', () => {
    expect(manHoursPeriodBounds('2026-03-12', 'quarter')).toEqual({ start: '2026-01-01', end: '2026-03-31' })
    expect(manHoursPeriodBounds('2026-11-02', 'quarter')).toEqual({ start: '2026-10-01', end: '2026-12-31' })
    expect(manHoursPeriodBounds('2026-11-02', 'year')).toEqual({ start: '2026-01-01', end: '2026-12-31' })
  })
})

describe('buildManHoursPeriods', () => {
  it('is empty with no counted sessions', () => {
    expect(buildManHoursPeriods({ entries: [], zoom: 'month', todayYmd: '2026-10-04' })).toEqual({ zoom: 'month', firstDay: null, periods: [] })
  })

  it('sums each side, the total, the people and the office share for a month', () => {
    const view = buildManHoursPeriods({
      zoom: 'month',
      todayYmd: '2026-10-04',
      entries: [
        entry('2026-09-01', 'field', 30, 'u1'),
        entry('2026-09-02', 'field', 30, 'u2'),
        entry('2026-09-03', 'office', 15, 'u3'),
        entry('2026-09-04', 'bid', 5, 'u3'),
        entry('2026-09-05', 'unassigned', 10, 'u1', true),
      ],
    })
    const sep = view.periods[0]
    expect(sep).toMatchObject({
      key: '2026-09-01',
      end: '2026-09-30',
      fieldHours: 60,
      officeHours: 15,
      bidHours: 5,
      unassignedHours: 10,
      totalHours: 90,
      pendingHours: 10,
      people: 3,
      soFar: false,
      fromFirstDay: false,
      coveredDays: 30,
    })
    // Time on no job is in the total and out of the share: 20 ÷ 80.
    expect(sep?.officeShare).toBeCloseTo(0.25)
    expect(sep?.hoursPerWeek).toBeCloseTo(90 / (30 / 7))
  })

  it('marks the open period, clips it to today, and still reads it per week', () => {
    const view = buildManHoursPeriods({
      zoom: 'month',
      todayYmd: '2026-10-04',
      entries: [entry('2026-09-10', 'field', 100), entry('2026-10-02', 'field', 40)],
    })
    const oct = view.periods[1]
    expect(view.periods.map((p) => p.key)).toEqual(['2026-09-01', '2026-10-01'])
    expect(oct).toMatchObject({ soFar: true, coveredDays: 4, totalHours: 40 })
    expect(oct?.hoursPerWeek).toBeCloseTo(70)
  })

  it('marks the period the clock started in and counts its days from the first day', () => {
    const view = buildManHoursPeriods({
      zoom: 'month',
      todayYmd: '2026-05-10',
      entries: [entry('2026-03-12', 'field', 40), entry('2026-04-15', 'office', 10)],
    })
    expect(view.firstDay).toBe('2026-03-12')
    expect(view.periods[0]).toMatchObject({ key: '2026-03-01', fromFirstDay: true, coveredDays: 20 })
    expect(view.periods[1]).toMatchObject({ key: '2026-04-01', fromFirstDay: false, coveredDays: 30 })
  })

  it('leaves no gap: a period with no hours is a row of zeros with no share', () => {
    const view = buildManHoursPeriods({
      zoom: 'week',
      todayYmd: '2026-09-22',
      entries: [entry('2026-09-01', 'field', 8), entry('2026-09-21', 'office', 4)],
    })
    expect(view.periods.map((p) => [p.key, p.totalHours, p.officeShare])).toEqual([
      ['2026-08-30', 8, 0],
      ['2026-09-06', 0, null],
      ['2026-09-13', 0, null],
      ['2026-09-20', 4, 1],
    ])
  })

  it('shows the newest periods when there are more than the zoom holds', () => {
    const view = buildManHoursPeriods({
      zoom: 'week',
      todayYmd: '2026-09-30',
      maxPeriods: 2,
      entries: [entry('2026-06-01', 'field', 8), entry('2026-09-29', 'field', 8)],
    })
    expect(view.firstDay).toBe('2026-06-01')
    expect(view.periods.map((p) => p.key)).toEqual(['2026-09-20', '2026-09-27'])
  })

  it('folds the same entries into quarters and a year that add up', () => {
    const entries = [entry('2026-03-12', 'field', 10), entry('2026-06-30', 'office', 20), entry('2026-07-01', 'bid', 30), entry('2026-10-01', 'field', 40)]
    const quarters = buildManHoursPeriods({ entries, zoom: 'quarter', todayYmd: '2026-10-04' }).periods
    const years = buildManHoursPeriods({ entries, zoom: 'year', todayYmd: '2026-10-04' }).periods
    expect(quarters.map((p) => [p.key, p.totalHours])).toEqual([
      ['2026-01-01', 10],
      ['2026-04-01', 20],
      ['2026-07-01', 30],
      ['2026-10-01', 40],
    ])
    expect(years).toHaveLength(1)
    expect(years[0]).toMatchObject({ key: '2026-01-01', totalHours: 100, fromFirstDay: true, soFar: true })
    // Mar 12 through Oct 4.
    expect(years[0]?.coveredDays).toBe(207)
  })
})

describe('the card against the Overhead day table', () => {
  it('a week of office and field hours here equals the day table’s two columns', () => {
    const sessions = [
      sess('2026-09-28', 'u1', 8, { job_ledger_id: 'job-1' }),
      sess('2026-09-28', 'u2', 7.5, { job_ledger_id: 'job-2', approved_at: null }),
      sess('2026-09-29', 'u1', 9, { job_ledger_id: 'job-1' }),
      sess('2026-09-29', 'u3', 6, { job_ledger_id: OFFICE }),
      sess('2026-09-30', 'u3', 3, { bid_id: 'bid-1' }),
      sess('2026-09-30', 'u4', 5, {}),
      sess('2026-10-01', 'u2', 4, { job_ledger_id: 'job-2', rejected_at: '2026-10-02T00:00:00.000Z' }),
      sess('2026-10-02', 'u1', 2, { job_ledger_id: 'job-1', clocked_out_at: null }),
    ]
    const withNames = sessions.map((s, i) => ({ ...s, id: `s${i}`, users: { name: s.user_id } }))
    const noWages = new Map()
    const office = buildOverheadDailyLabor({ sessions: withNames, officeJobLedgerId: OFFICE, wageByNormalizedName: noWages })
    const field = buildOtherJobsLaborByDay({ sessions: withNames, officeJobLedgerId: OFFICE, wageByNormalizedName: noWages })
    const dayTableOffice = office.byDay.reduce((sum, d) => sum + d.laborHours, 0)
    const dayTableField = [...field.laborHoursByDay.values()].reduce((sum, h) => sum + h, 0)

    const week = buildManHoursPeriods({ entries: buildManHoursEntries(sessions, OFFICE), zoom: 'week', todayYmd: '2026-10-04' }).periods[0]
    expect(week?.key).toBe('2026-09-27')
    expect((week?.officeHours ?? 0) + (week?.bidHours ?? 0)).toBeCloseTo(dayTableOffice)
    expect(week?.fieldHours).toBeCloseTo(dayTableField)
    expect(week?.unassignedHours).toBeCloseTo(5)
    expect(week?.pendingHours).toBeCloseTo(7.5)
  })
})

describe('formatManHours', () => {
  it('prints whole hours, "<1" for time under half an hour, and a dash for none', () => {
    expect(formatManHours(1434.6)).toBe('1,435')
    expect(formatManHours(0.5)).toBe('1')
    expect(formatManHours(0.2)).toBe('<1')
    expect(formatManHours(0)).toBe('—')
  })
})

describe('labels', () => {
  it('names a period the way the card prints it', () => {
    expect(manHoursPeriodLabel({ start: '2026-09-27' }, 'week')).toBe('Week of Sep 27')
    expect(manHoursPeriodLabel({ start: '2026-09-01' }, 'month')).toBe('September 2026')
    expect(manHoursPeriodLabel({ start: '2026-07-01' }, 'quarter')).toBe('Q3 2026')
    expect(manHoursPeriodLabel({ start: '2026-01-01' }, 'year')).toBe('2026')
    expect(manHoursDayLabel('2026-03-12')).toBe('Mar 12')
  })
})
