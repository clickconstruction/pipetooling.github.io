import { describe, expect, it } from 'vitest'
import { BID_BEAT_IDLE_MS, beatSeconds, bidInFrontFromLocation, bidInFrontKey, isAtWork } from './bidInFront'

const BID = '0b1d0000-0000-4000-8000-00000000b412'

describe('bidInFrontFromLocation', () => {
  it('reads the bid and the tab off the Bids page', () => {
    expect(bidInFrontFromLocation('/bids', `?tab=pricing&bidId=${BID}`)).toEqual({ bidId: BID, tab: 'pricing' })
  })
  it('lower-cases the id and cleans the tab', () => {
    expect(bidInFrontFromLocation('/bids/', `?bidId=${BID.toUpperCase()}&tab=Cover-Letter!`)).toEqual({ bidId: BID, tab: 'cover-letter' })
  })
  it('has no tab when the address names none', () => {
    expect(bidInFrontFromLocation('/bids', `?bidId=${BID}`)).toEqual({ bidId: BID, tab: '' })
  })
  it('is null with no bid, a broken id or another page', () => {
    expect(bidInFrontFromLocation('/bids', '?tab=bid-board')).toBeNull()
    expect(bidInFrontFromLocation('/bids', '?bidId=412')).toBeNull()
    expect(bidInFrontFromLocation('/jobs', `?bidId=${BID}`)).toBeNull()
    expect(bidInFrontFromLocation('', '')).toBeNull()
  })
  it('keys a bid in front by its id and tab', () => {
    expect(bidInFrontKey({ bidId: BID, tab: 'counts' })).toBe(`${BID}:counts`)
    expect(bidInFrontKey(null)).toBe('')
  })
})

describe('beatSeconds', () => {
  const t0 = 1_000_000
  it('is a whole minute for a minute at work', () => {
    expect(beatSeconds(t0, t0 + 50_000, t0 + 60_000)).toBe(60)
  })
  it('is the part of a minute on leaving', () => {
    expect(beatSeconds(t0, t0 + 20_000, t0 + 23_400)).toBe(23)
  })
  it('is nothing for a glance under five seconds', () => {
    expect(beatSeconds(t0, t0, t0 + 4_900)).toBe(0)
  })
  it('stops at the idle limit past the last press', () => {
    const lastInput = t0 - BID_BEAT_IDLE_MS + 10_000
    expect(beatSeconds(t0, lastInput, t0 + 60_000)).toBe(10)
    expect(beatSeconds(t0, t0 - BID_BEAT_IDLE_MS - 1, t0 + 60_000)).toBe(0)
  })
  it('says whether the person is still at work', () => {
    expect(isAtWork(t0, t0 + BID_BEAT_IDLE_MS)).toBe(true)
    expect(isAtWork(t0, t0 + BID_BEAT_IDLE_MS + 1)).toBe(false)
  })
})
