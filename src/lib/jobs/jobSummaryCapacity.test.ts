import { describe, expect, it } from 'vitest'
import { buildJobDayLedger } from './jobDayLedger'
import { buildCapacitySeries, capacityNudgeWindow, capacityUnderStreak, type CapacitySeries, type CapacityWeek } from './jobSummaryCapacity'
import type { OtherJobsLaborDetailLine } from '../overheadDailyLabor'
import { ymdAddDays } from '../../utils/dateUtils'

const line = (ymd: string, job: string, user: string, hours: number): OtherJobsLaborDetailLine => ({
  sessionId: `${ymd}-${job}-${user}`,
  workDate: ymd,
  userName: user,
  hours,
  laborUsd: hours * 30,
  missingWage: false,
  jobLedgerId: job,
  notes: null,
})
// Two full weeks: Mon Aug 3 → Sun Aug 16. Week 1: Terry + Sam every weekday 8h (80h). Week 2: Terry only, 3 days × 8h (24h).
const detail = new Map<string, OtherJobsLaborDetailLine[]>()
for (const d of ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']) detail.set(d, [line(d, 'j1', 'Terry', 8), line(d, 'j2', 'Sam', 8)])
for (const d of ['2026-08-10', '2026-08-11', '2026-08-12']) detail.set(d, [line(d, 'j1', 'Terry', 8)])
const ledger = buildJobDayLedger({ startYmd: '2026-08-03', endYmd: '2026-08-16', officeJobLedgerId: 'office', fieldDetailByDay: detail, poolUsdByDay: new Map(), addDays: ymdAddDays })

describe('capacity (v2.2828)', () => {
  const roster = [
    { id: 'a', kind: 'master_technician', start_date: null, end_date: null, archived_at: null },
    { id: 'b', kind: 'helper', start_date: '2026-01-01', end_date: '2026-08-07', archived_at: null }, // leaves after week 1
    { id: 'c', kind: 'assistant', start_date: null, end_date: null, archived_at: null }, // office — not capacity
    { id: 'd', kind: 'helper', start_date: '2026-08-12', end_date: null, archived_at: null }, // joins mid week 2
  ]

  it('roster source: available = active field people per weekday × 8; utilization per week and overall', () => {
    const s = buildCapacitySeries({ ledger, people: roster })
    expect(s.source).toBe('roster')
    expect(s.weeks.length).toBe(2)
    const [w1, w2] = s.weeks
    expect(w1).toMatchObject({ workdays: 5, people: 2, availableHours: 80, fieldHours: 80, peopleWorked: 2, utilizationPct: 100 })
    // week 2: a every day (5×8) + d Wed–Fri (3×8) = 64 available; 24 used
    expect(w2).toMatchObject({ workdays: 5, people: 2, availableHours: 64, fieldHours: 24, peopleWorked: 1 })
    expect(w2!.utilizationPct).toBeCloseTo(37.5)
    expect(s.totals).toEqual({ availableHours: 144, fieldHours: 104, hoursOff: 0, utilizationPct: (104 / 144) * 100 })
    expect(s.peak?.weekStartYmd).toBe('2026-08-03')
    expect(s.weeksUnder60).toBe(1)
    expect(s.weeksOver100).toBe(0)
    expect(s.crewNow).toBe(2)
  })

  it('clocked source when the roster is unreadable: available = people who clocked in × workdays × 8', () => {
    const s = buildCapacitySeries({ ledger, people: null })
    expect(s.source).toBe('clocked')
    expect(s.weeks[0]).toMatchObject({ people: 2, availableHours: 80, fieldHours: 80 })
    expect(s.weeks[1]).toMatchObject({ people: 1, availableHours: 40, fieldHours: 24 })
    expect(s.crewNow).toBe(1)
  })

  it('time off comes off that weekday\'s available hours and the week says how much (v2.3523)', () => {
    // a is off Tue–Wed of week 1 (16 h); b is off Sat–Sun (weekend: nothing to subtract); c (office) off all week: not capacity anyway
    const timeOff = [
      { personId: 'a', startYmd: '2026-08-04', endYmd: '2026-08-05' },
      { personId: 'b', startYmd: '2026-08-08', endYmd: '2026-08-09' },
      { personId: 'c', startYmd: '2026-08-03', endYmd: '2026-08-07' },
    ]
    const s = buildCapacitySeries({ ledger, people: roster, timeOff })
    const [w1, w2] = s.weeks
    expect(w1).toMatchObject({ people: 2, availableHours: 64, hoursOff: 16, fieldHours: 80 })
    expect(w1!.utilizationPct).toBeCloseTo(125)
    expect(w2).toMatchObject({ availableHours: 64, hoursOff: 0 })
    expect(s.totals).toMatchObject({ availableHours: 128, hoursOff: 16 })
    expect(s.weeksOver100).toBe(1)
  })

  it('time off on a day the person was not on the roster yet subtracts nothing', () => {
    // d joins Wed Aug 12; a day off on Mon Aug 10 is before their start
    const s = buildCapacitySeries({ ledger, people: roster, timeOff: [{ personId: 'd', startYmd: '2026-08-10', endYmd: '2026-08-10' }] })
    expect(s.weeks[1]).toMatchObject({ availableHours: 64, hoursOff: 0 })
  })

  it('the clocked fallback ignores time off (it has no roster to subtract from)', () => {
    const s = buildCapacitySeries({ ledger, people: null, timeOff: [{ personId: 'a', startYmd: '2026-08-03', endYmd: '2026-08-07' }] })
    expect(s.weeks[0]).toMatchObject({ availableHours: 80, hoursOff: 0 })
  })

  it('is empty without a ledger', () => {
    expect(buildCapacitySeries({ ledger: null, people: roster }).weeks).toEqual([])
  })
})

describe('capacity under 60% three weeks running (Needs You)', () => {
  const week = (weekStartYmd: string, utilizationPct: number | null, workdays = 5): CapacityWeek => ({
    weekStartYmd,
    weekEndYmd: ymdAddDays(weekStartYmd, 6),
    workdays,
    people: 2,
    hoursOff: 0,
    availableHours: 80,
    fieldHours: utilizationPct == null ? 0 : (utilizationPct / 100) * 80,
    peopleWorked: 2,
    utilizationPct,
  })
  const series = (weeks: CapacityWeek[]): CapacitySeries => ({ source: 'roster', weeks, totals: { availableHours: 0, fieldHours: 0, hoursOff: 0, utilizationPct: null }, peak: null, weeksUnder60: 0, weeksOver100: 0, crewNow: 2 })

  it('names the three complete weeks before this one, never the current partial week', () => {
    expect(capacityNudgeWindow('2026-09-14')).toEqual({ startYmd: '2026-08-24', endYmd: '2026-09-13' }) // a Monday
    expect(capacityNudgeWindow('2026-09-16')).toEqual({ startYmd: '2026-08-24', endYmd: '2026-09-13' }) // mid-week, same window
    expect(capacityNudgeWindow('2026-09-20')).toEqual({ startYmd: '2026-08-24', endYmd: '2026-09-13' }) // Sunday still belongs to this week
    expect(capacityNudgeWindow('2026-09-14', 1)).toEqual({ startYmd: '2026-09-07', endYmd: '2026-09-13' })
  })

  it('returns the streak only when every one of the last three rated weeks is under the line', () => {
    const under = capacityUnderStreak(series([week('2026-08-24', 48), week('2026-08-31', 52.4), week('2026-09-07', 41)]))
    expect(under?.weeks.map((w) => w.weekStartYmd)).toEqual(['2026-08-24', '2026-08-31', '2026-09-07'])
    expect(under?.weeks.map((w) => Math.round(w.utilizationPct))).toEqual([48, 52, 41])
    expect(under).toMatchObject({ availableHours: 240, thresholdPct: 60, source: 'roster', crewNow: 2 })
    expect(under?.fieldHours).toBeCloseTo(113.12)
    // One week at 60 clears it — the line is strict.
    expect(capacityUnderStreak(series([week('2026-08-24', 48), week('2026-08-31', 60), week('2026-09-07', 41)]))).toBeNull()
    // The last three of a longer series are what count.
    expect(capacityUnderStreak(series([week('2026-08-17', 95), week('2026-08-24', 48), week('2026-08-31', 52), week('2026-09-07', 41)]))).not.toBeNull()
    expect(capacityUnderStreak(series([week('2026-08-17', 30), week('2026-08-24', 48), week('2026-08-31', 52), week('2026-09-07', 90)]))).toBeNull()
  })

  it('cannot say with fewer than three rated weeks — an unknown week is not a low one', () => {
    expect(capacityUnderStreak(series([week('2026-08-31', 10), week('2026-09-07', 10)]))).toBeNull()
    expect(capacityUnderStreak(series([week('2026-08-24', null), week('2026-08-31', 10), week('2026-09-07', 10)]))).toBeNull()
    expect(capacityUnderStreak(series([week('2026-08-24', 10, 2), week('2026-08-31', 10), week('2026-09-07', 10)]))).toBeNull()
    expect(capacityUnderStreak(series([]))).toBeNull()
  })
})
