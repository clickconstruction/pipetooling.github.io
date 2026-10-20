import { describe, expect, it } from 'vitest'
import { NO_TAG, buildPricingComposition, buildTagComposition } from './pricingComposition'

const rows = [
  { id: 'a', name: 'WC', count: 2, cost: 500, revenue: 1000, tags: ['restrooms'], materialCost: 200, materialPrice: 320 },
  { id: 'b', name: 'LAV', count: 2, cost: 400, revenue: 800, tags: ['restrooms', 'level 2'], materialCost: 100, materialPrice: 150 },
  { id: 'c', name: 'Scissor lift', count: 1, cost: 0, revenue: 200, kind: 'equipment' as const, tags: [] },
]

describe('buildTagComposition', () => {
  it('adds each tag up, a row with two tags in both, the untagged under No tag, with the weighted markup', () => {
    const c = buildTagComposition(rows)
    expect(c.totalRevenue).toBe(2000)
    expect(c.rowsWithManyTags).toBe(1)
    const restrooms = c.buckets.find((b) => b.tag === 'restrooms')!
    expect(restrooms.rows).toBe(2)
    expect(restrooms.revenue).toBe(1800)
    expect(restrooms.margin).toBeCloseTo(0.5, 6)
    expect(restrooms.markup).toBeCloseTo(470 / 300 - 1, 6)
    expect(c.buckets.find((b) => b.tag === 'level 2')!.revenue).toBe(800)
    expect(c.buckets[c.buckets.length - 1]!.tag).toBe(NO_TAG)
    expect(c.buckets.find((b) => b.tag === NO_TAG)!.markup).toBeNull()
  })
})

describe('buildPricingComposition with a saved kind', () => {
  it('a saved kind wins over the guess and lands in its own bucket', () => {
    const c = buildPricingComposition(rows)
    expect(c.buckets.map((b) => b.kind)).toEqual(['fixture', 'equipment'])
    expect(c.buckets.find((b) => b.kind === 'equipment')!.revenue).toBe(200)
  })
})
