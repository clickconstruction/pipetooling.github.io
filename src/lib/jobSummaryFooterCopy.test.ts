import { describe, expect, it } from 'vitest'
import { jobSummaryFloorFooter } from './jobSummaryFooterCopy'

describe('jobSummaryFloorFooter (v2.2914, J6-7)', () => {
  it('discloses the legacy rows the default floor hides and offers show all', () => {
    expect(jobSummaryFloorFooter({ shown: 417, hidden: 398, floor: 500 })).toEqual({
      sentence: '417 shown · 398 older imported jobs (HCP # 500 and below) hidden by the default HCP # 500 floor',
      offerShowAll: true,
    })
  })

  it('names a custom floor without calling it the default', () => {
    expect(jobSummaryFloorFooter({ shown: 10, hidden: 1, floor: 800 }).sentence).toBe(
      '10 shown · 1 older imported job (HCP # 800 and below) hidden by the HCP # 800 floor',
    )
  })

  it('says nothing is hidden when the floor drops no rows — and offers no show all', () => {
    expect(jobSummaryFloorFooter({ shown: 417, hidden: 0, floor: 500 })).toEqual({
      sentence: '417 jobs shown · nothing hidden by the default HCP # 500 floor',
      offerShowAll: false,
    })
  })

  it('reads "All N jobs shown" once the floor is −1', () => {
    expect(jobSummaryFloorFooter({ shown: 815, hidden: 0, floor: -1 })).toEqual({
      sentence: 'All 815 jobs shown · no HCP # floor',
      offerShowAll: false,
    })
    expect(jobSummaryFloorFooter({ shown: 1, hidden: 0, floor: -1 }).sentence).toBe('All 1 job shown · no HCP # floor')
  })

  it('never prints a negative count', () => {
    expect(jobSummaryFloorFooter({ shown: -3, hidden: -2, floor: 500 }).sentence).toBe(
      '0 jobs shown · nothing hidden by the default HCP # 500 floor',
    )
  })
})
