import { describe, expect, it } from 'vitest'
import { batchGeocodeCacheKeys } from './geocodeCacheBatches'

describe('batchGeocodeCacheKeys', () => {
  it('returns no batches for no keys', () => {
    expect(batchGeocodeCacheKeys([])).toEqual([])
  })

  it('keeps a small list in a single batch', () => {
    expect(batchGeocodeCacheKeys(['a', 'b', 'c'])).toEqual([['a', 'b', 'c']])
  })

  it('splits on key count', () => {
    const keys = Array.from({ length: 7 }, (_, i) => `k${i}`)
    expect(batchGeocodeCacheKeys(keys, 3, 4000)).toEqual([
      ['k0', 'k1', 'k2'],
      ['k3', 'k4', 'k5'],
      ['k6'],
    ])
  })

  it('splits on character budget before key count', () => {
    const keys = ['aaaa', 'bbbb', 'cccc'] // 4 chars each
    expect(batchGeocodeCacheKeys(keys, 50, 8)).toEqual([['aaaa', 'bbbb'], ['cccc']])
  })

  it('puts a single over-budget key in its own batch instead of dropping it', () => {
    const keys = ['x'.repeat(100), 'short']
    expect(batchGeocodeCacheKeys(keys, 50, 10)).toEqual([['x'.repeat(100)], ['short']])
  })

  it('preserves every key in order across batches', () => {
    const keys = Array.from({ length: 611 }, (_, i) => `${i} main st, austin, tx`)
    const batches = batchGeocodeCacheKeys(keys)
    expect(batches.flat()).toEqual(keys)
    for (const b of batches) {
      expect(b.length).toBeLessThanOrEqual(50)
    }
  })
})
