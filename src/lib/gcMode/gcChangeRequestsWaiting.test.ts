import { describe, expect, it } from 'vitest'
import { allPeople, changeRequestsWaiting, gcChangeRequestsNeedsYou, gcReducer, initialGcState, stageProgress, type GcState } from './gcModel'

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

  it('answering it clears both', () => {
    let state = initialGcState()
    const request = fair(state).changeRequests?.[0]
    if (!request) throw new Error('no request')
    state = gcReducer(state, { type: 'turnDownChangeRequest', projectId: 'fairoaksd', requestId: request.id, note: 'Rock was in the geotech report; it is in their price.' })
    expect(gcChangeRequestsNeedsYou(state)).toBeNull()
    expect(stageProgress(state, fair(state)).also.some((l) => l.includes('asked for a change'))).toBe(false)
  })
})
