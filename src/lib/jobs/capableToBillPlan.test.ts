import { describe, expect, it } from 'vitest'
import { capableToBillTotalFromWorking } from '../jobsStagesBoard'
import { buildCapableToBillBreakdownRowsWithPlans, capableToBillFigures, capableToBillTotalWithPlans, jobStagePlanFromRow, sliceWorkingStageInputs, stagePlanFixturesFromRows, type CapableToBillPlanJob, type WorkingStageInputs } from './capableToBillPlan'

const today = '2026-09-14'

type Job = CapableToBillPlanJob & { id: string }
/** Invoices / payments / fixtures are typed loosely — the kernel reads them loosely too. */
type JobSeed = Partial<Omit<Job, 'invoices' | 'payments' | 'fixtures'>> & { id: string; invoices?: unknown[]; payments?: unknown[]; fixtures?: unknown[] }
const job = (over: JobSeed): Job =>
  ({
    revenue: 10_000,
    payments_made: 0,
    pct_complete: 50,
    invoices: [],
    payments: [],
    fixtures: [],
    ...over,
  }) as unknown as Job

const fx = (id: string, name: string, price: number, over: Record<string, unknown> = {}) => ({
  id,
  name,
  count: 1,
  line_unit_price: price,
  sequence_order: Number(id.replace(/\D/g, '')) || 0,
  invoice_id: null,
  line_kind: 'work',
  stage_kind: 'order',
  shared_with_gc: false,
  ...over,
})

/** Two passed stages (draws 1 and 2), one on site, a done Any row, all under job `a`. */
const inputs: WorkingStageInputs = {
  windows: [
    { id: 'w1', job_id: 'a', fixture_id: 'f1', window_start: '2026-08-01', window_end: '2026-08-05' },
    { id: 'w2', job_id: 'a', fixture_id: 'f2', window_start: '2026-08-10', window_end: '2026-08-15' },
    { id: 'w3', job_id: 'a', fixture_id: 'f3', window_start: '2026-09-10', window_end: '2026-09-20' },
    { id: 'w4', job_id: 'a', fixture_id: 'f4', window_start: '2026-09-01', window_end: '2026-09-05' },
    { id: 'w9', job_id: 'zzz', fixture_id: 'f9', window_start: '2026-09-01', window_end: '2026-09-05' },
  ],
  orders: [
    { id: 'o1', stage_window_id: 'w1', status: 'approved', picked_start: '2026-08-01', picked_end: '2026-08-02', labor_job_id: 's1' },
    { id: 'o2', stage_window_id: 'w2', status: 'approved', picked_start: '2026-08-10', picked_end: '2026-08-11', labor_job_id: 's2' },
    { id: 'o3', stage_window_id: 'w3', status: 'approved', picked_start: '2026-09-12', picked_end: '2026-09-16', labor_job_id: 's3' },
    { id: 'o4', stage_window_id: 'w4', status: 'approved', picked_start: '2026-09-01', picked_end: '2026-09-02', labor_job_id: 's4' },
    { id: 'o9', stage_window_id: 'w9', status: 'approved', picked_start: '2026-09-01', picked_end: '2026-09-02', labor_job_id: 's9' },
  ],
  sheets: [
    { id: 's1', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-08-03T12:00:00Z' },
    { id: 's2', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-08-12T12:00:00Z' },
    { id: 's3', stage: 'working', progress_pct: 40 },
    { id: 's4', stage: 'working', progress_pct: 100, progress_at: '2026-09-02T12:00:00Z' },
    { id: 's9', stage: 'customer_pay', progress_pct: 100 },
  ],
}

const stagedJob = job({
  id: 'a',
  revenue: 6000,
  pct_complete: 60,
  fixtures: [fx('f1', 'Rough-in', 1000), fx('f2', 'Top-out', 2000), fx('f3', 'Trim & final', 2500), fx('f4', 'Relocate water heater', 500, { stage_kind: 'any' })],
})

describe('capableToBillPlan', () => {
  it('reads the plan on a job with Order stages: passed stages in order and done Any rows, never an unbilled successor or an invoiced row', () => {
    const [f] = capableToBillFigures([stagedJob], inputs, today)
    expect(f!.source).toBe('plan')
    // Stage 1 passed and unbilled → ready; stage 2 passed but waits on stage 1; stage 3 on site; the Any row is done.
    expect(f!.billableRows.map((r) => r.fixtureId)).toEqual(['f1', 'f4'])
    expect(f!.toBill).toBe(1500)
    expect(capableToBillTotalWithPlans([stagedJob], inputs, today)).toBe(1500)

    // Draw 1 on a sent bill: stage 2 becomes ready, stage 1 leaves the sum.
    const billed = job({
      ...stagedJob,
      invoices: [{ id: 'inv1', status: 'billed', amount: 1000 }],
      fixtures: (stagedJob.fixtures as Array<ReturnType<typeof fx>>).map((r) => (r.id === 'f1' ? { ...r, invoice_id: 'inv1' } : r)),
    })
    const [g] = capableToBillFigures([billed], inputs, today)
    expect(g!.billableRows.map((r) => r.fixtureId)).toEqual(['f2', 'f4'])
    expect(g!.toBill).toBe(2500)
  })

  it('keeps the formula while the inputs are out, on lean rows without fixtures, and on jobs with no Order stage', () => {
    const anyOnly = job({ id: 'b', revenue: 4000, payments_made: 1000, pct_complete: 50, fixtures: [fx('f5', 'Water heater', 4000, { stage_kind: 'any' })] })
    const lean = job({ id: 'c', revenue: 2000, pct_complete: 25, fixtures: [] })
    const plain = job({ id: 'd', revenue: 1000, pct_complete: 100, fixtures: [fx('f6', 'Service call', 1000, { stage_kind: null })] })
    const working = [stagedJob, anyOnly, lean, plain]
    const formulaTotal = capableToBillTotalFromWorking(working)
    // Fetch not landed → every job reads the formula, to the dollar.
    expect(capableToBillTotalWithPlans(working, null, today)).toBe(formulaTotal)
    expect(capableToBillFigures(working, null, today).every((f) => f.source === 'formula')).toBe(true)
    // Landed → only the staged job switches; the others keep their formula figures.
    const figs = capableToBillFigures(working, inputs, today)
    expect(figs.map((f) => f.source)).toEqual(['plan', 'formula', 'formula', 'formula'])
    expect(figs[1]!.toBill).toBe(1000) // 50% of 4000 − 1000 paid
    expect(figs[2]!.toBill).toBe(500)
    expect(figs[3]!.toBill).toBe(1000)
    expect(capableToBillTotalWithPlans(working, inputs, today)).toBe(1500 + 1000 + 500 + 1000)
  })

  it('nets a discount into the stage it applies to, so the figure is what the draw would bill', () => {
    const discounted = job({
      id: 'a',
      revenue: 2700,
      fixtures: [
        fx('f1', 'Rough-in', 1000),
        fx('f2', 'Top-out', 2000),
        { ...fx('f8', 'Negotiated discount', -300, { stage_kind: null }), line_kind: 'discount', discount_pct: 10, discount_basis_positions: null },
      ],
    })
    const plan = jobStagePlanFromRow(discounted, inputs, today)
    expect(plan?.rows.map((r) => [r.fixtureId, r.amount])).toEqual([
      ['f1', 900],
      ['f2', 1800],
    ])
    expect(capableToBillTotalWithPlans([discounted], inputs, today)).toBe(900)
    // A discount row never becomes a stage; an unnamed row never enters the plan.
    expect(stagePlanFixturesFromRows([fx('x', '', 5), fx('y', 'Named', 5, { line_kind: 'discount' })])).toEqual([])
  })

  it('breakdown rows keep positive figures only, largest first, each saying where it came from', () => {
    const over = job({ id: 'e', revenue: 1000, pct_complete: 20, invoices: [{ id: 'i', status: 'billed', amount: 900 }], fixtures: [] })
    const rows = buildCapableToBillBreakdownRowsWithPlans([over, stagedJob, job({ id: 'f', revenue: 8000, pct_complete: 50 })], inputs, today)
    expect(rows.map((r) => [r.job.id, r.toBill, r.source])).toEqual([
      ['f', 4000, 'formula'],
      ['a', 1500, 'plan'],
    ])
  })

  it('slices the fetched inputs per job through the window → order → sheet chain', () => {
    const s = sliceWorkingStageInputs(inputs, 'zzz')
    expect(s.windows.map((w) => w.id)).toEqual(['w9'])
    expect(s.orders.map((o) => o.id)).toEqual(['o9'])
    expect(s.sheets.map((x) => x.id)).toEqual(['s9'])
    expect(sliceWorkingStageInputs(inputs, 'nobody')).toEqual({ windows: [], orders: [], sheets: [] })
  })
})
