import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  initialGcState,
  lookAheadWeeks,
  milestoneHitRate,
  milestoneRows,
  mondayOf,
  plannedPct,
  scheduleFloat,
  scheduleMeasures,
  scheduleRows,
  type GcState,
  type ScheduleActivity,
} from './gcModel'

function fairOaks(state: GcState) {
  const p = state.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

describe('schedule dates', () => {
  it('counts days and finds the week', () => {
    expect(daysBetween('2026-09-28', '2026-10-02')).toBe(4)
    expect(mondayOf('2026-10-02')).toBe('2026-09-28')
    expect(mondayOf('2026-09-28')).toBe('2026-09-28')
  })

  it('plans an activity straight across its days', () => {
    expect(plannedPct('2026-10-01', '2026-10-10', '2026-09-30')).toBe(0)
    expect(plannedPct('2026-10-01', '2026-10-10', '2026-10-05')).toBe(50)
    expect(plannedPct('2026-10-01', '2026-10-10', '2026-10-20')).toBe(100)
  })
})

describe('spare days and the critical path', () => {
  const a = (lineId: string, start: string, finish: string, after: string[] = []): ScheduleActivity => ({ lineId, packageId: 'p', start, finish, after })

  it('is zero on the longest chain, and the gap elsewhere', () => {
    // A (3 days) then B (5 days) ends Oct 8; C (2 days) after A ends Oct 5: C can slip 3 days.
    const f = scheduleFloat([a('A', '2026-10-01', '2026-10-03'), a('B', '2026-10-04', '2026-10-08', ['A']), a('C', '2026-10-04', '2026-10-05', ['A'])])
    expect([f.get('A'), f.get('B'), f.get('C')]).toEqual([0, 0, 3])
  })

  it('pushes an activity past what it waits on', () => {
    // B is drawn to start before A finishes: it starts the day after, and the job ends a day later.
    const f = scheduleFloat([a('A', '2026-10-01', '2026-10-05'), a('B', '2026-10-05', '2026-10-06', ['A']), a('C', '2026-10-01', '2026-10-07')])
    expect([f.get('A'), f.get('B'), f.get('C')]).toEqual([0, 0, 0])
  })
})

describe('Fair Oaks D, mid-build', () => {
  const state = initialGcState()
  const m = scheduleMeasures(state, fairOaks(state))

  it('reads what we see on a line we sent back', () => {
    const membrane = scheduleRows(state, fairOaks(state)).find((r) => r.activity.lineId === 'froof-1')
    expect(membrane).toMatchObject({ actual: 50, slipDays: 7, plannedToday: 100 })
  })

  it('is 3 days behind: 72% done where 76% was planned', () => {
    expect(Math.round(m.work.donePct)).toBe(72)
    expect(Math.round(m.work.plannedPct)).toBe(76)
    expect(m.work.daysBehind).toBe(3)
  })

  it('runs its critical path out to the trims', () => {
    expect(m.critical.map((r) => `${r.trade} · ${r.label}`)).toEqual(['Plumbing · Trim', 'HVAC · Test and balance'])
  })

  it('hit the slab, and dry-in is late', () => {
    const rows = milestoneRows(state, fairOaks(state))
    expect(rows.map((r) => [r.milestone.label, r.state, r.daysLate])).toEqual([
      ['Slab poured', 'hit', -1],
      ['Dry-in', 'late', 7],
      ['Rough-in inspection', 'due', -4],
      ['Substantial completion', 'due', -70],
    ])
    expect(milestoneHitRate(rows)).toEqual({ hit: 1, of: 2 })
  })

  it('counts only verified marks: 7 of 10 done as planned, 4 waiting', () => {
    expect([m.reliability.done, m.reliability.of, m.reliability.waiting]).toEqual([7, 10, 4])
    expect(m.reliability.byCompany.find((c) => c.company === 'Summit Roofing')).toEqual({ company: 'Summit Roofing', done: 1, of: 2 })
  })

  it('looks three weeks ahead, this week with its marks', () => {
    const weeks = lookAheadWeeks(fairOaks(state), m.rows, state.today)
    expect(weeks.map((w) => w.weekOf)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    const thisWeek = weeks[0]?.items.map((i) => `${i.row.activity.lineId}:${i.state}`)
    expect(thisWeek).toEqual(['fsteel-3:waiting', 'froof-1:waiting', 'felec-2:waiting', 'felec-3:unmarked', 'fplumb-3:done', 'fhvac-2:waiting'])
  })
})
