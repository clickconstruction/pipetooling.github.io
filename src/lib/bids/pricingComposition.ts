/**
 * What the bid is made of (v2.3239): the Workbench's rows bucketed into
 * fixtures · pipe · fittings · other, with revenue, cost, profit and margin
 * per bucket — the answer to "how much of this bid is counts and how much is
 * line feet", one level up from the profit-concentration bar.
 *
 * Classification starts from the audit diff's row signature (footage /
 * fitting / fixture) and adds the rules a real priced bid needed: valves,
 * wyes, tees and cleanouts are fittings even when the signature reads them as
 * fixtures; allowances ("Material/Labor/Travel", permits, rentals) are neither
 * and land in `other` rather than inflating fixtures. Rows the classifier can't
 * place also land in `other` — never dropped.
 *
 * Pure module — no React, no Supabase.
 */
import { parseRowSignature } from './takeoffDiff'

export type CompositionKind = 'fixture' | 'pipe' | 'fitting' | 'other'

export const COMPOSITION_ORDER: CompositionKind[] = ['fixture', 'pipe', 'fitting', 'other']

export const COMPOSITION_LABELS: Record<CompositionKind, { name: string; unit: string }> = {
  fixture: { name: 'Fixtures', unit: 'ea' },
  pipe: { name: 'Pipe', unit: 'ft' },
  fitting: { name: 'Fittings', unit: 'ea' },
  other: { name: 'Other', unit: 'ea' },
}

// Rows that are money, not plumbing: allowances, travel, permits, rentals, lump sums.
const ALLOWANCE = /\b(allowance|travel|lodging|per diem|permit|mobilization|rental|equipment|bond|contingency|lump|misc|overhead|labor only|material\/labor|supervision|cleanup|freight)\b/i
// Things that ride the pipe: the signature calls some of these fixtures (valves) or footage (wyes with a size).
const RIDES_THE_PIPE = /\b(valve|wye|tee|cleanout|coupling|adapter|union|flange|reducer|bushing|nipple|hanger|strap|clamp|sleeve|cap|plug|elbow|ell|90|45|22)\b|\bW?CO\b|\bFCO\b|\bGCO\b|\bY\b|\bT\b/i
// Footage rows name a length unit; a "4" Y (Waste)" has a size but no length.
const LENGTH_UNIT = /\b(ft|feet|foot|lf|linear|run)\b/i

export function compositionKind(rawName: string): CompositionKind {
  const name = (rawName ?? '').trim()
  if (!name) return 'other'
  if (ALLOWANCE.test(name)) return 'other'
  const sig = parseRowSignature(name)
  if (sig.kind === 'footage') {
    // The signature reads "4" Y (Waste)" as footage on size alone; only a length unit makes pipe.
    if (!LENGTH_UNIT.test(name) && RIDES_THE_PIPE.test(name)) return 'fitting'
    return 'pipe'
  }
  if (sig.kind === 'fitting') return 'fitting'
  if (RIDES_THE_PIPE.test(name)) return 'fitting'
  if (sig.fixtureKey === 'unknown') return 'other'
  return 'fixture'
}

export interface CompositionRowInput {
  id?: string
  name: string
  count: number
  /** The row's cost (materials + labor, as the Workbench prices it). 0 when uncosted. */
  cost: number
  /** count × effective unit price; 0 when unpriced. */
  revenue: number
}

export interface CompositionBucket {
  kind: CompositionKind
  name: string
  unit: string
  rows: number
  /** Σ count — feet for pipe, each for the rest. */
  count: number
  revenue: number
  cost: number
  profit: number
  /** (revenue − cost) / revenue; null when nothing is priced OR nothing is costed (a 100% margin on uncosted rows is not a margin). */
  margin: number | null
  /** Share of the bid's revenue / cost, 0–1. */
  revenueShare: number
  costShare: number
  /** The three biggest rows by revenue. */
  top: Array<{ id?: string; name: string; count: number; revenue: number }>
}

export interface PricingComposition {
  buckets: CompositionBucket[]
  totalRevenue: number
  totalCost: number
}

export function buildPricingComposition(rows: ReadonlyArray<CompositionRowInput>): PricingComposition {
  const acc = new Map<CompositionKind, CompositionBucket>()
  for (const kind of COMPOSITION_ORDER) {
    acc.set(kind, { kind, name: COMPOSITION_LABELS[kind].name, unit: COMPOSITION_LABELS[kind].unit, rows: 0, count: 0, revenue: 0, cost: 0, profit: 0, margin: null, revenueShare: 0, costShare: 0, top: [] })
  }
  let totalRevenue = 0
  let totalCost = 0
  for (const r of rows) {
    if (!(r.count > 0)) continue
    const b = acc.get(compositionKind(r.name)) as CompositionBucket
    b.rows++
    b.count += r.count
    b.revenue += r.revenue > 0 ? r.revenue : 0
    b.cost += r.cost > 0 ? r.cost : 0
    b.top.push({ id: r.id, name: r.name, count: r.count, revenue: r.revenue > 0 ? r.revenue : 0 })
    totalRevenue += r.revenue > 0 ? r.revenue : 0
    totalCost += r.cost > 0 ? r.cost : 0
  }
  const buckets: CompositionBucket[] = []
  for (const kind of COMPOSITION_ORDER) {
    const b = acc.get(kind) as CompositionBucket
    if (b.rows === 0) continue
    b.profit = b.revenue - b.cost
    b.margin = b.revenue > 0 && b.cost > 0 ? b.profit / b.revenue : null
    b.revenueShare = totalRevenue > 0 ? b.revenue / totalRevenue : 0
    b.costShare = totalCost > 0 ? b.cost / totalCost : 0
    b.top = b.top.sort((x, y) => y.revenue - x.revenue).slice(0, 3)
    b.count = Math.round(b.count * 100) / 100
    buckets.push(b)
  }
  return { buckets, totalRevenue, totalCost }
}

/** '158 fixtures · 2,575 ft of pipe · 132 fittings' — the bar's header line. */
export function compositionHeadline(c: PricingComposition): string {
  const parts: string[] = []
  for (const b of c.buckets) {
    if (b.kind === 'other') continue
    const n = Math.round(b.count).toLocaleString()
    if (b.kind === 'pipe') parts.push(`${n} ft of pipe`)
    else parts.push(`${n} ${b.kind === 'fixture' ? (b.count === 1 ? 'fixture' : 'fixtures') : b.count === 1 ? 'fitting' : 'fittings'}`)
  }
  return parts.join(' · ')
}
