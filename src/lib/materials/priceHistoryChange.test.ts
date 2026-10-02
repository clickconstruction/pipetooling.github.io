import { describe, expect, it } from 'vitest'
import { PRICE_HISTORY_TONE_COLOR, priceHistoryChange } from './priceHistoryChange'

describe('priceHistoryChange', () => {
  it('a rise reads orange and up, a drop blue and down', () => {
    expect(priceHistoryChange({ old_price: 704.31, new_price: 770.59, price_change_percent: 9.41 })).toEqual({ text: '▲ +9.41%', tone: 'up' })
    expect(priceHistoryChange({ old_price: 19.52, new_price: 17.56, price_change_percent: -10.04 })).toEqual({ text: '▼ -10.04%', tone: 'down' })
    expect(PRICE_HISTORY_TONE_COLOR.up).toBe('var(--text-orange-700)')
    expect(PRICE_HISTORY_TONE_COLOR.down).toBe('var(--text-blue-700)')
  })

  it('the same price again reads Checked, and the first price says so', () => {
    expect(priceHistoryChange({ old_price: 4, new_price: 4, price_change_percent: 0 })).toEqual({ text: 'Checked', tone: 'same' })
    expect(priceHistoryChange({ old_price: null, new_price: 653.93, price_change_percent: null })).toEqual({ text: 'First price', tone: 'first' })
  })

  it('works the percent out when the row has none, and says only the direction from $0', () => {
    expect(priceHistoryChange({ old_price: 10, new_price: 11, price_change_percent: null })).toEqual({ text: '▲ +10.00%', tone: 'up' })
    expect(priceHistoryChange({ old_price: 0, new_price: 999_999, price_change_percent: null })).toEqual({ text: '▲', tone: 'up' })
  })
})
