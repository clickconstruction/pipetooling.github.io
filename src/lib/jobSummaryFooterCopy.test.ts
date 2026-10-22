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

  it('counts the search’s rows while the box holds something, and the rows lifted from under the floor (v2.5745)', () => {
    expect(jobSummaryFloorFooter({ shown: 1, hidden: 398, floor: 500, search: { lifted: 0 } })).toEqual({
      sentence: '1 job shown for the search · 398 older imported jobs (HCP # 500 and below) hidden by the default HCP # 500 floor',
      offerShowAll: true,
    })
    expect(jobSummaryFloorFooter({ shown: 1, hidden: 398, floor: 500, search: { lifted: 1 } }).sentence).toBe(
      '1 job shown for the search, 1 from under the floor · 397 older imported jobs (HCP # 500 and below) hidden by the default HCP # 500 floor',
    )
    expect(jobSummaryFloorFooter({ shown: 2, hidden: 0, floor: 500, search: { lifted: 0 } })).toEqual({
      sentence: '2 jobs shown for the search · nothing hidden by the default HCP # 500 floor',
      offerShowAll: false,
    })
    expect(jobSummaryFloorFooter({ shown: 3, hidden: 0, floor: -1, search: { lifted: 0 } })).toEqual({
      sentence: '3 jobs shown for the search · no HCP # floor',
      offerShowAll: false,
    })
    // No search: the whole list, as before.
    expect(jobSummaryFloorFooter({ shown: 417, hidden: 398, floor: 500, search: null }).sentence).toBe(
      '417 shown · 398 older imported jobs (HCP # 500 and below) hidden by the default HCP # 500 floor',
    )
  })

  it('never prints a negative count', () => {
    expect(jobSummaryFloorFooter({ shown: -3, hidden: -2, floor: 500 }).sentence).toBe(
      '0 jobs shown · nothing hidden by the default HCP # 500 floor',
    )
  })
})
