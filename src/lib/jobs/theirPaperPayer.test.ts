import { describe, expect, it } from 'vitest'
import { theirPaperPayer } from './theirPaperPayer'

describe('theirPaperPayer', () => {
  it('is the GC on a job the GC pays', () => {
    expect(theirPaperPayer({ customer_id: 'home', gc_customer_id: 'gc', bill_to_party: 'gc', customer_name: 'Dana Whitfield', gcCustomer: { name: 'Larkfield Construction' } })).toEqual({ id: 'gc', name: 'Larkfield Construction' })
  })

  it('is the customer on a job the customer pays', () => {
    expect(theirPaperPayer({ customer_id: 'home', gc_customer_id: null, bill_to_party: 'customer', customer_name: 'Dana Whitfield', gcCustomer: null })).toEqual({ id: 'home', name: 'Dana Whitfield' })
  })

  it('is nobody on a job that names nobody to bill', () => {
    expect(theirPaperPayer({ customer_id: null, gc_customer_id: null, bill_to_party: 'customer', customer_name: null, gcCustomer: null })).toBeNull()
  })
})
