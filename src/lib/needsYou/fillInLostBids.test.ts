import { describe, expect, it } from 'vitest'
import { EMPTY_LOST_BID_DECISION, lostBidDecisionReady, lostBidFillInRows, lostBidKnows, lostBidTrailWords, lostBidWrites, type LostBidSource } from './fillInLostBids'

const bid = (p: Partial<LostBidSource> = {}): LostBidSource => ({
  id: 'bid-1',
  bid_number: '412',
  project_name: 'Oak Street clinic',
  customer_id: 'gc-1',
  bid_value: 84_300,
  outcome: 'lost',
  outcome_at: '2026-09-30T15:00:00Z',
  bid_date_sent: '2026-08-14T15:00:00Z',
  last_contact: '2026-09-22T15:00:00Z',
  loss_category: null,
  loss_reason: null,
  adopted_into_bid_id: null,
  customers: { name: 'Ridgeway Builders' },
  bids_gc_builders: null,
  ...p,
})

describe('fillInLostBids · the rows (punch list #146)', () => {
  it('keeps the Why we lost lens’s rows: lost, no category, not adopted; marked lost the same day, the biggest first', () => {
    const rows = lostBidFillInRows([
      bid({ id: 'small', bid_value: 1_000 }),
      bid({ id: 'won', outcome: 'won' }),
      bid({ id: 'done', loss_category: 'price' }),
      bid({ id: 'legacy', loss_category: 'something typed by hand' }),
      bid({ id: 'adopted', adopted_into_bid_id: 'other' }),
      bid({ id: 'big', bid_value: '90000' }),
      bid({ id: 'none', bid_value: null }),
    ])
    expect(rows.map((r) => r.bidId)).toEqual(['big', 'legacy', 'small', 'none'])
  })

  it('runs oldest first (v2.6754, punch list #176): marked lost longest ago, then sent longest ago, a bid with no date after those with one', () => {
    const rows = lostBidFillInRows([
      bid({ id: 'lost-oct', outcome_at: '2026-10-20T15:00:00Z', bid_value: 500_000 }),
      bid({ id: 'lost-aug', outcome_at: '2026-08-02T15:00:00Z', bid_value: 1_000 }),
      bid({ id: 'no-stamp-sent-july', outcome_at: null, bid_date_sent: '2026-07-01T15:00:00Z' }),
      bid({ id: 'no-stamp-sent-sept', outcome_at: null, bid_date_sent: '2026-09-01T15:00:00Z', bid_value: 900_000 }),
      bid({ id: 'no-dates', outcome_at: null, bid_date_sent: null }),
      bid({ id: 'lost-aug-too', outcome_at: '2026-08-02T15:00:00Z', bid_value: 2_000 }),
    ])
    expect(rows.map((r) => r.bidId)).toEqual(['lost-aug-too', 'lost-aug', 'lost-oct', 'no-stamp-sent-july', 'no-stamp-sent-sept', 'no-dates'])
    expect(rows[0]!.lostAtMs).toBe(Date.parse('2026-08-02T15:00:00Z'))
    expect(rows[3]!.lostAtMs).toBeNull()
    expect(rows[3]!.sentAtMs).toBe(Date.parse('2026-07-01T15:00:00Z'))
  })

  it('titles the row as the Needs you lines say a bid, and reads the GC from the customer or the builder', () => {
    const [r] = lostBidFillInRows([bid()])
    expect(r!.title).toBe('b412 Oak Street clinic · Ridgeway Builders · $84,300')
    expect(r!.key).toBe('lost-bid:bid-1')
    expect(r!.doorHref).toBe('/bids?tab=bid-board&bidId=bid-1')
    const [b] = lostBidFillInRows([bid({ customers: null, bids_gc_builders: { name: 'Halvorsen Commercial' }, bid_number: null, project_name: '', bid_value: null })])
    expect(b!.title).toBe('a bid no project name · Halvorsen Commercial')
  })

  it('says what the app knows in short sentences', () => {
    expect(lostBidKnows(bid())).toEqual(['Marked lost on Sep 30.', 'Bid went out Aug 14.', 'Last contact: Sep 22.'])
    expect(lostBidKnows(bid({ last_contact: '2026-08-01T00:00:00Z' }))).toEqual(['Marked lost on Sep 30.', 'Bid went out Aug 14.', 'No contact recorded since it went out.'])
    expect(lostBidKnows(bid({ outcome_at: null, bid_date_sent: null, last_contact: null, loss_reason: ' too high ' }))).toEqual(['A note already says: too high'])
  })

  it('writes the lens’s patch, and a contact-log entry only when someone was talked to', () => {
    const [row] = lostBidFillInRows([bid({ loss_reason: 'old note' })])
    const ctx = { userId: 'u-1', nowIso: '2026-10-23T16:00:00Z' }
    expect(lostBidWrites(row!, EMPTY_LOST_BID_DECISION, ctx)).toBeNull()
    expect(lostBidDecisionReady(EMPTY_LOST_BID_DECISION)).toBe(false)
    const quiet = lostBidWrites(row!, { category: 'price', said: '', who: '' }, ctx)!
    expect(quiet.patch).toEqual({ loss_category: 'price', loss_reason: 'old note' })
    expect(quiet.entry).toBeNull()
    const talked = lostBidWrites(row!, { category: 'price', said: 'about 8 percent under us', who: 'Dale Brennan' }, ctx)!
    expect(talked.patch).toEqual({ loss_category: 'price', loss_reason: 'about 8 percent under us' })
    expect(talked.entry).toEqual({
      bid_id: 'bid-1',
      gc_customer_id: 'gc-1',
      contact_method: null,
      notes: 'Reason recorded on Quickfill — Price too high: about 8 percent under us. Talked to Dale Brennan.',
      occurred_at: ctx.nowIso,
      created_by: 'u-1',
    })
    expect(lostBidTrailWords('price', true)).toBe('Price too high · the Why we lost lens and the contact log have it')
    expect(lostBidTrailWords('no_answer', false)).toBe('No answer · the Why we lost lens has it')
  })
})
