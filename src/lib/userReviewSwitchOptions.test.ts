import { describe, it, expect } from 'vitest'
import { buildSwitchUserOptions, type SwitchableUser } from './userReviewSwitchOptions'

describe('buildSwitchUserOptions', () => {
  it('returns an empty array for an empty roster', () => {
    expect(buildSwitchUserOptions([], 'me')).toEqual([])
  })

  it('omits the current user (no destination)', () => {
    const roster: SwitchableUser[] = [
      { id: 'me', name: 'Me Myself' },
      { id: 'a', name: 'Abraham' },
      { id: 'b', name: 'Bryan' },
    ]
    const out = buildSwitchUserOptions(roster, 'me')
    expect(out.map((o) => o.value)).toEqual(['a', 'b'])
  })

  it('keeps the current user when currentUserId is empty (no subject yet)', () => {
    const roster: SwitchableUser[] = [
      { id: 'a', name: 'Abraham' },
      { id: 'b', name: 'Bryan' },
    ]
    const out = buildSwitchUserOptions(roster, '')
    expect(out.map((o) => o.value)).toEqual(['a', 'b'])
  })

  it('sorts by name asc case-insensitive', () => {
    const roster: SwitchableUser[] = [
      { id: '1', name: 'zara' },
      { id: '2', name: 'Abraham' },
      { id: '3', name: 'bryan' },
      { id: '4', name: 'Cara' },
    ]
    const out = buildSwitchUserOptions(roster, 'me')
    expect(out.map((o) => o.label)).toEqual(['Abraham', 'bryan', 'Cara', 'zara'])
  })

  it('tie-breaks identical names deterministically by id asc', () => {
    const roster: SwitchableUser[] = [
      { id: 'z', name: 'Bryan' },
      { id: 'a', name: 'Bryan' },
      { id: 'm', name: 'Bryan' },
    ]
    const out = buildSwitchUserOptions(roster, 'me')
    expect(out.map((o) => o.value)).toEqual(['a', 'm', 'z'])
  })

  it('skips rows with empty / whitespace-only names', () => {
    const roster: SwitchableUser[] = [
      { id: 'blank', name: '' },
      { id: 'ws', name: '   ' },
      { id: 'a', name: 'Abraham' },
    ]
    const out = buildSwitchUserOptions(roster, 'me')
    expect(out.map((o) => o.value)).toEqual(['a'])
  })

  it('skips rows with empty id', () => {
    const roster: SwitchableUser[] = [
      { id: '', name: 'Ghost' },
      { id: 'a', name: 'Abraham' },
    ]
    const out = buildSwitchUserOptions(roster, 'me')
    expect(out.map((o) => o.value)).toEqual(['a'])
  })

  it('trims whitespace from names in the emitted label', () => {
    const roster: SwitchableUser[] = [{ id: 'a', name: '  Abraham  ' }]
    const out = buildSwitchUserOptions(roster, 'me')
    expect(out).toEqual([{ value: 'a', label: 'Abraham' }])
  })
})
