import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — tested here.
import { gcPortalStages } from '../../../supabase/functions/_shared/gcStages'
import type { StagePlanFixture, StagePlanOrder } from '../jobs/stagePlan'

const fx = (over: Partial<StagePlanFixture> & { id: string; name: string; sequence_order: number }): StagePlanFixture => ({ count: 1, line_unit_price: 1000, invoice_id: null, stage_kind: 'order', shared_with_gc: true, ...over })
const FIX: StagePlanFixture[] = [
  fx({ id: 'f-rough', name: 'Rough-in', sequence_order: 1, invoice_id: 'inv-1' }),
  fx({ id: 'f-top', name: 'Top-out', sequence_order: 2 }),
  fx({ id: 'f-trim', name: 'Trim & final', sequence_order: 3 }),
  fx({ id: 'f-final', name: 'Final inspection', sequence_order: 4, shared_with_gc: false }),
  fx({ id: 'f-co', name: 'Relocate water heater', sequence_order: 5, stage_kind: 'any' }),
]
const WIN = [
  { id: 'w-rough', fixture_id: 'f-rough', window_start: '2026-09-01', window_end: '2026-09-05' },
  { id: 'w-top', fixture_id: 'f-top', window_start: '2026-09-08', window_end: '2026-09-12' },
  { id: 'w-trim', fixture_id: 'f-trim', window_start: '2026-09-22', window_end: '2026-10-02', asked_at: '2026-09-09T15:00:00Z', asked_start: '2026-09-24', asked_end: '2026-10-02' },
]
type OrderWithName = StagePlanOrder & { display_name: string }
const ORD: OrderWithName[] = [
  { id: 'o1', stage_window_id: 'w-rough', status: 'settled', picked_start: '2026-09-01', picked_end: '2026-09-03', labor_job_id: 's1', display_name: 'Behar Kraja' },
  { id: 'o2', stage_window_id: 'w-top', status: 'accepted', picked_start: '2026-09-09', picked_end: '2026-09-10', labor_job_id: 's2', display_name: 'Behar Kraja' },
]
const SHEETS = [
  { id: 's1', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-04T15:00:00Z' },
  { id: 's2', stage: 'working', progress_pct: 50 },
]

describe('gcPortalStages', () => {
  const out = gcPortalStages({ fixtures: FIX, windows: WIN, orders: ORD, sheets: SHEETS, invoices: [{ id: 'inv-1', status: 'paid' }], payments: [{ invoice_id: 'inv-1', paid_on: '2026-09-06' }], todayYmd: '2026-09-09' })

  it('one sequence of the shared Order rows: done, now, next (the only askable), never the unshared row', () => {
    expect(out.view.headline).toBe('Stage 2 of 3 · Top-out · on site now')
    expect(out.view.steps.map((s) => [s.number, s.name, s.state, s.askable])).toEqual([
      [1, 'Rough-in', 'done', false],
      [2, 'Top-out', 'now', false],
      [3, 'Trim & final', 'next', true],
    ])
    expect(out.view.steps[2]!.line).toBe("You asked for Sep 24 – Oct 2 · we'll confirm")
    expect(out.view.also).toEqual([{ name: 'Relocate water heater', state: 'later', line: 'Not scheduled yet' }])
  })

  it('the ask lands on the next step\'s window', () => {
    expect(out.askWindowId).toBe('w-trim')
    expect(out.askFixtureId).toBe('f-trim')
  })

  it('never a name, never "offered", no money', () => {
    const json = JSON.stringify(out)
    expect(json).not.toContain('Behar')
    expect(json).not.toContain('display_name')
    expect(json).not.toContain('offered')
    expect(json).not.toContain('1000')
  })

  it('no ask window when the next step has none', () => {
    const o = gcPortalStages({ fixtures: FIX, windows: WIN.slice(0, 2), orders: ORD, sheets: SHEETS, invoices: [{ id: 'inv-1', status: 'paid' }], payments: [{ invoice_id: 'inv-1', paid_on: '2026-09-06' }], todayYmd: '2026-09-09' })
    expect(o.askFixtureId).toBe('f-trim')
    expect(o.askWindowId).toBeNull()
  })
})
