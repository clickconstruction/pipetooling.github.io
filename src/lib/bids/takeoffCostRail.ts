import type { CoverageLine, TakeoffCoverageSummary } from './takeoffCoverage'
import { roughCountMultiplier } from './bidTakeoffHelpers'
import { orderIncrementChip } from '../materials/orderIncrement'
import type { TakeoffOrderRounding } from './takeoffOrderRounding'

/**
 * New 2 — "Cost rail" (docs/TAKEOFFS_REFRESH_PLAN.md, mockup C): the pure
 * parts of the right-hand rail — the unpriced-parts queue and the RFQ scope
 * it turns into, and the per-fixture unit-cost list Pricing reads.
 */

export type ZeroPriceQueueItem = {
  lineId: string
  countRowId: string
  fixture: string
  count: number | string | null | undefined
  unit: string | null | undefined
  partId: string
  partName: string
  quantity: number
}

/** Part lines at $0, with their fixture — what "Needs a price" lists. Bundle lines are not parts and are skipped. */
export function zeroPriceQueue(
  countRows: ReadonlyArray<{ id: string; fixture: string | null | undefined; count: number | string | null | undefined; unit?: string | null }>,
  lines: ReadonlyArray<CoverageLine>,
  partNameById: ReadonlyMap<string, string>,
): ZeroPriceQueueItem[] {
  const rowById = new Map(countRows.map((r) => [r.id, r]))
  const out: ZeroPriceQueueItem[] = []
  for (const l of lines) {
    if (!l.partId || Number(l.unitPrice) !== 0) continue
    const row = rowById.get(l.countRowId)
    if (!row) continue
    out.push({
      lineId: l.id,
      countRowId: row.id,
      fixture: String(row.fixture ?? ''),
      count: row.count,
      unit: row.unit,
      partId: l.partId,
      partName: partNameById.get(l.partId) ?? 'Part',
      quantity: Number(l.quantity) || 1,
    })
  }
  return out
}

/**
 * The scope `RfqComposeModal` takes — one line per fixture that carries an
 * unpriced part, and a note listing the parts to quote — so the supply house
 * knows exactly what is missing a price.
 */
export function rfqScopeForZeroPrice(
  queue: ReadonlyArray<ZeroPriceQueueItem>,
  /** v2.3409: with the bid's rounding, a part sold in packs is quoted at its ORDERED quantity. */
  rounding?: TakeoffOrderRounding | null,
): { lines: Array<{ fixture: string; count: number; unit?: string | null }>; text: string } {
  const byRow = new Map<string, ZeroPriceQueueItem[]>()
  for (const q of queue) {
    const list = byRow.get(q.countRowId) ?? []
    list.push(q)
    byRow.set(q.countRowId, list)
  }
  const lines = [...byRow.values()].map((items) => {
    const first = items[0]!
    return { fixture: first.fixture, count: Number(first.count) || 1, unit: first.unit ?? null }
  })
  // The bid's need per part — quantity × fixture count, summed — not the per-fixture quantity.
  const parts = new Map<string, { name: string; needed: number }>()
  for (const q of queue) {
    const cur = parts.get(q.partId) ?? { name: q.partName, needed: 0 }
    cur.needed += q.quantity * roughCountMultiplier(q.count)
    parts.set(q.partId, cur)
  }
  const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))
  const text = [
    'Please quote these parts (no catalog price on file):',
    ...[...parts].map(([partId, p]) => {
      const r = rounding?.byPartId.get(partId)
      if (r && r.ordered > 0) {
        const ft = r.unit === 'ft_stick' || r.unit === 'ft_coil' ? ' ft' : ''
        return `• ${p.name} × ${num(r.ordered)}${ft} (${num(r.needed)}${ft} needed · ${orderIncrementChip({ increment: r.increment, unit: r.unit })} ${r.unit === 'ft_stick' ? 'sticks' : r.unit === 'ft_coil' ? 'coils' : 'packs'})`
      }
      return `• ${p.name} × ${num(p.needed)}`
    }),
  ].join('\n')
  return { lines, text }
}

export type FixtureUnitCost = { countRowId: string; fixture: string; unitCost: number; total: number; incomplete: boolean }

/** Per-fixture unit costs for "What Pricing sees", costed fixtures only, in row order. */
export function fixtureUnitCosts(
  countRows: ReadonlyArray<{ id: string; fixture: string | null | undefined }>,
  coverage: TakeoffCoverageSummary,
): FixtureUnitCost[] {
  const out: FixtureUnitCost[] = []
  for (const r of countRows) {
    const f = coverage.perFixture.get(r.id)
    if (!f || f.lineCount === 0) continue
    out.push({ countRowId: r.id, fixture: String(r.fixture ?? ''), unitCost: f.unitCost, total: f.total, incomplete: f.hasZeroPriceLine })
  }
  return out
}
