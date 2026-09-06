import { describe, expect, it } from 'vitest'

import { subRateSaveDecision } from './crewPnlSubRate'

describe('subRateSaveDecision', () => {
  it('an empty box is "no change" — never a reset to the default (J8-F3)', () => {
    expect(subRateSaveDecision('', 65)).toEqual({ kind: 'keep' })
    expect(subRateSaveDecision('   ', 65)).toEqual({ kind: 'keep' })
  })

  it('the same number is "no change"', () => {
    expect(subRateSaveDecision('65', 65)).toEqual({ kind: 'keep' })
    expect(subRateSaveDecision(' 65.0 ', 65)).toEqual({ kind: 'keep' })
  })

  it('a new positive number saves', () => {
    expect(subRateSaveDecision('72.5', 65)).toEqual({ kind: 'save', value: 72.5 })
    expect(subRateSaveDecision('50', 65)).toEqual({ kind: 'save', value: 50 })
  })

  it('zero, negatives and junk are invalid rather than silently dropped', () => {
    expect(subRateSaveDecision('0', 65)).toEqual({ kind: 'invalid' })
    expect(subRateSaveDecision('-4', 65)).toEqual({ kind: 'invalid' })
    expect(subRateSaveDecision('abc', 65)).toEqual({ kind: 'invalid' })
    expect(subRateSaveDecision('Infinity', 65)).toEqual({ kind: 'invalid' })
  })
})
