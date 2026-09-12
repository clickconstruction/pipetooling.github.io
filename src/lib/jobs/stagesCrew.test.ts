import { describe, expect, it } from 'vitest'
import { buildStagesCrewModel, splitStagesCrew, stagesCrewArchivedTail, stagesCrewSummary, type StagesCrewMember } from './stagesCrew'

const m = (id: string, name: string, archived_at: string | null = null, role: string | null = 'helpers'): StagesCrewMember => ({ user_id: id, users: { name, archived_at, role } })

// Mission Hills (J523) on 2026-09-12: five live accounts, five archived.
const mission: StagesCrewMember[] = [
  m('juan', 'Juan', '2026-05-15T00:00:00Z', 'subcontractor'),
  m('mario', 'Mario', '2026-07-12T00:00:00Z'),
  m('jesse', 'Jesse', '2026-07-12T00:00:00Z'),
  m('mikez', 'Mike Z', '2026-05-21T00:00:00Z', 'superintendent'),
  m('malachi', 'Malachi', null, 'master_technician'),
  m('tristen', 'Tristen'),
  m('trace', 'Trace', null, 'primary'),
  m('joseph', 'Joseph', '2026-07-12T00:00:00Z', 'subcontractor'),
  m('michaela', 'Michael A', null, 'subcontractor'),
  m('isiah', 'Isiah'),
]

describe('splitStagesCrew / stagesCrewSummary (v2.3373)', () => {
  it('keeps live accounts in team order and folds archived ones into the tail', () => {
    const split = splitStagesCrew(mission)
    expect(split.active).toEqual(['Malachi', 'Tristen', 'Trace', 'Michael A', 'Isiah'])
    expect(split.archived).toEqual(['Juan', 'Mario', 'Jesse', 'Mike Z', 'Joseph'])
    expect(stagesCrewArchivedTail(split)).toBe('and 5 archived')
    expect(stagesCrewSummary(mission)).toBe('Malachi, Tristen, Trace, Michael A, Isiah, and 5 archived')
  })
  it('nobody archived → no tail; everybody archived → the count alone; no crew → null', () => {
    const live = [m('a', 'Tristen'), m('b', 'Isiah')]
    expect(stagesCrewArchivedTail(splitStagesCrew(live))).toBeNull()
    expect(stagesCrewSummary(live)).toBe('Tristen, Isiah')
    const gone = [m('a', 'Mario', '2026-07-12T00:00:00Z'), m('b', 'Jesse', '2026-07-12T00:00:00Z')]
    expect(stagesCrewSummary(gone)).toBe('2 archived')
    expect(stagesCrewSummary([])).toBeNull()
    expect(stagesCrewSummary(null)).toBeNull()
    expect(stagesCrewSummary([{ user_id: 'x', users: null }, m('y', '   ')])).toBeNull()
  })
})

describe('buildStagesCrewModel', () => {
  const hours = [
    { personName: 'Mario', hours: 169.8, byWorkDate: [{ workDate: '2026-04-01', hours: 8 }, { workDate: '2026-05-15', hours: 4 }] },
    { personName: 'trace ', hours: 64, byWorkDate: [{ workDate: '2026-06-12', hours: 8 }] },
    { personName: 'Tristen', hours: 59.94, byWorkDate: [{ workDate: '2026-09-11', hours: 6 }, { workDate: '2026-09-10', hours: 0 }] },
    { personName: 'Paige', hours: 9.1, byWorkDate: [{ workDate: '2026-07-14', hours: 9.1 }] },
    { personName: 'Robert', hours: 0, byWorkDate: [] },
    { personName: 'Abraham', hours: 0.02, byWorkDate: [{ workDate: '2026-03-23', hours: 0.02 }] },
  ]
  it('live accounts by hours, then archived by hours; hours match by name; days count only worked dates', () => {
    const model = buildStagesCrewModel({ members: mission, hours })
    expect(model.crew.map((r) => `${r.name}:${r.hours}:${r.days}:${r.lastDay ?? '-'}:${r.archivedAt ? 'A' : 'L'}`)).toEqual([
      'Trace:64:1:2026-06-12:L',
      'Tristen:59.9:1:2026-09-11:L',
      'Isiah:0:0:-:L',
      'Malachi:0:0:-:L',
      'Michael A:0:0:-:L',
      'Mario:169.8:2:2026-05-15:A',
      'Jesse:0:0:-:A',
      'Joseph:0:0:-:A',
      'Juan:0:0:-:A',
      'Mike Z:0:0:-:A',
    ])
    expect(model.crew[0]!.role).toBe('primary')
    expect(model.crew[0]!.userId).toBe('trace')
  })
  it('people with hours who are not on the team land in others; zero-hour (or one-minute) strangers are not listed', () => {
    const model = buildStagesCrewModel({ members: mission, hours })
    expect(model.others.map((r) => `${r.name}:${r.hours}`)).toEqual(['Paige:9.1'])
    expect(model.others[0]!.userId).toBeNull()
    // The total is the sheets' sum (the row's 🕒 line), so the one-minute stranger still counts there.
    expect(model.totalHours).toBe(302.9)
  })
  it('no hours yet → every member at zero, no others', () => {
    const model = buildStagesCrewModel({ members: mission, hours: null })
    expect(model.crew).toHaveLength(10)
    expect(model.others).toEqual([])
    expect(model.totalHours).toBe(0)
  })
})
