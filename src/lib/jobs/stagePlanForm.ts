/**
 * Stage Plan ↔ the Job form (PR 2): reading the stage columns off a DB
 * fixture row, and building the plan from the form's live line items (array
 * position is the order — the save engine persists it as sequence_order).
 */
import type { FixtureRow } from './jobFormTypes'
import { discountSharesByWorkRow, isDiscountRow, netWorkLineCents } from './discountLine'
import type { JobDollarCoverage } from './jobSegmentsCoverage'
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

/**
 * Named rows only, in form order. Discount rows (v2.3252+) are never stages
 * and never appear in the plan; each work row's amount is NET of the
 * discount shares that follow it, so a draw reads as what it will bill.
 * Positions still count every named row (the save engine's numbering).
 */
export function stagePlanFixturesFromForm(fixtures: FixtureRow[]): StagePlanFixture[] {
  const named = fixtures.filter((f) => (f.name ?? '').trim().length > 0)
  const shares = discountSharesByWorkRow(named)
  return named
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !isDiscountRow(f))
    .map(({ f, i }) => ({
      id: f.id,
      name: f.name,
      count: 1,
      line_unit_price: netWorkLineCents(named, f, shares) / 100,
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

/** An unbilled stage row: what is already billed against it by amount, and what is left. */
export type UpcomingDrawRow = StagePlanRow & { coveredDollars: number; leftDollars: number }

/**
 * Uninvoiced money with a rule behind it, in plan order: the old Still to bill list, and since v2.4307
 * what the ② money card's rows read for ready / waits (`billTabLines`).
 *
 * v2.4303: a bill made by amount names no line, so the plan reads its lines as unbilled. Given the
 * Bill tab's `coverage` (the waterfall the ② strip hatches with), a line covered to the cent leaves
 * the list, a line covered in part stays for what is left, and a passed stage no longer waits on a
 * stage above it that is covered to the cent. The plan itself, shared with the portal, is unchanged.
 */
export function upcomingDrawRows(plan: StagePlan, coverage?: JobDollarCoverage | null): UpcomingDrawRow[] {
  const coveredCents = (r: StagePlanRow) =>
    Math.min(Math.round(r.amount * 100), Math.round((coverage?.bySegmentKey[r.fixtureId]?.coveredDollars ?? 0) * 100))
  const fullyCovered = (r: StagePlanRow) => r.amount > 0 && coveredCents(r) >= Math.round(r.amount * 100)
  const out: UpcomingDrawRow[] = []
  for (const r of plan.rows) {
    if (r.invoiceId || r.amount <= 0 || !(r.draw === 'ready' || r.draw === 'waits' || r.draw === 'later')) continue
    if (fullyCovered(r)) continue
    let draw = r.draw
    if (draw === 'waits' && r.number != null) {
      const holding = plan.rows.some(
        (p) => p.kind === 'order' && p.number != null && p.number < r.number! && !p.invoiceId && p.amount > 0 && !fullyCovered(p),
      )
      if (!holding) draw = 'ready'
    }
    const c = coveredCents(r)
    out.push({ ...r, draw, coveredDollars: c / 100, leftDollars: (Math.round(r.amount * 100) - c) / 100 })
  }
  return out
}

export function drawRowLabel(r: StagePlanRow): string {
  if (r.kind === 'order') return `Draw ${r.number} · ${r.name}`
  if (r.kind === 'any') return `◆ ${r.name}`
  return r.name
}
