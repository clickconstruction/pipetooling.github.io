import { describe, expect, it } from 'vitest'
import {
  effectiveOrderIncrement,
  formatOrderIncrement,
  orderIncrementChip,
  orderIncrementIsFeet,
  orderIncrementPackWord,
  packsFor,
  parseOrderIncrement,
  parseTypedOrderIncrement,
  roundUpToIncrement,
} from './orderIncrement'

describe('parsing', () => {
  it('reads the two columns; a missing, zero or junk increment is no rule; an unknown unit falls back to sticks', () => {
    expect(parseOrderIncrement({ order_increment: 20, order_increment_unit: 'ft_stick' })).toEqual({ increment: 20, unit: 'ft_stick' })
    expect(parseOrderIncrement({ order_increment: '100', order_increment_unit: 'ft_coil' })).toEqual({ increment: 100, unit: 'ft_coil' })
    expect(parseOrderIncrement({ order_increment: 10, order_increment_unit: 'sacks' })).toEqual({ increment: 10, unit: 'ft_stick' })
    expect(parseOrderIncrement({ order_increment: null, order_increment_unit: 'box' })).toBeNull()
    expect(parseOrderIncrement({ order_increment: 0 })).toBeNull()
    expect(parseOrderIncrement(null)).toBeNull()
    expect(parseTypedOrderIncrement(' 20 ')).toBe(20)
    expect(parseTypedOrderIncrement('1,000')).toBe(1000)
    expect(parseTypedOrderIncrement('')).toBeNull()
    expect(parseTypedOrderIncrement('-5')).toBeNull()
  })
})

describe('effectiveOrderIncrement', () => {
  const copperType = { order_increment: 20, order_increment_unit: 'ft_stick' }
  it('the part’s own rule wins, else the type’s, else none — and says which', () => {
    expect(effectiveOrderIncrement({ order_increment: 10, order_increment_unit: 'ft_stick' }, copperType)).toEqual({ value: { increment: 10, unit: 'ft_stick' }, source: 'part' })
    expect(effectiveOrderIncrement({ order_increment: null }, copperType)).toEqual({ value: { increment: 20, unit: 'ft_stick' }, source: 'type' })
    expect(effectiveOrderIncrement({ order_increment: null }, null)).toEqual({ value: null, source: 'none' })
    expect(effectiveOrderIncrement(null, { order_increment: null })).toEqual({ value: null, source: 'none' })
  })
})

describe('words', () => {
  it('the sentence and the chip', () => {
    expect(formatOrderIncrement({ increment: 20, unit: 'ft_stick' })).toBe('20 ft sticks')
    expect(formatOrderIncrement({ increment: 100, unit: 'ft_coil' })).toBe('100 ft coils')
    expect(formatOrderIncrement({ increment: 10, unit: 'box' })).toBe('boxes of 10')
    expect(formatOrderIncrement({ increment: 2.5, unit: 'bundle' })).toBe('bundles of 2.5')
    expect(formatOrderIncrement({ increment: 5, unit: 'pack' })).toBe('packs of 5')
    expect(orderIncrementChip({ increment: 5, unit: 'pack' })).toBe('pack of 5')
    expect(orderIncrementPackWord('pack')).toBe('packs')
    expect(orderIncrementIsFeet('pack')).toBe(false)
    expect(orderIncrementIsFeet('ft_coil')).toBe(true)
    expect(orderIncrementChip({ increment: 20, unit: 'ft_stick' })).toBe('20 ft')
    expect(orderIncrementChip({ increment: 100, unit: 'ft_coil' })).toBe('100 ft coil')
    expect(orderIncrementChip({ increment: 10, unit: 'box' })).toBe('box of 10')
  })
})

describe('roundUpToIncrement', () => {
  it('105 ft at 20 ft sticks is 120 ft; 13 nuts in packs of 5 is 15; an exact multiple stays; float dust does not add a stick; zero stays zero', () => {
    expect(roundUpToIncrement(13, 5)).toBe(15)
    expect(roundUpToIncrement(105, 20)).toBe(120)
    expect(roundUpToIncrement(120, 20)).toBe(120)
    expect(roundUpToIncrement(120.0000001, 20)).toBe(120)
    expect(roundUpToIncrement(0.5, 20)).toBe(20)
    expect(roundUpToIncrement(0, 20)).toBe(0)
    expect(roundUpToIncrement(105, 0)).toBe(105)
    expect(packsFor(120, 20)).toBe(6)
    expect(packsFor(120, 0)).toBe(0)
  })
})
