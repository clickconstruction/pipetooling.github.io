import { describe, expect, it } from 'vitest'
import { bidSentCounts, bidsAndPacketsLabel, bidsInScope, distinctBidCount, scopeLabel, withScopeLabel, type BidSentCountsBid } from './bidSentCounts'
import { gcOutcomeRowsForBid, tallyGcOutcomeRows } from './gcOutcomeRows'
import type { GcPacket } from './gcPackets'
import { buildCallQueue, classifyCallQueueOutcome, type CallQueueBid } from './callQueue'

/**
 * The fixture reproduces the afternoon the map walkers recorded (J14-F1, 2026-09-03):
 *   Dashboard "60 lost bids have no reason recorded" vs Why-we-lost "59 need a reason"  (scope)
 *   By-status "Not yet won or lost (107)"          vs Bid Board Pending 101              (unit)
 *   Why-we-lost "of 115 lost"                       vs Bid Board Lost 114                 (unit)
 *   Call queue "99 bids to chase"                   vs Waiting-to-hear "96 sent bids"     (unit)
 * and shows every pair collapsing to one number per scope through the kernel.
 */

const PLUMBING = 'st-plumbing'
const HVAC = 'st-hvac'
const NOW = '2026-09-03T18:00:00Z'
const QUIET_SENT = '2026-07-20' // > 7 days, nobody has talked to the GC
const FRESH_CONTACT = '2026-09-02T12:00:00Z'

type Fx = BidSentCountsBid & { customer_id: string; last_contact: string | null; loss_reason: string | null }

let seq = 0
function bid(over: Partial<Fx> & { outcome: string | null; bid_date_sent: string | null }): Fx {
  seq += 1
  return {
    id: `b${seq}`,
    service_type_id: PLUMBING,
    adopted_into_bid_id: null,
    working_board_archived_at: null,
    loss_category: null,
    loss_reason: null,
    bid_value: 100_000,
    customer_id: `gc-${seq % 7}`,
    last_contact: null,
    ...over,
  }
}

function packet(bidId: string, gcId: string, opts: { sentOn: string | null; outcome?: 'won' | 'lost' | null; lossCategory?: string | null }): GcPacket {
  return {
    key: gcId,
    gcId,
    name: `GC ${gcId}`,
    versions: [{ id: `${bidId}:${gcId}:v`, name: 'Base', customer_id: gcId, sort_order: 0, outcome: opts.outcome ?? null, loss_category: opts.lossCategory ?? null }],
    sentOn: opts.sentOn,
    sentValue: null,
    outcome: opts.outcome ?? null,
  }
}

function buildFixture() {
  seq = 0
  const bids: Fx[] = []
  const packetsByBid: Record<string, GcPacket[]> = {}

  // --- Pending (Plumbing): 101 bids → 107 per-GC rows.
  // 93 single-GC pending bids needing a chase (quiet since July, never contacted).
  for (let i = 0; i < 93; i++) bids.push(bid({ outcome: null, bid_date_sent: QUIET_SENT }))
  // 1 single-GC pending bid, fresh.
  bids.push(bid({ outcome: null, bid_date_sent: '2026-08-30', last_contact: FRESH_CONTACT }))
  // 3 two-GC pending bids, both packets quiet → 3 bids but 6 chase rows.
  for (let i = 0; i < 3; i++) {
    const b = bid({ outcome: null, bid_date_sent: QUIET_SENT })
    bids.push(b)
    packetsByBid[b.id] = [packet(b.id, 'gc-a', { sentOn: QUIET_SENT }), packet(b.id, 'gc-b', { sentOn: QUIET_SENT })]
  }
  // 3 two-GC pending bids, fresh (contacted yesterday) → 3 bids, 6 pending rows, 0 chase rows.
  for (let i = 0; i < 3; i++) {
    const b = bid({ outcome: null, bid_date_sent: '2026-08-28', last_contact: FRESH_CONTACT })
    bids.push(b)
    packetsByBid[b.id] = [packet(b.id, 'gc-a', { sentOn: '2026-08-28' }), packet(b.id, 'gc-b', { sentOn: '2026-08-28' })]
  }
  // 1 pending bid whose second GC already said no, reason recorded (the v2.2164 Bids-by-GC
  // case): the bid is still open, but a lens draws one pending row AND one lost row for it
  // (115 vs 114). Its reason is on the packet, so the "need a reason" pair reads 59 both ways.
  {
    const b = bid({ outcome: null, bid_date_sent: '2026-08-28', last_contact: FRESH_CONTACT })
    bids.push(b)
    packetsByBid[b.id] = [packet(b.id, 'gc-a', { sentOn: '2026-08-28' }), packet(b.id, 'gc-b', { sentOn: '2026-08-28', outcome: 'lost', lossCategory: 'price' })]
  }

  // --- Lost (Plumbing): 114 bids, 59 with no reason recorded.
  for (let i = 0; i < 59; i++) bids.push(bid({ outcome: 'lost', bid_date_sent: '2026-06-01', loss_category: null }))
  for (let i = 0; i < 55; i++) bids.push(bid({ outcome: 'lost', bid_date_sent: '2026-06-01', loss_category: 'price' }))

  // --- Won / started / unsent (Plumbing) — present so the pile is a real board.
  for (let i = 0; i < 26; i++) bids.push(bid({ outcome: 'won', bid_date_sent: '2026-05-01' }))
  for (let i = 0; i < 10; i++) bids.push(bid({ outcome: 'started_or_complete', bid_date_sent: '2026-04-01' }))
  for (let i = 0; i < 17; i++) bids.push(bid({ outcome: null, bid_date_sent: null }))
  // An archived working bid leaves the Unsent pile (the board's rule), but is still a bid in scope.
  bids.push(bid({ outcome: null, bid_date_sent: null, working_board_archived_at: '2026-08-01T00:00:00Z' }))

  // --- HVAC: the one lost bid with no reason that makes the company-wide card read 60.
  bids.push(bid({ outcome: 'lost', bid_date_sent: '2026-07-01', service_type_id: HVAC, loss_category: null, bid_value: 14_879 }))

  // --- Adopted into another bid's package: leaves every list (v2.2133) — and now every count.
  bids.push(bid({ outcome: 'lost', bid_date_sent: '2026-07-01', adopted_into_bid_id: 'b1', loss_category: null }))

  return { bids, packetsByBid }
}

/** What the lenses drew before the kernel: one row per GC packet. */
function lensRows(bids: Fx[], packetsByBid: Record<string, GcPacket[]>) {
  return bids.flatMap((b) =>
    gcOutcomeRowsForBid(
      { id: b.id, outcome: b.outcome, bid_date_sent: b.bid_date_sent, bid_value: b.bid_value ?? null, loss_category: b.loss_category, loss_reason: b.loss_reason },
      { key: b.customer_id, name: b.customer_id },
      packetsByBid[b.id],
    ).map((row) => ({ bid: b, row })),
  )
}

describe('bidSentCounts — the five doors collapse to one number per scope', () => {
  const { bids, packetsByBid } = buildFixture()
  const plumbing = bids.filter((b) => b.service_type_id === PLUMBING && !b.adopted_into_bid_id)
  const tradeScope = { kind: 'trade' as const, tradeId: PLUMBING, tradeName: 'Plumbing' }
  const counts = bidSentCounts(bids, { scope: tradeScope, packetsByBid })
  const allTrades = bidSentCounts(bids, { scope: { kind: 'all' }, packetsByBid })

  it('reproduces the per-packet rows the lenses used to count (107 pending · 115 lost)', () => {
    const rows = lensRows(plumbing, packetsByBid).map((r) => r.row)
    const tally = tallyGcOutcomeRows(rows)
    expect(tally.pending).toBe(107)
    expect(tally.lost).toBe(115)
  })

  it('Bid Board pills · By-status headers: 101 waiting and 114 lost — per bid, Plumbing', () => {
    expect(counts.waiting).toBe(101)
    expect(counts.lost).toBe(114)
    expect(counts.won).toBe(26)
    expect(counts.started).toBe(10)
    expect(counts.unsent).toBe(17) // the archived working bid is not on the Unsent pile
    expect(counts.bids).toBe(plumbing.length)
    // The packet figure survives as the secondary number the lens header prints.
    expect(counts.packetRows).toBe(plumbing.length + 7) // 7 two-GC bids add one row each
    expect(bidsAndPacketsLabel(counts.waiting, 107)).toBe('101 bids · 107 GC packets')
  })

  it('Dashboard card vs Why-we-lost lens: 60 across all trades, 59 in Plumbing — same rule, labelled scope', () => {
    expect(allTrades.lostNeedingReason).toBe(60)
    expect(counts.lostNeedingReason).toBe(59)
    expect(allTrades.lostNeedingReason - counts.lostNeedingReason).toBe(1) // the HVAC pill's "1 of 1"
    expect(withScopeLabel(`${allTrades.lostNeedingReason} lost bids have no reason recorded`, { kind: 'all' })).toBe(
      '60 lost bids have no reason recorded · all trades',
    )
    expect(withScopeLabel(`${counts.lostNeedingReason} need a reason`, tradeScope)).toBe('59 need a reason · Plumbing')
    expect(allTrades.lostNeedingReasonValue).toBe(59 * 100_000 + 14_879)
  })

  it('Call queue vs Waiting to hear: 99 chase rows are 96 bids', () => {
    const queueRows: CallQueueBid[] = lensRows(plumbing, packetsByBid).map(({ bid: b, row }) => ({
      id: b.id,
      builderKey: row.gcKey,
      builderName: row.gcName,
      phone: null,
      value: row.value,
      outcome: row.outcome,
      sentIso: row.sentOn ?? b.bid_date_sent,
      lastContactIso: b.last_contact,
      lossCategory: row.lossCategory,
      hasTab: false,
    }))
    const { totals } = buildCallQueue(queueRows, NOW)
    expect(totals.chasePacketRows).toBe(99) // what the headline used to say
    expect(totals.chaseCount).toBe(96) // what it says now — the bid count Waiting-to-hear always had
    expect(totals.reasonsCount).toBe(59)
    expect(bidsAndPacketsLabel(totals.chaseCount, totals.chasePacketRows)).toBe('96 bids · 99 GC packets')
    // The single-GC classifier agrees with the pile rule for every bid in the fixture.
    for (const b of plumbing) {
      const k = classifyCallQueueOutcome(b)
      if (k === 'pending') expect(b.bid_date_sent).not.toBeNull()
    }
  })

  it('a bid with 3 GC packets is one sent bid; the packets are a sub-count', () => {
    const b = bid({ outcome: null, bid_date_sent: '2026-08-01' })
    const three = [packet(b.id, 'x', { sentOn: '2026-08-01' }), packet(b.id, 'y', { sentOn: '2026-08-02' }), packet(b.id, 'z', { sentOn: '2026-08-03' })]
    const c = bidSentCounts([b], { scope: { kind: 'all' }, packetsByBid: { [b.id]: three } })
    expect(c.sent).toBe(1)
    expect(c.waiting).toBe(1)
    expect(c.packetsSent).toBe(3)
    expect(c.packetRows).toBe(3)
  })

  it('"Also sent to" shared letters ride the bid — they are not packets', () => {
    const b = bid({ outcome: null, bid_date_sent: '2026-08-01' })
    const shared: GcPacket = { ...packet(b.id, 'y', { sentOn: '2026-08-01' }), key: 'shared:y', versions: [], sharedLetter: true }
    const c = bidSentCounts([b], { scope: { kind: 'all' }, packetsByBid: { [b.id]: [packet(b.id, 'x', { sentOn: '2026-08-01' }), shared] } })
    expect(c.packetsSent).toBe(1)
    expect(c.packetRows).toBe(1)
  })

  it('Package & Send (a teammate got the pricing table) never makes a bid sent', () => {
    // The kernel has no input for bid_pricing_package_sends: a bid with any number of teammate
    // shares and no sent date is unsent — by construction, not by filter.
    const b = { ...bid({ outcome: null, bid_date_sent: null }), packageSends: 4 }
    const c = bidSentCounts([b], { scope: { kind: 'all' } })
    expect(c.sent).toBe(0)
    expect(c.unsent).toBe(1)
    expect(c.waiting).toBe(0)
  })

  it('adopted bids leave every count, in every scope', () => {
    expect(bidsInScope(bids, { kind: 'all' }).some((b) => b.adopted_into_bid_id)).toBe(false)
    expect(allTrades.lost).toBe(115) // 114 Plumbing + 1 HVAC; the adopted lost bid is not a 116th
  })

  it('scope labels', () => {
    expect(scopeLabel({ kind: 'all' })).toBe('all trades')
    expect(scopeLabel(tradeScope)).toBe('Plumbing')
    expect(scopeLabel({ kind: 'trade', tradeId: 'x' })).toBe('this trade')
    expect(scopeLabel({ kind: 'trade', tradeId: 'x', tradeName: '  ' })).toBe('this trade')
  })

  it('bidsAndPacketsLabel collapses when nothing is multi-GC', () => {
    expect(bidsAndPacketsLabel(5, 5)).toBe('5 bids')
    expect(bidsAndPacketsLabel(1, 1)).toBe('1 bid')
    expect(bidsAndPacketsLabel(1, 2)).toBe('1 bid · 2 GC packets')
    expect(bidsAndPacketsLabel(3, 0, 'still open')).toBe('3 still open')
    expect(bidsAndPacketsLabel(1, 1, { one: 'loss', many: 'losses' })).toBe('1 loss')
    expect(bidsAndPacketsLabel(2, 3, { one: 'loss', many: 'losses' })).toBe('2 losses · 3 GC packets')
  })

  it('distinctBidCount folds per-GC rows back to bids', () => {
    expect(distinctBidCount([{ bidId: 'a' }, { bidId: 'a' }, { bidId: 'b' }, { id: 'c' }])).toBe(3)
  })
})
