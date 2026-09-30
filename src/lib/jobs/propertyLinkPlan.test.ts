import { describe, expect, it } from 'vitest'
import { planPropertyLink } from './propertyLinkPlan'
import type { CustomerAddressRow } from './lienProperty'

const row = (over: Partial<CustomerAddressRow>): CustomerAddressRow => ({ id: 'p1', customer_id: 'c1', address: '662 Co Rd 232, Hondo, TX', property_kind: '', homestead: false, ...over } as CustomerAddressRow)

describe('planPropertyLink (v2.4212)', () => {
  it('reuses the customer property the job address already matches — exactly, or by street line (before the first line break or comma)', () => {
    const existing = [row({})]
    expect(planPropertyLink({ customerId: 'c1', jobAddress: '662 Co Rd 232, Hondo, TX', kind: 'residential' }, existing)).toEqual({
      action: 'link',
      customerAddressId: 'p1',
      patch: { property_kind: 'residential' },
    })
    expect(planPropertyLink({ customerId: 'c1', jobAddress: '662 co rd 232\nHondo TX 78861', kind: 'non_residential' }, existing)).toMatchObject({ action: 'link', customerAddressId: 'p1', patch: { property_kind: 'non_residential', homestead: false } })
  })

  it("saves the job's address as a new property on the customer, with the kind on it, when nothing matches", () => {
    const now = new Date('2026-09-29T12:00:00Z')
    const plan = planPropertyLink({ customerId: 'c1', jobAddress: ' 1780 FM 1343\nCastroville, TX ', kind: 'residential' }, [row({})], now)
    expect(plan.action).toBe('create')
    if (plan.action !== 'create') return
    expect(plan.row).toMatchObject({ customer_id: 'c1', address: '1780 FM 1343\nCastroville, TX', property_kind: 'residential', homestead: false, sequence_order: 1, note: null, county: '' })
    expect('is_primary' in plan.row).toBe(false)
  })

  it("another customer's property never counts as a match, and the new row sorts after the customer's own", () => {
    const plan = planPropertyLink({ customerId: 'c2', jobAddress: '662 Co Rd 232, Hondo, TX', kind: 'non_residential' }, [row({}), row({ id: 'p2', customer_id: 'c2', address: '9 Elsewhere St' })])
    expect(plan).toMatchObject({ action: 'create', row: { customer_id: 'c2', sequence_order: 1, property_kind: 'non_residential' } })
  })
})
