import { describe, expect, it } from 'vitest'
import { rosterStrayCount, rosterStrayWords } from './rosterStrays'

describe('roster strays', () => {
  it('counts live records with no users row', () => {
    expect(rosterStrayCount([{ account_user_id: 'u1' }, { account_user_id: null }, { account_user_id: null, archived_at: '2026-06-01' }])).toBe(1)
    expect(rosterStrayCount([])).toBe(0)
  })
  it('says the count in words, or nothing', () => {
    expect(rosterStrayWords(0)).toBeNull()
    expect(rosterStrayWords(1)).toBe('1 roster record has no users row yet. Link account on its row joins it to its login.')
    expect(rosterStrayWords(2)).toBe('2 roster records have no users row yet. Link account on each row joins it to its login.')
  })
})
