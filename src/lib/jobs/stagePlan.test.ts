import { describe, expect, it } from 'vitest'
import {
  billable,
  buildStagePlan,
  gcView,
  headline,
  pctWords,
  stageSpanShort,
  type StagePlanFixture,
  type StagePlanInput,
  type StagePlanOrder,
} from './stagePlan'

// The mock-up's sample job #1004 (to-dos/stage-plan): four stages in order,
// two change orders, one plain line. Today is Sep 9 — Top-out is on site.
const TODAY = '2026-09-09'
const fx = (over: Partial<StagePlanFixture> & { id: string; name: string; sequence_order: number }): StagePlanFixture => ({
  count: 1,
  line_unit_price: 0,
  invoice_id: null,
  stage_kind: 'any',
  shared_with_gc: false,
  ...over,
})
const FIXTURES: StagePlanFixture[] = [
  fx({ id: 'f-rough', name: 'Rough-in', sequence_order: 1, line_unit_price: 12465, invoice_id: 'inv-1', stage_kind: 'order', shared_with_gc: true }),
  fx({ id: 'f-top', name: 'Top-out', sequence_order: 2, line_unit_price: 12465, invoice_id: 'inv-2', stage_kind: 'order', shared_with_gc: true }),
  fx({ id: 'f-trim', name: 'Trim & final', sequence_order: 3, count: 2, line_unit_price: 8310, stage_kind: 'order', shared_with_gc: true }),
  fx({ id: 'f-final', name: 'Final inspection', sequence_order: 4, line_unit_price: 0, stage_kind: 'order', shared_with_gc: true }),
  fx({ id: 'f-co2', name: 'Relocate water heater', sequence_order: 5, line_unit_price: 1850, stage_kind: 'any', shared_with_gc: true }),
  fx({ id: 'f-co3', name: 'Add hose bib, garage', sequence_order: 6, line_unit_price: 420, stage_kind: 'any' }),
  fx({ id: 'f-permit', name: 'Permit & misc', sequence_order: 7, line_unit_price: 600, stage_kind: null }),
]
// Orders carry a name on the real table; the plan's input type has no field
// for it, and the "never a name" test feeds one in anyway.
type OrderWithName = StagePlanOrder & { display_name: string }
const ORDERS: OrderWithName[] = [
  { id: 'o-rough', stage_window_id: 'w-rough', status: 'settled', picked_start: '2026-09-01', picked_end: '2026-09-03', labor_job_id: 's-rough', display_name: "Sam's Plumbing" },
  { id: 'o-top', stage_window_id: 'w-top', status: 'accepted', picked_start: '2026-09-09', picked_end: '2026-09-10', labor_job_id: 's-top', display_name: "Sam's Plumbing" },
  { id: 'o-co2', stage_window_id: 'w-co2', status: 'accepted', picked_start: '2026-09-15', picked_end: '2026-09-16', labor_job_id: 's-co2', display_name: "Sam's Plumbing" },
]
const SAMPLE: StagePlanInput = {
  fixtures: FIXTURES,
  windows: [
    { id: 'w-rough', fixture_id: 'f-rough', window_start: '2026-09-01', window_end: '2026-09-05' },
    { id: 'w-top', fixture_id: 'f-top', window_start: '2026-09-08', window_end: '2026-09-12' },
    { id: 'w-trim', fixture_id: 'f-trim', window_start: '2026-09-22', window_end: '2026-10-02' },
    { id: 'w-co2', fixture_id: 'f-co2', window_start: '2026-09-15', window_end: '2026-09-19' },
  ],
  orders: ORDERS,
  sheets: [
    { id: 's-rough', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-04T15:00:00Z' },
    { id: 's-top', stage: 'working', progress_pct: 50, progress_at: '2026-09-09T18:00:00Z' },
    { id: 's-co2', stage: 'walkthrough', progress_pct: 100, stage_changed_at: '2026-09-16T20:00:00Z' },
  ],
  invoices: [
    { id: 'inv-1', status: 'paid', billed_at: '2026-08-20T15:00:00Z' },
    { id: 'inv-2', status: 'billed', billed_at: '2026-09-05T15:00:00Z' },
  ],
  payments: [{ invoice_id: 'inv-1', paid_on: '2026-08-29' }],
  todayYmd: TODAY,
}

describe('buildStagePlan — the sample job', () => {
  const plan = buildStagePlan(SAMPLE)
  const line = (id: string) => plan.byFixtureId.get(id)!.stateLine

  it('numbers Order rows only, skipping Any rows; a plain row never gets a number', () => {
    expect(plan.rows.map((r) => [r.fixtureId, r.number])).toEqual([
      ['f-rough', 1],
      ['f-top', 2],
      ['f-trim', 3],
      ['f-final', 4],
      ['f-co2', null],
      ['f-co3', null],
      ['f-permit', null],
    ])
    expect(plan.orderCount).toBe(4)
    expect(plan.anyCount).toBe(2)
    expect(plan.plainCount).toBe(1)
    expect(plan.sharedCount).toBe(5)
  })

  it('reads every second line the mock-up prints', () => {
    expect(line('f-rough')).toBe('Stage 1 · passed Sep 4 · draw 1 paid Aug 29')
    expect(line('f-top')).toBe('Stage 2 · on site Sep 9 – 10 · 50% · draw 2 billed Sep 5')
    expect(line('f-trim')).toBe('Stage 3 · window Sep 22 – Oct 2 · draw 3 after it passes')
    expect(line('f-final')).toBe('Stage 4 · after 3 · no draw')
    expect(line('f-co2')).toBe('◆ done Sep 16 · ready to bill')
    expect(line('f-co3')).toBe('◆ not scheduled · bills when done')
    expect(line('f-permit')).toBe('not a stage · bills with the final draw')
  })

  it('badges: paid = done, the first unpaid Order row is live, the rest later; Any rows by done', () => {
    expect(plan.rows.map((r) => r.badge)).toEqual(['done', 'live', 'later', 'later', 'any-done', 'any', 'none'])
  })

  it('draws follow stages', () => {
    expect(plan.rows.map((r) => r.draw)).toEqual(['paid', 'billed', 'later', 'none', 'ready', 'later', 'later'])
    expect(plan.byFixtureId.get('f-trim')!.amount).toBe(16620)
  })

  it('headline counts Order rows only', () => {
    expect(headline(plan)).toBe('Stage 2 of 4 · Top-out · on site now')
  })

  it('billable lists the done change order and nothing else', () => {
    expect(billable(plan)).toEqual([{ fixtureId: 'f-co2', amount: 1850, why: 'Relocate water heater is done' }])
  })
})

describe('billable never bills out of order', () => {
  it('an Order stage that passed waits while the one above it is unbilled', () => {
    const plan = buildStagePlan({
      ...SAMPLE,
      fixtures: FIXTURES.map((f) => (f.id === 'f-rough' || f.id === 'f-top' ? { ...f, invoice_id: null } : f)),
      sheets: SAMPLE.sheets.map((s) => (s.id === 's-top' ? { ...s, stage: 'customer_pay', stage_changed_at: '2026-09-11T15:00:00Z' } : s)),
      invoices: [],
      payments: [],
      todayYmd: '2026-09-12',
    })
    expect(billable(plan).map((b) => b.fixtureId)).toEqual(['f-rough', 'f-co2'])
    expect(plan.byFixtureId.get('f-top')!.draw).toBe('waits')
    expect(plan.byFixtureId.get('f-top')!.stateLine).toBe('Stage 2 · passed Sep 11 · draw 2 waits on stage 1')
    expect(plan.byFixtureId.get('f-rough')!.stateLine).toBe('Stage 1 · passed Sep 4 · draw 1 ready to bill')
    // both unpaid: stage 1 is still the live one — done is paid, not passed
    expect(headline(plan)).toBe('Stage 1 of 4 · Rough-in · passed inspection · ready to bill')
  })

  it('a $0 stage is done when it passes (it has no draw to pay)', () => {
    const plan = buildStagePlan({
      ...SAMPLE,
      fixtures: FIXTURES.filter((f) => f.id === 'f-final').map((f) => ({ ...f, sequence_order: 1 })),
      windows: [{ id: 'w-final', fixture_id: 'f-final', window_start: '2026-09-01', window_end: '2026-09-02' }],
      orders: [{ id: 'o-final', stage_window_id: 'w-final', status: 'settled', picked_start: '2026-09-01', picked_end: '2026-09-01', labor_job_id: 's-final' }],
      sheets: [{ id: 's-final', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-02T15:00:00Z' }],
    })
    expect(plan.rows[0]!.badge).toBe('done')
    expect(headline(plan)).toBe('All 1 stage done')
    expect(billable(plan)).toEqual([])
  })

  it('an Any row is billable once its sheet reads 100% even with no stage change', () => {
    const plan = buildStagePlan({
      ...SAMPLE,
      sheets: SAMPLE.sheets.map((s) => (s.id === 's-co2' ? { id: 's-co2', stage: 'working', progress_pct: 100, progress_at: '2026-09-16T20:00:00Z' } : s)),
    })
    expect(plan.byFixtureId.get('f-co2')!.stateLine).toBe('◆ done Sep 16 · ready to bill')
  })

  it('a job with no Order rows: no headline, plain rows bill on their own', () => {
    const plan = buildStagePlan({ ...SAMPLE, fixtures: FIXTURES.filter((f) => f.stage_kind !== 'order') })
    expect(headline(plan)).toBeNull()
    expect(plan.byFixtureId.get('f-permit')!.draw).toBe('open')
    expect(plan.byFixtureId.get('f-permit')!.stateLine).toBe('not a stage · bills on its own')
  })
})

describe('gcView — the company voice', () => {
  const view = gcView(buildStagePlan(SAMPLE))

  it('numbers the shared Order rows, one now, one next, the rest later', () => {
    expect(view.headline).toBe('Stage 2 of 4 · Top-out · on site now')
    expect(view.steps.map((s) => [s.number, s.name, s.state, s.line])).toEqual([
      [1, 'Rough-in', 'done', 'Passed inspection Sep 4'],
      [2, 'Top-out', 'now', 'On site Sep 9 – 10 · about halfway'],
      [3, 'Trim & final', 'next', 'Planned Sep 22 – Oct 2'],
      [4, 'Final inspection', 'later', 'After trim & final'],
    ])
    expect(view.steps.map((s) => s.pct)).toEqual([null, 50, null, null])
  })

  it('the ask sits on exactly one row — the next one', () => {
    expect(view.steps.filter((s) => s.askable).map((s) => s.name)).toEqual(['Trim & final'])
  })

  it('shared Any rows land under "Also on this job"; unshared rows never appear', () => {
    expect(view.also).toEqual([{ name: 'Relocate water heater', state: 'done', line: 'Done Sep 16' }])
    expect(JSON.stringify(view)).not.toContain('hose bib')
    expect(JSON.stringify(view)).not.toContain('Permit')
  })

  it('never carries a name, whatever the input holds', () => {
    const json = JSON.stringify(view)
    expect(json).not.toContain('Sam')
    expect(json).not.toContain('display_name')
    expect(json).not.toContain('offered')
  })

  it('an open ask reads back on the next row; only shared rows count toward N of M', () => {
    const plan = buildStagePlan({
      ...SAMPLE,
      fixtures: FIXTURES.map((f) => (f.id === 'f-final' ? { ...f, shared_with_gc: false } : f)),
      windows: SAMPLE.windows.map((w) => (w.id === 'w-trim' ? { ...w, asked_at: '2026-09-09T15:00:00Z', asked_start: '2026-09-24', asked_end: '2026-10-02', asked_note: 'framing runs late' } : w)),
    })
    const v = gcView(plan)
    expect(v.headline).toBe('Stage 2 of 3 · Top-out · on site now')
    const next = v.steps.find((s) => s.state === 'next')!
    expect(next.line).toBe("You asked for Sep 24 – Oct 2 · we'll confirm")
    expect(next.ask).toEqual({ start: '2026-09-24', end: '2026-10-02', note: 'framing runs late', answer: 'open', answerNote: null })
    expect(v.steps.filter((s) => s.askable)).toHaveLength(1)
  })

  it('before anything starts the first stage is next (askable); when all are paid nothing is', () => {
    const fresh = gcView(buildStagePlan({ ...SAMPLE, windows: [], orders: [], sheets: [], invoices: [], payments: [], fixtures: FIXTURES.map((f) => ({ ...f, invoice_id: null })) }))
    expect(fresh.steps.map((s) => s.state)).toEqual(['next', 'later', 'later', 'later'])
    expect(fresh.headline).toBe('Stage 1 of 4 · Rough-in · not scheduled yet')
    expect(fresh.steps.filter((s) => s.askable)).toHaveLength(1)
    const paid = gcView(
      buildStagePlan({
        ...SAMPLE,
        fixtures: FIXTURES.filter((f) => f.id === 'f-rough'),
      }),
    )
    expect(paid.steps.map((s) => s.state)).toEqual(['done'])
    expect(paid.headline).toBe('All 1 stage done')
    expect(paid.steps.filter((s) => s.askable)).toHaveLength(0)
  })

  it('a re-pick reads as our crew choosing days, never the sub', () => {
    const plan = buildStagePlan({
      ...SAMPLE,
      orders: SAMPLE.orders.map((o) => (o.id === 'o-top' ? { ...o, change_requested_at: '2026-09-09T15:00:00Z', picked_start: null, picked_end: null } : o)),
      sheets: SAMPLE.sheets.map((s) => (s.id === 's-top' ? { ...s, progress_pct: 0 } : s)),
    })
    const v = gcView(plan)
    expect(v.steps[1]).toMatchObject({ state: 'next', line: "We're picking new days inside the window", askable: true })
  })
})

describe('words', () => {
  it('spans', () => {
    expect(stageSpanShort({ start: '2026-09-04', end: '2026-09-04' })).toBe('Sep 4')
    expect(stageSpanShort({ start: '2026-09-09', end: '2026-09-10' })).toBe('Sep 9 – 10')
    expect(stageSpanShort({ start: '2026-09-22', end: '2026-10-02' })).toBe('Sep 22 – Oct 2')
  })
  it('percent', () => {
    expect(pctWords(0)).toBe('just started')
    expect(pctWords(33)).toBe('about a third')
    expect(pctWords(50)).toBe('about halfway')
    expect(pctWords(90)).toBe('nearly done')
    expect(pctWords(null)).toBe('just started')
  })
})
