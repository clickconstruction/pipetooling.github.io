import { describe, expect, it } from 'vitest'
import {
  UNSORTED_ROLE_KEY,
  groupTeamProspects,
  moveTeamProspectAcrossRoles,
  nextTeamProspectRank,
  reorderActiveTeamProspects,
  roleKeyOf,
  type RankableTeamProspect,
} from './teamProspectRanking'

function row(
  id: string,
  rank: number,
  status = 'active',
  roleId: string | null = 'plumber',
  created = '2026-07-01T00:00:00Z',
): RankableTeamProspect {
  return { id, status, rank_order: rank, role_id: roleId, created_at: created }
}

describe('roleKeyOf', () => {
  it('maps NULL role to the unsorted key', () => {
    expect(roleKeyOf({ role_id: null })).toBe(UNSORTED_ROLE_KEY)
    expect(roleKeyOf({ role_id: 'r1' })).toBe('r1')
  })
})

describe('groupTeamProspects', () => {
  it('splits into per-role active lists plus hired/passed buckets', () => {
    const rows = [
      row('a', 1, 'active', 'plumber'),
      row('b', 1, 'active', 'office'),
      row('c', 2, 'active', 'plumber'),
      row('d', 3, 'hired', 'plumber'),
      row('e', 4, 'passed', 'office'),
      row('f', 1, 'active', null),
    ]
    const g = groupTeamProspects(rows)
    expect(g.activeByRole['plumber']!.map((r) => r.id)).toEqual(['a', 'c'])
    expect(g.activeByRole['office']!.map((r) => r.id)).toEqual(['b'])
    expect(g.activeByRole[UNSORTED_ROLE_KEY]!.map((r) => r.id)).toEqual(['f'])
    expect(g.hired.map((r) => r.id)).toEqual(['d'])
    expect(g.passed.map((r) => r.id)).toEqual(['e'])
  })

  it('sorts each column by rank ascending', () => {
    const g = groupTeamProspects([row('c', 3), row('a', 1), row('b', 2)])
    expect(g.activeByRole['plumber']!.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('treats unknown statuses as active (defensive against free-text drift)', () => {
    const g = groupTeamProspects([row('a', 1, 'something_else')])
    expect(g.activeByRole['plumber']!.map((r) => r.id)).toEqual(['a'])
  })

  it('breaks rank ties by created_at then id (stable across loads)', () => {
    const rows = [
      row('b', 0, 'active', 'plumber', '2026-07-02T00:00:00Z'),
      row('a', 0, 'active', 'plumber', '2026-07-01T00:00:00Z'),
      row('c', 0, 'active', 'plumber', '2026-07-02T00:00:00Z'),
    ]
    expect(groupTeamProspects(rows).activeByRole['plumber']!.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(groupTeamProspects(rows.reverse()).activeByRole['plumber']!.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts hired/passed newest first', () => {
    const rows = [
      row('old', 1, 'hired', 'plumber', '2026-06-01T00:00:00Z'),
      row('new', 2, 'hired', 'office', '2026-07-01T00:00:00Z'),
    ]
    expect(groupTeamProspects(rows).hired.map((r) => r.id)).toEqual(['new', 'old'])
  })
})

describe('nextTeamProspectRank', () => {
  it('returns 1 for an empty column', () => {
    expect(nextTeamProspectRank([], 'plumber')).toBe(1)
  })

  it('scopes to the given role and ignores hired/passed', () => {
    const rows = [
      row('a', 2, 'active', 'plumber'),
      row('b', 9, 'hired', 'plumber'),
      row('c', 5, 'active', 'office'),
    ]
    expect(nextTeamProspectRank(rows, 'plumber')).toBe(3)
    expect(nextTeamProspectRank(rows, 'office')).toBe(6)
  })

  it('treats null role as the unsorted column', () => {
    const rows = [row('a', 4, 'active', null), row('b', 7, 'active', 'plumber')]
    expect(nextTeamProspectRank(rows, null)).toBe(5)
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

describe('moveTeamProspectAcrossRoles', () => {
  const plumbers = [row('a', 1), row('b', 2), row('c', 3)]
  const office = [row('x', 1, 'active', 'office'), row('y', 2, 'active', 'office')]

  it('moves into the middle of another column, renumbering both', () => {
    const { source, dest, updates } = moveTeamProspectAcrossRoles(plumbers, office, 'b', 1, 'office')
    expect(source.map((r) => r.id)).toEqual(['a', 'c'])
    expect(source.map((r) => r.rank_order)).toEqual([1, 2])
    expect(dest.map((r) => r.id)).toEqual(['x', 'b', 'y'])
    expect(dest.map((r) => r.rank_order)).toEqual([1, 2, 3])
    expect(dest[1]!.role_id).toBe('office')
    expect(updates).toEqual([
      { id: 'c', rank_order: 2 },
      { id: 'b', rank_order: 2, role_id: 'office' },
      { id: 'y', rank_order: 3 },
    ])
  })

  it('appends to an empty column and always persists the moved row', () => {
    const { source, dest, updates } = moveTeamProspectAcrossRoles(plumbers, [], 'a', 0, 'office')
    expect(source.map((r) => r.id)).toEqual(['b', 'c'])
    expect(dest.map((r) => r.id)).toEqual(['a'])
    expect(updates).toContainEqual({ id: 'a', rank_order: 1, role_id: 'office' })
  })

  it('moves into the unsorted column (null role)', () => {
    const { dest, updates } = moveTeamProspectAcrossRoles(plumbers, [], 'c', 0, null)
    expect(dest[0]!.role_id).toBeNull()
    expect(updates).toContainEqual({ id: 'c', rank_order: 1, role_id: null })
  })

  it('clamps an out-of-range destination index to append', () => {
    const { dest } = moveTeamProspectAcrossRoles(plumbers, office, 'a', 99, 'office')
    expect(dest.map((r) => r.id)).toEqual(['x', 'y', 'a'])
  })

  it('is a no-op when the id is not in the source column', () => {
    const { source, dest, updates } = moveTeamProspectAcrossRoles(plumbers, office, 'zzz', 0, 'office')
    expect(source).toBe(plumbers)
    expect(dest).toBe(office)
    expect(updates).toEqual([])
  })

  it('does not mutate its inputs', () => {
    const beforeSource = plumbers.map((r) => ({ ...r }))
    const beforeDest = office.map((r) => ({ ...r }))
    moveTeamProspectAcrossRoles(plumbers, office, 'a', 0, 'office')
    expect(plumbers).toEqual(beforeSource)
    expect(office).toEqual(beforeDest)
  })
})
