import { describe, expect, it } from 'vitest'
import { stripReads } from './stripState'

describe('stripReads', () => {
  it('is loading until the first answer, failed on null, ready on rows, even none', () => {
    expect(stripReads(undefined)).toBe('loading')
    expect(stripReads(null)).toBe('failed')
    expect(stripReads([])).toBe('ready')
    expect(stripReads([{ trade: 'Concrete', dependable: 1 }])).toBe('ready')
    expect(stripReads({ bidding: 1, buying_out: 0, building: 1, lost: 0 })).toBe('ready')
  })
})
