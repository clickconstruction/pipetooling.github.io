import { describe, expect, it } from 'vitest'
import { COMMON_EXCLUSIONS, exclusionName, exclusionsFor } from './exclusions'

describe('each trade’s exclusions (the owner, 2026-10-04)', () => {
  it('folds what people write onto one name', () => {
    expect(exclusionName('permits')).toBe('Permits and fees')
    expect(exclusionName('Permit fees')).toBe('Permits and fees')
    expect(exclusionName('rock')).toBe('Rock excavation')
    expect(exclusionName('crane time')).toBe('Crane time')
    expect(exclusionName('  ')).toBe('')
  })

  it('offers a trade its own exclusions first, then the ones every trade may have, each once', () => {
    expect(exclusionsFor('Sitework').slice(0, 2)).toEqual(['Dewatering', 'Rock excavation'])
    expect(exclusionsFor('Plumbing')[0]).toBe('Gas piping')
    const offered = exclusionsFor('Sitework', [{ trade: 'Sitework', name: 'Permits and fees' }, { trade: 'Roofing', name: 'Roof curbs' }])
    expect(offered[0]).toBe('Permits and fees')
    expect(offered).not.toContain('Roof curbs')
    expect(new Set(offered).size).toBe(offered.length)
    expect(offered).toEqual(expect.arrayContaining(COMMON_EXCLUSIONS.all))
  })
})
