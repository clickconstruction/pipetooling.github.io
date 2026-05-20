import { describe, expect, it } from 'vitest'
import {
  filterRosterByQuery,
  type DispatchSettingsRosterRow,
} from './dispatchSettingsPeopleSearch'

const roster: DispatchSettingsRosterRow[] = [
  { userId: 'u1', displayName: 'Abraham Lincoln' },
  { userId: 'u2', displayName: 'Abigail Adams' },
  { userId: 'u3', displayName: 'Benjamin Franklin' },
  { userId: 'u4', displayName: 'Calvin Coolidge' },
  { userId: 'u5', displayName: 'Diana Prince' },
]

describe('filterRosterByQuery', () => {
  it('returns no results for empty query', () => {
    expect(filterRosterByQuery(roster, '', 10)).toEqual([])
  })

  it('returns no results for whitespace-only query', () => {
    expect(filterRosterByQuery(roster, '   ', 10)).toEqual([])
  })

  it('matches case-insensitively', () => {
    expect(filterRosterByQuery(roster, 'ab', 10)).toEqual([
      { value: 'u1', label: 'Abraham Lincoln' },
      { value: 'u2', label: 'Abigail Adams' },
    ])
    expect(filterRosterByQuery(roster, 'AB', 10)).toEqual([
      { value: 'u1', label: 'Abraham Lincoln' },
      { value: 'u2', label: 'Abigail Adams' },
    ])
  })

  it('matches substrings anywhere in the name', () => {
    expect(filterRosterByQuery(roster, 'lin', 10)).toEqual([
      { value: 'u1', label: 'Abraham Lincoln' },
      { value: 'u3', label: 'Benjamin Franklin' },
    ])
  })

  it('caps results at the requested max', () => {
    const out = filterRosterByQuery(roster, 'a', 2)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ value: 'u1', label: 'Abraham Lincoln' })
    expect(out[1]).toEqual({ value: 'u2', label: 'Abigail Adams' })
  })

  it('returns no results when max is 0 or negative', () => {
    expect(filterRosterByQuery(roster, 'a', 0)).toEqual([])
    expect(filterRosterByQuery(roster, 'a', -1)).toEqual([])
  })

  it('preserves the roster order when filtering', () => {
    const out = filterRosterByQuery(roster, 'a', 10).map((r) => r.value)
    expect(out).toEqual(['u1', 'u2', 'u3', 'u4', 'u5'])
  })

  it('returns no results when no row matches', () => {
    expect(filterRosterByQuery(roster, 'zzzz', 10)).toEqual([])
  })

  it('tolerates rosters with empty / missing names', () => {
    const tricky: DispatchSettingsRosterRow[] = [
      { userId: 'u1', displayName: '' },
      { userId: 'u2', displayName: 'Real Person' },
    ]
    expect(filterRosterByQuery(tricky, 'real', 10)).toEqual([
      { value: 'u2', label: 'Real Person' },
    ])
  })
})
