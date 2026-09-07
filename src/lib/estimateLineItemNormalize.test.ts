import { describe, expect, it } from 'vitest'
import {
  computeEstimateLineExtendedCents,
  normalizeEstimateLineItemFromJsonElement,
  normalizeEstimateLineItemsFromJson,
  sumNormalizedLineItems,
} from './estimateLineItemNormalize'

describe('computeEstimateLineExtendedCents', () => {
  it('multiplies, rounds, and never goes below zero unless negatives are allowed', () => {
    expect(computeEstimateLineExtendedCents(3, 1250)).toBe(3750)
    expect(computeEstimateLineExtendedCents(1.5, 333)).toBe(500) // 499.5 rounds up
    expect(computeEstimateLineExtendedCents(2, -500)).toBe(0)
    expect(computeEstimateLineExtendedCents(2, -500, { allowNegative: true })).toBe(-1000)
  })
  it('a missing or non-positive quantity counts as one', () => {
    expect(computeEstimateLineExtendedCents(0, 1250)).toBe(1250)
    expect(computeEstimateLineExtendedCents(Number.NaN, 1250)).toBe(1250)
    expect(computeEstimateLineExtendedCents(-2, 1250)).toBe(1250)
  })
})

describe('normalizeEstimateLineItemFromJsonElement', () => {
  it('reads the modern shape and computes the extended amount', () => {
    expect(normalizeEstimateLineItemFromJsonElement({ line_item: ' Labor ', description: 'Install', quantity: '2', unit_price_cents: 1500, amount_cents: 999 })).toEqual({
      line_item: 'Labor',
      description: 'Install',
      quantity: 2,
      unit_price_cents: 1500,
      amount_cents: 3000,
    })
  })
  it('reads the legacy { description, amount_cents } shape as one unit at that price', () => {
    expect(normalizeEstimateLineItemFromJsonElement({ description: 'Old line', amount_cents: 4200 })).toEqual({
      line_item: '',
      description: 'Old line',
      quantity: 1,
      unit_price_cents: 4200,
      amount_cents: 4200,
    })
  })
  it('derives a unit price from a legacy line total when the unit price is zero', () => {
    expect(normalizeEstimateLineItemFromJsonElement({ quantity: 4, unit_price_cents: 0, amount_cents: 1000 })).toMatchObject({ unit_price_cents: 250, amount_cents: 1000 })
  })
  it('defaults blank, zero or negative quantities to one', () => {
    expect(normalizeEstimateLineItemFromJsonElement({ quantity: '', unit_price_cents: 100 }).quantity).toBe(1)
    expect(normalizeEstimateLineItemFromJsonElement({ quantity: 0, unit_price_cents: 100 }).quantity).toBe(1)
    expect(normalizeEstimateLineItemFromJsonElement({ quantity: 'x', unit_price_cents: 100 }).quantity).toBe(1)
  })
  it('clamps a negative unit price to zero for estimates and keeps it for change orders', () => {
    expect(normalizeEstimateLineItemFromJsonElement({ quantity: 1, unit_price_cents: -500 })).toMatchObject({ unit_price_cents: 0, amount_cents: 0 })
    expect(normalizeEstimateLineItemFromJsonElement({ quantity: 2, unit_price_cents: -500 }, { allowNegative: true })).toMatchObject({ unit_price_cents: -500, amount_cents: -1000 })
  })
  it('tolerates an empty object', () => {
    expect(normalizeEstimateLineItemFromJsonElement({})).toEqual({ line_item: '', description: '', quantity: 1, unit_price_cents: 0, amount_cents: 0 })
  })
})

describe('normalizeEstimateLineItemsFromJson / sumNormalizedLineItems', () => {
  it('returns [] for non-arrays and sums the normalised amounts', () => {
    expect(normalizeEstimateLineItemsFromJson(null)).toEqual([])
    expect(normalizeEstimateLineItemsFromJson('x')).toEqual([])
    const lines = normalizeEstimateLineItemsFromJson([
      { quantity: 2, unit_price_cents: 100 },
      { description: 'legacy', amount_cents: 50 },
    ])
    expect(sumNormalizedLineItems(lines)).toBe(250)
    expect(sumNormalizedLineItems([])).toBe(0)
  })
})
