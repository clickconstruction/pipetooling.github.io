import { describe, expect, it } from 'vitest'
import { boardSectionCounts, gcReducer, initialGcState } from './gcModel'

describe('the stage strip (the owner, 2026-10-04)', () => {

  it('a lost bid leaves Bidding for Lost', () => {
    const state = gcReducer(initialGcState(), { type: 'markLost', projectId: 'padb', why: 'price', wonBy: '', note: '' })
    const counts = boardSectionCounts(state)
    expect(counts.find((c) => c.key === 'pursuing')?.count).toBe(1)
    expect(counts.find((c) => c.key === 'lost')?.count).toBe(1)
  })
})
