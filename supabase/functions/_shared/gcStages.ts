/**
 * The GC's view of a job's stages (v2.2933; rewritten for the Stage Plan,
 * PR 5). The customer-portal function loads a job's line items, windows,
 * orders, sheets, invoices and payments, and `gcPortalStages` hands back the
 * `GcView` the portal card draws — the shared Order rows as one numbered
 * sequence in the company's voice, the shared Any rows under "Also on this
 * job". Never a name: the plan's order input has no field for one. Tested
 * from src/lib/subs/gcStages.test.ts.
 */
import { buildStagePlan, gcView, type GcView, type StagePlanFixture, type StagePlanInvoice, type StagePlanOrder, type StagePlanPayment, type StagePlanSheet, type StagePlanWindow } from './stagePlan.ts'

export type GcStageInputs = {
  fixtures: StagePlanFixture[]
  windows: Array<StagePlanWindow & { job_id: string }>
  orders: StagePlanOrder[]
  sheets: StagePlanSheet[]
  invoices: Array<StagePlanInvoice & { job_id: string }>
  payments: Array<StagePlanPayment & { job_id: string }>
}

/** What the portal payload carries per job. `askWindowId` = the window on the `next` step, when it has one. */
export type GcPortalStages = { view: GcView; askWindowId: string | null; askFixtureId: string | null }

export function gcPortalStages(input: { fixtures: StagePlanFixture[]; windows: StagePlanWindow[]; orders: StagePlanOrder[]; sheets: StagePlanSheet[]; invoices: StagePlanInvoice[]; payments: StagePlanPayment[]; todayYmd: string }): GcPortalStages {
  const plan = buildStagePlan(input)
  const view = gcView(plan)
  const next = view.steps.find((s) => s.askable) ?? null
  const askWindowId = next ? (input.windows.find((w) => w.fixture_id === next.fixtureId)?.id ?? null) : null
  return { view, askWindowId, askFixtureId: next?.fixtureId ?? null }
}

/** The narrowest client shape the loader needs — the supabase-js admin client satisfies it. */
export type GcStageAdmin = {
  from(table: string): { select(columns: string): { in(column: string, values: string[]): PromiseLike<{ data: unknown }> } }
}

const FIXTURE_COLS = 'id, job_id, name, count, line_unit_price, sequence_order, invoice_id, stage_kind, shared_with_gc'
const WINDOW_COLS = 'id, job_id, fixture_id, window_start, window_end, asked_start, asked_end, asked_note, asked_at, answered_at, answer, answer_note'
const ORDER_COLS = 'id, stage_window_id, status, picked_start, picked_end, labor_job_id, change_requested_at'
const SHEET_COLS = 'id, stage, progress_pct, progress_at, stage_changed_at'
const INVOICE_COLS = 'id, job_id, status, billed_at, sent_to_customer_at'
const PAYMENT_COLS = 'job_id, invoice_id, paid_on'

/** Everything the plan needs for a set of jobs, in six reads. Orders are selected without `display_name`. */
export async function loadGcStageInputs(admin: GcStageAdmin, jobIds: string[]): Promise<GcStageInputs & { byJob: (jobId: string) => Parameters<typeof gcPortalStages>[0] extends infer P ? Omit<P, 'todayYmd'> : never }> {
  if (jobIds.length === 0) return { fixtures: [], windows: [], orders: [], sheets: [], invoices: [], payments: [], byJob: () => ({ fixtures: [], windows: [], orders: [], sheets: [], invoices: [], payments: [] }) }
  const [fx, wn, inv, pay] = await Promise.all([
    admin.from('jobs_ledger_fixtures').select(FIXTURE_COLS).in('job_id', jobIds),
    admin.from('job_stage_windows').select(WINDOW_COLS).in('job_id', jobIds),
    admin.from('jobs_ledger_invoices').select(INVOICE_COLS).in('job_id', jobIds),
    admin.from('jobs_ledger_payments').select(PAYMENT_COLS).in('job_id', jobIds),
  ])
  type FixtureRow = StagePlanFixture & { job_id: string }
  const fixtures = ((fx.data ?? []) as Array<Record<string, unknown>>).map((f) => ({
    id: String(f.id),
    job_id: String(f.job_id),
    name: typeof f.name === 'string' ? f.name : '',
    count: Number(f.count) || 0,
    line_unit_price: f.line_unit_price == null ? null : Number(f.line_unit_price),
    sequence_order: Number(f.sequence_order) || 0,
    invoice_id: typeof f.invoice_id === 'string' ? f.invoice_id : null,
    stage_kind: f.stage_kind === 'order' || f.stage_kind === 'any' ? f.stage_kind : null,
    shared_with_gc: f.shared_with_gc === true,
  })) as FixtureRow[]
  const windows = (wn.data ?? []) as Array<StagePlanWindow & { job_id: string }>
  const windowIds = windows.map((w) => w.id)
  const orders = windowIds.length > 0 ? ((await admin.from('step_commitments').select(ORDER_COLS).in('stage_window_id', windowIds)).data ?? []) as StagePlanOrder[] : []
  const sheetIds = [...new Set(orders.map((o) => o.labor_job_id).filter((id): id is string => !!id))]
  const sheets = sheetIds.length > 0 ? ((await admin.from('people_labor_jobs').select(SHEET_COLS).in('id', sheetIds)).data ?? []) as StagePlanSheet[] : []
  const invoices = (inv.data ?? []) as Array<StagePlanInvoice & { job_id: string }>
  const payments = (pay.data ?? []) as Array<StagePlanPayment & { job_id: string }>
  const orderByWindow = new Map(orders.map((o) => [o.stage_window_id, o]))
  const byJob = (jobId: string) => {
    const jw = windows.filter((w) => w.job_id === jobId)
    const jo = jw.map((w) => orderByWindow.get(w.id)).filter((o): o is StagePlanOrder => !!o)
    const sheetSet = new Set(jo.map((o) => o.labor_job_id))
    return {
      fixtures: fixtures.filter((f) => f.job_id === jobId),
      windows: jw,
      orders: jo,
      sheets: sheets.filter((s) => sheetSet.has(s.id)),
      invoices: invoices.filter((i) => i.job_id === jobId),
      payments: payments.filter((p) => p.job_id === jobId),
    }
  }
  return { fixtures, windows, orders, sheets, invoices, payments, byJob }
}
