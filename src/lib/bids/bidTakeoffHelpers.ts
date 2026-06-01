/**
 * Pure takeoff helpers and small takeoff types for the Bids page, extracted from `src/pages/Bids.tsx`.
 */

import type { BidCountRow } from '../../types/bids'

export type TakeoffStage = 'rough_in' | 'top_out' | 'trim_set'
export type MaterialsModel = 'exact' | 'rough'

export const STAGE_LABELS: Record<TakeoffStage, string> = { rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set' }

export function clampRoughQtyFromDraft(draft: string): number {
  const t = draft.trim()
  if (t === '' || t === '.') return 0.0001
  const n = parseFloat(t)
  if (Number.isNaN(n)) return 0.0001
  return Math.max(0.0001, n)
}

export function roughQtyToDraftString(q: number): string {
  if (!Number.isFinite(q) || q <= 0) return '0.0001'
  return String(q)
}

export function normalizeMaterialsModel(v: string | null | undefined): MaterialsModel {
  return v === 'rough' ? 'rough' : 'exact'
}

/** Takeoffs: single-column label for fixture + count row (e.g. `(5) Toilet`). */
export function takeoffFixtureCountLabel(row: Pick<BidCountRow, 'fixture' | 'count'>): string {
  const name = (row.fixture ?? '').trim()
  const n = Number(row.count)
  if (name) return `(${n}) ${name}`
  return `(${n})`
}

export function sumRoughLinesPreTax(lines: Array<{ quantity: number; unit_price: number }>): number {
  return lines.reduce((s, r) => s + Number(r.quantity) * Number(r.unit_price), 0)
}

/**
 * Fixture-count multiplier for Combined (rough) takeoff lines: a rough line's material cost is
 * `fixtureCount × quantity × unit_price` (so 2 of a fixture doubles its parts), mirroring how
 * By Stage assemblies default their quantity to the fixture count. A missing/zero/invalid count
 * falls back to 1 (no multiplication), preserving prior behavior for those edge rows.
 */
export function roughCountMultiplier(count: number | string | null | undefined): number {
  const c = Number(count)
  return Number.isFinite(c) && c > 0 ? c : 1
}

/** Count-weighted pre-tax rough materials total: Σ fixtureCount × quantity × unit_price. */
export function sumRoughLinesPreTaxWithCount(
  lines: Array<{ count_row_id?: string | null; quantity: number; unit_price: number }>,
  countByRowId: ReadonlyMap<string, number | string | null | undefined>,
): number {
  return lines.reduce((s, l) => {
    const count = l.count_row_id != null ? countByRowId.get(l.count_row_id) : undefined
    return s + Number(l.quantity) * Number(l.unit_price) * roughCountMultiplier(count)
  }, 0)
}

export function mergePartLinesToTakeoffTemplateItems(
  lines: Array<{ partId: string; quantity: number }>
): Array<{ item_type: 'part' | 'template'; part_id: string | null; nested_template_id: string | null; quantity: number }> {
  const merged: Array<{
    item_type: 'part' | 'template'
    part_id: string | null
    nested_template_id: string | null
    quantity: number
  }> = []
  for (const line of lines) {
    const pid = line.partId.trim()
    if (!pid) continue
    const qty = Math.max(0.0001, Number(line.quantity) || 0.0001)
    const existing = merged.find((m) => m.item_type === 'part' && m.part_id === pid)
    if (existing) {
      existing.quantity += qty
    } else {
      merged.push({
        item_type: 'part',
        part_id: pid,
        nested_template_id: null,
        quantity: qty,
      })
    }
  }
  return merged
}
