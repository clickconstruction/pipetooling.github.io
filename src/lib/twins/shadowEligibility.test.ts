import { describe, expect, it } from 'vitest'
import {
  bidRef,
  buildShadowQueue,
  HELD_REASONS,
  isRobotCopyName,
  isShadowShellName,
  ROUND_ORPHAN_MINUTES,
  SHADOW_LOOKBACK_DAYS,
  SHADOW_STALE_DUE_DAYS,
  shadowHold,
  shadowHoldWords,
  shellHold,
  shellHoldWords,
  ymdMinusDays,
  type ShadowCandidateBid,
  type ShadowHoldReason,
  type ShadowRuleContext,
  type ShadowRunStatus,
} from '../../../supabase/functions/_shared/shadowEligibility'
import { plainWordsFailures } from '../plainWords'

const PLUMBING = 'st-plumbing'
const NOW = Date.parse('2026-10-23T00:10:00Z')
const TODAY = '2026-10-22'

const bid = (over: Partial<ShadowCandidateBid> & { id: string }): ShadowCandidateBid => ({
  bid_number: over.id.replace(/\D/g, '') || '1',
  project_name: 'Dalmoros',
  plans_link: 'https://drive/plans',
  service_type_id: PLUMBING,
  bid_due_date: '2026-10-28',
  bid_date_sent: null,
  outcome: null,
  created_at: '2026-10-19T12:00:00Z',
  robot_requested_at: null,
  robot_opt_out: false,
  plans_robot_readable: true,
  working_board_archived_at: null,
  ...over,
})

const ctx = (runs: Record<string, ShadowRunStatus> = {}, over: Partial<ShadowRuleContext> = {}): ShadowRuleContext => ({
  plumbingServiceTypeId: PLUMBING,
  nowMs: NOW,
  todayYmd: TODAY,
  runStatusFor: (id) => runs[id] ?? null,
  ...over,
})

describe('shadowHold · the four Ready bids of 2026-10-23 are claimable by the one rule', () => {
  it('b515 Dalmoros, b521 O’Reilly, b516 Take 5 (no due date, no GC) and b510 after its shell was voided', () => {
    const runs: Record<string, ShadowRunStatus> = { b510: 'void' }
    expect(shadowHold(bid({ id: 'b515' }), ctx(runs))).toBeNull()
    expect(shadowHold(bid({ id: 'b521', created_at: '2026-10-22T20:00:00Z', bid_due_date: '2026-11-04' }), ctx(runs))).toBeNull()
    expect(shadowHold(bid({ id: 'b516', bid_due_date: null, created_at: '2026-10-20T12:00:00Z' }), ctx(runs))).toBeNull()
    expect(shadowHold(bid({ id: 'b510', created_at: '2026-10-13T12:00:00Z', bid_due_date: '2026-11-03' }), ctx(runs))).toBeNull()
  })

  it('a voided run ends that shell, not the bid; an open, locked or scored run covers it', () => {
    expect(shadowHold(bid({ id: 'x' }), ctx({ x: 'void' }))).toBeNull()
    expect(shadowHold(bid({ id: 'x' }), ctx({ x: 'open' }))).toBe('has_shadow')
    expect(shadowHold(bid({ id: 'x' }), ctx({ x: 'locked' }))).toBe('has_shadow')
    expect(shadowHold(bid({ id: 'x' }), ctx({ x: 'scored' }))).toBe('has_shadow')
  })

  it('what ends the bid for robots comes first: a robot copy, sent, decided, archived', () => {
    expect(shadowHold(bid({ id: 'x', project_name: 'ZZ Shadow DALMOROS', bid_date_sent: '2026-10-01' }), ctx())).toBe('robot_copy')
    expect(shadowHold(bid({ id: 'x', bid_date_sent: '2026-10-05', outcome: 'lost' }), ctx())).toBe('sent')
    expect(shadowHold(bid({ id: 'x', outcome: 'lost' }), ctx())).toBe('decided')
    expect(shadowHold(bid({ id: 'x', outcome: '' }), ctx())).toBeNull()
    expect(shadowHold(bid({ id: 'x', working_board_archived_at: '2026-10-01T00:00:00Z' }), ctx())).toBe('archived')
  })

  it('then what a person decided or can fix: left to a person, the division, the plans', () => {
    expect(shadowHold(bid({ id: 'x', robot_opt_out: true }), ctx())).toBe('opted_out')
    expect(shadowHold(bid({ id: 'x', service_type_id: null }), ctx())).toBe('no_service_type')
    expect(shadowHold(bid({ id: 'x', service_type_id: 'st-electrical' }), ctx())).toBe('not_plumbing')
    expect(shadowHold(bid({ id: 'x', service_type_id: 'st-electrical' }), ctx({}, { plumbingServiceTypeId: null }))).toBeNull()
    expect(shadowHold(bid({ id: 'x', plans_link: '  ' }), ctx())).toBe('no_plans')
    expect(shadowHold(bid({ id: 'x', plans_robot_readable: false }), ctx())).toBe('plans_unreadable')
    expect(shadowHold(bid({ id: 'x', plans_robot_readable: null }), ctx())).toBeNull()
  })

  it('then time: a due date 30 days gone is stale; an unrequested bid over 30 days old is left alone; a request has no age', () => {
    expect(shadowHold(bid({ id: 'x', bid_due_date: '2026-09-21' }), ctx())).toBe('stale_due')
    expect(shadowHold(bid({ id: 'x', bid_due_date: '2026-09-22' }), ctx())).toBeNull()
    expect(shadowHold(bid({ id: 'x', created_at: '2026-09-20T12:00:00Z' }), ctx())).toBe('too_old')
    expect(shadowHold(bid({ id: 'x', created_at: '2026-09-24T12:00:00Z' }), ctx())).toBeNull()
    expect(shadowHold(bid({ id: 'x', created_at: '2026-06-01T12:00:00Z', robot_requested_at: '2026-10-22T00:00:00Z' }), ctx())).toBeNull()
    expect(shadowHold(bid({ id: 'x', created_at: null }), ctx())).toBeNull()
    expect(shadowHold(bid({ id: 'x', created_at: '2026-10-01T12:00:00Z' }), ctx({}, { lookbackDays: 14 }))).toBe('too_old')
  })
})

describe('shadowHoldWords', () => {
  const reasons: ShadowHoldReason[] = ['robot_copy', 'sent', 'decided', 'archived', 'opted_out', 'no_service_type', 'not_plumbing', 'no_plans', 'plans_unreadable', 'has_shadow', 'stale_due', 'too_old']
  it('every reason is one plain sentence', () => {
    for (const r of reasons) {
      const words = shadowHoldWords(r)
      expect(words.endsWith('.')).toBe(true)
      expect(plainWordsFailures(words)).toEqual([])
    }
  })
  it('the day counts follow the rule’s numbers', () => {
    expect(shadowHoldWords('too_old')).toBe(`Made over ${SHADOW_LOOKBACK_DAYS} days ago and nobody asked.`)
    expect(shadowHoldWords('stale_due', { staleDueDays: 45 })).toBe('Its due date passed over 45 days ago.')
  })
  it('the Held list carries live plumbing bids a person expects a robot on, not other trades, sent or covered bids (v2.5755)', () => {
    expect([...HELD_REASONS].sort()).toEqual(['opted_out', 'plans_unreadable', 'stale_due', 'too_old'])
  })
})

describe('buildShadowQueue', () => {
  it('requested oldest ask first, then ready by due date then age, then held with words; the top row is the next claim', () => {
    const q = buildShadowQueue(
      [
        bid({ id: 'later-due', bid_due_date: '2026-11-04' }),
        bid({ id: 'no-due', bid_due_date: null, created_at: '2026-10-20T00:00:00Z' }),
        bid({ id: 'no-due-older', bid_due_date: null, created_at: '2026-10-15T00:00:00Z' }),
        bid({ id: 'sooner-due', bid_due_date: '2026-10-28' }),
        bid({ id: 'asked-late', robot_requested_at: '2026-10-22T10:00:00Z' }),
        bid({ id: 'asked-early', robot_requested_at: '2026-10-21T10:00:00Z' }),
        bid({ id: 'old', created_at: '2026-09-01T00:00:00Z' }),
        bid({ id: 'elec', service_type_id: 'st-electrical' }),
        bid({ id: 'covered' }),
        bid({ id: 'sent', bid_date_sent: '2026-10-01' }),
        bid({ id: 'no-plans', plans_link: null }),
      ],
      ctx({ covered: 'open' }),
    )
    expect(q.requested.map((b) => b.id)).toEqual(['asked-early', 'asked-late'])
    expect(q.ready.map((b) => b.id)).toEqual(['sooner-due', 'later-due', 'no-due-older', 'no-due'])
    // Another trade's bid is not the robots' work: neither ready nor held.
    expect(q.held.map((h) => [h.bid.id, h.reason])).toEqual([['old', 'too_old']])
    expect(q.held[0]!.words).toBe('Made over 30 days ago and nobody asked.')
  })

  it('an empty board is three empty lists', () => {
    expect(buildShadowQueue([], ctx())).toEqual({ requested: [], ready: [], held: [] })
  })
})

describe('shellHold · what the server tells a round about its own shells', () => {
  const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString()
  it('void, locked, scored, or a sent reference: closed', () => {
    expect(shellHold({ status: 'void', referenceSent: false, parked: false, lastWordAt: at(1) }, NOW)).toBe('closed')
    expect(shellHold({ status: 'locked', referenceSent: false, parked: false, lastWordAt: at(1) }, NOW)).toBe('closed')
    expect(shellHold({ status: 'scored', referenceSent: true, parked: false, lastWordAt: null }, NOW)).toBe('closed')
    expect(shellHold({ status: 'open', referenceSent: true, parked: false, lastWordAt: at(60)}, NOW)).toBe('closed')
  })
  it('open and parked on a plans ask: parked, however long ago the word was', () => {
    expect(shellHold({ status: 'open', referenceSent: false, parked: true, lastWordAt: at(60 * 24 * 23) }, NOW)).toBe('parked')
  })
  it('open with a word inside 15 minutes: in another round’s hands; past it: orphaned', () => {
    expect(shellHold({ status: 'open', referenceSent: false, parked: false, lastWordAt: at(3) }, NOW)).toBe('in_hand')
    expect(shellHold({ status: 'open', referenceSent: false, parked: false, lastWordAt: at(ROUND_ORPHAN_MINUTES) }, NOW)).toBe('in_hand')
    expect(shellHold({ status: 'open', referenceSent: false, parked: false, lastWordAt: at(16) }, NOW)).toBe('orphaned')
    expect(shellHold({ status: 'open', referenceSent: false, parked: false, lastWordAt: null }, NOW)).toBe('orphaned')
  })
  it('a bid with no run is not a shell, unless it is named one: then it is residue, closed (b493, 2026-10-23)', () => {
    expect(shellHold({ status: null, referenceSent: false, parked: false, lastWordAt: null }, NOW)).toBeNull()
    expect(shellHold({ status: null, namedShadow: true, referenceSent: false, parked: true, lastWordAt: at(1) }, NOW)).toBe('closed')
    expect(isShadowShellName('ZZ Shadow SECOND RODEO BREWING')).toBe(true)
    expect(isShadowShellName('ZZ Twin PALMER WINERY (backtest)')).toBe(false)
  })
  it('a parked shell stays parked though its own round just spoke on it, so it never reads as in hand', () => {
    expect(shellHold({ status: 'open', referenceSent: false, parked: true, lastWordAt: at(1) }, NOW)).toBe('parked')
  })
  it('the words are plain', () => {
    for (const h of ['closed', 'parked', 'in_hand', 'orphaned'] as const) expect(plainWordsFailures(shellHoldWords(h))).toEqual([])
  })
})

describe('helpers', () => {
  it('isRobotCopyName, ymdMinusDays, bidRef', () => {
    expect(isRobotCopyName('ZZ Shadow X')).toBe(true)
    expect(isRobotCopyName(' zz twin')).toBe(true)
    expect(isRobotCopyName('Buzz Lightyear')).toBe(false)
    expect(ymdMinusDays('2026-10-22', SHADOW_STALE_DUE_DAYS)).toBe('2026-09-22')
    expect(ymdMinusDays('2026-03-01', 1)).toBe('2026-02-28')
    expect(bidRef(515)).toBe('b515')
    expect(bidRef(' 515 ')).toBe('b515')
    expect(bidRef(null)).toBe('a bid')
  })
})
