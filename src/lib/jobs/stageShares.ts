/**
 * A staged job's labor budget, cut by stage (punch list #242, PR 1). The pace strip's
 * track is the labor budget; a job split into Rough In / Top Out / Trim Set owns that
 * budget stage by stage, so the strip can be divided where each stage's share ends, in
 * order. In-order stages come first in their sequence, then the any-time lines, then
 * whatever carries hours but no stage, folded into one trailing piece. A job with fewer
 * than two pieces has no divisions to draw.
 *
 * Each line arrives with its labor already read (`laborHours`, `laborUsd`): the board
 * reads them from the line budgets (#234's `calcLineBudget`), so this kernel stays pure
 * over its inputs and needs nothing of that PR. A discount line carries no labor and is
 * skipped. Pure.
 */
export type StageShareLine = {
  id: string
  name: string | null
  /** `order` for a stage the crew works in sequence, `any` for a line worked any time, else no stage. */
  stage_kind: string | null
  line_kind?: string | null
  /** The crew's report on this line, when it has one. */
  progress_pct: number | string | null
  sequence_order: number | string | null
  /** This line's labor budget in hours, as the line budgets read it. */
  laborHours: number
  /** The same labor in dollars: what the line set aside for the crew. */
  laborUsd: number
}

export type StageShare = {
  id: string
  name: string
  kind: 'order' | 'any' | 'other'
  /** This stage's labor hours; the share is this over the sum. */
  laborHours: number
  /** The same labor in dollars. */
  laborUsd: number
  sharePct: number
  /** The crew's report on this stage, when it has one; the folded piece's is weighted by hours. */
  pctDone: number | null
}

const num = (v: number | string | null | undefined, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n != null && Number.isFinite(n) ? n : fallback
}

const hoursOf = (f: StageShareLine) => (Number.isFinite(f.laborHours) ? Math.max(0, f.laborHours) : 0)
const usdOf = (f: StageShareLine) => (Number.isFinite(f.laborUsd) ? Math.max(0, f.laborUsd) : 0)

export function stageSharesOf(lines: ReadonlyArray<StageShareLine>): StageShare[] {
  const priced = lines.filter((f) => f.line_kind !== 'discount')
  const bySeq = (a: StageShareLine, b: StageShareLine) => num(a.sequence_order) - num(b.sequence_order)
  const order = priced.filter((f) => f.stage_kind === 'order').sort(bySeq)
  const any = priced.filter((f) => f.stage_kind === 'any').sort(bySeq)
  const other = priced.filter((f) => f.stage_kind !== 'order' && f.stage_kind !== 'any')
  const pieces: StageShare[] = []
  for (const f of [...order, ...any]) {
    const hours = hoursOf(f)
    if (hours <= 0) continue
    pieces.push({ id: f.id, name: (f.name ?? '').trim() || 'Stage', kind: f.stage_kind === 'order' ? 'order' : 'any', laborHours: hours, laborUsd: usdOf(f), sharePct: 0, pctDone: f.progress_pct != null ? num(f.progress_pct) : null })
  }
  const otherHours = other.reduce((s, f) => s + hoursOf(f), 0)
  if (otherHours > 0 && pieces.length > 0) {
    const reported = other.filter((f) => f.progress_pct != null && hoursOf(f) > 0)
    const reportedHours = reported.reduce((s, f) => s + hoursOf(f), 0)
    const pctDone = reportedHours > 0 ? reported.reduce((s, f) => s + num(f.progress_pct) * hoursOf(f), 0) / reportedHours : null
    const withHours = other.filter((f) => hoursOf(f) > 0)
    pieces.push({ id: 'other', name: withHours.length === 1 ? (withHours[0]!.name ?? '').trim() || 'Other lines' : 'Other lines', kind: 'other', laborHours: otherHours, laborUsd: other.reduce((s, f) => s + usdOf(f), 0), sharePct: 0, pctDone })
  }
  if (pieces.length < 2) return []
  const total = pieces.reduce((s, p) => s + p.laborHours, 0)
  return pieces.map((p) => ({ ...p, sharePct: total > 0 ? (p.laborHours * 100) / total : 0 }))
}
