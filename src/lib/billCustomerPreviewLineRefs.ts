import type { Database } from '../types/database'
import { buildBillableServiceLinesFromFixtures, buildMaterialLinesFromMaterials, isBillableFixtureRow } from './physicalInvoiceLineItems'

type FixtureRow = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type MaterialRow = Database['public']['Tables']['jobs_ledger_materials']['Row']

/** Billable Specific Work rows in `sequence_order`, aligned with physical `serviceLines` / Stripe multi-line order. */
export function billableFixtureRefsInOrder(fixtures: FixtureRow[] | null | undefined): Array<
  Pick<FixtureRow, 'id' | 'name' | 'line_description'>
> {
  if (!fixtures?.length) return []
  const sorted = [...fixtures].sort((a, b) => {
    const ao = Number(a.sequence_order) || 0
    const bo = Number(b.sequence_order) || 0
    return ao - bo
  })
  return sorted
    .filter((row) => isBillableFixtureRow(row))
    .map((row) => ({
      id: row.id,
      name: row.name,
      line_description: row.line_description,
    }))
}

/** Materials rows in `sequence_order` with positive amount — aligned with physical `materialLines`. */
export function billableMaterialRefsInOrder(
  materials: MaterialRow[] | null | undefined,
): Array<Pick<MaterialRow, 'id' | 'description' | 'amount'>> {
  if (!materials?.length) return []
  const sorted = [...materials].sort((a, b) => {
    const ao = Number(a.sequence_order) || 0
    const bo = Number(b.sequence_order) || 0
    return ao - bo
  })
  const out: Array<Pick<MaterialRow, 'id' | 'description' | 'amount'>> = []
  for (const m of sorted) {
    const amt = Number(m.amount)
    const amount = Number.isFinite(amt) ? Math.round(amt * 100) / 100 : 0
    if (amount > 0) {
      out.push({ id: m.id, description: m.description, amount })
    }
  }
  return out
}

/**
 * True when physical preview uses real fixture+material breakdown rows (same line count as
 * `buildPhysicalInvoiceDocument` detailed tables), so each preview row maps to a DB id.
 */
export function physicalPreviewRowsAreDbBacked(
  fixtures: FixtureRow[] | null | undefined,
  materials: MaterialRow[] | null | undefined,
  billAmountDollars: number,
): boolean {
  if (!Number.isFinite(billAmountDollars) || billAmountDollars <= 0) return false
  const services = buildBillableServiceLinesFromFixtures(fixtures ?? [])
  const materialLines = buildMaterialLinesFromMaterials(materials ?? [])
  const t = services.reduce((s, x) => s + x.amount, 0) + materialLines.reduce((s, x) => s + x.amount, 0)
  return Math.abs(t - billAmountDollars) <= 0.02
}
