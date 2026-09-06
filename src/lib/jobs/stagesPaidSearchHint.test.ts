import { describe, expect, it } from 'vitest'
import { stagesPaidHeaderSearchCount, stagesPaidSearchHint } from './stagesPaidSearchHint'

describe('stagesPaidSearchHint (B6 / J3-3)', () => {
  const base = { searchActive: true, openMatchCount: 0, paidMatchCount: 0, serverSearchBusy: false }

  it('is silent without a search', () => {
    expect(stagesPaidSearchHint({ ...base, searchActive: false, paidMatchCount: 3 })).toBeNull()
  })

  it('names paid matches even when open sections also matched', () => {
    expect(stagesPaidSearchHint({ ...base, paidMatchCount: 1, openMatchCount: 2 })).toEqual({
      kind: 'paid_matches',
      count: 1,
      label: '1 match in Paid in Full — show it',
    })
    expect(stagesPaidSearchHint({ ...base, paidMatchCount: 3 })?.label).toBe('3 matches in Paid in Full — show them')
  })

  it('stays quiet while open sections have matches and paid has none', () => {
    expect(stagesPaidSearchHint({ ...base, openMatchCount: 4 })).toBeNull()
    expect(stagesPaidSearchHint({ ...base, openMatchCount: 4, serverSearchBusy: true })).toBeNull()
  })

  it('says it is still checking before declaring nothing anywhere', () => {
    expect(stagesPaidSearchHint({ ...base, serverSearchBusy: true })).toEqual({ kind: 'checking', label: 'Checking Paid in Full…' })
    expect(stagesPaidSearchHint(base)).toEqual({ kind: 'none_anywhere', label: 'No match anywhere — Paid in Full included' })
  })
})

describe('stagesPaidHeaderSearchCount', () => {
  it('counts matches and never says "Expand to load" during a search', () => {
    expect(stagesPaidHeaderSearchCount(0, true)).toBe('checking…')
    expect(stagesPaidHeaderSearchCount(0, false)).toBe('0 matches')
    expect(stagesPaidHeaderSearchCount(1, false)).toBe('1 match')
    expect(stagesPaidHeaderSearchCount(2, true)).toBe('2 matches')
  })
})
