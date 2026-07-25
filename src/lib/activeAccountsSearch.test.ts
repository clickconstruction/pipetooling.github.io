import { describe, expect, it } from 'vitest'
import { filterActiveAccountUsers, type ActiveAccountsSearchableUser } from './activeAccountsSearch'

function user(name: string | null, email: string, role: ActiveAccountsSearchableUser['role']): ActiveAccountsSearchableUser {
  return { name, email, role }
}

const ROSTER: ActiveAccountsSearchableUser[] = [
  user('Robert Douglas', 'robert@douglasmining.com', 'dev'),
  user('Wendi Smith', 'wendi@example.com', 'assistant'),
  user('Trace Jones', 'trace@example.com', 'helpers'),
  user(null, 'no-name@example.com', 'subcontractor'),
  user('Paige Miller', 'paige@example.com', 'master_technician'),
]

describe('filterActiveAccountUsers', () => {
  it('returns every row unchanged for empty and whitespace-only queries', () => {
    expect(filterActiveAccountUsers(ROSTER, '')).toEqual(ROSTER)
    expect(filterActiveAccountUsers(ROSTER, '   ')).toEqual(ROSTER)
  })

  it('matches name case-insensitively on substrings', () => {
    expect(filterActiveAccountUsers(ROSTER, 'WENDI')).toEqual([ROSTER[1]])
    expect(filterActiveAccountUsers(ROSTER, 'oug')).toEqual([ROSTER[0]])
  })

  it('matches email fragments and tolerates null names', () => {
    expect(filterActiveAccountUsers(ROSTER, 'no-name@')).toEqual([ROSTER[3]])
  })

  it('matches the DB role slug', () => {
    expect(filterActiveAccountUsers(ROSTER, 'master_tech')).toEqual([ROSTER[4]])
  })

  it('matches the role display label ("Helper" for helpers rows)', () => {
    expect(filterActiveAccountUsers(ROSTER, 'helper')).toEqual([ROSTER[2]])
  })

  it('trims the query before matching', () => {
    expect(filterActiveAccountUsers(ROSTER, '  trace  ')).toEqual([ROSTER[2]])
  })

  it('returns empty when nothing matches, preserving order otherwise', () => {
    expect(filterActiveAccountUsers(ROSTER, 'zzz-no-match')).toEqual([])
    expect(filterActiveAccountUsers(ROSTER, 'example.com')).toEqual([ROSTER[1], ROSTER[2], ROSTER[3], ROSTER[4]])
  })
})
