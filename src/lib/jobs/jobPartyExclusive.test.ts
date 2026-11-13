import { describe, expect, it } from 'vitest'
import { isGcOnlyJob, jobHasBillingParty, jobPartyMoveNotice, jobPartyName, pickJobCustomer, pickJobGc } from './jobPartyExclusive'

describe('pickJobGc', () => {
  it('moves the customer to GC when the picked GC is the job customer', () => {
    const r = pickJobGc('rlc', { customerId: 'rlc', gcCustomerId: null })
    expect(r).toEqual({ customerId: null, gcCustomerId: 'rlc', moved: 'customer_to_gc' })
  })
  it('keeps a different customer', () => {
    expect(pickJobGc('rlc', { customerId: 'owner', gcCustomerId: null })).toEqual({ customerId: 'owner', gcCustomerId: 'rlc', moved: null })
  })
  it('clearing the GC touches nothing else', () => {
    expect(pickJobGc(null, { customerId: 'owner', gcCustomerId: 'rlc' })).toEqual({ customerId: 'owner', gcCustomerId: null, moved: null })
  })
})

describe('pickJobCustomer', () => {
  it('drops the GC when the picked customer is the job GC', () => {
    expect(pickJobCustomer('rlc', { customerId: null, gcCustomerId: 'rlc' })).toEqual({ customerId: 'rlc', gcCustomerId: null, moved: 'gc_cleared' })
  })
  it('keeps a different GC', () => {
    expect(pickJobCustomer('owner', { customerId: null, gcCustomerId: 'rlc' })).toEqual({ customerId: 'owner', gcCustomerId: 'rlc', moved: null })
  })
})

describe('jobPartyMoveNotice', () => {
  it('says what moved, naming the party', () => {
    expect(jobPartyMoveNotice('customer_to_gc', 'RLC- Dunmere Mallin')).toMatch(/^RLC- Dunmere Mallin is now the GC on this job/)
    expect(jobPartyMoveNotice('gc_cleared', 'RLC- Dunmere Mallin')).toMatch(/no longer its GC/)
    expect(jobPartyMoveNotice(null, 'x')).toBeNull()
  })
})

describe('GC-only jobs', () => {
  it('a GC with no customer is a GC job that still has a party to bill', () => {
    expect(isGcOnlyJob({ customer_id: null, gc_customer_id: 'rlc' })).toBe(true)
    expect(isGcOnlyJob({ customer_id: 'owner', gc_customer_id: 'rlc' })).toBe(false)
    expect(jobHasBillingParty({ customer_id: null, gc_customer_id: 'rlc' })).toBe(true)
    expect(jobHasBillingParty({ customer_id: '', gc_customer_id: null })).toBe(false)
  })
  it('the party name falls through to the GC standing alone', () => {
    expect(jobPartyName({ customer_name: 'Jane', gcCustomer: { name: 'RLC' } })).toBe('Jane')
    expect(jobPartyName({ customer_name: null, gcCustomer: { name: 'RLC' } })).toBe('RLC')
    expect(jobPartyName({ customer_name: ' ', gcCustomer: null })).toBeNull()
  })
})
