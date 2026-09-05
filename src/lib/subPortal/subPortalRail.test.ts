import { describe, expect, it } from 'vitest'
import { isSubPortalSheetQueued, subPortalRailStep } from './subPortalRail'

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
