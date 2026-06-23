import { describe, expect, it } from 'vitest'
import { buildAddSessionPeople } from './buildAddSessionPeople'

const users = [
  { id: 'u-amy', name: 'Amy' },
  { id: 'u-bob', name: 'Bob' },
  { id: 'u-cara', name: 'Cara' },
]

describe('buildAddSessionPeople', () => {
  it('includes Hours people that map to a user, as {value:user.id,label:name}', () => {
    expect(buildAddSessionPeople(['Bob', 'Amy'], users)).toEqual([
      { value: 'u-amy', label: 'Amy' },
      { value: 'u-bob', label: 'Bob' },
    ])
  })

  it('drops names with no matching user account', () => {
    expect(buildAddSessionPeople(['Amy', 'Ghost', 'Cara'], users)).toEqual([
      { value: 'u-amy', label: 'Amy' },
      { value: 'u-cara', label: 'Cara' },
    ])
  })

  it('sorts options by label case-insensitively', () => {
    const out = buildAddSessionPeople(['Cara', 'amy', 'Bob'], [
      ...users,
      { id: 'u-amy-lower', name: 'amy' },
    ])
    expect(out.map((o) => o.label)).toEqual(['amy', 'Bob', 'Cara'])
  })

  it('emits a single entry per Hours name and keeps the first user on duplicate names', () => {
    const out = buildAddSessionPeople(['Amy', 'Amy'], [
      { id: 'u-amy-1', name: 'Amy' },
      { id: 'u-amy-2', name: 'Amy' },
    ])
    expect(out).toEqual([{ value: 'u-amy-1', label: 'Amy' }])
  })

  it('returns [] for empty inputs', () => {
    expect(buildAddSessionPeople([], users)).toEqual([])
    expect(buildAddSessionPeople(['Amy'], [])).toEqual([])
  })

  it('ignores user rows missing id or name', () => {
    const out = buildAddSessionPeople(['Amy', 'Bob'], [
      { id: '', name: 'Amy' },
      { id: 'u-bob', name: '' },
      { id: 'u-bob', name: 'Bob' },
    ])
    expect(out).toEqual([{ value: 'u-bob', label: 'Bob' }])
  })
})
