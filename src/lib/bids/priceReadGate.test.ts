import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { createPriceReadGate, figureWhileLoading, OPEN_PRICE_LOADING_MESSAGE, OPEN_PRICE_LOADING_TITLE, openPriceLoading, openPricePricesReady } from './priceReadGate'

describe('createPriceReadGate', () => {
  it('a read of the price on screen writes', () => {
    const gate = createPriceReadGate()
    const t = gate.begin('alt')
    expect(gate.mayWrite('alt', t, 'alt')).toBe(true)
  })

  it('a read of the price you left never writes, however late it lands (Grace: the save reload of WENDI after the switch)', () => {
    const gate = createPriceReadGate()
    const saveReload = gate.begin('wendi')
    const switchRead = gate.begin('alt')
    expect(gate.mayWrite('alt', switchRead, 'alt')).toBe(true)
    expect(gate.mayWrite('wendi', saveReload, 'alt')).toBe(false)
  })

  it('an older read of the open price never overwrites a newer one', () => {
    const gate = createPriceReadGate()
    const first = gate.begin('alt')
    const second = gate.begin('alt')
    expect(gate.mayWrite('alt', second, 'alt')).toBe(true)
    expect(gate.mayWrite('alt', first, 'alt')).toBe(false)
  })

  it('a later read of another price does not block the open price\'s newest read', () => {
    const gate = createPriceReadGate()
    const open = gate.begin('alt')
    gate.begin('wendi')
    expect(gate.mayWrite('alt', open, 'alt')).toBe(true)
  })

  it('nothing on screen: no read writes', () => {
    const gate = createPriceReadGate()
    const t = gate.begin('alt')
    expect(gate.mayWrite('alt', t, null)).toBe(false)
  })
})

describe('openPricePricesReady', () => {
  it('ready only when the book and the rows on screen were both read for the open price', () => {
    expect(openPricePricesReady({ selectedPricingVersionId: 'alt', entriesReadFor: 'alt', rowsReadFor: 'alt' })).toBe(true)
    expect(openPricePricesReady({ selectedPricingVersionId: 'alt', entriesReadFor: 'alt', rowsReadFor: 'wendi' })).toBe(false)
    expect(openPricePricesReady({ selectedPricingVersionId: 'alt', entriesReadFor: 'wendi', rowsReadFor: 'alt' })).toBe(false)
    expect(openPricePricesReady({ selectedPricingVersionId: 'alt', entriesReadFor: null, rowsReadFor: null })).toBe(false)
  })

  it('no price open is never ready', () => {
    expect(openPricePricesReady({ selectedPricingVersionId: null, entriesReadFor: null, rowsReadFor: null })).toBe(false)
  })
})

describe('openPriceLoading (v2.5671)', () => {
  it('a price open whose prices have not landed is loading', () => {
    expect(openPriceLoading({ selectedPricingVersionId: 'alt', pricesReady: false })).toBe(true)
  })

  it('once they land it is not', () => {
    expect(openPriceLoading({ selectedPricingVersionId: 'alt', pricesReady: true })).toBe(false)
  })

  it('no price open is nothing to wait for: the Workbench has its own empty state', () => {
    expect(openPriceLoading({ selectedPricingVersionId: null, pricesReady: false })).toBe(false)
  })
})

describe('figureWhileLoading (v2.5671)', () => {
  it('reads … while the open price loads and the figure once it lands', () => {
    expect(figureWhileLoading(true, '$1,250')).toBe('…')
    expect(figureWhileLoading(false, '$1,250')).toBe('$1,250')
  })
})

describe('the loading words', () => {
  it('are plain words', () => {
    expect(plainWordsFailures(OPEN_PRICE_LOADING_MESSAGE)).toEqual([])
    expect(plainWordsFailures(OPEN_PRICE_LOADING_TITLE)).toEqual([])
  })
})
