/**
 * Stage-weighted field reports (v2.3192, owner idea 2026-09-09).
 *
 * A job split into stages on the Bill tab reports progress stage by stage:
 * the tech says which stage they worked on and how far along it is; the job's
 * percent is Σ weight × stage percent, where a stage's weight is its share of
 * the stage lines' value (the `list_job_stage_progress` RPC computes it — no
 * prices reach the field). 60% of a 35% stage moves the job 21 points.
 *
 * The derived job percent still goes into the report's "How complete is the
 * job?" field, so nothing downstream changes. Jobs with no priced stage rows
 * have no stage mode and keep the plain slider. Pure.
 */

export type StageProgressRow = {
  fixtureId: string
  name: string
  kind: 'order' | 'any'
  sequenceOrder: number
  /** Share of the stage lines' value, 0..100 (server-computed). */
  weightPct: number
  /** Crew-reported percent; null = never reported. */
  progressPct: number | null
  /** The stage's draw is paid — done by the Stage Plan's rule, regardless of the reported %. */
  drawPaid: boolean
}

/** Raw RPC row → kernel row; drops rows without weight (unpriced) and unknown kinds. */
export function stageProgressRowsFromRpc(
  rows: ReadonlyArray<{
    fixture_id: string
    name: string | null
    stage_kind: string | null
    sequence_order: number | null
    weight_pct: number | string | null
    progress_pct: number | null
    draw_paid: boolean | null
  }>,
): StageProgressRow[] {
  const out: StageProgressRow[] = []
  for (const r of rows) {
    const kind = r.stage_kind === 'order' || r.stage_kind === 'any' ? r.stage_kind : null
    const weight = Number(r.weight_pct)
    if (!kind || !Number.isFinite(weight) || weight <= 0) continue
    out.push({
      fixtureId: r.fixture_id,
      name: (r.name ?? '').trim() || 'Stage',
      kind,
      sequenceOrder: Number(r.sequence_order ?? 0),
      weightPct: weight,
      progressPct: r.progress_pct == null ? null : Math.max(0, Math.min(100, Math.round(r.progress_pct))),
      drawPaid: r.draw_paid === true,
    })
  }
  return out
}

/**
 * Stage mode needs a deliberate plan: at least one Order row. Every legacy line
 * item is kind `any` (the v2.3083 backfill), so keying on "any priced row" would
 * turn a three-line service job into a three-stage report nobody asked for.
 * Any rows join the picker beside the Order rows once one exists.
 */
export function stageModeAvailable(stages: ReadonlyArray<StageProgressRow>): boolean {
  return stages.some((s) => s.kind === 'order')
}

/** A stage's effective percent: paid draw = 100, else the crew's number, else 0. */
export function stageEffectivePct(s: Pick<StageProgressRow, 'progressPct' | 'drawPaid'>): number {
  if (s.drawPaid) return 100
  return s.progressPct ?? 0
}

/** Σ weight × percent, rounded to a whole point and clamped. */
export function jobPercentFromStages(stages: ReadonlyArray<StageProgressRow>, override?: { fixtureId: string; pct: number } | null): number {
  let sum = 0
  for (const s of stages) {
    const pct = override && override.fixtureId === s.fixtureId ? override.pct : stageEffectivePct(s)
    sum += (s.weightPct / 100) * pct
  }
  return Math.max(0, Math.min(100, Math.round(sum)))
}

/**
 * Which stage the picker opens on: the first Order stage not yet done, else
 * the first Any stage not yet done, else the last stage in plan order.
 */
export function defaultStageToReport(stages: ReadonlyArray<StageProgressRow>): StageProgressRow | null {
  if (stages.length === 0) return null
  const notDone = (s: StageProgressRow) => !s.drawPaid && stageEffectivePct(s) < 100
  return stages.find((s) => s.kind === 'order' && notDone(s)) ?? stages.find((s) => s.kind === 'any' && notDone(s)) ?? stages[stages.length - 1] ?? null
}

/** Plan-order numbering for the picker: 1..N over Order rows, "—" for Any rows. */
export function stagePickerNumber(stages: ReadonlyArray<StageProgressRow>, s: StageProgressRow): string {
  if (s.kind !== 'order') return '◆'
  let n = 0
  for (const x of stages) {
    if (x.kind === 'order') {
      n += 1
      if (x.fixtureId === s.fixtureId) return String(n)
    }
  }
  return String(n)
}

/** "Rough-in 60% × 35% = 21 pts · job 40% → 46%". */
export function stageReportSummary(stages: ReadonlyArray<StageProgressRow>, fixtureId: string, pct: number): { before: number; after: number; contributionPts: number; line: string } {
  const s = stages.find((x) => x.fixtureId === fixtureId)
  const before = jobPercentFromStages(stages)
  const after = jobPercentFromStages(stages, { fixtureId, pct })
  const contributionPts = s ? Math.round((s.weightPct / 100) * pct) : 0
  const line = s
    ? `${s.name} ${pct}% × ${Math.round(s.weightPct)}% of the job = ${contributionPts} pts · job ${before}% → ${after}%`
    : `job ${before}% → ${after}%`
  return { before, after, contributionPts, line }
}

/** The report's extra field: a compact, human-readable record of the stage move. */
export const REPORT_FIELD_LABEL_STAGE_PROGRESS = 'Stage progress'

export function stageProgressFieldValue(stages: ReadonlyArray<StageProgressRow>, fixtureId: string, pct: number): string {
  const s = stages.find((x) => x.fixtureId === fixtureId)
  if (!s) return ''
  const { after } = stageReportSummary(stages, fixtureId, pct)
  return `${s.name}: ${pct}% (${Math.round(s.weightPct)}% of the job) → job ${after}%`
}
