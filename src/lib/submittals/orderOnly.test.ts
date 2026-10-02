import { describe, expect, it } from 'vitest'
import { gcRows, isOrderOnlyRow, orderOnlyInsert, orderOnlyRows } from './orderOnly'

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
