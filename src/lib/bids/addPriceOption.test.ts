import { describe, expect, it } from 'vitest'
import { defaultPriceOptionName, priceOptionsOnVersion } from './addPriceOption'

const PRICES = [
  { id: 'base', name: 'Base price', bid_version_id: null },
  { id: 'alt', name: 'Alternate 1', bid_version_id: null },
  { id: 'gc-b-base', name: 'Base price', bid_version_id: 'ver-b' },
]

describe('priceOptionsOnVersion', () => {
  it('on an unsplit bid lists the prices with no version, in the order loaded', () => {
    expect(priceOptionsOnVersion(PRICES, null, 'base')).toEqual([
      { id: 'base', name: 'Base price', isBase: true },
      { id: 'alt', name: 'Alternate 1', isBase: false },
    ])
  })
  it("on a version lists that version's own prices only", () => {
    expect(priceOptionsOnVersion(PRICES, 'ver-b', 'gc-b-base')).toEqual([{ id: 'gc-b-base', name: 'Base price', isBase: true }])
    expect(priceOptionsOnVersion(PRICES, 'ver-c', null)).toEqual([])
  })
  it('marks no price as the base when the letter is built on none of them', () => {
    expect(priceOptionsOnVersion(PRICES, null, null).map((p) => p.isBase)).toEqual([false, false])
    expect(priceOptionsOnVersion(PRICES, null, 'gc-b-base').map((p) => p.isBase)).toEqual([false, false])
  })
})

describe('defaultPriceOptionName', () => {
  it('counts the prices already on the version, and never reads Alternate 0', () => {
    expect(defaultPriceOptionName(0)).toBe('Alternate 1')
    expect(defaultPriceOptionName(1)).toBe('Alternate 1')
    expect(defaultPriceOptionName(2)).toBe('Alternate 2')
    expect(defaultPriceOptionName(5)).toBe('Alternate 5')
  })
})
