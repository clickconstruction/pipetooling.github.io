import { describe, expect, it } from 'vitest'
import { salesOutWorth } from './salesWorth'
import { buildBidWins, type BidSent } from '../bidWins'
import { buildEstimateWins, type EstimateSent } from '../estimateWins'
import { ymdAddDays } from '../../../utils/dateUtils'

const TODAY = '2026-11-09'
const ago = (n: number): string => ymdAddDays(TODAY, -n)
const bid = (usd: number, ageDays: number, outcome: string | null = null): BidSent => ({ sentYmd: ago(ageDays), outcome, usd, hasJob: false, jobUsd: null })
const estimate = (usd: number, ageDays: number, status = 'sent', customerKey: string | null = null): EstimateSent => ({ sentYmd: ago(ageDays), status, usd, customerKey })

describe('salesOutWorth (punch list #303)', () => {
  it('is null until one of the two reads lands', () => {
    expect(salesOutWorth(null, null)).toBeNull()
  })

  it('counts as out the part of each unmarked bid not yet lost by age, plus the estimates still out, and reads that part at the rate for its size', () => {
    const bidWins = buildBidWins({
      todayYmd: TODAY,
      windowStart: ago(91),
      bids: [
        // Under $10k: 1 won of 2 marked, $4k of $8k, so 50% won.
        bid(4_000, 200, 'won'),
        bid(4_000, 200, 'lost'),
        bid(6_000, 10),
        // $50k to $500k: $100k won, $300k lost, and an unmarked $200k at 100 days, half lost by age.
        bid(100_000, 300, 'won'),
        bid(300_000, 300, 'lost'),
        bid(200_000, 100),
        // Over $500k: nothing marked, so it reads at the rate of all sizes together.
        bid(600_000, 20),
      ],
    })
    const estimateWins = buildEstimateWins({ todayYmd: TODAY, windowStart: ago(91), estimates: [estimate(3_000, 30, 'customer_accepted', 'c1'), estimate(1_000, 30, 'declined', 'c2'), estimate(8_000, 5, 'sent', 'c3')] })
    const read = salesOutWorth(bidWins, estimateWins)
    expect(read).not.toBeNull()
    // The $200k bid is 100 days old, so half of it is counted as lost and half is still out.
    expect(read!.outUsd).toBe(6_000 + 100_000 + 600_000 + 8_000)
    // Small: 4 / 8 = 50%. Large: 100 / (100 + 300 + 100 aged) = 20%. All sizes: 104 / (104 + 304 + 100) for the giant.
    const all = 104_000 / (104_000 + 304_000 + 100_000)
    const expected = 6_000 * 0.5 + (200_000 - 100_000) * 0.2 + 600_000 * all + 8_000 * 0.75
    expect(read!.worthUsd).toBeCloseTo(expected, 6)
  })

  it('reads one side alone when the other has not landed', () => {
    const estimateWins = buildEstimateWins({ todayYmd: TODAY, windowStart: ago(91), estimates: [estimate(2_000, 30, 'customer_accepted', 'c1'), estimate(2_000, 30, 'declined', 'c2'), estimate(10_000, 5, 'sent', 'c3')] })
    expect(salesOutWorth(null, estimateWins)).toEqual({ outUsd: 10_000, worthUsd: 5_000 })
    const bidWins = buildBidWins({ todayYmd: TODAY, windowStart: ago(91), bids: [bid(20_000, 10)] })
    // Nothing is marked, so there is no rate and the worth is nothing yet.
    expect(salesOutWorth(bidWins, null)).toEqual({ outUsd: 20_000, worthUsd: 0 })
  })

  it('counts 5% of an unmarked bid past 180 days as out, and reads that at the rate for its size', () => {
    const bidWins = buildBidWins({ todayYmd: TODAY, windowStart: ago(91), bids: [bid(20_000, 400, 'won'), bid(20_000, 400, 'lost'), bid(40_000, 200)] })
    const read = salesOutWorth(bidWins, null)
    expect(read!.outUsd).toBeCloseTo(2_000, 6)
    // $38k of the $40k is lost by age: the rate is 20 / (20 + 20 + 38), on the $2k left.
    expect(read!.worthUsd).toBeCloseTo(2_000 * (20_000 / 78_000), 6)
  })
})
