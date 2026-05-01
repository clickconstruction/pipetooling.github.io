import { describe, expect, it } from 'vitest'
import {
  buildBidBoardWeeklySentSummaries,
  buildBidBoardWeeklySentPivot,
  BID_BOARD_WEEKLY_SENT_DEFAULT_MAX_WEEKS,
  type BidBoardWeekSentSummary,
} from './bidBoardWeeklySentStats'
import type { BidWithBuilder } from '../types/bidWithBuilder'

function minimalBid(
  overrides: Partial<
    Pick<BidWithBuilder, 'id' | 'bid_date_sent' | 'bid_value' | 'outcome' | 'estimator_id' | 'estimator'>
  >
): Pick<BidWithBuilder, 'id' | 'bid_date_sent' | 'bid_value' | 'outcome' | 'estimator_id' | 'estimator'> {
  return {
    id: 'bid-default-id',
    bid_date_sent: null,
    bid_value: null,
    outcome: null,
    estimator_id: null,
    estimator: null,
    ...overrides,
  }
}

describe('buildBidBoardWeeklySentSummaries', () => {
  it('buckets by Chicago Sunday-start week and aggregates per estimator', () => {
    const bids = [
      minimalBid({
        id: 'b1',
        bid_date_sent: '2026-04-28T17:00:00.000Z',
        bid_value: 1000,
        outcome: null,
        estimator_id: 'u1',
        estimator: { id: 'u1', name: 'Alice', email: 'a@x.com' },
      }),
      minimalBid({
        id: 'b2',
        bid_date_sent: '2026-04-29T17:00:00.000Z',
        bid_value: 500,
        outcome: 'won',
        estimator_id: 'u2',
        estimator: { id: 'u2', name: 'Bob', email: 'b@x.com' },
      }),
    ]
    const rows = buildBidBoardWeeklySentSummaries(bids)
    expect(rows).toHaveLength(1)
    const w0 = rows[0]!
    expect(w0.weekStart).toBe('2026-04-26')
    expect(w0.weekEnd).toBe('2026-05-02')
    expect(w0.won).toBe(1)
    expect(w0.lost).toBe(0)
    expect(w0.haventHeardBack).toBe(1)

    const byName = Object.fromEntries(w0.estimatorRows.map((r) => [r.displayName, r]))
    expect(byName.Alice).toEqual({
      estimatorKey: 'u1',
      displayName: 'Alice',
      sentCount: 1,
      sentDollars: 1000,
      bidIds: ['b1'],
    })
    expect(byName.Bob).toEqual({
      estimatorKey: 'u2',
      displayName: 'Bob',
      sentCount: 1,
      sentDollars: 500,
      bidIds: ['b2'],
    })
  })

  it('classifies lost and started_or_complete like the Bid Board scoreboard', () => {
    const bids = [
      minimalBid({
        id: 'l1',
        bid_date_sent: '2026-04-28T17:00:00.000Z',
        outcome: 'lost',
        estimator_id: 'u1',
        estimator: { id: 'u1', name: 'A', email: 'a@x.com' },
      }),
      minimalBid({
        id: 'w1',
        bid_date_sent: '2026-04-28T18:00:00.000Z',
        outcome: 'started_or_complete',
        estimator_id: 'u1',
        estimator: { id: 'u1', name: 'A', email: 'a@x.com' },
      }),
    ]
    const out = buildBidBoardWeeklySentSummaries(bids)
    const w = out[0]!
    expect(w.won).toBe(1)
    expect(w.lost).toBe(1)
    expect(w.haventHeardBack).toBe(0)
  })

  it('uses Unassigned row when estimator_id is null', () => {
    const rows = buildBidBoardWeeklySentSummaries([
      minimalBid({
        id: 'u0',
        bid_date_sent: '2026-04-28T17:00:00.000Z',
        bid_value: 250,
        outcome: null,
        estimator_id: null,
        estimator: null,
      }),
    ])
    const u0 = rows[0]!
    expect(u0.estimatorRows).toEqual([
      {
        estimatorKey: '__unassigned__',
        displayName: 'Unassigned',
        sentCount: 1,
        sentDollars: 250,
        bidIds: ['u0'],
      },
    ])
  })

  it('skips bids without bid_date_sent', () => {
    expect(buildBidBoardWeeklySentSummaries([minimalBid({ bid_date_sent: null })])).toEqual([])
  })

  it('lists multiple bid ids for the same estimator-week in input order', () => {
    const rows = buildBidBoardWeeklySentSummaries([
      minimalBid({
        id: 'first',
        bid_date_sent: '2026-04-28T12:00:00.000Z',
        bid_value: 100,
        outcome: null,
        estimator_id: 'u1',
        estimator: { id: 'u1', name: 'A', email: 'a@x.com' },
      }),
      minimalBid({
        id: 'second',
        bid_date_sent: '2026-04-29T12:00:00.000Z',
        bid_value: 200,
        outcome: 'won',
        estimator_id: 'u1',
        estimator: { id: 'u1', name: 'A', email: 'a@x.com' },
      }),
    ])
    const r = rows[0]!.estimatorRows[0]!
    expect(r.sentCount).toBe(2)
    expect(r.bidIds).toEqual(['first', 'second'])
  })

  it('caps number of weeks with maxWeeks', () => {
    const older = minimalBid({
      id: 'older',
      bid_date_sent: '2026-04-07T17:00:00.000Z',
      estimator_id: 'u1',
      estimator: { id: 'u1', name: 'A', email: 'a@x.com' },
    })
    const newer = minimalBid({
      id: 'newer',
      bid_date_sent: '2026-04-28T17:00:00.000Z',
      estimator_id: 'u1',
      estimator: { id: 'u1', name: 'A', email: 'a@x.com' },
    })
    const out = buildBidBoardWeeklySentSummaries([older, newer], { maxWeeks: 1 })
    expect(out).toHaveLength(1)
    expect(out[0]!.weekStart).toBe('2026-04-26')
  })

  it('default max weeks constant matches plan', () => {
    expect(BID_BOARD_WEEKLY_SENT_DEFAULT_MAX_WEEKS).toBe(26)
  })
})

function summaryWeek(
  weekStart: string,
  weekEnd: string,
  partial: Pick<BidBoardWeekSentSummary, 'won' | 'lost' | 'haventHeardBack' | 'estimatorRows'>
): BidBoardWeekSentSummary {
  return { weekStart, weekEnd, ...partial }
}

describe('buildBidBoardWeeklySentPivot', () => {
  it('returns empty pivot for empty weeks', () => {
    expect(buildBidBoardWeeklySentPivot([])).toEqual({ weeks: [], rows: [] })
  })

  it('fills zeros for estimator-week pairs with no sends', () => {
    const wNew = summaryWeek('2026-04-26', '2026-05-02', {
      won: 0,
      lost: 0,
      haventHeardBack: 1,
      estimatorRows: [
        { estimatorKey: 'u1', displayName: 'Alice', sentCount: 1, sentDollars: 100, bidIds: ['x1'] },
      ],
    })
    const wOld = summaryWeek('2026-04-19', '2026-04-25', {
      won: 1,
      lost: 0,
      haventHeardBack: 0,
      estimatorRows: [
        { estimatorKey: 'u2', displayName: 'Bob', sentCount: 2, sentDollars: 200, bidIds: ['y1', 'y2'] },
      ],
    })
    const pivot = buildBidBoardWeeklySentPivot([wNew, wOld])
    expect(pivot.weeks).toHaveLength(2)
    expect(pivot.rows).toHaveLength(2)

    const alice = pivot.rows.find((r) => r.estimatorKey === 'u1')!
    const bob = pivot.rows.find((r) => r.estimatorKey === 'u2')!

    expect(alice.byWeek['2026-04-26']).toEqual({ sentCount: 1, sentDollars: 100, bidIds: ['x1'] })
    expect(alice.byWeek['2026-04-19']).toEqual({ sentCount: 0, sentDollars: 0, bidIds: [] })
    expect(bob.byWeek['2026-04-26']).toEqual({ sentCount: 0, sentDollars: 0, bidIds: [] })
    expect(bob.byWeek['2026-04-19']).toEqual({ sentCount: 2, sentDollars: 200, bidIds: ['y1', 'y2'] })
  })

  it('sorts Unassigned last', () => {
    const wNew = summaryWeek('2026-04-26', '2026-05-02', {
      won: 0,
      lost: 0,
      haventHeardBack: 1,
      estimatorRows: [
        {
          estimatorKey: '__unassigned__',
          displayName: 'Unassigned',
          sentCount: 1,
          sentDollars: 0,
          bidIds: ['u1'],
        },
      ],
    })
    const wOld = summaryWeek('2026-04-19', '2026-04-25', {
      won: 0,
      lost: 0,
      haventHeardBack: 0,
      estimatorRows: [
        { estimatorKey: 'uZ', displayName: 'Zed', sentCount: 1, sentDollars: 50, bidIds: ['z'] },
      ],
    })
    const pivot = buildBidBoardWeeklySentPivot([wNew, wOld])
    expect(pivot.rows.map((r) => r.estimatorKey)).toEqual(['uZ', '__unassigned__'])
  })
})
