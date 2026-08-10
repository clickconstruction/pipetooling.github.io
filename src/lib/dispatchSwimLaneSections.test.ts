import { describe, expect, it } from 'vitest'
import {
  buildSwimLaneDisplaySections,
  filterSwimLaneSectionsByQuery,
  personMatchesLaneQuery,
  swimLaneAccentColor,
  summarizeExpectedManpowerByLane,
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

describe('summarizeExpectedManpowerByLane', () => {
  const data = lanesData(
    [
      { id: 'L1', name: 'North crew', sort_order: 0 },
      { id: 'L2', name: 'South crew', sort_order: 1 },
    ],
    [
      ['L1', 'a'],
      ['L1', 'b'],
      ['L2', 'c'],
    ],
  )
  const R = (uid: string, h: number) => ({ assigneeUserId: uid, personHours: h })

  it('groups hours + distinct people per lane in lane order, Everyone else tail', () => {
    const rows = [R('a', 4), R('a', 2), R('b', 8), R('z', 3)]
    expect(summarizeExpectedManpowerByLane(rows, data)).toEqual([
      { laneId: 'L1', label: 'North crew', personHours: 14, distinctPeople: 2 },
      { laneId: null, label: SWIM_LANE_EVERYONE_ELSE_LABEL, personHours: 3, distinctPeople: 1 },
    ])
  })

  it('skips lanes with no scheduled hours; empty when no lanes configured', () => {
    expect(summarizeExpectedManpowerByLane([R('c', 5)], data).map((r) => r.label)).toEqual([
      'South crew',
    ])
    expect(summarizeExpectedManpowerByLane([R('a', 5)], lanesData([], []))).toEqual([])
  })
})

describe('filterSwimLaneSectionsByQuery', () => {
  const sections = [
    { laneId: 'L1', label: 'Team Abraham', people: [P('abraham'), P('paige')] },
    { laneId: 'L2', label: 'Office', people: [P('taunya'), P('grace')] },
    { laneId: null, label: SWIM_LANE_EVERYONE_ELSE_LABEL, people: [P('behar')] },
  ]

  it('blank query returns sections untouched', () => {
    expect(filterSwimLaneSectionsByQuery(sections, '')).toBe(sections)
    expect(filterSwimLaneSectionsByQuery(sections, '   ')).toBe(sections)
  })

  it('team-name match keeps the whole team', () => {
    expect(filterSwimLaneSectionsByQuery(sections, 'office')).toEqual([sections[1]])
    expect(filterSwimLaneSectionsByQuery(sections, 'OFF')).toEqual([sections[1]])
  })

  it('person match narrows the section to matching people, case-insensitive', () => {
    expect(filterSwimLaneSectionsByQuery(sections, 'grace')).toEqual([
      { laneId: 'L2', label: 'Office', people: [P('grace')] },
    ])
  })

  it('matches across teams and drops empty sections', () => {
    // "a" hits Team Abraham by label, GRACE + TAUNYA by name, BEHAR by name.
    const out = filterSwimLaneSectionsByQuery(sections, 'a')
    expect(out.map((s) => s.label)).toEqual(['Team Abraham', 'Office', SWIM_LANE_EVERYONE_ELSE_LABEL])
    expect(out[0]?.people.map((p) => p.userId)).toEqual(['abraham', 'paige'])
    expect(filterSwimLaneSectionsByQuery(sections, 'zzz')).toEqual([])
  })
})

describe('swimLaneAccentColor', () => {
  it('is stable for the same lane id and null for Everyone else', () => {
    const a = swimLaneAccentColor('lane-123')
    expect(a).toMatch(/^#[0-9a-f]{6}$/)
    expect(swimLaneAccentColor('lane-123')).toBe(a)
    expect(swimLaneAccentColor(null)).toBeNull()
  })

  it('never hands a team the selection blue or conflict amber', () => {
    for (const id of ['L1', 'L2', 'L3', 'a-b-c', 'zz-top', '0000']) {
      const c = swimLaneAccentColor(id)
      expect(c).not.toBe('#2563eb')
      expect(c).not.toBe('#d97706')
    }
  })
})
