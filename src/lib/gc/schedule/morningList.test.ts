/**
 * The tests of `gcMorningList.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { morningSteps } from './morningList'
import { initialGcState } from './testState'
import type { GcState } from '../types'

/** Fair Oaks Shops, Building D, being built; the made-up today is Fri Oct 2, and its last log Thu Oct 1. */
const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd')!

describe('the superintendent’s morning list (G-118)', () => {
  it('steps a day at a time, from the day work started to today', () => {
    const project = fairOaks(initialGcState())
    expect(morningSteps(project, '2026-10-02', '2026-10-02')).toEqual({ before: '2026-10-01', after: null })
    expect(morningSteps(project, '2026-09-28', '2026-10-02')).toEqual({ before: '2026-09-27', after: '2026-09-29' })
    expect(morningSteps(project, '2026-07-01', '2026-10-02')).toEqual({ before: null, after: '2026-07-02' })
  })
})
