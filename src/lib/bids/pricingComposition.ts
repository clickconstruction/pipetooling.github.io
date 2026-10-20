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

/** #128 (spike): the row's saved kind splits `other` into equipment and allowance. */
export type CompositionBucketKind = CompositionKind | 'equipment' | 'allowance'

export const COMPOSITION_ORDER: CompositionBucketKind[] = ['fixture', 'pipe', 'fitting', 'equipment', 'allowance', 'other']

export const COMPOSITION_LABELS: Record<CompositionBucketKind, { name: string; unit: string }> = {
  fixture: { name: 'Fixtures', unit: 'ea' },
  pipe: { name: 'Pipe', unit: 'ft' },
  fitting: { name: 'Fittings', unit: 'ea' },
  equipment: { name: 'Equipment', unit: 'ea' },
  allowance: { name: 'Allowances', unit: 'ea' },
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
  /** #128: the row's saved kind; the guess from the name when absent. */
  kind?: CompositionBucketKind | null
  /** #128: the estimator's own tags on the row. */
  tags?: ReadonlyArray<string> | null
  /** #128: the row's material at cost and as sold, for the weighted markup by tag. */
  materialCost?: number | null
  materialPrice?: number | null
}

export interface CompositionBucket {
  kind: CompositionBucketKind
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
  const acc = new Map<CompositionBucketKind, CompositionBucket>()
  for (const kind of COMPOSITION_ORDER) {
    acc.set(kind, { kind, name: COMPOSITION_LABELS[kind].name, unit: COMPOSITION_LABELS[kind].unit, rows: 0, count: 0, revenue: 0, cost: 0, profit: 0, margin: null, revenueShare: 0, costShare: 0, top: [] })
  }
  let totalRevenue = 0
  let totalCost = 0
  for (const r of rows) {
    if (!(r.count > 0)) continue
    const b = acc.get(r.kind ?? compositionKind(r.name)) as CompositionBucket
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

/** #128 (spike): the same buckets by the estimator's own tags; a row with two tags counts in both, an untagged row under "No tag". */
export type TagBucket = { tag: string; rows: number; revenue: number; cost: number; profit: number; margin: number | null; revenueShare: number; materialCost: number; materialPrice: number; /** Σ material sold ÷ Σ material cost − 1; null with no material. */ markup: number | null }
export const NO_TAG = 'No tag'
export function buildTagComposition(rows: ReadonlyArray<CompositionRowInput>): { buckets: TagBucket[]; totalRevenue: number; rowsWithManyTags: number } {
  const acc = new Map<string, TagBucket>()
  let totalRevenue = 0
  let rowsWithManyTags = 0
  for (const r of rows) {
    if (!(r.count > 0)) continue
    const rev = r.revenue > 0 ? r.revenue : 0
    const cost = r.cost > 0 ? r.cost : 0
    totalRevenue += rev
    const tags = (r.tags ?? []).filter((x) => x.trim() !== '')
    if (tags.length > 1) rowsWithManyTags++
    for (const tag of tags.length ? tags : [NO_TAG]) {
      const b = acc.get(tag) ?? { tag, rows: 0, revenue: 0, cost: 0, profit: 0, margin: null, revenueShare: 0, materialCost: 0, materialPrice: 0, markup: null }
      b.rows++
      b.revenue += rev
      b.cost += cost
      b.materialCost += r.materialCost != null && r.materialCost > 0 ? r.materialCost : 0
      b.materialPrice += r.materialPrice != null && r.materialPrice > 0 ? r.materialPrice : 0
      acc.set(tag, b)
    }
  }
  const buckets = [...acc.values()].sort((a, b) => (a.tag === NO_TAG ? 1 : b.tag === NO_TAG ? -1 : b.revenue - a.revenue || a.tag.localeCompare(b.tag)))
  for (const b of buckets) {
    b.profit = b.revenue - b.cost
    b.margin = b.revenue > 0 && b.cost > 0 ? b.profit / b.revenue : null
    b.revenueShare = totalRevenue > 0 ? b.revenue / totalRevenue : 0
    b.markup = b.materialCost > 0 ? b.materialPrice / b.materialCost - 1 : null
  }
  return { buckets, totalRevenue, rowsWithManyTags }
}
