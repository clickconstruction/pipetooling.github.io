/**
 * DB fixture rows → Edit Job form rows (v2.3252+). One place for the two
 * hydration rules a discount row needs:
 *   - `discount_basis_positions` (stored) → `discount_basis_ids` (form), keyed
 *     on the rows' `sequence_order` the way invoice links are.
 *   - a LEGACY negative work row — a change-order credit line that "Apply to
 *     job" wrote before discounts existed — reads as a fixed dollar discount,
 *     so the next autosave keeps it instead of nulling the price.
 * The result is run through `syncDiscountRows` so state is invariant-true
 * from the first render.
 */
import { discountBasisIdsFromPositions, syncDiscountRows } from './discountLine'
import type { FixtureRow } from './jobFormTypes'
import { fixtureStageFields } from './stagePlanForm'

export type DbFixtureRowLike = {
  id: string
  name: string
  count: number | null
  line_unit_price: number | string | null
  line_description: string | null
  invoice_id?: string | null
  sequence_order: number
  line_kind?: string | null
  discount_pct?: number | string | null
  discount_basis_positions?: number[] | null
  discount_reason?: string | null
  stage_kind?: unknown
  shared_with_gc?: unknown
  /** Who pays this line (v2.3349): customer | gc | null. */
  bill_to_party?: unknown
}

const num = (v: unknown): number | null => (v != null && Number.isFinite(Number(v)) ? Number(v) : null)

export function fixtureRowsFromDb(rows: readonly DbFixtureRowLike[]): FixtureRow[] {
  const mapped: FixtureRow[] = rows.map((f) => {
    const price = num(f.line_unit_price)
    const base = {
      id: f.id,
      name: f.name,
      count: Number(f.count) || 1,
      line_unit_price: price,
      line_description: f.line_description ?? '',
      invoice_id: f.invoice_id ?? null,
    }
    if (f.line_kind === 'discount') {
      return {
        ...base,
        count: 1,
        line_kind: 'discount',
        discount_pct: num(f.discount_pct),
        discount_basis_ids: discountBasisIdsFromPositions(rows, f.discount_basis_positions ?? null),
        discount_reason: (f.discount_reason ?? '').trim() || null,
        stage_kind: null,
        shared_with_gc: false,
      }
    }
    if (price != null && price < 0) return legacyNegativeAsDiscount({ ...base, ...fixtureStageFields(f) })
    return {
      ...base,
      line_kind: 'work',
      ...fixtureStageFields(f),
      bill_to_party: f.bill_to_party === 'gc' || f.bill_to_party === 'customer' ? f.bill_to_party : null,
    }
  })
  return syncDiscountRows(mapped)
}

/** A negative-priced work row becomes a fixed dollar discount on every work row. */
export function legacyNegativeAsDiscount(row: FixtureRow): FixtureRow {
  const price = row.line_unit_price
  if (row.line_kind === 'discount' || price == null || !(price < 0)) return row
  const c = Number(row.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  return {
    ...row,
    count: 1,
    line_unit_price: Math.round(price * qty * 100) / 100,
    line_kind: 'discount',
    discount_pct: null,
    discount_basis_ids: null,
    discount_reason: null,
    stage_kind: null,
    shared_with_gc: false,
  }
}

/** Rows built client-side (an estimate import): legacy credit lines become discounts, then the invariants run. */
export function normalizeFormFixtureRows(rows: readonly FixtureRow[]): FixtureRow[] {
  return syncDiscountRows(rows.map(legacyNegativeAsDiscount))
}
