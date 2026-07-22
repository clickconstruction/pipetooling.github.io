import { describe, expect, it } from 'vitest'
import {
  buildSwimLaneDisplaySections,
  personMatchesLaneQuery,
  SWIM_LANE_EVERYONE_ELSE_LABEL,
} from './dispatchSwimLaneSections'
import type { DispatchSwimLanesData } from './dispatchSwimLanes'

const P = (id: string) => ({ userId: id, displayName: id.toUpperCase() })

function lanesData(
  lanes: Array<{ id: string; name: string; sort_order: number }>,
  members: Array<[laneId: string, userId: string]>,
): DispatchSwimLanesData {
  const memberIdsByLaneId = new Map<string, string[]>()
  const laneIdByUserId = new Map<string, string>()
  for (const [laneId, userId] of members) {
    memberIdsByLaneId.set(laneId, [...(memberIdsByLaneId.get(laneId) ?? []), userId])
    laneIdByUserId.set(userId, laneId)
  }
  return { lanes, memberIdsByLaneId, laneIdByUserId }
}

describe('buildSwimLaneDisplaySections', () => {
  const data = lanesData(
    [
      { id: 'L1', name: 'North crew', sort_order: 0 },
      { id: 'L2', name: 'South crew', sort_order: 1 },
      { id: 'L3', name: 'Empty crew', sort_order: 2 },
    ],
    [
      ['L1', 'a'],
      ['L1', 'b'],
      ['L2', 'c'],
      ['L3', 'zz-not-visible'],
    ],
  )

  it('orders lanes, keeps member order, tails Everyone else, skips empty lanes', () => {
    const sections = buildSwimLaneDisplaySections(data, [P('c'), P('a'), P('b'), P('d')])
    expect(sections.map((s) => s.label)).toEqual(['North crew', 'South crew', SWIM_LANE_EVERYONE_ELSE_LABEL])
    expect(sections[0]!.people.map((p) => p.userId)).toEqual(['a', 'b'])
    expect(sections[1]!.people.map((p) => p.userId)).toEqual(['c'])
    expect(sections[2]!.people.map((p) => p.userId)).toEqual(['d'])
    expect(sections[2]!.laneId).toBeNull()
  })

  it('omits filtered-out members and drops lanes that become empty', () => {
    const sections = buildSwimLaneDisplaySections(data, [P('a'), P('d')])
    expect(sections.map((s) => s.label)).toEqual(['North crew', SWIM_LANE_EVERYONE_ELSE_LABEL])
  })

  it('no lanes → single Everyone else section; no unassigned → no tail', () => {
    expect(
      buildSwimLaneDisplaySections(lanesData([], []), [P('a')]).map((s) => s.label),
    ).toEqual([SWIM_LANE_EVERYONE_ELSE_LABEL])
    const onlyLane = lanesData([{ id: 'L1', name: 'X', sort_order: 0 }], [['L1', 'a']])
    expect(buildSwimLaneDisplaySections(onlyLane, [P('a')]).map((s) => s.label)).toEqual(['X'])
  })
})

describe('personMatchesLaneQuery', () => {
  const data = lanesData([{ id: 'L1', name: 'North crew', sort_order: 0 }], [['L1', 'a']])
  it('matches members by lane-name substring, misses non-members and empty query', () => {
    expect(personMatchesLaneQuery('a', 'north', data)).toBe(true)
    expect(personMatchesLaneQuery('a', 'crew', data)).toBe(true)
    expect(personMatchesLaneQuery('b', 'north', data)).toBe(false)
    expect(personMatchesLaneQuery('a', '', data)).toBe(false)
  })
})
