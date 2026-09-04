import { roughCountMultiplier, sumRoughLinesPreTaxWithCount } from './bidTakeoffHelpers'

/**
 * Coverage math for the Takeoffs refresh (docs/TAKEOFFS_REFRESH_PLAN.md,
 * decision 9): a fixture is COSTED when it has at least one Combined line,
 * even a $0 one; $0 lines are surfaced separately. The materials total is
 * `sumRoughLinesPreTaxWithCount` — the same number the Labor tab and the
 * Workbench already show — so the strip can never disagree with Pricing.
 */

export type CoverageCountRow = { id: string; count: number | string | null | undefined }

export type CoverageLine = {
  id: string
  countRowId: string
  partId: string | null
  quantity: number
  unitPrice: number
  sourceMaterialPartPriceId: string | null
  sourceTemplateId: string | null
}

export type FixtureCoverage = {
  countRowId: string
  lineCount: number
  /** Cost of one unit of the fixture (Σ qty × price over its lines). */
  unitCost: number
  /** unitCost × the row's count (feet for `ft of` rows). */
  total: number
  hasZeroPriceLine: boolean
}

export type TakeoffCoverageSummary = {
  fixtures: number
  costed: number
  uncostedIds: string[]
  /** 0–100, rounded; 0 when there are no fixtures. */
  costedPct: number
  materialsTotal: number
  zeroPriceLineIds: string[]
  bundleLineCount: number
  overrideLineCount: number
  perFixture: Map<string, FixtureCoverage>
}

/** True for an assembly bought as one bundle line (no part, a source template). */
export function isBundleLine(line: Pick<CoverageLine, 'partId' | 'sourceTemplateId'>): boolean {
  return line.partId == null && line.sourceTemplateId != null
}

/** True for a part line whose price was typed or picked away from the catalog's lowest. */
export function isOverrideLine(line: Pick<CoverageLine, 'partId' | 'sourceMaterialPartPriceId' | 'unitPrice'>): boolean {
  return line.partId != null && line.sourceMaterialPartPriceId == null && Number(line.unitPrice) > 0
}

export function summarizeTakeoffCoverage(
  countRows: ReadonlyArray<CoverageCountRow>,
  lines: ReadonlyArray<CoverageLine>,
): TakeoffCoverageSummary {
  const countByRowId = new Map<string, number | string | null | undefined>(countRows.map((r) => [r.id, r.count]))
  const perFixture = new Map<string, FixtureCoverage>()
  for (const r of countRows) {
    perFixture.set(r.id, { countRowId: r.id, lineCount: 0, unitCost: 0, total: 0, hasZeroPriceLine: false })
  }
  const zeroPriceLineIds: string[] = []
  let bundleLineCount = 0
  let overrideLineCount = 0
  for (const l of lines) {
    const f = perFixture.get(l.countRowId)
    if (!f) continue
    f.lineCount += 1
    f.unitCost += Number(l.quantity) * Number(l.unitPrice)
    if (Number(l.unitPrice) === 0) {
      f.hasZeroPriceLine = true
      zeroPriceLineIds.push(l.id)
    }
    if (isBundleLine(l)) bundleLineCount += 1
    if (isOverrideLine(l)) overrideLineCount += 1
  }
  for (const f of perFixture.values()) {
    f.total = f.unitCost * roughCountMultiplier(countByRowId.get(f.countRowId))
  }
  const uncostedIds = countRows.filter((r) => (perFixture.get(r.id)?.lineCount ?? 0) === 0).map((r) => r.id)
  const fixtures = countRows.length
  const costed = fixtures - uncostedIds.length
  const materialsTotal = sumRoughLinesPreTaxWithCount(
    lines.map((l) => ({ count_row_id: l.countRowId, quantity: l.quantity, unit_price: l.unitPrice })),
    countByRowId,
  )
  return {
    fixtures,
    costed,
    uncostedIds,
    costedPct: fixtures === 0 ? 0 : Math.round((100 * costed) / fixtures),
    materialsTotal,
    zeroPriceLineIds,
    bundleLineCount,
    overrideLineCount,
    perFixture,
  }
}

/** The next uncosted fixture after `afterId` in row order (wrapping), or null when all are costed. */
export function nextUncostedFixtureId(
  countRows: ReadonlyArray<{ id: string }>,
  uncostedIds: ReadonlyArray<string>,
  afterId: string | null,
): string | null {
  if (uncostedIds.length === 0) return null
  const uncosted = new Set(uncostedIds)
  const order = countRows.map((r) => r.id)
  const start = afterId ? order.indexOf(afterId) : -1
  for (let i = 1; i <= order.length; i++) {
    const id = order[(start + i) % order.length]
    if (id != null && uncosted.has(id) && id !== afterId) return id
  }
  return null
}
