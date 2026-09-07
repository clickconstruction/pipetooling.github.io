import { describe, expect, it } from 'vitest'

import type { ShadowRunRow } from './shadowStory'
import { buildAxisCards, buildLedger, type RunScoreRow } from './confidenceBoard'

const score = (over: Partial<RunScoreRow>): RunScoreRow => ({
  id: over.run_label ?? 'x',
  run_label: 'BT-0',
  kind: 'backtest',
  axis: 'small TI',
  project_name: null,
  twin_bid_number: null,
  reference_bid_number: null,
  locked_total: null,
  reference_value: null,
  delta_pct: null,
  counts_note: null,
  scope_verdict: null,
  gate_eligible: true,
  note: null,
  scored_at: '2026-08-31T00:00:00Z',
  ...over,
})

const shadow = (over: Partial<ShadowRunRow>): ShadowRunRow => ({
  id: over.shadow_bid_number ?? 's',
  status: 'locked',
  axis: 'small TI',
  created_at: '2026-08-31T00:00:00Z',
  locked_at: null,
  scored_at: null,
  shadow_bid_number: null,
  reference_bid_number: null,
  project_name: null,
  requested_by_name: null,
  reference_sent_at: null,
  locked_total: null,
  reference_value: null,
  delta_pct: null,
  ...over,
})

describe('buildAxisCards', () => {
  it('renders scored slots then pending shadows then empty slots', () => {
    const cards = buildAxisCards(
      [score({ run_label: 'BT-12', delta_pct: -2.6, scored_at: '2026-08-31T14:00:00Z' })],
      [shadow({ shadow_bid_number: '423', status: 'locked', project_name: 'La Villita' })],
    )
    expect(cards).toHaveLength(1)
    const card = cards[0]!
    expect(card.slots.map((s) => s.state)).toEqual(['in', 'pending', 'pending', 'pending', 'pending'])
    expect(card.slots[0]!.label).toBe('−2.6')
    expect(card.slots[1]!.label).toBe('b423')
    expect(card.chip).toEqual({ text: 'GATE B · 1/5', tone: 'progress' })
    expect(card.nextLine).toContain('4 more in-band')
    expect(card.nextLine).toContain('1 in flight')
  })

  it('excludes void runs from the gate but keeps eligible out-of-band ones', () => {
    const cards = buildAxisCards(
      [
        score({ run_label: 'BT-15', axis: 'institutional', delta_pct: -28, gate_eligible: false, scored_at: '2026-08-31T18:00:00Z' }),
        score({ run_label: 'BT-16', axis: 'institutional', delta_pct: -57.5, note: 'district wage tier', scored_at: '2026-08-31T22:00:00Z' }),
      ],
      [],
    )
    const card = cards[0]!
    expect(card.slots.filter((s) => s.state !== 'pending')).toHaveLength(1) // BT-15 void excluded
    expect(card.slots[0]!.state).toBe('out')
    expect(card.chip.tone).toBe('blocked') // last run out-of-band with a note
    expect(card.nextLine).toContain('district wage tier')
  })

  it('meets Gate B on five consecutive in-band runs and breaks streak on a miss', () => {
    const five = [-2, 3, 7.9, -6, 1].map((d, i) =>
      score({ run_label: `BT-${i}`, delta_pct: d, scored_at: `2026-08-3${i}T00:00:00Z` }))
    expect(buildAxisCards(five, [])[0]!.chip.tone).toBe('met')

    const withMiss = [...five.slice(0, 3), score({ run_label: 'BT-x', delta_pct: 20, scored_at: '2026-08-31T09:00:00Z' }), ...five.slice(3)]
    const card = buildAxisCards(withMiss, [])[0]!
    expect(card.chip.tone).not.toBe('met')
  })

  it('marks axes with only unscored shadows as awaiting', () => {
    const cards = buildAxisCards([], [shadow({ axis: 'vet/medical', shadow_bid_number: '419' })])
    expect(cards[0]!.chip).toEqual({ text: 'AWAITING SCORE', tone: 'awaiting' })
  })

  it('counts zero holdout runs when no holdout set is given — current gate semantics untouched', () => {
    const cards = buildAxisCards(
      [score({ run_label: 'BT-12', delta_pct: -2.6, reference_bid_number: 'b67' })],
      [],
    )
    const card = cards[0]!
    expect(card.holdoutRuns).toBe(0)
    expect(card.practiceRuns).toBe(1)
    expect(card.streakHoldoutRuns).toBe(0)
    expect(card.chip).toEqual({ text: 'GATE B · 1/5', tone: 'progress' }) // unchanged
  })

  it('splits holdout vs practice runs by reference number (b-prefix insensitive), from scores and shadows', () => {
    const cards = buildAxisCards(
      [
        score({ run_label: 'BT-1', delta_pct: -2, reference_bid_number: 'B301', scored_at: '2026-08-30T00:00:00Z' }),
        score({ run_label: 'BT-2', delta_pct: 3, reference_bid_number: '302', scored_at: '2026-08-31T00:00:00Z' }),
      ],
      [
        shadow({
          shadow_bid_number: '423',
          reference_bid_number: '303',
          status: 'scored',
          delta_pct: 1,
          scored_at: '2026-09-01T00:00:00Z',
        }),
      ],
      { holdoutReferenceNumbers: new Set(['301', '303']) },
    )
    const card = cards[0]!
    expect(card.scoredCount).toBe(3)
    expect(card.holdoutRuns).toBe(2) // BT-1 (b-prefixed) + the scored shadow
    expect(card.practiceRuns).toBe(1)
    expect(card.streak).toBe(3)
    expect(card.streakHoldoutRuns).toBe(2)
  })

  it('counts holdout runs only inside the current streak for streakHoldoutRuns', () => {
    const cards = buildAxisCards(
      [
        // holdout run, then an out-of-band miss breaks the streak, then a practice run
        score({ run_label: 'BT-1', delta_pct: -2, reference_bid_number: '301', scored_at: '2026-08-29T00:00:00Z' }),
        score({ run_label: 'BT-2', delta_pct: 20, reference_bid_number: '302', scored_at: '2026-08-30T00:00:00Z' }),
        score({ run_label: 'BT-3', delta_pct: 1, reference_bid_number: '303', scored_at: '2026-08-31T00:00:00Z' }),
      ],
      [],
      { holdoutReferenceNumbers: new Set(['301']) },
    )
    const card = cards[0]!
    expect(card.holdoutRuns).toBe(1) // still counted overall
    expect(card.streak).toBe(1) // only BT-3 survives the miss
    expect(card.streakHoldoutRuns).toBe(0) // the streak holds no holdout evidence
  })
})

describe('buildLedger', () => {
  it('unifies scores and shadows, newest first, pending shadows on top', () => {
    const rows = buildLedger(
      [score({ run_label: 'BT-16', axis: 'institutional', delta_pct: -57.5, scored_at: '2026-08-31T22:00:00Z' })],
      [shadow({ shadow_bid_number: '423', axis: 'institutional' })],
    )
    expect(rows[0]!.label).toBe('SH b423')
    expect(rows[0]!.gate).toBe('pending')
    expect(rows[1]!.label).toBe('BT-16')
    expect(rows[1]!.gate).toBe('eligible')
  })

  it('marks void shadows VOID and practice-teacher shadows practice, carrying the teacher', () => {
    const rows = buildLedger(
      [],
      [
        shadow({ shadow_bid_number: '480', status: 'void', scored_at: null }),
        shadow({ shadow_bid_number: '481', status: 'scored', delta_pct: 4, scored_at: '2026-09-06T00:00:00Z', teacher_name: 'Grace', teacher_standard: false }),
        shadow({ shadow_bid_number: '482', status: 'scored', delta_pct: -3, scored_at: '2026-09-07T00:00:00Z', teacher_name: 'Wendi', teacher_standard: true }),
      ],
    )
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]))
    expect(byLabel['SH b480']!.gate).toBe('void')
    expect(byLabel['SH b481']).toMatchObject({ gate: 'practice', teacher: 'Grace', teacherStandard: false })
    expect(byLabel['SH b482']).toMatchObject({ gate: 'eligible', teacher: 'Wendi', teacherStandard: true })
  })
})

// Teacher attribution (v2.3080, LEARNING_PLAN lever 2 lesson a): a shadow
// scored against a non-standard teacher is practice — shown, never gated.
describe('buildAxisCards · teacher attribution', () => {
  const scoredShadow = (n: string, delta: number, teacher: { name: string; standard: boolean | null }) =>
    shadow({
      shadow_bid_number: n,
      status: 'scored',
      delta_pct: delta,
      scored_at: `2026-09-0${n.slice(-1)}T00:00:00Z`,
      teacher_name: teacher.name,
      teacher_standard: teacher.standard,
    })

  it('sets practice-teacher runs aside from the gate and says so on the card', () => {
    const cards = buildAxisCards(
      [],
      [
        scoredShadow('481', 4, { name: 'Grace', standard: false }),
        scoredShadow('482', -3, { name: 'Wendi', standard: true }),
      ],
    )
    const card = cards[0]!
    expect(card.scoredCount).toBe(1) // Grace's run is not a gate entry
    expect(card.streak).toBe(1)
    expect(card.practiceTeacherRuns).toBe(1)
    expect(card.nextLine).toContain('1 practice-teacher run set aside')
    expect(card.slots.filter((s) => s.state !== 'pending')).toHaveLength(1)
  })

  it('treats an unknown teacher standing (null — client ahead of the migration) as gate-eligible, as before', () => {
    const cards = buildAxisCards([], [scoredShadow('483', 2, { name: 'Someone', standard: null })])
    expect(cards[0]!.scoredCount).toBe(1)
    expect(cards[0]!.practiceTeacherRuns).toBe(0)
  })

  it('a practice-teacher miss cannot break a standard-teacher streak', () => {
    const cards = buildAxisCards(
      [],
      [
        scoredShadow('484', 1, { name: 'Wendi', standard: true }),
        scoredShadow('485', 40, { name: 'Grace', standard: false }), // wildly out, but practice
        scoredShadow('486', 2, { name: 'Wendi', standard: true }),
      ],
    )
    expect(cards[0]!.streak).toBe(2)
  })
})
