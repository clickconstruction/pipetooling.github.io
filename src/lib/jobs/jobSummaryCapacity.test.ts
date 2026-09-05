import { describe, expect, it } from 'vitest'
import { buildJobDayLedger } from './jobDayLedger'
import { buildCapacitySeries } from './jobSummaryCapacity'
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
    expect(s.totals).toEqual({ availableHours: 144, fieldHours: 104, utilizationPct: (104 / 144) * 100 })
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

  it('is empty without a ledger', () => {
    expect(buildCapacitySeries({ ledger: null, people: roster }).weeks).toEqual([])
  })
})
