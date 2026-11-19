import { describe, expect, it } from 'vitest'
import { isSubPortalSheetQueued, subPortalCustomerPaidDay, subPortalRailStep } from './subPortalRail'

describe('subPortalRailStep', () => {
  it('follows the stored stage for the first three dots', () => {
    expect(subPortalRailStep({ stage: 'working', payableAfter: null })).toBe(0)
    expect(subPortalRailStep({ stage: 'walkthrough', payableAfter: null })).toBe(1)
    expect(subPortalRailStep({ stage: 'customer_pay', payableAfter: null })).toBe(2)
  })

  it('lights the fourth dot only for Waiting on customer with a payable-after date', () => {
    expect(subPortalRailStep({ stage: 'customer_pay', payableAfter: '2026-09-11' })).toBe(3)
    expect(isSubPortalSheetQueued({ stage: 'customer_pay', payableAfter: '2026-09-11' })).toBe(true)
    // A promised progress payment mid-job never jumps the rail ahead of the work.
    expect(subPortalRailStep({ stage: 'working', payableAfter: '2026-09-04' })).toBe(0)
    expect(subPortalRailStep({ stage: 'walkthrough', payableAfter: '2026-09-09' })).toBe(1)
    expect(isSubPortalSheetQueued({ stage: 'customer_pay', payableAfter: '  ' })).toBe(false)
  })
})

describe('subPortalCustomerPaidDay (punch list #388, step 2)', () => {
  const day = (over: { stage?: 'working' | 'walkthrough' | 'customer_pay'; payableAfter?: string | null; customerPaidOn?: string | null }) =>
    subPortalCustomerPaidDay({ stage: over.stage ?? 'customer_pay', payableAfter: over.payableAfter ?? null, customerPaidOn: over.customerPaidOn })

  it('is the day the function sent, on a sheet still waiting on the customer', () => {
    expect(day({ customerPaidOn: '2026-11-12' })).toBe('2026-11-12')
  })

  it('is nothing without a day, or with one that is not a day', () => {
    expect(day({})).toBeNull()
    expect(day({ customerPaidOn: null })).toBeNull()
    expect(day({ customerPaidOn: '' })).toBeNull()
    expect(day({ customerPaidOn: 'Nov 12' })).toBeNull()
  })

  it('is nothing once the sheet is queued: Queued says more', () => {
    expect(day({ customerPaidOn: '2026-11-12', payableAfter: '2026-11-20' })).toBeNull()
  })

  it('is nothing on an earlier stage', () => {
    expect(day({ customerPaidOn: '2026-11-12', stage: 'walkthrough' })).toBeNull()
    expect(day({ customerPaidOn: '2026-11-12', stage: 'working' })).toBeNull()
  })

  it('leaves the rail on the third dot', () => {
    expect(subPortalRailStep({ stage: 'customer_pay', payableAfter: null })).toBe(2)
  })
})
