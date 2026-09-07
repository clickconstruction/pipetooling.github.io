/**
 * Effective sub sheet stage (v2.3064): what the rail shows when the facts already
 * know the answer. v2.2767 stored three hand-stepped stages; v2.2667 deferred
 * "derive it from the anchored steps". This is that derivation, display-side:
 *
 *   working → walkthrough  when the sub reported 100% from the portal
 *                          (`progress_pct`), or the signed order's last picked
 *                          (else proposed) day has passed.
 *
 * Nothing moves backwards, `walkthrough` and `customer_pay` stay as set (the
 * inspection passing is not knowable from data), and a hand move that came
 * AFTER the evidence — the office or the sub set it back to Waiting on work
 * after the 100% or after the window closed — is a manual nudge that stands.
 * The stored row is untouched; `source: 'auto'` marks a derived stage for the
 * chip and the stamp. Pure.
 */
import { normalizeSubSheetStage, normalizeSubSheetStageSource, type SubSheetStage, type SubSheetStageSource } from './subSheetStage'

export type SubSheetStageEvidence = {
  stage: unknown
  stageSource?: unknown
  /** ISO instant of the last stored move. */
  stageChangedAt?: string | null
  progressPct?: number | null
  /** ISO instant the sub reported the percent. */
  progressAt?: string | null
  /** Last day of the signed order's work (YYYY-MM-DD) — see {@link subSheetWorkEndYmd}. */
  workEndYmd?: string | null
  todayYmd: string
}

export type SubSheetStageAutoReason = 'percent' | 'window'

export type EffectiveSubSheetStage = {
  stage: SubSheetStage
  source: SubSheetStageSource | null
  /** For the stamp: the stored move, or the evidence instant when derived. */
  changedAt: string | null
  derived: boolean
  reason: SubSheetStageAutoReason | null
}

const SIGNED = new Set(['accepted', 'approved', 'settled'])

/** The latest picked-else-proposed end day among the signed orders covering a sheet; null when none is dated. */
export function subSheetWorkEndYmd(orders: ReadonlyArray<{ status: string; picked_end?: string | null; proposed_end?: string | null }>): string | null {
  let end: string | null = null
  for (const o of orders) {
    if (!SIGNED.has(o.status)) continue
    const d = ((o.picked_end ?? '').trim() || (o.proposed_end ?? '').trim()).slice(0, 10)
    if (!d) continue
    if (!end || d > end) end = d
  }
  return end
}

export const SUB_SHEET_STAGE_AUTO_REASON_LABEL: Record<SubSheetStageAutoReason, string> = {
  percent: 'the sub reported 100%',
  window: 'the signed window has ended',
}

export function effectiveSubSheetStage(e: SubSheetStageEvidence): EffectiveSubSheetStage {
  const stored = normalizeSubSheetStage(e.stage)
  const source = normalizeSubSheetStageSource(e.stageSource)
  const changedAt = (e.stageChangedAt ?? '').trim() || null
  const keep: EffectiveSubSheetStage = { stage: stored, source, changedAt, derived: false, reason: null }
  if (stored !== 'working') return keep

  const handMoved = (source === 'office' || source === 'portal') && !!changedAt
  const progressAt = (e.progressAt ?? '').trim() || null
  const pctDone = e.progressPct != null && Number.isFinite(e.progressPct) && e.progressPct >= 100
  // A hand move after the report is a nudge back; an undated report cannot be out-nudged.
  const pctFires = pctDone && !(handMoved && progressAt != null && changedAt! > progressAt)
  if (pctFires) return { stage: 'walkthrough', source: 'auto', changedAt: progressAt, derived: true, reason: 'percent' }

  const end = (e.workEndYmd ?? '').trim() || null
  const windowOver = !!end && end < e.todayYmd
  const windowFires = windowOver && !(handMoved && changedAt!.slice(0, 10) > end!)
  if (windowFires) return { stage: 'walkthrough', source: 'auto', changedAt: `${end}T12:00:00`, derived: true, reason: 'window' }

  return keep
}
