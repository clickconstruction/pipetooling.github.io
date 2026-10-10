/**
 * The one count (the Board's B2b, call E1): Needs you and Work the list each count `allPeople`, everyone the office waits
 * on, once a person across their jobs. A board row shows its job's share (`projectPeople`), so the rows' sum is not the
 * count: a person on two jobs is on both rows and counts once. B2b-ii puts Follow up's badge on the same number.
 */
import { describe, expect, it } from 'vitest'
import { boardStateFromRows } from './boardRows'
import { awardedClinicBoardRows } from './boardTestRows'
import { gcNeedsYou } from './needsYou'
import { allFollowPeople, allPeople, projectPeople } from './projectPeople'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const states: [string, () => GcState][] = [
  ['the made-up data', () => initialGcState()],
  ['the clinic as the board maps it', () => boardStateFromRows(awardedClinicBoardRows())],
]

describe('the one count', () => {
  it.each(states)('%s: Needs you and Work the list each count everyone once', (_label, make) => {
    const state = make()
    const all = allPeople(state)
    expect(all.count).toBeGreaterThan(0)
    expect(gcNeedsYou(state)?.count).toBe(all.count)
    expect(allFollowPeople(state)).toHaveLength(all.count)
  })

  it.each(states)('%s: each row is its job’s share, everyone on it in the count', (_label, make) => {
    const state = make()
    const counted = new Set(allPeople(state).people.map((p) => p.key))
    for (const project of state.projects) for (const person of projectPeople(state, project).people) expect(counted.has(person.key), person.name).toBe(true)
  })

  it('a person on two jobs is on both rows and counts once, so the rows’ sum is not the count', () => {
    const state = initialGcState()
    const rows = state.projects.reduce((n, project) => n + projectPeople(state, project).count, 0)
    expect(rows).toBeGreaterThan(allPeople(state).count)
  })
})
