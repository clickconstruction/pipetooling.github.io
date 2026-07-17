import { describe, expect, it } from 'vitest'
import {
  groupTeamProspects,
  nextTeamProspectRank,
  reorderActiveTeamProspects,
  type RankableTeamProspect,
} from './teamProspectRanking'

function row(id: string, rank: number, status = 'active', created = '2026-07-01T00:00:00Z'): RankableTeamProspect {
  return { id, status, rank_order: rank, created_at: created }
}

describe('groupTeamProspects', () => {
  it('splits into active/hired/passed', () => {
    const rows = [row('a', 1), row('b', 2, 'hired'), row('c', 3, 'passed'), row('d', 4)]
    const g = groupTeamProspects(rows)
    expect(g.active.map((r) => r.id)).toEqual(['a', 'd'])
    expect(g.hired.map((r) => r.id)).toEqual(['b'])
    expect(g.passed.map((r) => r.id)).toEqual(['c'])
  })

  it('sorts active by rank ascending', () => {
    const g = groupTeamProspects([row('c', 3), row('a', 1), row('b', 2)])
    expect(g.active.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('treats unknown statuses as active (defensive against free-text drift)', () => {
    const g = groupTeamProspects([row('a', 1, 'something_else')])
    expect(g.active.map((r) => r.id)).toEqual(['a'])
  })

  it('breaks rank ties by created_at then id (stable across loads)', () => {
    const rows = [
      row('b', 0, 'active', '2026-07-02T00:00:00Z'),
      row('a', 0, 'active', '2026-07-01T00:00:00Z'),
      row('c', 0, 'active', '2026-07-02T00:00:00Z'),
    ]
    expect(groupTeamProspects(rows).active.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(groupTeamProspects(rows.reverse()).active.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts hired/passed newest first', () => {
    const rows = [
      row('old', 1, 'hired', '2026-06-01T00:00:00Z'),
      row('new', 2, 'hired', '2026-07-01T00:00:00Z'),
    ]
    expect(groupTeamProspects(rows).hired.map((r) => r.id)).toEqual(['new', 'old'])
  })
})

describe('nextTeamProspectRank', () => {
  it('returns 1 for an empty list', () => {
    expect(nextTeamProspectRank([])).toBe(1)
  })

  it('returns max active rank + 1, ignoring hired/passed', () => {
    const rows = [row('a', 2), row('b', 5, 'hired'), row('c', 3)]
    expect(nextTeamProspectRank(rows)).toBe(4)
  })
})

describe('reorderActiveTeamProspects', () => {
  const active = [row('a', 1), row('b', 2), row('c', 3), row('d', 4)]

  it('moves an item down and renumbers densely', () => {
    const { next, updates } = reorderActiveTeamProspects(active, 0, 2)
    expect(next.map((r) => r.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(next.map((r) => r.rank_order)).toEqual([1, 2, 3, 4])
    expect(updates).toEqual([
      { id: 'b', rank_order: 1 },
      { id: 'c', rank_order: 2 },
      { id: 'a', rank_order: 3 },
    ])
  })

  it('moves an item up and only reports changed rows', () => {
    const { next, updates } = reorderActiveTeamProspects(active, 3, 0)
    expect(next.map((r) => r.id)).toEqual(['d', 'a', 'b', 'c'])
    expect(updates).toHaveLength(4)
  })

  it('no-op move produces no updates', () => {
    const { next, updates } = reorderActiveTeamProspects(active, 1, 1)
    expect(next.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(updates).toEqual([])
  })

  it('normalizes sparse/legacy ranks (all zeros) on first reorder', () => {
    const sparse = [row('a', 0), row('b', 0), row('c', 7)]
    const { next, updates } = reorderActiveTeamProspects(sparse, 2, 0)
    expect(next.map((r) => r.id)).toEqual(['c', 'a', 'b'])
    expect(next.map((r) => r.rank_order)).toEqual([1, 2, 3])
    expect(updates).toEqual([
      { id: 'c', rank_order: 1 },
      { id: 'a', rank_order: 2 },
      { id: 'b', rank_order: 3 },
    ])
  })

  it('ignores out-of-range indexes', () => {
    expect(reorderActiveTeamProspects(active, -1, 2).updates).toEqual([])
    expect(reorderActiveTeamProspects(active, 0, 9).updates).toEqual([])
  })

  it('does not mutate the input array', () => {
    const before = active.map((r) => ({ ...r }))
    reorderActiveTeamProspects(active, 0, 3)
    expect(active).toEqual(before)
  })
})
