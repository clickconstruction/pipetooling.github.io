/**
 * The tests of `gcBuildingSchedule.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1a). The data is `testState.ts`, the prototype's fixture cut to
 * what the kernels read. The tests that play the prototype's reducer or read another lane stay on the
 * spike, where they run against these kernels, until their presses and lanes reach main.
 */
import { describe, expect, it } from 'vitest'
import { activityName, daysBetween, draftSchedule, inspectedTrades, lookAheadWeeks, milestoneHitRate, milestoneRows, mondayOf, openInspectionFailures, plannedPct, projectedFinish, pushAfter, scheduleFloat, scheduleItems, scheduleLinesOf, scheduleMeasures, scheduleRows, substantialCompletionOn, verifyList } from './schedule'
import { initialGcState } from './testState'
import type { ScheduleActivity } from './types'
import type { GcState } from '../types'

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

  it('runs its critical path out to the final inspection', () => {
    // The trims finish Friday Dec 4 and the final inspection starts Monday Dec 7: on calendar days
    // the weekend reads as 2 spare days, so the inspection alone has none.
    expect(m.critical.map(activityName)).toEqual(['Final inspection'])
    expect(m.float.get('fplumb-4')).toBe(2)
  })

  it('hit the slab, and dry-in is late', () => {
    const rows = milestoneRows(state, fairOaks(state))
    expect(rows.map((r) => [r.milestone.label, r.state, r.daysLate])).toEqual([
      ['Slab poured', 'hit', -1],
      ['Dry-in', 'late', 7],
      ['Rough-in inspection', 'due', -11],
      ['Substantial completion', 'due', -70],
    ])
    expect(milestoneHitRate(rows)).toEqual({ hit: 1, of: 2 })
  })

  it('counts only verified marks: 8 of 11 done as planned (this week too), 4 waiting', () => {
    expect([m.reliability.done, m.reliability.of, m.reliability.waiting]).toEqual([8, 11, 4])
    expect(m.reliability.byCompany.find((c) => c.company === 'Summit Roofing')).toEqual({ company: 'Summit Roofing', done: 1, of: 2 })
  })

  it('looks three weeks ahead, this week with its marks', () => {
    const weeks = lookAheadWeeks(fairOaks(state), m.rows, state.today)
    expect(weeks.map((w) => w.weekOf)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    const thisWeek = weeks[0]?.items.map((i) => `${i.row.activity.lineId}:${i.state}`)
    expect(thisWeek).toEqual(['fsteel-3:waiting', 'froof-1:waiting', 'felec-2:waiting', 'felec-3:unmarked', 'fplumb-3:done', 'fhvac-2:waiting'])
  })
})

describe('drawing the schedule', () => {
  const helotes = (s: GcState) => {
    const p = s.projects.find((x) => x.id === 'helotes')
    if (!p) throw new Error('no Helotes')
    return p
  }

  it('drafts every line once, linked only to lines it has, with the three milestones', () => {
    // The draft itself is the New Project lane's (scheduleDraft); this pins only its shape.
    const project = helotes(initialGcState())
    const d = draftSchedule(project, '2026-10-12')
    const ids = d.activities.map((a) => a.lineId)
    const lines = project.packages.flatMap((k) => scheduleLinesOf(k).map((l) => l.lineId))
    // The draft's inspections are the job's own activities, not trade lines.
    expect(d.activities.filter((a) => !a.inspection).map((a) => a.lineId).sort()).toEqual([...lines].sort())
    expect(d.activities.every((a) => a.start >= '2026-10-12' && a.finish >= a.start && a.after.every((id) => ids.includes(id) && id !== a.lineId))).toBe(true)
    expect(d.milestones.map((m) => m.id)).toEqual(expect.arrayContaining(['helotes-roughin', 'helotes-substantial']))
    expect(d.baseline).toBeNull()
  })
})

describe("the superintendent's verify list", () => {
  it('lists the marks waiting, oldest week first, and our crew when it is not marked', () => {
    const s = initialGcState()
    const { waiting, ourCrew } = verifyList(fairOaks(s), scheduleRows(s, fairOaks(s)), s.today)
    expect(waiting.map((w) => w.mark.lineId)).toEqual(['froof-1', 'fsteel-3', 'felec-2', 'fhvac-2'])
    expect(ourCrew).toEqual([])
  })
})

describe('inspections', () => {
  const at = (today: string): GcState => ({ ...initialGcState(), today })

  it('are on the chart but carry no dollars: work done against the plan reads the trades only', () => {
    const s = initialGcState()
    const items = scheduleItems(s, fairOaks(s))
    const insp = items.filter((i) => i.activity.inspection)
    expect(insp.map((i) => [i.label, i.trade, i.company, i.worth, i.pkg])).toEqual([
      ['Rough-in inspection', 'Inspections', 'The city', 0, null],
      ['Electrical service inspection', 'Inspections', 'The city', 0, null],
      ['Final inspection', 'Inspections', 'The city', 0, null],
    ])
    expect(scheduleRows(s, fairOaks(s)).some((r) => r.activity.inspection)).toBe(false)
    expect(scheduleMeasures(s, fairOaks(s)).float.get('fairoaksd-insp-roughin')).toBe(35)
  })

  it('shows in the look-ahead the week it is planned, and on the verify list from that week', () => {
    const s = initialGcState()
    const weeks = lookAheadWeeks(fairOaks(s), scheduleRows(s, fairOaks(s)), s.today)
    // The service inspection failed Sep 28 and is inspected again today.
    expect(weeks.map((w) => w.inspections.map((i) => i.label))).toEqual([['Electrical service inspection'], [], ['Rough-in inspection']])
    expect(verifyList(fairOaks(s), scheduleRows(s, fairOaks(s)), s.today).inspections.map((i) => i.label)).toEqual(['Electrical service inspection'])
    const later = at('2026-10-12')
    expect(verifyList(fairOaks(later), scheduleRows(later, fairOaks(later)), later.today).inspections.map((i) => i.label)).toEqual([
      'Rough-in inspection',
      'Electrical service inspection',
    ])
  })
})

describe('a failed inspection', () => {
  const act = (s: GcState, lineId: string) => fairOaks(s).schedule?.activities.find((a) => a.lineId === lineId)

  it("reads the one still open, and whose work it was", () => {
    const s = initialGcState()
    const open = openInspectionFailures(fairOaks(s))
    expect(open.map((f) => [f.label, f.times, f.failure.packageIds, f.failure.reinspectOn])).toEqual([['Electrical service inspection', 1, ['felec'], '2026-10-02']])
    expect(openInspectionFailures(fairOaks(s), 'felec')).toHaveLength(1)
    expect(openInspectionFailures(fairOaks(s), 'fconc')).toEqual([])
    const roughIn = act(s, 'fairoaksd-insp-roughin')
    expect(roughIn ? inspectedTrades(fairOaks(s), roughIn).map((k) => k.id) : []).toEqual(['felec', 'fplumb', 'fhvac'])
  })
})

describe('substantial completion moves with change orders (question 28)', () => {
  it('is the planned day while no signed change order adds days', () => {
    const s = initialGcState()
    expect(substantialCompletionOn(fairOaks(s))).toEqual({ planned: '2026-12-11', days: 0, on: '2026-12-11' })
  })
})

describe('when the job will finish (for the late-finish warning on Bill the owner)', () => {
  it('Fair Oaks D: the plan ends with the final inspection Dec 8; 3 days behind, the pace says Dec 11', () => {
    const s = initialGcState()
    expect(projectedFinish(fairOaks(s), s.today)).toEqual({
      on: '2026-12-11',
      behind: 3,
      from: 'pace',
      why: 'The work runs 3 days behind the plan. At that pace it finishes Fri Dec 11.',
    })
    expect(projectedFinish({ ...fairOaks(s), schedule: undefined }, s.today)).toBeNull()
    // The Schedule tab's measures card carries it beside the contract's day.
    const m = scheduleMeasures(s, fairOaks(s))
    expect([m.finish?.on, m.contract?.on]).toEqual(['2026-12-11', '2026-12-11'])
  })

  it('work not started past its finish needs its days from today, and pushes what waits on it', () => {
    const s = initialGcState()
    const p = fairOaks(s)
    const act = (lineId: string, start: string, finish: string, after: string[]): ScheduleActivity => {
      const a = p.schedule?.activities.find((x) => x.lineId === lineId)
      if (!a) throw new Error(`no ${lineId}`)
      return { ...a, start, finish, after }
    }
    const schedule = p.schedule
    if (!schedule) throw new Error('no schedule')
    // The ductwork (80%) is ahead; the rooftop units, due Sep 30, have not started; controls wait on them.
    const chain = {
      ...p,
      schedule: {
        ...schedule,
        // No baseline: the plan as drawn is the one measured against.
        baseline: null,
        activities: [act('fhvac-2', '2026-09-28', '2026-10-16', []), act('fhvac-1', '2026-09-28', '2026-09-30', []), act('fhvac-3', '2026-10-01', '2026-10-16', ['fhvac-1'])],
      },
    }
    expect(projectedFinish(chain, s.today)).toEqual({
      on: '2026-10-20',
      behind: 4,
      from: 'plan',
      why: 'HVAC · Rooftop units has not started. It was planned to finish Wed Sep 30. What comes after it moves the finish to Tue Oct 20.',
    })
  })

  it('work already done stays put', () => {
    const s = initialGcState()
    const p = fairOaks(s)
    const schedule = p.schedule
    if (!schedule) throw new Error('no schedule')
    // Pushing the slab late would move the steel after it, but the steel is reported done.
    const slab = schedule.activities.map((a) => (a.lineId === 'fconc-1' ? { ...a, finish: '2026-10-30' } : a))
    const pushed = pushAfter(p, slab, 'fconc-1')
    expect(pushed.moved.map((m) => m.lineId)).not.toContain('fsteel-1')
  })
})
