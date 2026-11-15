import { describe, expect, it } from 'vitest'
import { buildEstimatorScore, scoreBid, type EstimatorBidInput } from './estimatorScore'
import { buildHurdle } from './hurdle'

const hurdle = buildHurdle({ overheadUsd: 50_000, paidFieldHours: 1_000, windowDays: 56, setting: { targetProfitPerHourUsd: 25 } }) // $75/h
const period = { fromYmd: '2026-10-01', toYmd: '2026-11-15', todayYmd: '2026-11-15' }

const bid = (over: Partial<EstimatorBidInput> & { bidId: string }): EstimatorBidInput => ({
  bidNumber: over.bidId,
  projectName: 'A project',
  customerName: 'A GC',
  estimatorName: 'Robert',
  accountManagerName: 'Micah',
  outcome: 'won',
  outcomeYmd: '2026-10-20',
  sentYmd: '2026-10-01',
  pricedRevenueUsd: 100_000,
  pricedCostUsd: 60_000, // expected gp 40,000
  pricedUncostedUsd: 0,
  labor: { usable: true, rowsWithHours: 30, rowsTotal: 30, rateSet: true },
  awardedHours: 400, // $100/h, clears
  job: null,
  ...over,
})
const closedJob = (actual: number, closedYmd: string | null = '2026-11-05'): EstimatorBidInput['job'] => ({ jobId: 'j', label: '#1 Job', status: 'billed', finished: true, closedYmd, actualGrossProfitUsd: actual })

describe('estimator score', () => {
  it('counts the priced gross profit at award when it clears the hurdle over the award hours', () => {
    const r = scoreBid(bid({ bidId: 'b1' }), hurdle, period.todayYmd)
    expect(r.kind).toBe('counted')
    expect(r.expectedPerHourUsd).toBe(100)
    expect(r.countedUsd).toBe(40_000)
  })

  it('awarded under the hurdle counts zero, and stays zero even when the crew beats it', () => {
    const r = scoreBid(bid({ bidId: 'b2', awardedHours: 800, job: closedJob(70_000) }), hurdle, period.todayYmd) // $50/h at award
    expect(r.kind).toBe('under_hurdle')
    expect(r.countedUsd).toBe(0)
    expect(r.note).toContain('counts zero, and stays there')
  })

  it('once the job is billed or paid, the actual replaces the estimate and the adjustment is the variance', () => {
    const r = scoreBid(bid({ bidId: 'b3', job: closedJob(31_000) }), hurdle, period.todayYmd)
    expect(r.kind).toBe('closed')
    expect(r.countedUsd).toBe(31_000)
    expect(r.adjustmentUsd).toBe(-9_000)
    expect(scoreBid(bid({ bidId: 'b3', job: closedJob(31_000, null) }), hurdle, period.todayYmd).note).toContain('no Billed move on record')
  })

  it('a proposal out with no answer counts zero and carries its days out; one priced under the hurdle says so', () => {
    const waiting = scoreBid(bid({ bidId: 'b4', outcome: null, outcomeYmd: null, sentYmd: '2026-11-01' }), hurdle, period.todayYmd)
    expect(waiting.kind).toBe('waiting')
    expect(waiting.daysOut).toBe(14)
    expect(waiting.note).toBeNull()
    const low = scoreBid(bid({ bidId: 'b5', outcome: null, outcomeYmd: null, sentYmd: '2026-11-01', awardedHours: 1_000 }), hurdle, period.todayYmd)
    expect(low.note).toBe('Priced under the hurdle at $40/h.')
  })

  it('no stamp or no hours: held with the reason', () => {
    expect(scoreBid(bid({ bidId: 'b6', pricedCostUsd: null }), hurdle, period.todayYmd)).toMatchObject({ kind: 'held', note: expect.stringContaining('No priced stamp') })
    expect(scoreBid(bid({ bidId: 'b7', awardedHours: null }), hurdle, period.todayYmd)).toMatchObject({ kind: 'held', note: expect.stringContaining('No labor hours at award') })
  })

  it('a bid whose labor was never estimated, or with uncosted rows, is held with the words an estimator can act on', () => {
    const noLabor = scoreBid(bid({ bidId: 'b10', labor: { usable: false, rowsWithHours: 4, rowsTotal: 33, rateSet: false } }), hurdle, period.todayYmd)
    expect(noLabor.kind).toBe('held')
    expect(noLabor.needsEstimate).toBe(true)
    expect(noLabor.note).toBe('Labor not estimated: 4 of 33 rows have hours. The priced cost has little or no labor in it.')
    // The rate alone never holds: the company crew rate stands in when none is typed.
    expect(scoreBid(bid({ bidId: 'b13', labor: { usable: false, rowsWithHours: 30, rowsTotal: 32, rateSet: false } }), hurdle, period.todayYmd).kind).toBe('counted')
    expect(noLabor.expectedPerHourUsd).toBeNull()
    const partial = scoreBid(bid({ bidId: 'b11', pricedUncostedUsd: 12_345.6 }), hurdle, period.todayYmd)
    expect(partial.note).toBe('$12,346 of rows uncosted at send: the priced margin is partial.')
    const outNoLabor = scoreBid(bid({ bidId: 'b12', outcome: null, outcomeYmd: null, sentYmd: '2026-11-01', labor: { usable: false, rowsWithHours: 0, rowsTotal: 10, rateSet: false } }), hurdle, period.todayYmd)
    expect(outNoLabor.kind).toBe('waiting')
    expect(outNoLabor.needsEstimate).toBe(true)
  })

  it('until the first judged bid, the card is a ramp: coverage of the priced bids in play, and the words say what starts the score', () => {
    const s = buildEstimatorScore({
      ...period,
      hurdle,
      bids: [
        bid({ bidId: 'b10', labor: { usable: false, rowsWithHours: 4, rowsTotal: 33, rateSet: false } }),
        bid({ bidId: 'b12', outcome: null, outcomeYmd: null, sentYmd: '2026-11-03', labor: { usable: false, rowsWithHours: 0, rowsTotal: 10, rateSet: false } }),
        bid({ bidId: 'b4', outcome: null, outcomeYmd: null, sentYmd: '2026-11-01' }),
      ],
    })
    expect(s.ramp).toBe(true)
    expect(s.coverage).toEqual({ judged: 1, total: 3 })
    expect(s.verdict).toBe('1 can be judged; the score starts when one of them is awarded. 2 need their Labor tab finished.')
    const none = buildEstimatorScore({ ...period, hurdle, bids: [] })
    expect(none.ramp).toBe(false)
    expect(none.verdict).toBe('No bids awarded or closed in the period.')
  })

  it('the period is a flow: additions at award plus the closeouts in it; the two people share one number', () => {
    const s = buildEstimatorScore({
      ...period,
      hurdle,
      bids: [
        bid({ bidId: 'b1' }), // awarded in period: +40,000
        bid({ bidId: 'b3', job: closedJob(31_000) }), // awarded and closed in period: +40,000 − 9,000
        bid({ bidId: 'old', outcomeYmd: '2026-08-01', job: closedJob(52_000, '2026-10-10') }), // awarded before, closed in period: +12,000
        bid({ bidId: 'older', outcomeYmd: '2026-08-01', job: closedJob(52_000, '2026-09-10') }), // closed before the period: nothing
        bid({ bidId: 'b2', awardedHours: 800 }), // under hurdle
        bid({ bidId: 'b4', outcome: null, outcomeYmd: null, sentYmd: '2026-11-01', estimatorName: 'Lee', accountManagerName: null }),
        bid({ bidId: 'b8', outcome: null, outcomeYmd: null, sentYmd: '2026-11-01', pricedCostUsd: null }), // out, no stamp
        bid({ bidId: 'b9', outcome: null, outcomeYmd: null, sentYmd: '2025-06-01' }), // out 532 days: stale
        bid({ bidId: 'b10', labor: { usable: false, rowsWithHours: 4, rowsTotal: 33, rateSet: false } }), // awarded, labor not estimated
        bid({ bidId: 'b12', outcome: null, outcomeYmd: null, sentYmd: '2026-11-03', labor: { usable: false, rowsWithHours: 0, rowsTotal: 10, rateSet: false } }), // out, labor not estimated
      ],
    })
    expect(s.additionsUsd).toBe(80_000)
    expect(s.adjustmentsUsd).toBe(3_000)
    expect(s.countedUsd).toBe(83_000)
    expect(s.openAtEstimateUsd).toBe(40_000)
    expect(s.awarded.map((r) => r.bidId)).toEqual(['b1', 'b3'])
    expect(s.closeouts.map((r) => r.bidId)).toEqual(['b3', 'old'])
    expect(s.underHurdle.map((r) => r.bidId)).toEqual(['b2'])
    expect(s.held.map((r) => r.bidId)).toEqual(['b10'])
    expect(s.waiting.map((r) => r.bidId)).toEqual(['b4'])
    expect(s.toFinish.map((r) => r.bidId)).toEqual(['b10', 'b12'])
    expect(s.waitingUnpriced).toBe(1)
    expect(s.waitingStale).toBe(1)
    expect(s.coverage).toEqual({ judged: 4, total: 6 }) // b1 b3 b2 b4 judged; b10 b12 not; old, older, b8, b9 out of play
    expect(s.ramp).toBe(false)
    expect(s.people).toEqual([
      { name: 'Micah', countedUsd: 83_000, bids: 2, closed: 2 },
      { name: 'Robert', countedUsd: 83_000, bids: 2, closed: 2 },
    ])
    expect(s.verdict).toBe('$80,000 of gross profit won above the hurdle on 2 bids. 2 jobs closed and moved it by $3,000. 1 awarded under the hurdle counts zero.')
  })
})
