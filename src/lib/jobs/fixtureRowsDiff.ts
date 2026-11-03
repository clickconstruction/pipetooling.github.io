/**
 * The billing slice's line items, written in place (v2.6420, punch list #237).
 *
 * Until v2.6420 `writeBillingSlice` deleted every `jobs_ledger_fixtures` row of the job and
 * re-inserted the form's rows without their ids, so each save minted new line ids. The schema
 * took the rest: `ON DELETE CASCADE` on `fixture_id` deleted every answer, job item and skip of
 * a stage's checklist and the stage's window with the line; `ON DELETE SET NULL` took the stage
 * off a report photo and a job photo; the stage's crew-reported progress and the line's
 * `created_at`, never in the payload, reset; and the activity trigger wrote *Specific work
 * added* for every line on every save, since its dedupe keys on the line's id. The materials
 * slice had the same defect until v2.6111 and this is its shape: every row worth keeping is
 * upserted under its own id (a hydrated row keeps the id the database gave it, a new row the
 * one the form minted), then the job's rows not among them are deleted.
 *
 * The form's rows stay the whole truth of the job's lines, as they always were: a discount's
 * `discount_basis_positions` and an invoice's link by position both key on `sequence_order`
 * across the job's rows, so a line the form does not hold is not kept beside them. (The
 * payments diff keeps rows born mid-edit; no other payment reads a payment's position.)
 */
import { fixtureInsertRows } from './jobFormAutosaveSlices'
import type { FixtureRow } from './jobFormTypes'
import type { StageKind } from './stagePlan'

/**
 * One line as the upsert writes it: every column the slice owns, the same set on every row, so one
 * statement writes them all alike (a bulk upsert writes the union of its rows' columns, and a row
 * missing one there is written as null). Nothing the slice does not own — `created_at`, the
 * stage's progress columns — so an update leaves those as they are.
 */
export type FixtureUpsertRow = {
  id: string
  job_id: string
  name: string
  sequence_order: number
  line_description: string | null
  invoice_id: string | null
  count: number
  line_unit_price: number | null
  line_kind: 'work' | 'discount'
  discount_pct: number | null
  discount_basis_positions: number[] | null
  discount_reason: string | null
  stage_kind: StageKind | null
  shared_with_gc: boolean
  bill_to_party: 'customer' | 'gc' | null
  budget_labor_pct: number | null
  budget_materials_pct: number | null
  budget_source: 'workbench' | 'assumed' | 'tuned' | null
  budget_tuned_at: string | null
  budget_rate_usd: number | null
}

export type FixtureRowsDiff = {
  /** Every line worth keeping, keyed by its own id — upsert these (onConflict: id). */
  upserts: FixtureUpsertRow[]
  /** Their ids: the job's rows not among them are deleted. Empty means every line of the job goes. */
  keepIds: string[]
}

const NO_BUDGET = { budget_labor_pct: null, budget_materials_pct: null, budget_source: null, budget_tuned_at: null, budget_rate_usd: null } as const

/**
 * The lines worth keeping (named, as `fixtureInsertRows` filters them), each under its own id with
 * every column the slice owns, in form order; and the ids to keep. A row with no stored budget
 * writes the five budget columns as null, which is what the re-insert left them at.
 */
export function diffFixtureRows(jobId: string, fixtures: readonly FixtureRow[]): FixtureRowsDiff {
  const upserts: FixtureUpsertRow[] = fixtureInsertRows(jobId, [...fixtures]).map((row) => ({ ...NO_BUDGET, ...row }))
  return { upserts, keepIds: upserts.map((u) => u.id) }
}
