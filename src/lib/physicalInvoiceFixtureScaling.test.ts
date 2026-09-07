import { describe, expect, it } from 'vitest'
import {
  allocateProportionalCents,
  buildScaledFixtureLineDrafts,
  fixturePhysicalDescription,
  type FixtureRowForScaling,
} from './physicalInvoiceFixtureScaling'

const fx = (name: string | null, count: number | null, unit: number | null, seq: number, desc: string | null = null): FixtureRowForScaling => ({
  name,
  count,
  line_unit_price: unit,
  line_description: desc,
  sequence_order: seq,
})

describe('allocateProportionalCents', () => {
  it('returns the raw buckets untouched when the target equals their sum', () => {
    expect(allocateProportionalCents([100, 200, 300], 600)).toEqual([100, 200, 300])
  })
  it('scales by largest remainder so the result sums exactly to the target', () => {
    const out = allocateProportionalCents([100, 100, 100], 100)
    expect(out).toEqual([34, 33, 33])
    expect(out.reduce((a, b) => a + b, 0)).toBe(100)
    const up = allocateProportionalCents([1, 1, 1], 1000)
    expect(up.reduce((a, b) => a + b, 0)).toBe(1000)
    expect(up).toEqual([334, 333, 333])
  })
  it('breaks remainder ties by position, earliest first', () => {
    expect(allocateProportionalCents([50, 50], 101)).toEqual([51, 50])
  })
  it('yields zeros for empty or non-positive input', () => {
    expect(allocateProportionalCents([], 100)).toEqual([])
    expect(allocateProportionalCents([0, 0], 100)).toEqual([0, 0])
  })
})

describe('fixturePhysicalDescription', () => {
  it('joins name and scope with a newline, falls back to "Line item"', () => {
    expect(fixturePhysicalDescription(fx('Toilet', 1, 1, 1, ' rough-in '))).toBe('Toilet\nrough-in')
    expect(fixturePhysicalDescription(fx(' Toilet ', 1, 1, 1))).toBe('Toilet')
    expect(fixturePhysicalDescription(fx('', 1, 1, 1))).toBe('Line item')
    expect(fixturePhysicalDescription(fx(null, 1, 1, 1))).toBe('Line item')
  })
})

describe('buildScaledFixtureLineDrafts', () => {
  it('keeps raw amounts when the fixtures already sum to the target', () => {
    const out = buildScaledFixtureLineDrafts([fx('Toilet', 2, 150, 1), fx('Sink', 1, 100, 2)], 40_000)
    expect(out).toEqual({
      drafts: [
        { description: 'Toilet', amountCents: 30_000 },
        { description: 'Sink', amountCents: 10_000 },
      ],
      proportionalScalingUsed: false,
    })
  })

  it('scales proportionally to the billed amount, exact to the cent, and says so', () => {
    const out = buildScaledFixtureLineDrafts([fx('Toilet', 2, 150, 1), fx('Sink', 1, 100, 2)], 30_001)
    expect(out?.proportionalScalingUsed).toBe(true)
    expect(out?.drafts.map((d) => d.amountCents)).toEqual([22_501, 7_500])
    expect(out?.drafts.reduce((s, d) => s + d.amountCents, 0)).toBe(30_001)
  })

  it('orders by sequence_order and drops unnamed or zero-priced rows before allocating', () => {
    const out = buildScaledFixtureLineDrafts(
      [fx('Sink', 1, 100, 5), fx('', 3, 50, 1), fx('Free item', 1, 0, 2), fx('Toilet', 1, 300, 3), fx('No price', 1, null, 4)],
      40_000,
    )
    expect(out?.drafts.map((d) => d.description)).toEqual(['Toilet', 'Sink'])
    expect(out?.proportionalScalingUsed).toBe(false)
  })

  it('treats a missing or non-positive count as one', () => {
    const out = buildScaledFixtureLineDrafts([fx('Toilet', null, 100, 1), fx('Sink', 0, 100, 2)], 20_000)
    expect(out?.drafts.map((d) => d.amountCents)).toEqual([10_000, 10_000])
  })

  it('returns null when nothing is billable or the target is below one cent', () => {
    expect(buildScaledFixtureLineDrafts([fx('', 1, 100, 1)], 1000)).toBeNull()
    expect(buildScaledFixtureLineDrafts([fx('Toilet', 1, 0, 1)], 1000)).toBeNull()
    expect(buildScaledFixtureLineDrafts([], 1000)).toBeNull()
    expect(buildScaledFixtureLineDrafts([fx('Toilet', 1, 100, 1)], 0)).toBeNull()
    expect(buildScaledFixtureLineDrafts([fx('Toilet', 1, 100, 1)], Number.NaN)).toBeNull()
  })

  it('a tiny target lands entirely on the rows that survive rounding and still sums exactly', () => {
    const out = buildScaledFixtureLineDrafts([fx('A', 1, 100, 1), fx('B', 1, 100, 2), fx('C', 1, 100, 3)], 2)
    expect(out?.drafts.reduce((s, d) => s + d.amountCents, 0)).toBe(2)
    expect(out?.drafts.every((d) => d.amountCents > 0)).toBe(true)
  })
})
