/**
 * The tests of `gcLateNotices.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { lateDoor, lateTarget, lateWaiting } from './lateNotices'
import { moveActivityName } from './moves'
import { initialGcState } from './testState'
import type { GcState } from '../types'

const ID = 'fairoaksd'

const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

const TPO = 'froof-1'

const CURBS = 'froof-4'

describe('the made-up job, as these tests read it', () => {
  it('has the bars the examples name, and no notice yet', () => {
    const state = initialGcState()
    expect(moveActivityName(job(state), TPO)).toBe('Roofing · TPO membrane')
    expect(moveActivityName(job(state), CURBS)).toBe('Roofing · Roof curbs')
    expect(state.today).toBe('2026-10-02')
    expect(job(state).schedule!.lateNotices).toBeUndefined()
  })
})

describe('the door: a company may say it will be late on its own unfinished bar', () => {
  const state = initialGcState()

  it('asks for a new finish on work under way, a new start on work not started', () => {
    expect(lateDoor(state, job(state), 'summit', TPO)).toMatchObject({ started: true, day: '2026-10-09' })
    expect(lateDoor(state, job(state), 'summit', CURBS)).toMatchObject({ started: false, day: '2026-10-05' })
  })

  it('has no door on a finished bar, another company’s bar, our own crew’s, an inspection, or a job not being built', () => {
    expect(lateDoor(state, job(state), 'summit', 'froof-2')).toBeNull()
    expect(lateDoor(state, job(state), 'summit', 'fhvac-1')).toBeNull()
    expect(lateDoor(state, job(state), 'summit', 'fplumb-3')).toBeNull()
    expect(lateDoor(state, job(state), 'summit', 'fairoaksd-insp-roughin')).toBeNull()
    const pursuing = state.projects.find((p) => p.stage !== 'building' && p.schedule)
    if (pursuing) {
      const line = pursuing.schedule!.activities[0]!.lineId
      expect(state.partners.every((p) => lateDoor(state, pursuing, p.id, line) === null)).toBe(true)
    }
  })

  it('moves the finish of work under way, and the whole bar of work not started', () => {
    const a = (id: string) => job(state).schedule!.activities.find((x) => x.lineId === id)!
    expect(lateTarget(a(TPO), true, '2026-10-14')).toEqual({ start: '2026-09-21', finish: '2026-10-14' })
    expect(lateTarget(a(CURBS), false, '2026-10-07')).toEqual({ start: '2026-10-07', finish: '2026-10-11' })
  })
})

describe('what waits on it, for the trade to see before it sends', () => {
  it('names the bars that wait on it directly and would move, its own and another company’s', () => {
    const state = initialGcState()
    expect(lateWaiting(state, job(state), TPO, { start: '2026-09-21', finish: '2026-10-14' })).toEqual([
      { lineId: 'froof-3', work: 'Sheet metal and flashing', company: null, start: '2026-10-15', days: 3 },
      { lineId: 'fhvac-1', work: 'Rooftop units', company: 'Cool Breeze Mechanical', start: '2026-10-15', days: 3 },
    ])
  })

  it('is empty when nothing waiting on it would move', () => {
    const state = initialGcState()
    expect(lateWaiting(state, job(state), CURBS, { start: '2026-10-07', finish: '2026-10-11' })).toEqual([])
  })
})
