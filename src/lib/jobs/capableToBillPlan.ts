/**
 * Capable of Being Billed, read from the Stage Plan (to-dos/stage-plan-residuals
 * item 1). The Pipeline's Working header and the Capable list used to sum one
 * formula per job — value created by % complete, less what was paid and what
 * is already asked for (`jobCapableToBillAmounts`). A job split into Order
 * stages has a better answer: the plan's `billable()` — the stages that passed
 * inspection with nothing above them unbilled, and the Any rows whose work is
 * done. This kernel builds each Working job's plan from the fixtures the board
 * row already carries plus the windows / orders / sheets one paged fetch
 * brings (`useWorkingStagePlanInputs`), and hands the header the sum.
 *
 * The rule: a job with at least one Order stage reads its plan; every other
 * job keeps the formula (its rows are all Any or plain — the plan has no
 * sequence to enforce, and a job the office never split must not read $0
 * because no row is "done"). Lean stats rows carry no fixtures and stay on
 * the formula too, and so does every job while the fetch is still out (the
 * hook hands back null) — the number never flashes to zero.
 */
import { billable, buildStagePlan, type StageBillable, type StagePlan, type StagePlanFixture, type StagePlanInvoice, type StagePlanOrder, type StagePlanPayment, type StagePlanSheet, type StagePlanWindow } from './stagePlan'
import { discountRowsFromDb, discountSharesByWorkRow, isDiscountRow, netWorkLineCents } from './discountLine'
import { fixtureStageFields } from './stagePlanForm'
import { jobCapableToBillAmounts } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/** The three tables the board rows don't carry, for every Working job at once (the `loadGcStageInputs` shape, client-side). */
export type WorkingStageInputs = {
  windows: Array<StagePlanWindow & { job_id: string }>
  orders: StagePlanOrder[]
  sheets: StagePlanSheet[]
}

export const EMPTY_WORKING_STAGE_INPUTS: WorkingStageInputs = { windows: [], orders: [], sheets: [] }

/** One job's slice: its windows, the live order on each, and those orders' sheets. */
export function sliceWorkingStageInputs(inputs: WorkingStageInputs, jobId: string): { windows: StagePlanWindow[]; orders: StagePlanOrder[]; sheets: StagePlanSheet[] } {
  const windows = inputs.windows.filter((w) => w.job_id === jobId)
  if (windows.length === 0) return { windows: [], orders: [], sheets: [] }
  const windowIds = new Set(windows.map((w) => w.id))
  const orders = inputs.orders.filter((o) => !!o.stage_window_id && windowIds.has(o.stage_window_id))
  const sheetIds = new Set(orders.map((o) => o.labor_job_id).filter((id): id is string => !!id))
  const sheets = sheetIds.size > 0 ? inputs.sheets.filter((s) => sheetIds.has(s.id)) : []
  return { windows, orders, sheets }
}

type LooseFixture = {
  id: string
  name: string
  count: number | null
  line_unit_price: number | null
  sequence_order: number | null
  invoice_id: string | null
  line_kind: string | null
  discount_pct: number | string | null
  discount_basis_positions: number[] | null
  progress_pct: number | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)

/** A board fixture row read loosely — a row loaded before a column landed reads as its default. */
function readFixtureRow(f: unknown, i: number): LooseFixture | null {
  const r = (f ?? {}) as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id) return null
  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : '',
    count: num(r.count),
    line_unit_price: num(r.line_unit_price),
    sequence_order: num(r.sequence_order) ?? i,
    invoice_id: typeof r.invoice_id === 'string' ? r.invoice_id : null,
    line_kind: typeof r.line_kind === 'string' ? r.line_kind : null,
    discount_pct: num(r.discount_pct),
    discount_basis_positions: Array.isArray(r.discount_basis_positions) ? r.discount_basis_positions.filter((p): p is number => typeof p === 'number') : null,
    progress_pct: num(r.progress_pct),
  }
}

/**
 * Board fixture rows → plan fixtures: named rows only, discount rows folded
 * into the work rows they apply to (each row's amount is what its draw would
 * bill — the same netting the Bill tab's `stagePlanFixturesFromForm` does).
 */
export function stagePlanFixturesFromRows(rows: ReadonlyArray<unknown>): StagePlanFixture[] {
  const named = rows
    .map((f, i) => ({ raw: f, row: readFixtureRow(f, i) }))
    .filter((x): x is { raw: unknown; row: LooseFixture } => x.row != null && x.row.name.trim().length > 0)
    .sort((a, b) => (a.row.sequence_order ?? 0) - (b.row.sequence_order ?? 0))
  const kernelRows = discountRowsFromDb(named.map((x) => x.row))
  const shares = discountSharesByWorkRow(kernelRows)
  const out: StagePlanFixture[] = []
  named.forEach((x, i) => {
    const k = kernelRows[i]
    if (!k || isDiscountRow(k)) return
    const stage = fixtureStageFields(x.raw)
    out.push({
      id: x.row.id,
      name: x.row.name,
      count: 1,
      line_unit_price: netWorkLineCents(kernelRows, k, shares) / 100,
      sequence_order: i,
      invoice_id: x.row.invoice_id,
      stage_kind: stage.stage_kind,
      shared_with_gc: stage.shared_with_gc,
      progress_pct: x.row.progress_pct,
    })
  })
  return out
}

/** The board row fields the plan reads; `fixtures` is read loosely (lean rows carry none). */
export type CapableToBillPlanJob = Pick<JobWithDetails, 'id' | 'revenue' | 'payments_made' | 'pct_complete' | 'invoices' | 'payments'> & {
  fixtures?: ReadonlyArray<unknown> | null
}

const planInvoices = (job: CapableToBillPlanJob): StagePlanInvoice[] =>
  (job.invoices ?? []).map((i) => {
    const r = i as { id: string; status: string | null; billed_at?: string | null; sent_to_customer_at?: string | null }
    return { id: r.id, status: r.status ?? '', billed_at: r.billed_at ?? null, sent_to_customer_at: r.sent_to_customer_at ?? null }
  })
const planPayments = (job: CapableToBillPlanJob): StagePlanPayment[] =>
  (job.payments ?? []).map((p) => {
    const r = p as { invoice_id: string | null; paid_on?: string | null }
    return { invoice_id: r.invoice_id ?? null, paid_on: r.paid_on ?? null }
  })

/** A Working job's plan from its board row + the fetched inputs; null when the row carries no line items. */
export function jobStagePlanFromRow(job: CapableToBillPlanJob, inputs: WorkingStageInputs, todayYmd: string = todayYmdInAppTz()): StagePlan | null {
  const fixtures = stagePlanFixturesFromRows(job.fixtures ?? [])
  if (fixtures.length === 0) return null
  return buildStagePlan({ fixtures, ...sliceWorkingStageInputs(inputs, job.id), invoices: planInvoices(job), payments: planPayments(job), todayYmd })
}

/** A job reads its plan when the office split it into at least one Order stage. */
export const jobReadsStagePlan = (plan: StagePlan | null): plan is StagePlan => plan != null && plan.orderCount > 0

export type CapableToBillFigure<T extends CapableToBillPlanJob> = {
  job: T
  /** The plan's `billable()` sum on a plan job; the formula's `toBill` (may be negative) otherwise. */
  toBill: number
  valueCreated: number
  openBilling: number
  source: 'plan' | 'formula'
  /** The rows the plan says may be billed now (plan jobs only). */
  billableRows: StageBillable[]
}

/**
 * One figure per Working job. `inputs` null = the fetch hasn't landed (or
 * failed) — every job reads the formula, exactly the pre-plan header.
 */
export function capableToBillFigures<T extends CapableToBillPlanJob>(working: readonly T[], inputs: WorkingStageInputs | null, todayYmd: string = todayYmdInAppTz()): Array<CapableToBillFigure<T>> {
  return working.map((job) => {
    const formula = jobCapableToBillAmounts(job)
    const plan = inputs ? jobStagePlanFromRow(job, inputs, todayYmd) : null
    if (!jobReadsStagePlan(plan)) return { job, ...formula, source: 'formula', billableRows: [] }
    const rows = billable(plan)
    return { job, toBill: rows.reduce((s, r) => s + r.amount, 0), valueCreated: formula.valueCreated, openBilling: formula.openBilling, source: 'plan', billableRows: rows }
  })
}

/** Working header total: Σ positive figures (plan jobs read their plan, the rest the formula). */
export function capableToBillTotalWithPlans(working: readonly CapableToBillPlanJob[], inputs: WorkingStageInputs | null, todayYmd?: string): number {
  return capableToBillFigures(working, inputs, todayYmd).reduce((s, f) => s + Math.max(0, f.toBill), 0)
}

/** Capable list rows: positive figures only, largest first. */
export function buildCapableToBillBreakdownRowsWithPlans<T extends CapableToBillPlanJob>(working: readonly T[], inputs: WorkingStageInputs | null, todayYmd?: string): Array<CapableToBillFigure<T>> {
  return capableToBillFigures(working, inputs, todayYmd)
    .filter((f) => f.toBill > 0)
    .sort((a, b) => b.toBill - a.toBill)
}
