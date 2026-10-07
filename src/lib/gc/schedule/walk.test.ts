/**
 * The tests of `gcScheduleWalk.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import type { GanttHold } from './gantt'
import { initialGcState } from './testState'
import { paceFinish, walkItems, walkStanding, walkTally } from './walk'
import type { GcState } from '../types'

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

  it('puts the daily log’s lost days on the bar, for the walk to add (G-58)', () => {
    const tpo = items(initialGcState()).find((i) => i.name === 'Roofing · TPO membrane')!
    expect(tpo.lostDays.map((d) => d.date)).toEqual(['2026-09-24'])
    expect(tpo.facts).toContain('1 day lost to the weather by the daily log: Thu Sep 24.')
    expect(items(initialGcState()).find((i) => i.name === 'Electrical service inspection')?.lostDays).toEqual([])
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

  it('tallies a walk in a sentence', () => {
    expect(walkTally(5, 2, 1)).toBe('5 kept as drawn, 2 moved, 1 not looked at.')
    expect(walkTally(8, 0, 0)).toBe('8 kept as drawn, 0 moved.')
  })
})
