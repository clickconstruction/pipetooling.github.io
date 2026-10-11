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

  it('reads won, started as a job, lost and awaiting', () => {
    const d = buildDemand({
      windowStart: start,
      todayYmd: end,
      bids: [
        bid({ id: 'won', sentYmd: '2026-08-20', usd: 40_000, outcome: 'won', outcomeYmd: '2026-09-01' }),
        bid({ id: 'started', sentYmd: '2026-08-22', usd: 60_000, jobCreatedYmd: '2026-09-10', jobUsd: 58_000 }),
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
    expect(d.sales.bids).toEqual({ sentUsd: 600_000, wonUsd: 40_000, startedUsd: 58_000, lostUsd: 200_000 })
    expect(d.sales.estimates).toEqual({ sentUsd: 15_000, wonUsd: 5_000, lostUsd: 3_000 })
    expect(d.sales.awaiting).toEqual({ bids: 2, bidsUsd: 300_000, estimates: 1, estimatesUsd: 7_000 })
    expect(d.bidsNoValue).toBe(1)
  })
})
