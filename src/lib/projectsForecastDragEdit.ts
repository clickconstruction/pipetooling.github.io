/**
 * Projects → Forecast: drag-edit math (pure).
 *
 * Given the resolved-bar positions of the stages in a single workflow, the id of the
 * dragged stage, and the requested delta in calendar days, this helper produces an
 * override map describing where each affected stage should be drawn (and later
 * persisted) in `{ startYmd, endYmd }` form.
 *
 * Two gestures share the same cascade rule but differ on what happens to the dragged
 * stage itself:
 *
 *   - `extend` (right-edge drag): the dragged stage shifts ONLY its end (its start is
 *     fixed). Delta is clamped so newEnd >= start (length >= 1 day). This is the
 *     historical default and is preserved when the `mode` argument is omitted.
 *   - `translate` (body drag): the dragged stage shifts BOTH its start and end by the
 *     same delta — its length is preserved by construction so no length clamp applies.
 *
 * In both modes, every stage with a strictly higher `sequenceOrder` shifts BOTH its
 * start and end by the same delta — original gaps and overlaps between subsequent
 * stages are preserved (the "soft attached" semantics chosen by the user). Stages
 * with a lower or equal `sequenceOrder` (other than the dragged one) are untouched.
 *
 * Pure: no I/O, no `Date.now`, no `Math.random`. Sorting is independent of input order
 * (callers can pass already-sorted Specific stages or raw rows; both work).
 */

import { ymdAddDays } from '../utils/dateUtils'

export type DragEditStageInput = {
  stageId: string
  sequenceOrder: number
  startYmd: string
  endYmd: string
}

export type DragEditOverride = {
  startYmd: string
  endYmd: string
}

export type DragEditPlan = {
  /** Map from `stageId` to the proposed `{ startYmd, endYmd }`. Empty when nothing
   *  would change (no-op delta, missing dragged stage, or all-zero clamp). */
  overrides: Map<string, DragEditOverride>
  /** Delta after the start-of-bar clamp. May be smaller in magnitude than requested. */
  effectiveDeltaDays: number
}

/** Which gesture the drag plan represents.
 *  - `extend`: right-edge resize — the dragged stage shifts only its end.
 *  - `translate`: body drag — the dragged stage shifts both ends together. */
export type DragEditMode = 'extend' | 'translate'

const YMD_RX = /^\d{4}-\d{2}-\d{2}$/

function isYmd(v: unknown): v is string {
  return typeof v === 'string' && YMD_RX.test(v)
}

/** Days between two YMDs (`b - a`). Returns null when either is malformed. */
function ymdDaysBetween(a: string, b: string): number | null {
  if (!isYmd(a) || !isYmd(b)) return null
  const aParts = a.split('-').map(Number) as [number, number, number]
  const bParts = b.split('-').map(Number) as [number, number, number]
  const aMs = Date.UTC(aParts[0], aParts[1] - 1, aParts[2])
  const bMs = Date.UTC(bParts[0], bParts[1] - 1, bParts[2])
  return Math.round((bMs - aMs) / 86400000)
}

export function buildDragEditPlan(
  stages: readonly DragEditStageInput[],
  draggedStageId: string,
  requestedDeltaDays: number,
  mode: DragEditMode = 'extend',
): DragEditPlan {
  if (
    stages.length === 0 ||
    !Number.isFinite(requestedDeltaDays) ||
    !draggedStageId
  ) {
    return { overrides: new Map(), effectiveDeltaDays: 0 }
  }

  const dragged = stages.find((s) => s.stageId === draggedStageId)
  if (!dragged) {
    return { overrides: new Map(), effectiveDeltaDays: 0 }
  }

  const requestedInt = Math.trunc(requestedDeltaDays)
  // Extend mode clamps at the dragged stage's start so newEnd >= start (length >= 1
  // day). Translate mode preserves length by construction, so the only constraint is
  // that the requested delta is finite — already checked above.
  // Existing data with end < start is taken at face value (we don't auto-repair the
  // bar here — that's the resolver's call). The clamp only kicks in for normal data.
  let effectiveDelta = requestedInt
  if (mode === 'extend') {
    const span = ymdDaysBetween(dragged.startYmd, dragged.endYmd)
    const minDelta = span == null ? Number.NEGATIVE_INFINITY : -span
    effectiveDelta = Math.max(requestedInt, minDelta)
  }

  if (effectiveDelta === 0) {
    return { overrides: new Map(), effectiveDeltaDays: 0 }
  }

  const overrides = new Map<string, DragEditOverride>()

  // Dragged stage: extend moves only the end; translate moves both ends.
  if (mode === 'extend') {
    overrides.set(dragged.stageId, {
      startYmd: dragged.startYmd,
      endYmd: ymdAddDays(dragged.endYmd, effectiveDelta),
    })
  } else {
    overrides.set(dragged.stageId, {
      startYmd: ymdAddDays(dragged.startYmd, effectiveDelta),
      endYmd: ymdAddDays(dragged.endYmd, effectiveDelta),
    })
  }

  // Every stage with a higher sequence_order shifts in lockstep — preserves gaps and
  // overlaps relative to the dragged stage. Note we use `>` (strict) so a sibling
  // sharing the same sequence_order stays put; conventional Specific data has unique
  // sequence_orders, but the strict comparison keeps the helper deterministic.
  for (const s of stages) {
    if (s.sequenceOrder > dragged.sequenceOrder) {
      overrides.set(s.stageId, {
        startYmd: ymdAddDays(s.startYmd, effectiveDelta),
        endYmd: ymdAddDays(s.endYmd, effectiveDelta),
      })
    }
  }

  return { overrides, effectiveDeltaDays: effectiveDelta }
}
