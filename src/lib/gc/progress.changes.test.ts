/**
 * The test of `gcChangeRequestsWaiting.test.ts` on branch spike/gc-mode that reads the ring's card, moved word for word (the
 * Board's B2b-vi). The data is `schedule/testState.ts`.
 */
import { describe, expect, it } from 'vitest'
import { changeRequestsWaiting, gcChangeRequestsNeedsYou } from './changeRequestsWaiting'
import { stageProgress } from './progress'
import { allPeople } from './projectPeople'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fair = (state: GcState) => {
  const p = state.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no fair oaks')
  return p
}

describe('change requests waiting on us (the owner, 2026-10-05)', () => {
  it("a trade's request is a Needs you line of its own and a line on the job's ring, not a person to call", () => {
    const state = initialGcState()
    expect(changeRequestsWaiting(state).map((w) => [w.company, w.project.id, w.request.amount])).toEqual([['Tri-County Site', 'fairoaksd', 14_820]])
    expect(gcChangeRequestsNeedsYou(state)).toMatchObject({
      count: 1,
      late: false,
      title: '1 change request waiting on you in GC mode',
      projectId: 'fairoaksd',
    })
    expect(gcChangeRequestsNeedsYou(state)?.detail.startsWith('Tri-County Site asked for $14,820 on Fair Oaks Shops, Building D.')).toBe(true)
    expect(stageProgress(state, fair(state)).also.find((l) => l.startsWith('Tri-County Site asked for a change'))).toMatch(/^Tri-County Site asked for a change 2 days ago: .*\$14,820\. Answer it on Bill the customer\.$/)
    // Our move, not theirs: Tri-County is not among the people we wait on.
    expect(allPeople(state).people.some((p) => p.company === 'Tri-County Site')).toBe(false)
  })
})
