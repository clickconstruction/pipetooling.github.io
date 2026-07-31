import { describe, expect, it } from 'vitest'
import { builderBidOutcomeCounts } from './builderBidMapFocus'

describe('builderBidOutcomeCounts', () => {
  it('tallies sections with startedOrComplete counting as won', () => {
    const c = builderBidOutcomeCounts(['won', 'startedOrComplete', 'lost', 'lost', 'pending', 'unsent', undefined, null])
    expect(c).toEqual({ won: 2, lost: 2, pending: 1, unsent: 1, hitRatePct: 50 })
  })

  it('hit rate is null when nothing is decided', () => {
    const c = builderBidOutcomeCounts(['pending', 'unsent'])
    expect(c.hitRatePct).toBe(null)
    expect(c.pending).toBe(1)
  })

  it('rounds the hit rate', () => {
    const c = builderBidOutcomeCounts(['won', 'lost', 'lost'])
    expect(c.hitRatePct).toBe(33)
  })

  it('empty input is all zeroes', () => {
    expect(builderBidOutcomeCounts([])).toEqual({ won: 0, lost: 0, pending: 0, unsent: 0, hitRatePct: null })
  })
})
