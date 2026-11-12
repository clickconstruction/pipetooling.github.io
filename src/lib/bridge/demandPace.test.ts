import { describe, expect, it } from 'vitest'
import { buildDemand, type DemandBid, type DemandEstimate } from './demandPace'

const bid = (p: Partial<DemandBid> & { id: string }): DemandBid => ({ createdYmd: null, sentYmd: null, usd: 0, outcome: null, outcomeYmd: null, jobCreatedYmd: null, jobUsd: null, ...p })
const est = (p: Partial<DemandEstimate> & { id: string; createdYmd: string }): DemandEstimate => ({ sentYmd: null, status: 'draft', usd: 0, acceptedYmd: null, updatedYmd: null, ...p })

describe('buildDemand', () => {
  const start = '2026-08-16'
  const end = '2026-10-10'
  it('counts the asks in the window, bids and estimates apart', () => {
    const d = buildDemand({
      windowStart: start,
      todayYmd: end,
      bids: [bid({ id: 'a', createdYmd: '2026-09-01', sentYmd: '2026-09-05', usd: 100_000 }), bid({ id: 'b', createdYmd: '2026-08-01', sentYmd: '2026-08-20', usd: 50_000 }), bid({ id: 'c', createdYmd: '2026-09-10', usd: 0 })],
      estimates: [est({ id: 'e1', createdYmd: '2026-09-02', sentYmd: '2026-09-03', status: 'sent', usd: 4_000 }), est({ id: 'e2', createdYmd: '2026-07-01', status: 'sent', sentYmd: '2026-07-02', usd: 9_000 })],
    })
    expect(d.market).toEqual({ bidsInvited: 2, bidsInvitedUsd: 100_000, estimatesRequested: 1, estimatesRequestedUsd: 4_000, weeks: 55 / 7 })
    expect(d.sales.bids.sentUsd).toBe(150_000)
    expect(d.sales.estimates.sentUsd).toBe(4_000)
    expect(d.bidsNoValue).toBe(0)
  })

  it('reads won, lost and awaiting by the mark alone', () => {
    const d = buildDemand({
      windowStart: start,
      todayYmd: end,
      bids: [
        bid({ id: 'won', sentYmd: '2026-08-20', usd: 40_000, outcome: 'won', outcomeYmd: '2026-09-01' }),
        // A job was made from this one and nobody marked it: it is still out, and no win.
        bid({ id: 'job-no-mark', sentYmd: '2026-08-22', usd: 60_000, jobCreatedYmd: '2026-09-10', jobUsd: 58_000 }),
        bid({ id: 'lost', sentYmd: '2026-08-25', usd: 200_000, outcome: 'lost', outcomeYmd: '2026-09-15' }),
        bid({ id: 'old-lost', sentYmd: '2026-06-01', usd: 500_000, outcome: 'lost', outcomeYmd: '2026-07-01' }),
        bid({ id: 'open', sentYmd: '2026-09-20', usd: 300_000 }),
        bid({ id: 'stale', sentYmd: '2026-06-01', usd: 1_000_000 }),
        bid({ id: 'novalue', sentYmd: '2026-09-21', usd: 0 }),
      ],
      estimates: [
        est({ id: 'acc', createdYmd: '2026-08-20', sentYmd: '2026-08-21', status: 'customer_accepted', usd: 5_000, acceptedYmd: '2026-08-30' }),
        est({ id: 'dec', createdYmd: '2026-08-20', sentYmd: '2026-08-21', status: 'declined', usd: 3_000, updatedYmd: '2026-09-02' }),
        est({ id: 'wait', createdYmd: '2026-09-01', sentYmd: '2026-09-02', status: 'sent', usd: 7_000 }),
      ],
    })
    expect(d.sales.bids).toEqual({ sentUsd: 600_000, wonUsd: 40_000, lostUsd: 200_000 })
    expect(d.sales.estimates).toEqual({ sentUsd: 15_000, wonUsd: 5_000, lostUsd: 3_000 })
    expect(d.sales.awaiting).toEqual({ bids: 3, bidsUsd: 360_000, estimates: 1, estimatesUsd: 7_000 })
    expect(d.bidsNoValue).toBe(1)
  })

  it('counts a bid marked started or complete as won, like one marked won', () => {
    const d = buildDemand({ windowStart: start, todayYmd: end, bids: [bid({ id: 's', sentYmd: '2026-08-20', usd: 30_000, outcome: 'started_or_complete', outcomeYmd: '2026-09-03' })], estimates: [] })
    expect(d.sales.bids.wonUsd).toBe(30_000)
    expect(d.sales.awaiting.bids).toBe(0)
  })

  it('dates a marked win with no answer day by the day its job was made, and counts no win it cannot date', () => {
    const d = buildDemand({
      windowStart: start,
      todayYmd: end,
      bids: [
        // Marked won, no answer day, a job made inside the window: the win lands in the window.
        bid({ id: 'job-day', sentYmd: '2026-08-20', usd: 25_000, outcome: 'won', jobCreatedYmd: '2026-09-04' }),
        // Marked won, no answer day, a job made before the window: the win is not this window's.
        bid({ id: 'old-job', sentYmd: '2026-05-01', usd: 70_000, outcome: 'won', jobCreatedYmd: '2026-06-01' }),
        // Marked won with no day at all: no week can hold it.
        bid({ id: 'no-day', sentYmd: '2026-08-20', usd: 90_000, outcome: 'won' }),
      ],
      estimates: [],
    })
    expect(d.sales.bids.wonUsd).toBe(25_000)
    expect(d.sales.awaiting.bids).toBe(0)
  })

  it('reads a won bid with no value of its own at its job’s revenue', () => {
    const d = buildDemand({ windowStart: start, todayYmd: end, bids: [bid({ id: 'v', sentYmd: '2026-08-20', usd: 0, outcome: 'won', outcomeYmd: '2026-09-01', jobCreatedYmd: '2026-09-02', jobUsd: 12_000 })], estimates: [] })
    expect(d.sales.bids.wonUsd).toBe(12_000)
  })
})
