import { describe, expect, it } from 'vitest'
import { paidSearchChipState } from './paidSearchChip'

const base = { searchActive: true, paidMerged: false, paidLoading: false, zeroLoadedMatches: false }

describe('paidSearchChipState', () => {
  it('hidden without search text — even mid paid fetch from a section expand', () => {
    expect(paidSearchChipState({ ...base, searchActive: false })).toBe('hidden')
    expect(paidSearchChipState({ ...base, searchActive: false, paidLoading: true })).toBe('hidden')
  })

  it('quiet while the search matches loaded jobs', () => {
    expect(paidSearchChipState(base)).toBe('quiet')
  })

  it('prominent when nothing loaded matches — the "is it an old job?" moment', () => {
    expect(paidSearchChipState({ ...base, zeroLoadedMatches: true })).toBe('prominent')
  })

  it('loading while the fetch runs, regardless of match state', () => {
    expect(paidSearchChipState({ ...base, paidLoading: true, zeroLoadedMatches: true })).toBe('loading')
  })

  it('included once merged wins over everything else', () => {
    expect(paidSearchChipState({ ...base, paidMerged: true, paidLoading: true, zeroLoadedMatches: true })).toBe('included')
  })
})
