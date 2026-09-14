import { describe, expect, it } from 'vitest'
import { isGcOnlyJob, jobHasBillingParty, jobPartyMoveNotice, jobPartyName, pickJobCustomer, pickJobGc } from './jobPartyExclusive'

describe('pickJobGc', () => {
  it('moves the customer to GC when the picked GC is the job customer', () => {
    const r = pickJobGc('rmc', { customerId: 'rmc', gcCustomerId: null })
    expect(r).toEqual({ customerId: null, gcCustomerId: 'rmc', moved: 'customer_to_gc' })
  })
  it('keeps a different customer', () => {
    expect(pickJobGc('rmc', { customerId: 'owner', gcCustomerId: null })).toEqual({ customerId: 'owner', gcCustomerId: 'rmc', moved: null })
  })
  it('clearing the GC touches nothing else', () => {
    expect(pickJobGc(null, { customerId: 'owner', gcCustomerId: 'rmc' })).toEqual({ customerId: 'owner', gcCustomerId: null, moved: null })
  })
})

describe('pickJobCustomer', () => {
  it('drops the GC when the picked customer is the job GC', () => {
    expect(pickJobCustomer('rmc', { customerId: null, gcCustomerId: 'rmc' })).toEqual({ customerId: 'rmc', gcCustomerId: null, moved: 'gc_cleared' })
  })
  it('keeps a different GC', () => {
    expect(pickJobCustomer('owner', { customerId: null, gcCustomerId: 'rmc' })).toEqual({ customerId: 'owner', gcCustomerId: 'rmc', moved: null })
  })
})

describe('jobPartyMoveNotice', () => {
  it('says what moved, naming the party', () => {
    expect(jobPartyMoveNotice('customer_to_gc', 'RMC- Dudley Mason')).toMatch(/^RMC- Dudley Mason is now the GC on this job/)
    expect(jobPartyMoveNotice('gc_cleared', 'RMC- Dudley Mason')).toMatch(/no longer its GC/)
    expect(jobPartyMoveNotice(null, 'x')).toBeNull()
  })
})

describe('GC-only jobs', () => {
  it('a GC with no customer is a GC job that still has a party to bill', () => {
    expect(isGcOnlyJob({ customer_id: null, gc_customer_id: 'rmc' })).toBe(true)
    expect(isGcOnlyJob({ customer_id: 'owner', gc_customer_id: 'rmc' })).toBe(false)
    expect(jobHasBillingParty({ customer_id: null, gc_customer_id: 'rmc' })).toBe(true)
    expect(jobHasBillingParty({ customer_id: '', gc_customer_id: null })).toBe(false)
  })
  it('the party name falls through to the GC standing alone', () => {
    expect(jobPartyName({ customer_name: 'Jane', gcCustomer: { name: 'RMC' } })).toBe('Jane')
    expect(jobPartyName({ customer_name: null, gcCustomer: { name: 'RMC' } })).toBe('RMC')
    expect(jobPartyName({ customer_name: ' ', gcCustomer: null })).toBeNull()
  })
})
