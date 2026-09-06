import { describe, it, expect } from 'vitest'
import { accountNicknameNudgeText, unnamedMercuryAccountIds } from './bankingAccountNicknameNudge'

describe('unnamedMercuryAccountIds', () => {
  it('returns the ids with no nickname row, sorted, and ignores named ones', () => {
    const out = unnamedMercuryAccountIds(['b-222', 'a-111', 'c-333'], { 'a-111': 'Operating', 'c-333': 'Recivables' })
    expect(out).toEqual(['b-222'])
  })

  it('treats a blank or null nickname as unnamed, dedupes, and skips empty ids', () => {
    const out = unnamedMercuryAccountIds(['z-9', 'z-9', ' ', 'y-8', 'x-7'], { 'y-8': '   ', 'x-7': null })
    expect(out).toEqual(['x-7', 'y-8', 'z-9'])
  })

  it('does not report nickname rows for accounts that are not in the loaded rows', () => {
    expect(unnamedMercuryAccountIds([], { 'orphan-1': 'Old account' })).toEqual([])
  })

  it('a misspelled nickname is still a nickname — the nudge is about missing names only', () => {
    expect(unnamedMercuryAccountIds(['r-1'], { 'r-1': 'Recivables' })).toEqual([])
  })
})

describe('accountNicknameNudgeText', () => {
  it('is null when nothing is unnamed', () => {
    expect(accountNicknameNudgeText(0)).toBeNull()
    expect(accountNicknameNudgeText(-1)).toBeNull()
  })

  it('pluralizes and says who can fix it', () => {
    expect(accountNicknameNudgeText(1)).toBe(
      '1 account has no nickname — it shows as a raw ID in every account filter. Only a dev can name accounts.',
    )
    expect(accountNicknameNudgeText(2)).toBe(
      '2 accounts have no nickname — they show as a raw ID in every account filter. Only a dev can name accounts.',
    )
  })
})
