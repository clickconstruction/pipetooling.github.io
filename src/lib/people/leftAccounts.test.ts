import { describe, expect, it } from 'vitest'
import { accountHasLeft, accountsThatLeft, linkedAccountIds, withAccountArchived } from './leftAccounts'

describe('leftAccounts · a roster row whose linked account is archived', () => {
  const rows = [
    { id: 'p-1', account_user_id: 'u-1' },
    { id: 'p-2', account_user_id: 'u-2' },
    { id: 'p-3', account_user_id: null },
    { id: 'p-4' },
    { id: 'p-5', account_user_id: 'u-1' },
    { id: 'p-6', account_user_id: '  ' },
  ]

  it('asks about each linked account once, and about no row with none', () => {
    expect(linkedAccountIds(rows)).toEqual(['u-1', 'u-2'])
    expect(linkedAccountIds([])).toEqual([])
  })

  it('an account the reader cannot see among the live ones has left', () => {
    expect(accountsThatLeft(['u-1', 'u-2', 'u-3'], ['u-1', 'u-3'])).toEqual(['u-2'])
    expect(accountsThatLeft(['u-1', 'u-2'], ['u-1', 'u-2', 'u-9'])).toEqual([])
  })

  it('a reader who sees no linked account at all is told nobody has left', () => {
    expect(accountsThatLeft(['u-1', 'u-2'], [])).toEqual([])
    expect(accountsThatLeft(['u-1', 'u-2'], ['u-9'])).toEqual([])
    expect(accountsThatLeft([], [])).toEqual([])
  })

  it('marks the rows whose account is archived, and leaves every other row offered', () => {
    const marked = withAccountArchived(rows, ['u-2'])
    expect(marked.map((r) => [r.id, r.account_archived])).toEqual([
      ['p-1', false],
      ['p-2', true],
      ['p-3', false],
      ['p-4', false],
      ['p-5', false],
      ['p-6', false],
    ])
    expect(marked.filter(accountHasLeft).map((r) => r.id)).toEqual(['p-2'])
  })

  it('marks nobody when the read of the accounts answered nothing', () => {
    expect(withAccountArchived(rows, []).some(accountHasLeft)).toBe(false)
  })

  it('keeps the row as it was, with the mark added', () => {
    const [first] = withAccountArchived([{ id: 'p-1', account_user_id: 'u-1', name: 'Sub Sam' }], ['u-1'])
    expect(first).toEqual({ id: 'p-1', account_user_id: 'u-1', name: 'Sub Sam', account_archived: true })
  })

  it('a row with no mark has not left', () => {
    expect(accountHasLeft({})).toBe(false)
    expect(accountHasLeft({ account_archived: null })).toBe(false)
  })
})
