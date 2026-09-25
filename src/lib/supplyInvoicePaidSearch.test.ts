import { describe, expect, it } from 'vitest'
import { supplyInvoicePaidWordMatches } from './supplyInvoicePaidSearch'

describe('supplyInvoicePaidSearch · supplyInvoicePaidWordMatches', () => {
  it('"unpaid" finds the unpaid bills and not the paid ones', () => {
    expect(supplyInvoicePaidWordMatches('unpaid', false)).toBe(true)
    expect(supplyInvoicePaidWordMatches('unpaid', true)).toBe(false)
  })

  it('"paid" finds the paid bills and not the unpaid ones', () => {
    expect(supplyInvoicePaidWordMatches('paid', true)).toBe(true)
    expect(supplyInvoicePaidWordMatches('paid', false)).toBe(false)
  })

  it('"open" is a synonym for unpaid', () => {
    expect(supplyInvoicePaidWordMatches('open', false)).toBe(true)
    expect(supplyInvoicePaidWordMatches('open', true)).toBe(false)
  })

  it('reads whole words, any case, anywhere in the query', () => {
    expect(supplyInvoicePaidWordMatches('  Unpaid  ferguson ', false)).toBe(true)
    expect(supplyInvoicePaidWordMatches('ferguson PAID', true)).toBe(true)
    expect(supplyInvoicePaidWordMatches('prepaid', true)).toBe(false)
    expect(supplyInvoicePaidWordMatches('reopen', false)).toBe(false)
  })

  it('says nothing for a query with no paid-state word', () => {
    expect(supplyInvoicePaidWordMatches('ferguson', true)).toBe(false)
    expect(supplyInvoicePaidWordMatches('ferguson', false)).toBe(false)
    expect(supplyInvoicePaidWordMatches('', false)).toBe(false)
  })
})
