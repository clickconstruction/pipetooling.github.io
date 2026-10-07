/**
 * Main's own tests for the weekly walk and the schedules nobody walked (G-52, G-59; the schedule's
 * PR 1b): the moves a walk made, the jobs whose schedule is stale, and the dashboard's line, run
 * through the kernels on the test data. The spike's own cases: Fair Oaks D, being built, has never
 * been walked. A walk is kept as Update the week keeps it; the spike's reducer tests save it.
 */
import { describe, expect, it } from 'vitest'
import type { GcProject, GcState } from '../types'
import { moveRecord, planMove, undoMove } from './moves'
import { gcStaleSchedulesNeedsYou, staleSchedules } from './staleSchedules'
import { initialGcState } from './testState'
import type { ScheduleWalk } from './types'
import { walkChanges } from './walk'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const withJob = (s: GcState, project: GcProject): GcState => ({ ...s, projects: s.projects.map((p) => (p.id === ID ? project : p)) })

/** A move saved the way a press saves it: the plan's dates, and its record on the schedule, newest first. */
function saved(project: GcProject, lineId: string, start: string, finish: string, note: string): GcProject {
  const schedule = project.schedule!
  const plan = planMove(project, lineId, start, finish)!
  const move = moveRecord(schedule, lineId, plan, { reason: 'weather', note, by: 'Robert' }, '2026-10-02')
  return { ...project, schedule: { ...schedule, activities: plan.activities, moves: [move, ...(schedule.moves ?? [])] } }
}
/** A walk kept on the schedule, newest first. */
function walked(project: GcProject, on: string): GcProject {
  const walks = project.schedule!.walks ?? []
  const walk: ScheduleWalk = { id: `walk-${walks.length + 1}`, on, by: 'Robert', kept: ['froof-1'], moveIds: [], skipped: 0 }
  return { ...project, schedule: { ...project.schedule!, walks: [walk, ...walks] } }
}

describe('the moves a walk made', () => {
  it('lists each standing move the walk names, with what it did and why', () => {
    const moved = saved(job(initialGcState()), 'froof-1', '2026-09-21', '2026-10-14', 'Rain stopped the roof for two days.')
    const [change, ...rest] = walkChanges(moved, ['move-1'])
    expect(rest).toEqual([])
    expect(change?.what).toContain('Roofing · TPO membrane moved from Sep 21 to Oct 9, to Sep 21 to Oct 14.')
    expect(change?.move.note).toBe('Rain stopped the roof for two days.')
  })

  it('leaves out a move the walk did not make, and one since undone', () => {
    const moved = saved(job(initialGcState()), 'froof-1', '2026-09-21', '2026-10-14', 'Rain stopped the roof for two days.')
    expect(walkChanges(moved, ['move-2'])).toEqual([])
    const undone = { ...moved, schedule: undoMove(moved, 'move-1', 'Robert', '2026-10-02')! }
    expect(walkChanges(undone, ['move-1'])).toEqual([])
  })
})

describe('a stale schedule says so on the dashboard (G-59)', () => {
  it('lists the jobs being built whose schedule nobody walked this week', () => {
    const state = initialGcState()
    expect(staleSchedules(state).map((s) => [s.project.id, s.days])).toEqual([['fairoaksd', null]])
    expect(gcStaleSchedulesNeedsYou(state)).toEqual({
      count: 1,
      late: true,
      title: '1 schedule not walked this week in GC mode',
      detail: 'Fair Oaks Shops, Building D: Not walked yet. Nobody has checked these dates against the job.',
      projectId: 'fairoaksd',
    })
  })

  it('goes quiet once the schedule is walked, and for a job closed', () => {
    const s = initialGcState()
    const walkedToday = withJob(s, walked(job(s), '2026-10-02'))
    expect(staleSchedules(walkedToday)).toEqual([])
    expect(gcStaleSchedulesNeedsYou(walkedToday)).toBeNull()
    expect(gcStaleSchedulesNeedsYou(withJob(s, { ...job(s), closedOn: '2026-10-01' }))).toBeNull()
  })

  it('comes back a week after the walk, and reads late after two', () => {
    const s = initialGcState()
    const aWeek = withJob(s, walked(job(s), '2026-09-25'))
    expect(staleSchedules(aWeek).map((x) => [x.project.id, x.days, x.words])).toEqual([['fairoaksd', 7, 'Not walked since Fri Sep 25, 7 days ago.']])
    expect(gcStaleSchedulesNeedsYou(aWeek)?.late).toBe(false)
    expect(gcStaleSchedulesNeedsYou(withJob(s, walked(job(s), '2026-09-18')))?.late).toBe(true)
  })
})
