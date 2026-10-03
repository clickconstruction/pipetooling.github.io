import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  draftSchedule,
  gcReducer,
  initialGcState,
  lookAheadWeeks,
  milestoneHitRate,
  milestoneRows,
  mondayOf,
  plannedPct,
  scheduleFloat,
  scheduleMeasures,
  scheduleLinesOf,
  scheduleRows,
  verifyList,
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
    expect([...ids].sort()).toEqual([...lines].sort())
    expect(d.activities.every((a) => a.start >= '2026-10-12' && a.finish >= a.start && a.after.every((id) => ids.includes(id) && id !== a.lineId))).toBe(true)
    expect(d.milestones.map((m) => m.id)).toEqual(expect.arrayContaining(['helotes-roughin', 'helotes-substantial']))
    expect(d.baseline).toBeNull()
  })

  it('moves an activity; before Start nothing is locked yet', () => {
    const drawn = gcReducer(initialGcState(), { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12' })
    const moved = gcReducer(drawn, { type: 'setScheduleActivity', projectId: 'helotes', lineId: 'dry-1', start: '2026-11-16', finish: '2026-11-25', after: ['delec-1', 'dry-1', 'nope'] })
    const a = helotes(moved).schedule?.activities.find((x) => x.lineId === 'dry-1')
    // Itself and an unknown line are dropped from what it waits on.
    expect(a).toMatchObject({ start: '2026-11-16', finish: '2026-11-25', after: ['delec-1'] })
    expect(helotes(moved).schedule?.baseline).toBeNull()
    // A finish before the start is refused; a second draft does not replace a drawn one.
    expect(gcReducer(moved, { type: 'setScheduleActivity', projectId: 'helotes', lineId: 'dry-1', start: '2026-11-16', finish: '2026-11-10', after: [] })).toBe(moved)
    expect(gcReducer(moved, { type: 'draftSchedule', projectId: 'helotes', start: '2026-12-01' })).toBe(moved)
  })

  it('after Start, the first change keeps the plan at Start as the baseline', () => {
    const started: GcState = { ...initialGcState(), projects: initialGcState().projects.map((p) => (p.id === 'helotes' ? { ...p, stage: 'building' as const, startedOn: '2026-10-02' } : p)) }
    const drawn = gcReducer(started, { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12' })
    const moved = gcReducer(drawn, { type: 'setScheduleActivity', projectId: 'helotes', lineId: 'dry-1', start: '2026-11-16', finish: '2026-11-25', after: ['delec-1'] })
    const schedule = helotes(moved).schedule
    const drafted = helotes(drawn).schedule?.activities.find((a) => a.lineId === 'dry-1')
    expect(schedule?.baseline?.lockedOn).toBe('2026-10-02')
    expect(schedule?.baseline?.activities['dry-1']).toEqual({ start: drafted?.start, finish: drafted?.finish })
    const row = scheduleRows(moved, helotes(moved)).find((r) => r.activity.lineId === 'dry-1')
    expect(row?.slipDays).toBe(daysBetween(drafted?.finish ?? '', '2026-11-25'))
  })
})

describe("the superintendent's verify list", () => {
  const verify = (s: GcState, lineId: string, done: boolean, reason?: 'weather') =>
    gcReducer(s, { type: 'verifyLookAhead', projectId: 'fairoaksd', weekOf: '2026-09-28', lineId, done, ...(reason ? { reason } : {}) })

  it('lists the marks waiting, oldest week first, and our crew when it is not marked', () => {
    const s = initialGcState()
    const { waiting, ourCrew } = verifyList(fairOaks(s), scheduleRows(s, fairOaks(s)), s.today)
    expect(waiting.map((w) => w.mark.lineId)).toEqual(['froof-1', 'fsteel-3', 'felec-2', 'fhvac-2'])
    expect(ourCrew).toEqual([])
  })

  it('a confirmed mark counts as the trade said; a corrected one counts as the superintendent says', () => {
    const right = verify(initialGcState(), 'fsteel-3', false)
    const corrected = verify(right, 'froof-1', false, 'weather')
    const marks = fairOaks(corrected).schedule?.lookAhead ?? []
    expect(marks.find((x) => x.weekOf === '2026-09-28' && x.lineId === 'froof-1')).toMatchObject({ done: true, verifiedDone: false, verifiedReason: 'weather', verifiedOn: '2026-10-02' })
    const r = scheduleMeasures(corrected, fairOaks(corrected)).reliability
    expect([r.done, r.of, r.waiting]).toEqual([8, 13, 2])
    // Verified once only.
    expect(verify(corrected, 'froof-1', true)).toBe(corrected)
  })

  it('marks our own crew ourselves, verified at once; a hired trade it will not mark', () => {
    const s = gcReducer(initialGcState(), { type: 'crewMarkLookAhead', projectId: 'fairoaksd', weekOf: '2026-10-05', lineId: 'fplumb-3', done: true })
    expect(fairOaks(s).schedule?.lookAhead.find((x) => x.weekOf === '2026-10-05')).toMatchObject({ lineId: 'fplumb-3', done: true, verifiedOn: '2026-10-02' })
    const hired = initialGcState()
    expect(gcReducer(hired, { type: 'crewMarkLookAhead', projectId: 'fairoaksd', weekOf: '2026-09-28', lineId: 'fsteel-3', done: true })).toBe(hired)
  })
})
