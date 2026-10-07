/**
 * The tests of `gcCrewCounts.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { crewWeeks } from './crewCounts'
import { morningList } from './morningList'
import { initialGcState } from './testState'
import type { GcState } from '../types'

const ID = 'fairoaksd'

const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

const lineOf = (s: GcState, company: string) => morningList(s, job(s), new Map()).expected.find((c) => c.company === company)!

describe('the weeks a count is for, and what is refused', () => {
  it('takes this week and the next two, the look-ahead’s own', () => {
    expect(crewWeeks('2026-10-02')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
  })
})

describe('the morning list reads the trade’s word beside the log’s', () => {
  it('leaves every line as the log’s alone when the trade gave no count', () => {
    const state = initialGcState()
    const c = lineOf(state, 'Summit Roofing')
    expect(c.logWords).toBe('Last on the log Thu Oct 1 with 4.')
    expect('said' in c || 'short' in c || 'crewTone' in c).toBe(false)
  })
})
