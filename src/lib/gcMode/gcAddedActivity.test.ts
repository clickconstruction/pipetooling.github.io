import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcState } from './gcTypes'
import { scheduleItems, scheduleMeasures } from './gcBuildingSchedule'
import { ganttBars, ganttGroups } from './gcGantt'
import { moveActivityName, planMove } from './gcScheduleMoves'
import { walkItems } from './gcScheduleWalk'
import { addedActivityProblem, addedActivityWords, nextOwnId } from './gcAddedActivity'

/** Fair Oaks Shops, Building D, today Fri Oct 2 2026: the roof curbs (froof-4) run Oct 5 to 9; the rooftop units (fhvac-1) start Oct 12. */
const ID = 'fairoaksd'
const job = (state: GcState) => state.projects.find((p) => p.id === ID)!
const OWN = 'fairoaksd-own-1'

function withCure(from = initialGcState()): GcState {
  return gcReducer(from, { type: 'addScheduleActivity', projectId: ID, label: 'Roof curb cure', who: 'Cure time', start: '2026-10-10', finish: '2026-10-11', after: ['froof-4'], holdsUp: ['fhvac-1', 'nope'], by: 'Robert' })
}

describe('an activity that is no trade’s line (G-38)', () => {
  it('goes on the schedule as the job’s own, waiting on work and holding work up', () => {
    const state = withCure()
    const a = job(state).schedule!.activities.find((x) => x.lineId === OWN)!
    expect(a).toEqual({ lineId: OWN, packageId: '', start: '2026-10-10', finish: '2026-10-11', after: ['froof-4'], added: { label: 'Roof curb cure', who: 'Cure time', doneOn: null } })
    expect(job(state).schedule!.activities.find((x) => x.lineId === 'fhvac-1')?.after).toContain(OWN)
    expect(state.log[0]?.text).toBe("Robert put Roof curb cure on Fair Oaks Shops, Building D's schedule, Sat Oct 10 to Sun Oct 11, Cure time. 1 activity waits on it.")
    expect(nextOwnId(job(state))).toBe('fairoaksd-own-2')
  })

  it('is a chart row with no dollars and no percent, under the job’s own', () => {
    const state = withCure()
    const item = scheduleItems(state, job(state)).find((i) => i.activity.lineId === OWN)!
    expect(item).toMatchObject({ pkg: null, trade: "The job's own", label: 'Roof curb cure', company: 'Cure time', worth: 0, actual: 0 })
    const m = scheduleMeasures(state, job(state))
    const bars = ganttBars(m.items, m.float, new Map(), state.today, true)
    const bar = bars.find((b) => b.id === OWN)!
    expect(bar.status).toBe('notStarted')
    const own = ganttGroups(bars, 'trade').find((g) => g.key === 'added')!
    expect(own.title).toBe("The job's own")
    expect(own.sub).toBe('Cure time')
    expect(own.bars.map((b) => b.id)).toEqual([OWN])
    // By stage it sits where its dates fall: after every stage that starts before it, before every one that starts after.
    const groups = ganttGroups(bars, 'stage')
    const at = groups.findIndex((g) => g.key === 'added')
    expect(at).toBeGreaterThan(0)
    expect(groups.slice(0, at).every((g) => g.start <= '2026-10-10')).toBe(true)
    expect(groups.slice(at + 1).filter((g) => g.key !== 'inspections').every((g) => g.start > '2026-10-10')).toBe(true)
    expect(moveActivityName(job(state), OWN)).toBe('Roof curb cure')
    expect(addedActivityWords(item.activity)).toBe('Roof curb cure, Cure time, 2 days.')
  })

  it('moves like any other bar and pushes what waits on it', () => {
    const state = withCure()
    const plan = planMove(job(state), OWN, '2026-10-10', '2026-10-13')!
    expect(plan.pushed.map((p) => [p.lineId, p.to.start])).toEqual([['fhvac-1', '2026-10-14']])
  })

  it('is on the walk once started, as under way, and the office marks it done', () => {
    // One starting inside the week: the walk lists it as starting; nobody reports it.
    let state = gcReducer(initialGcState(), { type: 'addScheduleActivity', projectId: ID, label: 'Roof curb cure', who: 'Cure time', start: '2026-10-05', finish: '2026-10-06', after: [], holdsUp: [], by: 'Robert' })
    const starting = walkItems(state, job(state), new Map()).find((i) => i.lineId === OWN)!
    expect(starting.name).toBe('Roof curb cure')
    expect(starting.kind).toBe('starting')
    expect(starting.paceFinish).toBeNull()
    state = gcReducer(state, { type: 'setAddedActivityDone', projectId: ID, lineId: OWN, on: '2026-10-02' })
    expect(scheduleItems(state, job(state)).find((i) => i.activity.lineId === OWN)?.actual).toBe(100)
    expect(state.log[0]?.text).toBe('Roof curb cure on Fair Oaks Shops, Building D is done, Fri Oct 2.')
    state = gcReducer(state, { type: 'setAddedActivityDone', projectId: ID, lineId: OWN, on: null })
    expect(job(state).schedule!.activities.find((x) => x.lineId === OWN)?.added?.doneOn).toBeNull()
    // A trade's line cannot be marked this way.
    expect(gcReducer(state, { type: 'setAddedActivityDone', projectId: ID, lineId: 'froof-4', on: '2026-10-02' })).toBe(state)
  })

  it('comes off the schedule, and whatever waited on it stops waiting', () => {
    let state = withCure()
    state = gcReducer(state, { type: 'removeScheduleActivity', projectId: ID, lineId: OWN })
    expect(job(state).schedule!.activities.some((x) => x.lineId === OWN)).toBe(false)
    expect(job(state).schedule!.activities.find((x) => x.lineId === 'fhvac-1')?.after).not.toContain(OWN)
    expect(gcReducer(state, { type: 'removeScheduleActivity', projectId: ID, lineId: 'froof-4' })).toBe(state)
  })

  it('refuses a nameless one, one with no owner, or one that ends before it starts', () => {
    expect(addedActivityProblem('', 'Cure time', '2026-10-10', '2026-10-11')).toBe('Give it a name.')
    expect(addedActivityProblem('Cure', '', '2026-10-10', '2026-10-11')).toBe('Say whose it is.')
    expect(addedActivityProblem('Cure', 'Cure time', '2026-10-12', '2026-10-11')).toBe('It has to finish on or after it starts.')
    const state = initialGcState()
    expect(gcReducer(state, { type: 'addScheduleActivity', projectId: ID, label: ' ', who: 'Cure time', start: '2026-10-10', finish: '2026-10-11', after: [], holdsUp: [], by: 'Robert' })).toBe(state)
  })
})
