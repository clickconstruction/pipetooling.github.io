/**
 * Stage-weighted field reports (v2.3192, owner idea 2026-09-09): the job's
 * percent is Σ weight × stage percent, where a stage's weight is its share of
 * the stage lines' value (the `list_job_stage_progress` RPC computes it — no
 * prices reach the field). 60% of a 35% stage moves the job 21 points, and the
 * derived number goes into the report's "How complete is the job?" field, so
 * nothing downstream changes.
 *
 * Since v2.5663 (punch list #130) the report asks about every line at once —
 * `lineProgressReport.ts` holds that rule over the rows this file parses — and
 * the one-stage picker retired in v2.5666. What stays here is the row shape,
 * the RPC parse with the v2.3417 recognition, a stage's effective percent, the
 * Σ with one override (the line kernel's test keeps it honest) and the
 * picker's numbering. Pure.
 */

import { recognizeStages } from '../jobs/stageRecognition'

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

/**
 * Raw RPC row → kernel row; drops rows without weight (unpriced) and unknown
 * kinds. v2.3417: rows that spell a plan in the plumbing vocabulary (Rough In
 * · Top Out · Trim Set, kind `any`) come back as `order`, so the picker
 * numbers them and stage mode opens without anyone touching the Bill tab.
 */
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
  const rec = recognizeStages(out.map((s) => ({ id: s.fixtureId, name: s.name, count: 1, line_unit_price: s.weightPct, sequence_order: s.sequenceOrder, stage_kind: s.kind })))
  if (!rec.recognized) return out
  const ids = new Set(rec.orderIds)
  return out.map((s) => (ids.has(s.fixtureId) ? { ...s, kind: 'order' as const } : s))
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

/** The report's extra field: a compact, human-readable record of the lines moved (`lineProgressFieldValue` writes it since v2.5663). */
export const REPORT_FIELD_LABEL_STAGE_PROGRESS = 'Stage progress'
