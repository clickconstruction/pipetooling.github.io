import { describe, expect, it } from 'vitest'
import {
  firstWordOfDisplayName,
  normalizeNameTokenForMatch,
  resolveUnambiguousUserFromCardNickname,
} from './mercuryCardNicknameUserMatch'

describe('mercuryCardNicknameUserMatch', () => {
  it('normalizeNameTokenForMatch strips trailing possessive', () => {
    expect(normalizeNameTokenForMatch("Mike's")).toBe('mike')
    expect(normalizeNameTokenForMatch('Alice')).toBe('alice')
  })

  it('resolveUnambiguousUserFromCardNickname returns the only matching user by first word', () => {
    const u = resolveUnambiguousUserFromCardNickname('Alice office card', [
      { id: '1', name: 'Bob Smith' },
      { id: '2', name: 'Alice Jones' },
    ])
    expect(u).toEqual({ id: '2', name: 'Alice Jones' })
  })

  it('returns null when two users share the same first word', () => {
    expect(
      resolveUnambiguousUserFromCardNickname("Mike's card", [
        { id: '1', name: 'Mike A' },
        { id: '2', name: 'Mike B' },
      ]),
    ).toBeNull()
  })

  it('returns null when no user first word matches', () => {
    expect(
      resolveUnambiguousUserFromCardNickname('Michael card', [{ id: '1', name: 'Mike Smith' }]),
    ).toBeNull()
  })

  it('returns null for empty or whitespace-only nickname', () => {
    expect(resolveUnambiguousUserFromCardNickname('  ', [{ id: '1', name: 'A' }])).toBeNull()
    expect(resolveUnambiguousUserFromCardNickname(null, [{ id: '1', name: 'A' }])).toBeNull()
  })

  it('firstWordOfDisplayName handles extra spaces', () => {
    expect(firstWordOfDisplayName('  Pat  Lee  ')).toBe('Pat')
  })
})
