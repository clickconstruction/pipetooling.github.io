import { describe, expect, it } from 'vitest'
import { boughtWords, gcRows, isBought, isOrderOnlyRow, orderOnlyGroupLine, orderOnlyInsert, orderOnlyRows } from './orderOnly'

const rows = [
  { id: 'wc', order_only: false },
  { id: 'fco', order_only: true },
  { id: 'old' }, // read before the column's push
  { id: 'nul', order_only: null },
]

describe('order-only rows', () => {
  it('only a stored true is order only: a row read before the push, or a null, is the GC’s', () => {
    expect(rows.map(isOrderOnlyRow)).toEqual([false, true, false, false])
  })

  it('splits a revision into the rows the GC sees and the rows bought without them, keeping the order', () => {
    expect(gcRows(rows).map((r) => r.id)).toEqual(['wc', 'old', 'nul'])
    expect(orderOnlyRows(rows).map((r) => r.id)).toEqual(['fco'])
  })

  it('an insert names the column only when it is true, so it is accepted before the column exists', () => {
    expect(orderOnlyInsert({ order_only: true })).toEqual({ order_only: true })
    expect(orderOnlyInsert({ order_only: false })).toEqual({})
    expect(orderOnlyInsert({})).toEqual({})
  })
})

describe('what the log already holds for a row', () => {
  const none = { orderedOn: null, deliveredOn: null, poRef: null }

  it('a line is bought once it has an order date, a delivery or a PO', () => {
    expect(isBought(none)).toBe(false)
    expect(isBought({ ...none, poRef: '  ' })).toBe(false)
    expect(isBought({ ...none, orderedOn: '2026-09-23' })).toBe(true)
    expect(isBought({ ...none, poRef: '4417' })).toBe(true)
  })

  it('says it in the log’s short dates: the first order, the last delivery, a PO when there is no date', () => {
    expect(boughtWords([])).toBe('')
    expect(boughtWords([none, none])).toBe('')
    expect(boughtWords([{ orderedOn: '2026-09-23', deliveredOn: '2026-09-29', poRef: 'space x carriers' }])).toBe('Ordered 09/23, on site 09/29')
    expect(boughtWords([{ ...none, orderedOn: '2026-09-25' }, { ...none, orderedOn: '2026-09-23' }, none])).toBe('Ordered 09/23')
    expect(boughtWords([{ ...none, poRef: '4417' }])).toBe('On PO 4417')
  })

  it('the group heading counts fixtures', () => {
    expect(orderOnlyGroupLine(1)).toBe('1 fixture · you buy it, the GC does not see it')
    expect(orderOnlyGroupLine(4)).toBe('4 fixtures · you buy them, the GC does not see them')
  })
})
