import { describe, expect, it } from 'vitest'
import { ymdAddDays } from '../../utils/dateUtils'
import { contextFor, TODAY, TRADE_FLOW, TRADES } from './boardFixtures'
import type { FactId } from './facts'
import { funnel, goingRows, median, quarterStart, sticksOf, sticksWords, usualBar, usualByStep, usualDays, type FunnelRun, type StepSpan } from './going'

const COMPANIES = ['greg', 'bill', 'tom', 'g1', 'g2', 'g3', 'g4', 'g5']

/** Done spans on a step, each `days` long, finishing a week apart back from Sep 30. */
const doneSpans = (stepId: string, days: number[], lastFacts: (FactId | null)[] = []): StepSpan[] =>
  days.map((d, i) => {
    const to = ymdAddDays('2026-09-30', -7 * i)
    return { stepId, contactId: COMPANIES[i % COMPANIES.length] ?? 'greg', jobId: null, from: ymdAddDays(to, -d), to, lastFact: lastFacts[i] ?? null }
  })

/** Papers in, done eight times: the certificate came last six of them, as the prototype's How it is going says. */
const PAPERS = doneSpans('papers', [2, 3, 3, 4, 3, 5, 2, 3], ['coi_current', 'coi_current', 'w9_signed', 'coi_current', 'coi_current', 'w9_signed', 'coi_current', 'coi_current'])
const SPANS: StepSpan[] = [
  ...PAPERS,
  ...doneSpans('msa', [4, 5, 3, 4]),
  ...doneSpans('ask', [6, 5, 7, 6, 8, 4]),
  ...doneSpans('compare', [2, 1, 2, 3, 2]),
  // Done this quarter, which began Thu Oct 1.
  { stepId: 'papers', contactId: 'g2', jobId: null, from: '2026-09-28', to: '2026-10-01', lastFact: 'coi_current' },
  { stepId: 'sow', contactId: 'g1', jobId: 'stoneoak', from: '2026-09-27', to: TODAY, lastFact: 'sow_signed' },
  // Still on it, and one done more than a year ago: neither counts toward the usual.
  { stepId: 'ask', contactId: 'greg', jobId: 'boerne', from: '2026-09-22', to: null, lastFact: null },
  { stepId: 'compare', contactId: 'bill', jobId: 'boerne', from: '2025-09-01', to: '2025-09-30', lastFact: 'carried' },
]

describe('median', () => {
  it('reads the middle, the mean of the middle two on an even count, and nothing of nothing', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([2, 2, 3, 3, 3, 3, 4, 5])).toBe(3)
    expect(median([1, 2])).toBe(2)
    expect(median([])).toBeNull()
  })
})

describe('the usual', () => {
  it('is the middle of the done ones over the last year', () => {
    expect(usualDays(SPANS, 'papers', TODAY)).toBe(3)
    expect(usualDays(SPANS, 'ask', TODAY)).toBe(6)
  })

  it('leaves out a step still on and one done more than a year ago', () => {
    expect(usualDays(SPANS, 'compare', TODAY)).toBe(2)
  })

  it('has no usual yet under five done', () => {
    expect(usualDays(SPANS, 'msa', TODAY)).toBeNull()
    expect(usualByStep(TRADE_FLOW, SPANS, TODAY)).toEqual({ invited: null, portal: null, papers: 3, msa: null, ask: 6, compare: 2, sow: null, draws: null, closeout: null })
  })

  it('draws the step card’s bar: the share of the usual used, and the overrun in red capped at 60', () => {
    expect(usualBar(2, 4)).toEqual({ pct: 50, overPct: 0 })
    expect(usualBar(5, 4)).toEqual({ pct: 100, overPct: 25 })
    expect(usualBar(20, 4)).toEqual({ pct: 100, overPct: 60 })
    expect(usualBar(0, 0)).toEqual({ pct: 0, overPct: 0 })
  })
})

describe('quarterStart', () => {
  it('reads the first day of the quarter', () => {
    expect([TODAY, '2026-01-01', '2026-06-30', '2026-12-31'].map(quarterStart)).toEqual(['2026-10-01', '2026-01-01', '2026-04-01', '2026-10-01'])
  })
})

describe('where a step sticks', () => {
  it('names the fact last to turn true most often, out of the done ones', () => {
    const s = sticksOf(['w9_signed', 'coi_current'], SPANS, 'papers', TODAY)
    expect(s).toEqual({ factId: 'coi_current', times: 7, of: 9 })
    expect(s && sticksWords(s)).toBe('their certificate of insurance, 7 of 9 times')
    expect(s && sticksWords(s, () => 'the certificate')).toBe('the certificate, 7 of 9 times')
  })

  it('says nothing for a step that waits on one fact, or a fork', () => {
    expect(sticksOf(['quote_in'], SPANS, 'ask', TODAY)).toBeNull()
  })

  it('gives a tie to the first fact in the step’s list', () => {
    const tie = doneSpans('papers', [1, 1], ['coi_current', 'w9_signed'])
    expect(sticksOf(['w9_signed', 'coi_current'], tie, 'papers', TODAY)).toEqual({ factId: 'w9_signed', times: 1, of: 2 })
  })
})

describe('goingRows', () => {
  const ctx = contextFor(TRADE_FLOW)
  const rows = goingRows(ctx, TRADES, SPANS)
  const row = (id: string) => rows.find((r) => r.stepId === id)

  it('reads one row per step in the flow’s order', () => {
    expect(rows.map((r) => r.stepId)).toEqual(['invited', 'portal', 'papers', 'msa', 'ask', 'compare', 'sow', 'draws', 'closeout'])
  })

  it('counts on it now as the board does, and names the one on it longest with its line’s tone', () => {
    expect(row('papers')).toMatchObject({ onItNow: 4, usual: 3, longest: { name: 'Cibolo Fence', days: 6, tone: 'over' } })
    expect(row('ask')).toMatchObject({ onItNow: 5, longest: { name: 'Hillside Excavation', days: 10, tone: 'late' } })
    expect(row('invited')).toMatchObject({ onItNow: 0, longest: null })
  })

  it('never marks the longest over usual while its day is still ahead', () => {
    const onTime = TRADES.filter((c) => c.contactId === 'g3')
    expect(goingRows(ctx, onTime, SPANS).find((r) => r.stepId === 'ask')?.longest).toMatchObject({ name: 'Lone Star Mechanical', days: 8, tone: '' })
  })

  it('says nothing of where a fork sticks, since it ends on whichever fact turns true', () => {
    const decided = [...SPANS, ...doneSpans('compare', [2, 2, 3, 1, 2, 2], ['carried', 'not_carried', 'carried', 'carried', 'not_carried', 'carried'])]
    expect(sticksOf(['carried', 'not_carried'], decided, 'compare', TODAY)).toMatchObject({ factId: 'carried' })
    expect(goingRows(ctx, TRADES, decided).find((r) => r.stepId === 'compare')?.sticks).toBeNull()
  })

  it('counts the done ones this quarter, and where the step sticks', () => {
    expect(row('papers')).toMatchObject({ doneThisQuarter: 1, sticks: { factId: 'coi_current', times: 7, of: 9 } })
    expect(row('sow')?.doneThisQuarter).toBe(1)
    expect(row('compare')?.doneThisQuarter).toBe(0)
  })
})

describe('funnel', () => {
  const LATE_IN_QUARTER = '2026-11-30'
  /** The facts when `on`, else none. */
  const when = (on: boolean, ...facts: FactId[]): FactId[] => (on ? facts : [])
  const run = (i: number, facts: FactId[], ended = false, from = '2026-10-05'): FunnelRun => ({ contactId: `c${i}`, jobId: `j${i}`, from, facts, ended })

  it('reads the trades as the prototype draws them: 24 asked, 17 quoted, 6 carried, 5 signed, 7 not quoted', () => {
    const runs = Array.from({ length: 24 }, (_, i) => run(i, [...when(i < 17, 'quote_in'), ...when(i < 6, 'carried'), ...when(i < 5, 'sow_signed')], i >= 17))
    expect(funnel('trade', [...runs, run(99, ['quote_in'], false, '2026-09-15')], LATE_IN_QUARTER)).toEqual({
      stages: [
        { label: 'asked', n: 24, pctOfPrev: null },
        { label: 'quoted', n: 17, pctOfPrev: 71 },
        { label: 'carried', n: 6, pctOfPrev: 35 },
        { label: 'SOW signed', n: 5, pctOfPrev: 83 },
      ],
      out: { label: 'not quoted', n: 7 },
      rounds: false,
    })
  })

  it('counts a customer who had our bid and ended without a yes as declined', () => {
    const runs = Array.from({ length: 11 }, (_, i) => run(i, [...when(i < 9, 'bid_sent'), ...when(i < 4, 'said_yes', 'contract_signed')], i >= 4 && i < 9))
    const f = funnel('customer', runs, LATE_IN_QUARTER)
    expect(f?.stages.map((s) => [s.label, s.n, s.pctOfPrev])).toEqual([
      ['asked us', 11, null],
      ['bid', 9, 82],
      ['said yes', 4, 44],
      ['contract', 4, 100],
    ])
    expect(f?.out).toEqual({ label: 'declined', n: 5 })
  })

  it('counts the architect’s rounds with no arrows: 6 plan sets, 14 questions and 9 addenda are no fall-off', () => {
    const runs = Array.from({ length: 6 }, (_, i) => run(i, ['plans_in', ...Array.from({ length: i === 0 ? 4 : 2 }, (): FactId => 'question_answered'), ...when(i < 3, 'addendum_filed', 'addendum_filed', 'addendum_filed')]))
    expect(funnel('arch', runs, LATE_IN_QUARTER)).toEqual({
      stages: [
        { label: 'plans in', n: 6, pctOfPrev: null },
        { label: 'questions', n: 14, pctOfPrev: null },
        { label: 'addenda', n: 9, pctOfPrev: null },
      ],
      out: null,
      rounds: true,
    })
  })

  it('has no funnel for a kind without one', () => {
    expect(funnel('unknown', [], TODAY)).toBeNull()
  })
})
