/**
 * Stage Plan ↔ the Job form (PR 2): reading the stage columns off a DB
 * fixture row, and building the plan from the form's live line items (array
 * position is the order — the save engine persists it as sequence_order).
 */
import type { FixtureRow } from './jobFormTypes'
import {
  buildStagePlan,
  type StageKind,
  type StagePlan,
  type StagePlanFixture,
  type StagePlanInvoice,
  type StagePlanOrder,
  type StagePlanPayment,
  type StagePlanRow,
  type StagePlanSheet,
  type StagePlanWindow,
} from './stagePlan'

export const isStageKind = (v: unknown): v is StageKind => v === 'order' || v === 'any'

/** The stage columns off a DB fixture row — read loosely so a row loaded before the push reads as plain. */
export function fixtureStageFields(f: unknown): { stage_kind: StageKind | null; shared_with_gc: boolean } {
  const r = (f ?? {}) as { stage_kind?: unknown; shared_with_gc?: unknown }
  return { stage_kind: isStageKind(r.stage_kind) ? r.stage_kind : null, shared_with_gc: r.shared_with_gc === true }
}

/** A form row's kind: `undefined` (never loaded / newly added) = Any time, the column default. */
export const formFixtureKind = (f: Pick<FixtureRow, 'stage_kind'>): StageKind | null => (f.stage_kind === undefined ? 'any' : f.stage_kind)

/** Named rows only, in form order. */
export function stagePlanFixturesFromForm(fixtures: FixtureRow[]): StagePlanFixture[] {
  return fixtures
    .filter((f) => (f.name ?? '').trim().length > 0)
    .map((f, i) => ({
      id: f.id,
      name: f.name,
      count: Number(f.count) || 1,
      line_unit_price: f.line_unit_price,
      sequence_order: i,
      invoice_id: f.invoice_id,
      stage_kind: formFixtureKind(f),
      shared_with_gc: f.shared_with_gc ?? false,
      // v2.3192: the column lands with migration 20260909141454; read it loosely until types regenerate.
      progress_pct: typeof (f as { progress_pct?: unknown }).progress_pct === 'number' ? ((f as { progress_pct?: number }).progress_pct ?? null) : null,
    }))
}

export type StagePlanFormInputs = {
  fixtures: FixtureRow[]
  windows: StagePlanWindow[]
  orders: StagePlanOrder[]
  sheets: StagePlanSheet[]
  invoices: StagePlanInvoice[]
  payments: StagePlanPayment[]
  todayYmd: string
}

export function stagePlanFromForm(args: StagePlanFormInputs): StagePlan {
  return buildStagePlan({ ...args, fixtures: stagePlanFixturesFromForm(args.fixtures) })
}

/** "Draw 2 · Top-out" / "◆ Relocate water heater" — what an invoice bills, by the rows linked to it. */
export function drawLabelsByInvoiceId(plan: StagePlan): Record<string, string> {
  const byInvoice = new Map<string, StagePlanRow[]>()
  for (const r of plan.rows) {
    if (!r.invoiceId) continue
    byInvoice.set(r.invoiceId, [...(byInvoice.get(r.invoiceId) ?? []), r])
  }
  const out: Record<string, string> = {}
  for (const [id, rows] of byInvoice) out[id] = rows.map(drawRowLabel).join(' + ')
  return out
}

/** The "Still to bill" list: uninvoiced money with a rule behind it, in plan order. */
export function upcomingDrawRows(plan: StagePlan): StagePlanRow[] {
  return plan.rows.filter((r) => !r.invoiceId && r.amount > 0 && (r.draw === 'ready' || r.draw === 'waits' || r.draw === 'later'))
}

export function drawRowLabel(r: StagePlanRow): string {
  if (r.kind === 'order') return `Draw ${r.number} · ${r.name}`
  if (r.kind === 'any') return `◆ ${r.name}`
  return r.name
}
