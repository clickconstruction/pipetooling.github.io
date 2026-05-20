/**
 * Projects → Forecast → Specific: "+ Insert stage" plan builder (pure).
 *
 * Drag-edit on the Specific Gantt lets the user click a `+` button on the right edge of
 * any stage's gutter row (or a toolbar button to insert at the start) to slot a new
 * `project_workflow_steps` row into the workflow. This helper computes everything the
 * call site needs to (a) optimistically reposition the affected bars on the timeline and
 * (b) persist the change to the DB in the right order.
 *
 * Semantics — settled with the user before implementation:
 *
 *   - **Start day**: new stage starts on the calendar day AFTER the chosen "insert
 *     after" stage's `endYmd` (strictly non-overlapping; `next_day` choice). Inserting
 *     at the very start of the workflow (`afterStageId === null`) anchors the new stage
 *     at `todayYmd` and prepends ahead of every existing stage.
 *
 *   - **Length**: caller-supplied via `lengthDays` (clamped to ≥ 1). The new stage
 *     occupies `[newStart, newStart + lengthDays - 1]` inclusive, so a 1-day stage
 *     renders as `endYmd === startYmd`.
 *
 *   - **Cascade**: every existing stage with a strictly higher `sequenceOrder` than the
 *     insert point has its `scheduled_*_date` translated forward by `+lengthDays` (so
 *     gaps and overlaps with the new stage are preserved), AND its `sequence_order`
 *     bumps by `+1` so the new row can slot in at `(after.sequence_order + 1)`. The
 *     bump uses the same `newOrder = after + 1; bump rows where order >= newOrder by +1`
 *     idiom that `src/pages/Workflow.tsx` `saveStep` uses today, which keeps the two
 *     pages consistent and tolerates the sparse `sequence_order` values
 *     (e.g. `3, 5, 7, 16, ...`) that template authors leave for future inserts.
 *
 *   - **Historical stages** (status ∈ `completed` / `approved` / `skipped`): get the
 *     sequence-order bump (otherwise the new row can't slot in) but DO NOT get their
 *     scheduled dates touched. The Forecast bar of a historical stage already shows its
 *     `started_at` / `ended_at` history rather than `scheduled_*`, so the timeline view
 *     stays truthful; the trade-off is that the projected schedule may briefly look
 *     overlapped until the user adjusts the historical row themselves. The caller can
 *     surface the count of stages this affected via `skippedHistoricalCount`.
 *
 *   - **Bump order**: `sequenceOrderBumps` is sorted DESCENDING by current order so the
 *     caller can iterate top-to-bottom (highest first) and never collide if a
 *     `UNIQUE(workflow_id, sequence_order)` index ever lands on the table — the same
 *     defensive pattern the Workflow page's serial bump uses today.
 *
 * Pure: no I/O, no `Date.now`, no `Math.random`. The `shiftedOverrides` shape matches
 * `DragEditOverride` so the call site can merge directly into the existing `dragOverrides`
 * Map and reuse the reconciler that already clears entries once `resolvedBars` catches up
 * via realtime.
 */

import { ymdAddDays } from '../utils/dateUtils'
import type { DragEditOverride } from './projectsForecastDragEdit'

/** Minimal stage shape this helper consumes. `status` is null-tolerant so callers can
 *  pass straight rows from `project_workflow_steps` without normalizing first. */
export type ForecastInsertStageInput = {
  stageId: string
  sequenceOrder: number
  startYmd: string
  endYmd: string
  status?: string | null
}

export type InsertSequenceBump = {
  stageId: string
  from: number
  to: number
}

export type InsertStagePlan = {
  newRow: {
    sequenceOrder: number
    startYmd: string
    endYmd: string
  }
  /** Stages whose `sequence_order` needs to increment by 1 to make room. Sorted
   *  DESCENDING by current order so the caller can update them in collision-safe order. */
  sequenceOrderBumps: readonly InsertSequenceBump[]
  /** Stages whose `scheduled_start_date` / `scheduled_end_date` need to translate
   *  forward by `lengthDays`. Excludes historical stages — see file header. Same shape
   *  as `buildDragEditPlan`'s output so the call site can merge into `dragOverrides`. */
  shiftedOverrides: Map<string, DragEditOverride>
  /** How many stages in the cascade window WERE historical and therefore had their
   *  scheduled dates intentionally left untouched. Used by the modal preview copy
   *  ("1 completed stage will keep its scheduled dates …"). */
  skippedHistoricalCount: number
}

export type InsertStagePlanInput = {
  stages: readonly ForecastInsertStageInput[]
  /** null = insert at the very start (sequence_order 1 with all existing stages bumped). */
  afterStageId: string | null
  todayYmd: string
  /** Length of the new stage in calendar days. Clamped to ≥ 1. */
  lengthDays?: number
}

const YMD_RX = /^\d{4}-\d{2}-\d{2}$/

function isYmd(value: unknown): value is string {
  return typeof value === 'string' && YMD_RX.test(value)
}

/** Statuses we treat as already-happened. Matches `projectsForecastAlignStages.ts`'s
 *  HISTORICAL_STATUSES set so the two helpers stay aligned semantically. */
const HISTORICAL_STATUSES = new Set<string>(['completed', 'approved', 'skipped'])

function isHistorical(status: string | null | undefined): boolean {
  return typeof status === 'string' && HISTORICAL_STATUSES.has(status)
}

/** Clamp the requested length to a finite integer ≥ 1. */
function normalizeLength(lengthDays: number | undefined): number {
  if (lengthDays == null || !Number.isFinite(lengthDays)) return 1
  const intVal = Math.trunc(lengthDays)
  return intVal < 1 ? 1 : intVal
}

/** Anchor the "insert at the start" path. Returns `todayYmd` when valid; otherwise
 *  falls back to the first stage's start so the new row at least lines up with the
 *  visible chart. Final fallback is an empty string (only happens with empty stages +
 *  malformed todayYmd, which the caller should not get into). */
function resolveStartAnchor(
  stages: readonly ForecastInsertStageInput[],
  todayYmd: string,
): string {
  if (isYmd(todayYmd)) return todayYmd
  const firstWithStart = stages.find((s) => isYmd(s.startYmd))
  return firstWithStart ? firstWithStart.startYmd : ''
}

export function planInsertStageAfter(input: InsertStagePlanInput): InsertStagePlan {
  const length = normalizeLength(input.lengthDays)
  const stages = input.stages ?? []
  const afterId = input.afterStageId

  // ── Insert at start (afterStageId === null) ──────────────────────────────────────
  if (afterId === null) {
    const newStart = resolveStartAnchor(stages, input.todayYmd)
    const newEnd = isYmd(newStart) ? ymdAddDays(newStart, length - 1) : newStart
    const newOrder = 1

    // Sort the cascade by sequence_order DESC for the bump list; the shift map is
    // order-independent. Every existing stage is in the cascade (we're prepending).
    const bumps: InsertSequenceBump[] = [...stages]
      .sort((a, b) => b.sequenceOrder - a.sequenceOrder)
      .map((s) => ({ stageId: s.stageId, from: s.sequenceOrder, to: s.sequenceOrder + 1 }))

    const shifted = new Map<string, DragEditOverride>()
    let historicalSkipped = 0
    for (const s of stages) {
      if (isHistorical(s.status)) {
        historicalSkipped += 1
        continue
      }
      // Date shift only applies to stages with parseable dates — anything else is
      // best-left-alone (the resolver will keep painting whatever it was painting).
      if (!isYmd(s.startYmd) || !isYmd(s.endYmd)) continue
      shifted.set(s.stageId, {
        startYmd: ymdAddDays(s.startYmd, length),
        endYmd: ymdAddDays(s.endYmd, length),
      })
    }

    return {
      newRow: { sequenceOrder: newOrder, startYmd: newStart, endYmd: newEnd },
      sequenceOrderBumps: bumps,
      shiftedOverrides: shifted,
      skippedHistoricalCount: historicalSkipped,
    }
  }

  // ── Insert after a specific stage ────────────────────────────────────────────────
  const after = stages.find((s) => s.stageId === afterId)
  if (!after) {
    // Defensive: caller asked to insert after a stage we don't see. Fall through to a
    // "no cascade" plan rooted at todayYmd so we never crash; the actual call site
    // should not invoke us with a stale id, but guarding makes tests deterministic.
    const newStart = resolveStartAnchor(stages, input.todayYmd)
    const newEnd = isYmd(newStart) ? ymdAddDays(newStart, length - 1) : newStart
    const maxOrder = stages.reduce((m, s) => Math.max(m, s.sequenceOrder), 0)
    return {
      newRow: { sequenceOrder: maxOrder + 1, startYmd: newStart, endYmd: newEnd },
      sequenceOrderBumps: [],
      shiftedOverrides: new Map(),
      skippedHistoricalCount: 0,
    }
  }

  // Start the day AFTER the chosen stage's end (`next_day` per user decision). If the
  // after-stage's endYmd is malformed we fall back to todayYmd so the user still gets
  // a usable bar; this matches Align Stages' "always return a valid YMD" stance.
  const newStart = isYmd(after.endYmd) ? ymdAddDays(after.endYmd, 1) : resolveStartAnchor(stages, input.todayYmd)
  const newEnd = isYmd(newStart) ? ymdAddDays(newStart, length - 1) : newStart
  const newOrder = after.sequenceOrder + 1

  const cascade = stages.filter((s) => s.sequenceOrder > after.sequenceOrder)

  const bumps: InsertSequenceBump[] = [...cascade]
    .sort((a, b) => b.sequenceOrder - a.sequenceOrder)
    .map((s) => ({ stageId: s.stageId, from: s.sequenceOrder, to: s.sequenceOrder + 1 }))

  const shifted = new Map<string, DragEditOverride>()
  let historicalSkipped = 0
  for (const s of cascade) {
    if (isHistorical(s.status)) {
      historicalSkipped += 1
      continue
    }
    if (!isYmd(s.startYmd) || !isYmd(s.endYmd)) continue
    shifted.set(s.stageId, {
      startYmd: ymdAddDays(s.startYmd, length),
      endYmd: ymdAddDays(s.endYmd, length),
    })
  }

  return {
    newRow: { sequenceOrder: newOrder, startYmd: newStart, endYmd: newEnd },
    sequenceOrderBumps: bumps,
    shiftedOverrides: shifted,
    skippedHistoricalCount: historicalSkipped,
  }
}
