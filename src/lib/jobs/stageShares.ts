import { calcLineBudget, lineBudgetEntryOf, lineBudgetFor, type LineBudgetColumns, type LineBudgetSettings } from './lineBudgets'

/**
 * A staged job's labor budget, cut by stage (design spike, punch list #234).
 * The pace strip's track is the labor budget; a job split into Rough In / Top
 * Out / Trim Set owns that budget stage by stage, so the strip can be divided
 * where each stage's share ends, in order. In-order stages come first in
 * their sequence, then the any-time lines, then whatever carries hours but
 * no stage, folded into one trailing piece. A job with fewer than two pieces
 * has no divisions to draw.
 */
export type StageShareLine = Partial<LineBudgetColumns> & {
  id: string
  name: string | null
  stage_kind: string | null
  line_kind?: string | null
  line_unit_price: number | string | null
  count: number | string | null
  progress_pct: number | string | null
  sequence_order: number | string | null
}

export type StageShare = {
  id: string
  name: string
  kind: 'order' | 'any' | 'other'
  /** This stage's labor hours at the lines' rate; the share is this over the sum. */
  laborHours: number
  /** The same labor in dollars: what the stage's lines set aside for the crew. */
  laborUsd: number
  sharePct: number
  /** The crew's report on this stage, when it has one. */
  pctDone: number | null
}

const num = (v: number | string | null | undefined, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n != null && Number.isFinite(n) ? n : fallback
}

export function stageSharesOf(fixtures: ReadonlyArray<StageShareLine>, settings: LineBudgetSettings): StageShare[] {
  const priced = fixtures.filter((f) => f.line_kind !== 'discount')
  const laborOf = (f: StageShareLine) => {
    const c = calcLineBudget(num(f.line_unit_price) * (num(f.count, 1) || 1), lineBudgetFor(lineBudgetEntryOf(f), f.name, settings), settings)
    return { hours: c.laborHours, usd: c.laborUsd }
  }
  const hoursOf = (f: StageShareLine) => laborOf(f).hours
  const bySeq = (a: StageShareLine, b: StageShareLine) => num(a.sequence_order) - num(b.sequence_order)
  const order = priced.filter((f) => f.stage_kind === 'order').sort(bySeq)
  const any = priced.filter((f) => f.stage_kind === 'any').sort(bySeq)
  const other = priced.filter((f) => f.stage_kind !== 'order' && f.stage_kind !== 'any')
  const pieces: StageShare[] = []
  for (const f of [...order, ...any]) {
    const l = laborOf(f)
    if (l.hours <= 0) continue
    pieces.push({ id: f.id, name: (f.name ?? '').trim() || 'Stage', kind: f.stage_kind === 'order' ? 'order' : 'any', laborHours: l.hours, laborUsd: l.usd, sharePct: 0, pctDone: f.progress_pct != null ? num(f.progress_pct) : null })
  }
  const otherHours = other.reduce((s, f) => s + hoursOf(f), 0)
  if (otherHours > 0 && pieces.length > 0) {
    const reported = other.filter((f) => f.progress_pct != null)
    const pctDone = reported.length ? reported.reduce((s, f) => s + num(f.progress_pct) * hoursOf(f), 0) / Math.max(1e-9, reported.reduce((s, f) => s + hoursOf(f), 0)) : null
    pieces.push({ id: 'other', name: other.length === 1 ? (other[0]!.name ?? '').trim() || 'Other lines' : 'Other lines', kind: 'other', laborHours: otherHours, laborUsd: other.reduce((s, f) => s + laborOf(f).usd, 0), sharePct: 0, pctDone })
  }
  if (pieces.length < 2) return []
  const total = pieces.reduce((s, p) => s + p.laborHours, 0)
  return pieces.map((p) => ({ ...p, sharePct: total > 0 ? (p.laborHours / total) * 100 : 0 }))
}
