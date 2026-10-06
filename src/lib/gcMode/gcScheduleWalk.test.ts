import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcState } from './gcTypes'
import type { GanttHold } from './gcGantt'
import { paceFinish, walkChanges, walkItems, walkStanding, walkTally } from './gcScheduleWalk'

/** Fair Oaks Shops, Building D, today Fri Oct 2 2026. */
const ID = 'fairoaksd'
const job = (state: GcState) => state.projects.find((p) => p.id === ID)!
const items = (state: GcState, holds = new Map<string, GanttHold>()) => walkItems(state, job(state), holds)

describe('what the weekly walk goes through', () => {
  it('lists the bars that should have moved, the worst news first, and leaves out finished work', () => {
    const list = items(initialGcState())
    expect(list.map((i) => i.name)).toEqual([
      'Electrical service inspection',
      'Structural steel · Erection',
      'Electrical · Panels and feeders',
      'Roofing · TPO membrane',
      'Electrical · Lighting',
      'Plumbing · Top out',
      'HVAC · Ductwork',
      'Roofing · Roof curbs',
    ])
    expect(list.map((i) => i.kind)).toEqual(['failed', 'due', 'due', 'behind', 'behind', 'underway', 'underway', 'starting'])
    expect(list.some((i) => i.name.includes('Insulation'))).toBe(false) // done
    expect(list.some((i) => i.name.includes('Fire alarm'))).toBe(false) // a month out
  })

  it('says what was reported, what the log shows, and the day the pace points to', () => {
    const erection = items(initialGcState()).find((i) => i.name === 'Structural steel · Erection')!
    expect(erection.chip).toBe('due today, 80% done')
    expect(erection.facts).toContain('Iron Horse Fabrication reported 80%. The plan has 100% by today.')
    expect(erection.facts).toContain('The daily log has them on site Mon, Tue and Thu, 11 worker-days.')
    expect(erection.paceFinish).toBe('2026-10-09')
    expect(erection.facts.some((f) => f.startsWith('At this pace it finishes Fri Oct 9, 7 days after'))).toBe(true)
    expect(erection.started).toBe(true)
  })

  it('work ahead of the plan has no later day to offer, and work not started asks about its start', () => {
    const list = items(initialGcState())
    const duct = list.find((i) => i.name === 'HVAC · Ductwork')!
    expect(duct.paceFinish).toBeNull()
    expect(duct.facts).toContain('It is ahead of the plan.')
    const curbs = list.find((i) => i.name === 'Roofing · Roof curbs')!
    expect(curbs.started).toBe(false)
    expect(curbs.chip).toBe('starts in 3 days')
  })

  it('held work says what holds it', () => {
    const state = initialGcState()
    const curbs = items(state).find((i) => i.name === 'Roofing · Roof curbs')!
    const held = items(state, new Map([[curbs.lineId, { kind: 'rfi', words: 'RFI-004, waiting on us', late: true }]])).find((i) => i.lineId === curbs.lineId)!
    expect(held.facts).toContain('It waits on RFI-004, waiting on us, which is late.')
  })

  it('reads a pace only from work started and not finished', () => {
    expect(paceFinish('2026-09-21', 50, '2026-10-02')).toBe('2026-10-14')
    expect(paceFinish('2026-09-21', 0, '2026-10-02')).toBeNull()
    expect(paceFinish('2026-09-21', 100, '2026-10-02')).toBeNull()
    expect(paceFinish('2026-10-05', 10, '2026-10-02')).toBeNull()
  })
})

describe('the walk is recorded, and a schedule nobody walked says so', () => {
  it('never walked is stale', () => {
    const s = walkStanding(job(initialGcState()), '2026-10-02')
    expect(s.stale).toBe(true)
    expect(s.words).toContain('Not walked yet.')
  })

  it('a walk records who, the day, what was kept and what was moved', () => {
    const state = initialGcState()
    const list = items(state)
    const tpo = list.find((i) => i.name === 'Roofing · TPO membrane')!
    const a = job(state).schedule!.activities.find((x) => x.lineId === tpo.lineId)!
    const moved = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: a.start, finish: tpo.paceFinish!, after: a.after, why: { reason: 'weather', note: 'Rain stopped the roof for two days.', by: 'Robert' } })
    const kept = list.filter((i) => i.lineId !== tpo.lineId).slice(0, 5).map((i) => i.lineId)
    const walked = gcReducer(moved, { type: 'recordScheduleWalk', projectId: ID, by: 'Robert', kept, moveIds: ['move-1'], skipped: 2 })
    expect(job(walked).schedule?.walks?.[0]).toEqual({ id: 'walk-1', on: '2026-10-02', by: 'Robert', kept, moveIds: ['move-1'], skipped: 2 })
    expect(walked.log[0]?.text).toBe('Robert walked the schedule on Fair Oaks Shops, Building D: 5 kept as drawn, 1 moved, 2 not looked at.')
    expect(walkStanding(job(walked), '2026-10-02').words).toBe('Walked today by Robert.')
    // Two bars were not looked at: walked, but not all of it.
    expect(walkStanding(job(walked), '2026-10-02').partial).toBe(true)
    expect(walkStanding(job(walked), '2026-10-03').words).toBe('Walked yesterday by Robert.')
    const week = walkStanding(job(walked), '2026-10-09')
    expect(week.stale).toBe(true)
    expect(week.words).toBe('Not walked since Fri Oct 2, 7 days ago.')
    const [change] = walkChanges(job(walked), ['move-1'])
    expect(change?.what).toContain('Roofing · TPO membrane moved from Sep 21 to Oct 9, to Sep 21 to Oct 14.')
    expect(change?.move.note).toBe('Rain stopped the roof for two days.')
  })

  it('a walk that looked at nothing is not recorded', () => {
    const state = initialGcState()
    expect(gcReducer(state, { type: 'recordScheduleWalk', projectId: ID, by: 'Robert', kept: [], moveIds: [], skipped: 8 })).toBe(state)
  })

  it('tallies a walk in a sentence', () => {
    expect(walkTally(5, 2, 1)).toBe('5 kept as drawn, 2 moved, 1 not looked at.')
    expect(walkTally(8, 0, 0)).toBe('8 kept as drawn, 0 moved.')
  })
})
