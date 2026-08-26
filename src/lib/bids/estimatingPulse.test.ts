import { describe, expect, it } from 'vitest'
import {
  buildPulseBandItems,
  buildPulsePeopleView,
  buildPulsePersonRows,
  buildPulseStats,
  buildPulseWeeks,
  classifyPulseOutcome,
  emptyPulseHiddenPeopleState,
  formatPulseMoney,
  parsePulseHiddenPeopleState,
  pulseWeekStarts,
  withAllPulsePeopleShown,
  withPulsePersonHidden,
} from './estimatingPulse'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

/** Minimal sent bid; `sent` is a YYYY-MM-DD civil date (noon Chicago ≈ UTC-5/6 safe at 18:00Z). */
function bid(over: {
  id: string
  sent?: string | null
  value?: number | null
  outcome?: string | null
  estId?: string | null
  estName?: string
  amId?: string | null
  amName?: string
}): BidWithBuilder {
  return {
    id: over.id,
    bid_date_sent: over.sent === null ? null : `${over.sent ?? '2026-08-17'}T18:00:00Z`,
    bid_value: over.value ?? 100000,
    outcome: over.outcome ?? null,
    estimator_id: over.estId ?? null,
    estimator: over.estId ? { name: over.estName ?? 'Est', email: 'e@x.com' } : null,
    account_manager_id: over.amId ?? null,
    account_manager: over.amId ? { name: over.amName ?? 'Am', email: 'a@x.com' } : null,
  } as unknown as BidWithBuilder
}

// 2026-08-16 is a Sunday (company week start for the week containing 08/17).
const WEEK = '2026-08-16'

describe('classifyPulseOutcome', () => {
  it('maps like the Scoreboard: started counts as won, everything undecided waits', () => {
    expect(classifyPulseOutcome('won')).toBe('won')
    expect(classifyPulseOutcome('started_or_complete')).toBe('won')
    expect(classifyPulseOutcome('lost')).toBe('lost')
    expect(classifyPulseOutcome(null)).toBe('wait')
    expect(classifyPulseOutcome('not_yet_won_or_lost')).toBe('wait')
  })
})

describe('pulseWeekStarts / buildPulseWeeks', () => {
  it('emits consecutive weeks oldest→newest, including empty ones', () => {
    const starts = pulseWeekStarts(WEEK, 3)
    expect(starts).toEqual(['2026-08-02', '2026-08-09', '2026-08-16'])
    const weeks = buildPulseWeeks(
      [bid({ id: 'a', sent: '2026-08-17', value: 250000, outcome: 'won' })],
      WEEK,
      3,
    )
    expect(weeks).toHaveLength(3)
    expect(weeks[0]!.count).toBe(0)
    expect(weeks[2]!).toMatchObject({ wonDollars: 250000, waitDollars: 0, lostDollars: 0, count: 1, bidIds: ['a'] })
    expect(weeks[2]!.dateRange).toBe('08/16–08/22')
  })

  it('labels the first week and month changes only; unsent bids never count', () => {
    const weeks = buildPulseWeeks([bid({ id: 'u', sent: null })], '2026-08-09', 4)
    // 07/19, 07/26, 08/02, 08/09 → "Jul" on the first, "Aug" at the boundary
    expect(weeks.map((w) => w.monthLabel)).toEqual(['Jul', null, 'Aug', null])
    expect(weeks.every((w) => w.count === 0)).toBe(true)
  })
})

describe('buildPulseStats', () => {
  it('splits count and dollars by outcome, with a last-4-weeks slice', () => {
    const stats = buildPulseStats(
      [
        bid({ id: 'a', sent: '2026-08-17', value: 1000, outcome: 'won' }),
        bid({ id: 'b', sent: '2026-08-10', value: 2000, outcome: 'lost' }),
        bid({ id: 'c', sent: '2026-05-04', value: 4000, outcome: null }),
        bid({ id: 'd', sent: null, value: 8000 }),
      ],
      WEEK,
    )
    expect(stats).toMatchObject({
      sentCount: 3,
      sentDollars: 7000,
      last4Count: 2,
      last4Dollars: 3000,
      wonCount: 1,
      decidedCount: 2,
      wonDollars: 1000,
      decidedDollars: 3000,
      waitingCount: 1,
      waitingDollars: 4000,
    })
  })
})

describe('buildPulsePersonRows', () => {
  it('keeps roles separate but counts a dual-role bid once in the header', () => {
    const rows = buildPulsePersonRows(
      [
        bid({ id: 'a', value: 100, outcome: 'won', estId: 'u1', estName: 'Wendi', amId: 'u1', amName: 'Wendi' }),
        bid({ id: 'b', value: 200, outcome: 'lost', estId: 'u1', estName: 'Wendi' }),
        bid({ id: 'c', value: 400, outcome: null, estId: 'u2', estName: 'Bill', amId: 'u1', amName: 'Wendi' }),
      ],
      WEEK,
      2,
    )
    expect(rows.map((r) => r.displayName)).toEqual(['Wendi', 'Bill'])
    const wendi = rows[0]!
    expect(wendi).toMatchObject({ touchedCount: 3, touchedDollars: 700, combinedWon: 1, combinedDecided: 2 })
    expect(wendi.estimator).toMatchObject({ sentCount: 2, wonCount: 1, lostCount: 1, wonBidIds: ['a'], lostBidIds: ['b'] })
    expect(wendi.accountManager).toMatchObject({ sentCount: 2, wonCount: 1, waitingCount: 1, waitingBidIds: ['c'] })
    // all three sent this week → sparkline puts everything in the newest bucket
    expect(wendi.weeklyTouchedDollars).toEqual([0, 700])
    expect(rows[1]!.accountManager).toBeNull()
  })
})

describe('buildPulseBandItems', () => {
  it('sorts by pct, staggers close neighbors, dims small samples, appends ALL', () => {
    const people = buildPulsePersonRows(
      [
        bid({ id: 'a', outcome: 'won', estId: 'u1', estName: 'Wendi' }),
        bid({ id: 'b', outcome: 'lost', estId: 'u1', estName: 'Wendi' }),
        bid({ id: 'c', outcome: 'lost', estId: 'u1', estName: 'Wendi' }),
        bid({ id: 'd', outcome: 'won', estId: 'u2', estName: 'Taunya' }),
        bid({ id: 'e', outcome: null, estId: 'u3', estName: 'Grace' }),
      ],
      WEEK,
      1,
    )
    const stats = buildPulseStats(
      [
        bid({ id: 'a', outcome: 'won' }),
        bid({ id: 'b', outcome: 'lost' }),
        bid({ id: 'c', outcome: 'lost' }),
        bid({ id: 'd', outcome: 'won' }),
      ],
      WEEK,
    )
    const items = buildPulseBandItems(people, stats)
    // Grace has no decided bids → no dot. Order: Wendi 33.3, ALL 50, Taunya 100 — all ≥12 pts apart, no stagger.
    expect(items.map((i) => i.label)).toEqual(['Wendi', 'ALL', 'Taunya'])
    expect(items[0]).toMatchObject({ row: 0, smallSample: true })
    expect(items[1]).toMatchObject({ company: true, row: 0, pct: 50 })
    expect(items[2]).toMatchObject({ label: 'Taunya', row: 0, smallSample: true })
  })

  it('staggers only close neighbors, alternating rows', () => {
    const people = buildPulsePersonRows(
      [
        bid({ id: 'a', outcome: 'won', estId: 'u1', estName: 'Ann' }),
        bid({ id: 'b', outcome: 'lost', estId: 'u1', estName: 'Ann' }),
        bid({ id: 'c', outcome: 'won', estId: 'u2', estName: 'Bea' }),
        bid({ id: 'd', outcome: 'lost', estId: 'u2', estName: 'Bea' }),
      ],
      WEEK,
      1,
    )
    // Ann 50%, Bea 50%, ALL 50% — identical pcts must alternate 0,1,0.
    const stats = buildPulseStats(
      [bid({ id: 'a', outcome: 'won' }), bid({ id: 'b', outcome: 'lost' })],
      WEEK,
    )
    const items = buildPulseBandItems(people, stats)
    expect(items.map((i) => i.row)).toEqual([0, 1, 0])
  })
})

describe('formatPulseMoney', () => {
  it('scales to K and M', () => {
    expect(formatPulseMoney(950)).toBe('$950')
    expect(formatPulseMoney(287000)).toBe('$287K')
    expect(formatPulseMoney(4230000)).toBe('$4.2M')
  })
})

describe('hidden-people view (buildPulsePeopleView + state helpers)', () => {
  const rows = (over?: { estName?: string }) =>
    buildPulsePersonRows(
      [
        bid({ id: 'a', value: 100, outcome: 'won', estId: 'u1', estName: 'Wendi' }),
        bid({ id: 'b', value: 200, outcome: 'won', estId: 'u2', estName: over?.estName ?? 'Bill' }),
      ],
      WEEK,
      2,
    )

  it('resolves a nameless ("—") person through the directory and default-hides archived people', () => {
    // u2's users join is RLS-hidden (archived): the bids row carries no name.
    const people = buildPulsePersonRows(
      [
        bid({ id: 'a', value: 100, outcome: 'won', estId: 'u1', estName: 'Wendi' }),
        { ...bid({ id: 'b', value: 200, outcome: 'won', estId: 'u2' }), estimator: null } as never,
      ],
      WEEK,
      2,
    )
    expect(people.find((p) => p.userId === 'u2')!.displayName).toBe('—')
    const directory = new Map([
      ['u1', { name: 'Wendi', archived: false }],
      ['u2', { name: 'Juan', archived: true }],
    ])
    const view = buildPulsePeopleView(people, directory, emptyPulseHiddenPeopleState())
    expect(view.visible.map((p) => p.displayName)).toEqual(['Wendi'])
    expect(view.hiddenChips).toEqual([{ userId: 'u2', label: 'Juan', archived: true }])
  })

  it('leaves people visible when the directory has not loaded yet', () => {
    const view = buildPulsePeopleView(rows(), new Map(), emptyPulseHiddenPeopleState())
    expect(view.visible.map((p) => p.displayName)).toEqual(['Bill', 'Wendi'])
    expect(view.hiddenChips).toEqual([])
  })

  it('hides explicit ids, shows archived only when explicitly shown, and round-trips the toggles', () => {
    const directory = new Map([
      ['u1', { name: 'Wendi', archived: false }],
      ['u2', { name: 'Juan', archived: true }],
    ])
    let state = emptyPulseHiddenPeopleState()
    state = withPulsePersonHidden(state, 'u1', false, true)
    let view = buildPulsePeopleView(rows(), directory, state)
    // u1 explicitly hidden; u2 default-hidden as archived (its bid-join name "Bill" wins for the label)
    expect(view.visible).toEqual([])
    expect(view.hiddenChips.map((c) => c.userId).sort()).toEqual(['u1', 'u2'])
    // un-hide u1, show archived u2
    state = withPulsePersonHidden(state, 'u1', false, false)
    state = withPulsePersonHidden(state, 'u2', true, false)
    view = buildPulsePeopleView(rows(), directory, state)
    expect(view.visible.map((p) => p.userId).sort()).toEqual(['u1', 'u2'])
    expect(view.hiddenChips).toEqual([])
    // re-hide the archived person: falls back to default-hidden, not the hidden list
    state = withPulsePersonHidden(state, 'u2', true, true)
    expect(state.hidden).toEqual([])
    expect(state.shownArchived).toEqual([])
  })

  it('withAllPulsePeopleShown clears hides and pins every archived chip visible', () => {
    const chips = [
      { userId: 'u1', label: 'Wendi', archived: false },
      { userId: 'u2', label: 'Juan', archived: true },
    ]
    const next = withAllPulsePeopleShown({ hidden: ['u1'], shownArchived: [] }, chips)
    expect(next).toEqual({ hidden: [], shownArchived: ['u2'] })
    // idempotent for already-shown archived ids
    expect(withAllPulsePeopleShown(next, chips)).toEqual(next)
  })

  it('parsePulseHiddenPeopleState survives junk and round-trips real state', () => {
    expect(parsePulseHiddenPeopleState(null)).toEqual({ hidden: [], shownArchived: [] })
    expect(parsePulseHiddenPeopleState('not json')).toEqual({ hidden: [], shownArchived: [] })
    expect(parsePulseHiddenPeopleState('{"hidden": "u1"}')).toEqual({ hidden: [], shownArchived: [] })
    expect(parsePulseHiddenPeopleState('{"hidden": ["u1", 3], "shownArchived": ["u2"]}')).toEqual({
      hidden: ['u1'],
      shownArchived: ['u2'],
    })
    const state = withPulsePersonHidden(emptyPulseHiddenPeopleState(), 'u9', false, true)
    expect(parsePulseHiddenPeopleState(JSON.stringify(state))).toEqual(state)
  })
})
