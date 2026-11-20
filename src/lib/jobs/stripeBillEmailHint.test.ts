import { describe, expect, it } from 'vitest'
import { stripeBillAddressWords, stripeBillEmailHint } from './stripeBillEmailHint'

const job = { bill_to_party: 'customer', customer_id: 'cust-1', gc_customer_id: 'gc-1', customer_email: ' pat@example.com ' }

describe('stripeBillEmailHint: the address the Send Email invoice window may name (v2.7972)', () => {
  it("a customer's bill names the job's customer email, as before", () => {
    expect(stripeBillEmailHint(job, {})).toEqual({ payer: 'customer', email: 'pat@example.com' })
    expect(stripeBillEmailHint({ ...job, customer_email: '' }, null)).toEqual({ payer: 'customer', email: null })
  })

  it("a bill to the GC never names the customer's address", () => {
    expect(stripeBillEmailHint({ ...job, bill_to_party: 'gc' }, {})).toEqual({ payer: 'gc', email: null })
    // The invoice's own pick on a split job, and a GC job with no customer.
    expect(stripeBillEmailHint({ ...job, bill_to_party: 'split' }, { bill_to_party: 'gc' })).toEqual({ payer: 'gc', email: null })
    expect(stripeBillEmailHint({ bill_to_party: 'customer', customer_id: null, gc_customer_id: 'gc-1', customer_email: null }, {})).toEqual({ payer: 'gc', email: null })
  })

  it('a bill typed to someone else names that address', () => {
    expect(stripeBillEmailHint({ ...job, bill_to_party: 'gc' }, { bill_to_email: ' jo@example.com ' })).toEqual({ payer: 'other', email: 'jo@example.com' })
  })

  it('with no address to name, the words say whose address Stripe holds', () => {
    expect(stripeBillAddressWords('gc')).toBe('the GC, at the address on the Stripe invoice')
    expect(stripeBillAddressWords('customer')).toBe('the address on the Stripe invoice')
    expect(stripeBillAddressWords(undefined)).toBe('the address on the Stripe invoice')
  })
})
