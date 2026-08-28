import { describe, expect, it } from 'vitest'
import { buildCallSessionWrites, callSessionAskPrompt, callSessionOutcomeLabel, nextFollowupQuickPickIso, type CallSessionBidDecision } from './builderCallSession'
import { compareCustomersForCallQueue, nextFollowupBadge } from './callQueueOrdering'

const NOW = '2026-08-04T17:00:00Z'

function decision(partial: Partial<CallSessionBidDecision> & { bidId: string }): CallSessionBidDecision {
  return { outcome: null, note: '', lossReason: '', lossCategory: null, ...partial }
}

describe('buildCallSessionWrites', () => {
  it('writes one contact, and entries/stamps only for touched bids', () => {
    const w = buildCallSessionWrites({
      customerId: 'c1',
      userId: 'u1',
      nowIso: NOW,
      summary: 'Ravi: Regan decision next week',
      decisions: [
        decision({ bidId: 'b1', outcome: 'still_pending', note: 'decision next week' }),
        decision({ bidId: 'b2' }), // untouched
        decision({ bidId: 'b3', outcome: 'lost', lossReason: 'price' }),
      ],
    })
    expect(w.customerContact.details).toBe('Ravi: Regan decision next week')
    expect(w.customerContact.contact_method).toBe('Phone')
    expect(w.bidEntries.map((e) => e.bid_id)).toEqual(['b1', 'b3'])
    expect(w.bidEntries[0]?.notes).toBe('Still pending. decision next week')
    expect(w.bidEntries[1]?.notes).toBe('Marked lost on call — price')
    expect(w.bidOutcomeUpdates).toEqual([{ bidId: 'b3', outcome: 'lost', loss_reason: 'price', loss_category: null }])
  })

  it('lost taps carry the structured category; the entry note folds category and detail together', () => {
    const w = buildCallSessionWrites({
      customerId: 'c1',
      userId: 'u1',
      nowIso: NOW,
      summary: '',
      decisions: [decision({ bidId: 'b1', outcome: 'lost', lossCategory: 'price', lossReason: '6 grand over' })],
    })
    expect(w.bidOutcomeUpdates).toEqual([{ bidId: 'b1', outcome: 'lost', loss_reason: '6 grand over', loss_category: 'price' }])
    expect(w.bidEntries[0]?.notes).toBe('Marked lost on call — Price too high: 6 grand over')
  })

  it('a note alone counts as touched; won taps update outcome with no loss reason', () => {
    const w = buildCallSessionWrites({
      customerId: 'c1',
      userId: 'u1',
      nowIso: NOW,
      summary: '',
      decisions: [decision({ bidId: 'b1', note: 'sent revised scope' }), decision({ bidId: 'b2', outcome: 'won' })],
    })
    expect(w.customerContact.details).toBe('Call session — 2 bids reviewed')
    expect(w.bidEntries[0]?.notes).toBe('sent revised scope')
    expect(w.bidOutcomeUpdates).toEqual([{ bidId: 'b2', outcome: 'won', loss_reason: null, loss_category: null }])
  })

  it('won taps clear any category picked before the caller flipped to won', () => {
    const w = buildCallSessionWrites({
      customerId: 'c1',
      userId: 'u1',
      nowIso: NOW,
      summary: '',
      decisions: [decision({ bidId: 'b1', outcome: 'won', lossCategory: 'price' })],
    })
    expect(w.bidOutcomeUpdates).toEqual([{ bidId: 'b1', outcome: 'won', loss_reason: null, loss_category: null }])
  })

  it('rebid taps log an entry but never change outcome', () => {
    const w = buildCallSessionWrites({ customerId: 'c1', userId: 'u1', nowIso: NOW, summary: 's', decisions: [decision({ bidId: 'b1', outcome: 'rebid' })] })
    expect(w.bidEntries[0]?.notes).toBe('Rebid / RFQ requested')
    expect(w.bidOutcomeUpdates).toEqual([])
  })
})

describe('callSessionOutcomeLabel', () => {
  it('labels each outcome, with loss reason folded in', () => {
    expect(callSessionOutcomeLabel({ outcome: 'lost', lossReason: '  ', lossCategory: null })).toBe('Marked lost on call')
    expect(callSessionOutcomeLabel({ outcome: null, lossReason: '', lossCategory: null })).toBe('')
  })

  it('folds category alone, and category + detail, into the label', () => {
    expect(callSessionOutcomeLabel({ outcome: 'lost', lossReason: '', lossCategory: 'gc_lost' })).toBe(
      'Marked lost on call — GC lost the project',
    )
    expect(callSessionOutcomeLabel({ outcome: 'lost', lossReason: 'went cheap', lossCategory: 'price' })).toBe(
      'Marked lost on call — Price too high: went cheap',
    )
  })
})

describe('nextFollowupQuickPickIso', () => {
  it('lands at 8am local N days ahead', () => {
    const base = new Date(2026, 7, 4, 16, 30) // Aug 4 local
    const iso = nextFollowupQuickPickIso('next-week', base)
    const d = new Date(iso)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 7, 11, 8])
  })
})

describe('compareCustomersForCallQueue', () => {
  const nowMs = new Date(NOW).getTime()
  const lastContact = new Map([
    ['stale', '2026-02-01T00:00:00Z'],
    ['fresh', '2026-08-01T00:00:00Z'],
    ['overdue', '2026-08-03T00:00:00Z'],
    ['promisedLater', '2026-01-01T00:00:00Z'],
  ])
  const promises = { overdue: '2026-08-03T08:00:00Z', promisedLater: '2026-08-11T08:00:00Z' }
  const c = (id: string) => ({ id, name: id })

  it('bands: overdue promises, then staleness, then future promises', () => {
    const sorted = [c('fresh'), c('promisedLater'), c('overdue'), c('stale')].sort((a, b) =>
      compareCustomersForCallQueue(a, b, lastContact, promises, nowMs),
    )
    expect(sorted.map((x) => x.id)).toEqual(['overdue', 'stale', 'fresh', 'promisedLater'])
  })

  it('future promises order by due date even when contact is ancient', () => {
    const p = { a: '2026-08-20T08:00:00Z', b: '2026-08-10T08:00:00Z' }
    const sorted = [c('a'), c('b')].sort((x, y) => compareCustomersForCallQueue(x, y, new Map(), p, nowMs))
    expect(sorted.map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('nextFollowupBadge', () => {
  const nowMs = new Date(NOW).getTime()
  it('labels the due date and flags overdue', () => {
    expect(nextFollowupBadge('2026-08-03T08:00:00Z', nowMs)).toEqual({ label: 'follow-up due 8/3', overdue: true })
    expect(nextFollowupBadge('2026-08-11T08:00:00Z', nowMs)?.overdue).toBe(false)
    expect(nextFollowupBadge(undefined, nowMs)).toBeNull()
    expect(nextFollowupBadge('garbage', nowMs)).toBeNull()
  })
})

describe('bid tabs on the call (v2.2103)', () => {
  const TAB = { low: 230_000, high: 310_000, rankFromLow: 2, bidderCount: 6 }

  it('a tab alone makes the bid touched; patch + note line come along', () => {
    const w = buildCallSessionWrites({
      customerId: 'c1',
      userId: 'u1',
      nowIso: NOW,
      summary: '',
      decisions: [decision({ bidId: 'b1', tab: TAB, bidValue: 274_249 })],
    })
    expect(w.bidEntries).toHaveLength(1)
    expect(w.bidEntries[0]!.notes).toMatch(/^Bid tab recorded — low \$230,000/)
    expect(w.bidEntries[0]!.notes).toContain('19% over the low')
    expect(w.bidTabUpdates).toEqual([
      { bidId: 'b1', patch: { bid_tab_low: 230_000, bid_tab_high: 310_000, bid_tab_rank_from_low: 2, bid_tab_bidder_count: 6 } },
    ])
  })

  it('tab line stacks with an outcome and a note', () => {
    const w = buildCallSessionWrites({
      customerId: 'c1',
      userId: 'u1',
      nowIso: NOW,
      summary: '',
      decisions: [decision({ bidId: 'b1', outcome: 'still_pending', note: 'deciding friday', tab: TAB, bidValue: 274_249 })],
    })
    expect(w.bidEntries[0]!.notes).toMatch(/^Still pending\. Bid tab recorded — .*\. deciding friday$/)
  })

  it('empty tab values write nothing', () => {
    const w = buildCallSessionWrites({
      customerId: 'c1',
      userId: 'u1',
      nowIso: NOW,
      summary: '',
      decisions: [decision({ bidId: 'b1', tab: { low: null, high: null, rankFromLow: null, bidderCount: null } })],
    })
    expect(w.bidEntries).toHaveLength(0)
    expect(w.bidTabUpdates).toHaveLength(0)
  })
})

describe('callSessionAskPrompt', () => {
  it('never contacted since sending → the full opener', () => {
    expect(callSessionAskPrompt({ sentIso: '2026-07-17', lastContactIso: null, hasTab: false, nowIso: NOW })).toMatch(/did our number land/)
    expect(callSessionAskPrompt({ sentIso: '2026-07-17', lastContactIso: '2026-07-01T00:00:00Z', hasTab: false, nowIso: NOW })).toMatch(/did our number land/)
  })

  it('contacted but no tab after 21 days → the tab ask; fresh sends stay quiet', () => {
    expect(callSessionAskPrompt({ sentIso: '2026-07-01', lastContactIso: '2026-07-20T00:00:00Z', hasTab: false, nowIso: NOW })).toBe(
      'ask: can we get the bid tab?',
    )
    expect(callSessionAskPrompt({ sentIso: '2026-08-01', lastContactIso: '2026-08-03T00:00:00Z', hasTab: false, nowIso: NOW })).toBeNull()
  })

  it('tab on file or never sent → nothing to ask', () => {
    expect(callSessionAskPrompt({ sentIso: '2026-07-01', lastContactIso: '2026-07-20T00:00:00Z', hasTab: true, nowIso: NOW })).toBeNull()
    expect(callSessionAskPrompt({ sentIso: null, lastContactIso: null, hasTab: false, nowIso: NOW })).toBeNull()
  })
})
