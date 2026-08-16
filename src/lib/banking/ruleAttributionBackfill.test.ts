import { describe, expect, it } from 'vitest'
import { chunkIds, planAttributionBackfill } from './ruleAttributionBackfill'

describe('planAttributionBackfill', () => {
  it('tags only candidates without an existing attribution, counting the kept ones', () => {
    const plan = planAttributionBackfill(['a', 'b', 'c', 'd'], ['b', 'd'])
    expect(plan.toTag).toEqual(['a', 'c'])
    expect(plan.skipped).toBe(2)
  })

  it('dedupes candidates (a tx can have several approved suggestions from one rule)', () => {
    const plan = planAttributionBackfill(['a', 'a', 'b', 'b', 'b'], [])
    expect(plan.toTag).toEqual(['a', 'b'])
    expect(plan.skipped).toBe(0)
  })

  it('duplicate already-attributed candidates count skipped once', () => {
    const plan = planAttributionBackfill(['a', 'a'], ['a'])
    expect(plan.toTag).toEqual([])
    expect(plan.skipped).toBe(1)
  })

  it('empty inputs produce an empty plan', () => {
    expect(planAttributionBackfill([], ['x'])).toEqual({ toTag: [], skipped: 0 })
  })
})

describe('chunkIds', () => {
  it('splits into fixed-size chunks with a short tail', () => {
    expect(chunkIds(['1', '2', '3', '4', '5'], 2)).toEqual([['1', '2'], ['3', '4'], ['5']])
    expect(chunkIds([], 10)).toEqual([])
  })
})
