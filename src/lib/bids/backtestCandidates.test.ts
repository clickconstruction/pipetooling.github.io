import { describe, expect, it } from 'vitest'
import {
  buildBacktestCandidateGroups,
  buildBacktestPrompt,
  normalizeBidNumber,
  starvationLine,
  type BacktestCandidateBidFields,
} from './backtestCandidates'
import type { AxisCard } from './confidenceBoard'

const TODAY = '2026-09-01'

function bid(over: Partial<BacktestCandidateBidFields> = {}): BacktestCandidateBidFields {
  return {
    id: over.id ?? `id-${over.bid_number ?? Math.random()}`,
    bid_number: 300,
    project_name: 'Grove Street Bistro',
    plans_link: 'https://drive.example/plans',
    bid_value: 187_432,
    outcome: 'won',
    loss_category: null,
    bid_date_sent: '2026-07-10',
    created_at: '2026-06-01T00:00:00Z',
    ...over,
  }
}

function card(axis: string, over: Partial<AxisCard> = {}): AxisCard {
  return {
    axis,
    chip: { text: 'GATE B · 1/5', tone: 'progress' },
    slots: [],
    scoredCount: 1,
    streak: 1,
    nextLine: '4 more in-band to gate',
    ...over,
  }
}

const fullPresence = () => ({ hasCounts: true, hasPricing: true })

function groupsOf(
  bids: BacktestCandidateBidFields[],
  opts: Partial<Parameters<typeof buildBacktestCandidateGroups>[1]> = {},
) {
  return buildBacktestCandidateGroups(bids, {
    axisOf: () => 'small TI',
    presenceOf: fullPresence,
    usedReferenceNumbers: new Set(),
    axisCards: [card('small TI')],
    todayYmd: TODAY,
    ...opts,
  })
}

describe('normalizeBidNumber', () => {
  it('strips the b/B prefix and stringifies', () => {
    expect(normalizeBidNumber('B376')).toBe('376')
    expect(normalizeBidNumber('b405')).toBe('405')
    expect(normalizeBidNumber(376)).toBe('376')
    expect(normalizeBidNumber(null)).toBeNull()
    expect(normalizeBidNumber('')).toBeNull()
  })
})

describe('buildBacktestCandidateGroups', () => {
  it('keeps decided grade-A/B bids and drops undecided, used, and ungraded ones', () => {
    const groups = groupsOf(
      [
        bid({ id: 'a', bid_number: 301 }),
        bid({ id: 'undecided', bid_number: 302, bid_date_sent: null, outcome: null }),
        bid({ id: 'used', bid_number: 376 }),
        bid({ id: 'no-plans', bid_number: 303, plans_link: null }),
        bid({ id: 'no-value', bid_number: 304, bid_value: null }), // grade C with counts — not a scorecard ref
      ],
      { usedReferenceNumbers: new Set(['376']) },
    )
    const g = groups.find((x) => x.axis === 'small TI')
    expect(g?.eligible.map((c) => c.bid.id)).toEqual(['a'])
  })

  it('splits gate-eligible from flagged (round value / weak loss / stale)', () => {
    const groups = groupsOf([
      bid({ id: 'clean', bid_number: 301, bid_value: 187_432 }),
      bid({ id: 'round', bid_number: 302, bid_value: 250_000 }),
      bid({ id: 'weak', bid_number: 303, outcome: 'lost', loss_category: 'no_bid' }),
      bid({ id: 'stale', bid_number: 304, bid_date_sent: '2025-11-01' }),
    ])
    const g = groups.find((x) => x.axis === 'small TI')
    expect(g?.eligible.map((c) => c.bid.id)).toEqual(['clean'])
    expect(g?.flagged.map((c) => c.bid.id).sort()).toEqual(['round', 'stale', 'weak'])
  })

  it('sorts eligible A before B, then newest decided first', () => {
    const groups = groupsOf([
      bid({ id: 'b-old', bid_number: 301, bid_date_sent: '2026-08-01' }),
      bid({ id: 'a-new', bid_number: 302, bid_date_sent: '2026-08-20' }),
      bid({ id: 'a-old', bid_number: 303, bid_date_sent: '2026-07-20' }),
    ], {
      presenceOf: (id) => (id === 'b-old' ? { hasCounts: false, hasPricing: false } : fullPresence()),
    })
    const g = groups.find((x) => x.axis === 'small TI')
    expect(g?.eligible.map((c) => c.bid.id)).toEqual(['a-new', 'a-old', 'b-old'])
    expect(g?.eligible.map((c) => c.grade)).toEqual(['A', 'A', 'B'])
  })

  it('orders groups by demand: open (closest to gate first), new, awaiting, blocked, met — unclassified last', () => {
    const axisByBid: Record<string, string | null> = {
      k: 'kitchen', s: 'small TI', v: 'vet', b: 'blocked-ax', m: 'met-ax', n: 'brand-new', u: null,
    }
    const groups = buildBacktestCandidateGroups(
      Object.keys(axisByBid).map((id, i) => bid({ id, bid_number: 400 + i })),
      {
        axisOf: (x) => axisByBid[x.id] ?? null,
        presenceOf: fullPresence,
        usedReferenceNumbers: new Set(),
        axisCards: [
          card('kitchen', { streak: 1 }),
          card('small TI', { streak: 3 }),
          card('vet', { chip: { text: 'AWAITING SCORE', tone: 'awaiting' }, streak: 0 }),
          card('blocked-ax', { chip: { text: 'BLOCKED', tone: 'blocked' }, nextLine: 'multiplier question on the b422 audit' }),
          card('met-ax', { chip: { text: 'GATE B MET', tone: 'met' }, streak: 5 }),
        ],
        todayYmd: TODAY,
      },
    )
    expect(groups.map((g) => g.axis)).toEqual(['small TI', 'kitchen', 'brand-new', 'vet', 'blocked-ax', 'met-ax', null])
    expect(groups[0]?.why).toBe('needs 2 more in-band · gate B at 3/5')
    expect(groups[2]?.demand).toBe('new')
    expect(groups[4]?.why).toContain('b422 audit')
    expect(groups[6]?.demand).toBeNull()
  })

  it('renders a demand axis with zero candidates (starvation), and starvationLine names the flags', () => {
    const groups = groupsOf([bid({ id: 'round', bid_number: 302, bid_value: 250_000 })], {
      axisCards: [card('small TI'), card('vet-clinic')],
    })
    const starved = groups.find((g) => g.axis === 'vet-clinic')
    expect(starved).toBeDefined()
    expect(starvationLine(starved!)).toContain('bidding (or grading) more of these')
    const flaggedOnly = groups.find((g) => g.axis === 'small TI')
    expect(starvationLine(flaggedOnly!)).toContain('repairing history')
    expect(starvationLine(flaggedOnly!)).toContain('1 round value')
  })

  it('omits the unclassified bucket when empty', () => {
    const groups = groupsOf([bid({ id: 'a', bid_number: 301 })])
    expect(groups.some((g) => g.axis === null)).toBe(false)
  })
})

describe('buildBacktestPrompt', () => {
  it('carries bid number + axis and the blind rule — never the value or outcome', () => {
    const p = buildBacktestPrompt(bid({ bid_number: 'B312', bid_value: 187_432, outcome: 'won' }), 'kitchen/occupied')
    expect(p).toContain('b312')
    expect(p).toContain('kitchen/occupied')
    expect(p).toContain('open_backtest')
    expect(p).toContain('BLIND RULE')
    expect(p).not.toContain('187')
    expect(p).not.toContain('won')
  })

  it('flags a missing axis instead of inventing one', () => {
    expect(buildBacktestPrompt(bid(), null)).toContain('axis unassigned')
  })
})
