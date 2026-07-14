/**
 * Projects → Forecast → Specific: stage-alignment plan builder (pure).
 *
 * Computes a "chained" forecast schedule for one job's `project_workflow_steps`:
 * each subsequent stage starts where the previous stage ended, while preserving each
 * stage's existing length in days (a 5-day stage stays 5 days, just shifted).
 *
 * Stages with missing scheduled dates default to a 1-day length so the chain stays
 * unbroken; stages whose scheduled end is before scheduled start are repaired to a
 * 1-day stage and flagged.
 *
 * The first stage is the anchor — its `scheduled_start_date` is preserved if set;
 * otherwise we fall back to its actual `started_at` calendar day, then to `todayYmd`.
 * The anchor source is surfaced on the result so the modal can explain in copy what
 * the user is anchoring on.
 *
 * Historical stages (`completed` / `approved` / `skipped`) are still chained — the
 * forecast chart should never grow a gap at the visual layer — but they're flagged
 * so the preview UI can call out that we're only changing the *scheduled* dates,
 * not the recorded `started_at` / `ended_at` history.
 *
 * The resulting `AlignmentRow[]` mirrors the on-screen Gantt order (sorted by
 * `sequence_order` ASC, ties resolved by input order to match
 * `resolveForecastStages`).
 */

import { ymdAddDays, APP_CALENDAR_TZ } from '../utils/dateUtils'

/** Minimal stage shape this helper consumes. Mirrors the columns the Forecast tab
 *  already loads via `fetchForecastStages` (see `projectsForecastData.ts`). */
export type AlignStageInput = {
  id: string
  sequence_order: number
  name: string
  status: string | null
  scheduled_start_date: string | null
  scheduled_end_date: string | null
  /** ISO timestamp; only consulted as an anchor fallback for the first stage. */
  started_at?: string | null
}

export type AlignmentRowChange = 'unchanged' | 'shifted' | 'filled' | 'repaired'

export type AlignmentRow = {
  stageId: string
  sequenceOrder: number
  name: string
  status: string | null
  /** Original `scheduled_start_date` (YMD) — null if it was unset on the row. */
  oldStartYmd: string | null
  /** Original `scheduled_end_date` (YMD) — null if it was unset on the row. */
  oldEndYmd: string | null
  /** Computed new `scheduled_start_date`. Always a valid YMD. */
  newStartYmd: string
  /** Computed new `scheduled_end_date`. Always a valid YMD; equal to `newStartYmd` for
   *  zero-length stages, otherwise > `newStartYmd`. */
  newEndYmd: string
  /** Length in calendar days (`newEnd - newStart`, never negative). */
  lengthDays: number
  change: AlignmentRowChange
  /** True when `status` indicates work is already done — the chain still includes the
   *  row, but the preview should make clear we're only changing scheduled dates. */
  isHistorical: boolean
}

export type AlignmentAnchorSource =
  | 'scheduled_start_date'
  | 'started_at'
  | 'today'
  | 'none'

export type AlignmentPlan = {
  rows: readonly AlignmentRow[]
  /** Convenience: only the rows where `change !== 'unchanged'`. */
  changedRows: readonly AlignmentRow[]
  /** Where the first-stage anchor came from. `'none'` only when there are no stages. */
  anchorSource: AlignmentAnchorSource
  /** YMD the chain is anchored to. Empty string when `anchorSource === 'none'`. */
  anchorYmd: string
}

/** Statuses that count as "already happened" for the historical badge in the preview. */
const HISTORICAL_STATUSES = new Set<string>(['completed', 'approved', 'skipped'])

const YMD_RX = /^\d{4}-\d{2}-\d{2}$/

function isYmd(value: string | null | undefined): value is string {
  return typeof value === 'string' && YMD_RX.test(value)
}

const CHICAGO_YMD_PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Convert an ISO timestamp (or already-YMD string) to a Chicago calendar YMD.
 *  Returns null on null / empty / unparseable input. */
function timestampToChicagoYmd(value: string | null | undefined): string | null {
  if (!value) return null
  if (isYmd(value)) return value
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  const parts = CHICAGO_YMD_PARTS_FMT.formatToParts(new Date(ms))
  let year = ''
  let month = ''
  let day = ''
  for (const p of parts) {
    if (p.type === 'year') year = p.value
    else if (p.type === 'month') month = p.value
    else if (p.type === 'day') day = p.value
  }
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
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

/** Derive the kept length (days) for one stage given its current scheduled dates.
 *  Returns the length plus whether the row needed to be repaired (end < start). */
function deriveLengthDays(
  scheduledStart: string | null,
  scheduledEnd: string | null,
): { length: number; repaired: boolean; bothSet: boolean } {
  const startSet = isYmd(scheduledStart)
  const endSet = isYmd(scheduledEnd)
  if (startSet && endSet) {
    const days = ymdDaysBetween(scheduledStart!, scheduledEnd!)
    if (days == null || days < 0) {
      return { length: 1, repaired: true, bothSet: true }
    }
    return { length: days, repaired: false, bothSet: true }
  }
  // Either or both missing → can't measure; chain in as a 1-day placeholder so the bar
  // still has a visible footprint and the next stage can chain off of it.
  return { length: 1, repaired: false, bothSet: false }
}

/** Pick the anchor (first stage's new start) and the source it came from. */
function resolveAnchor(
  firstStage: AlignStageInput,
  todayYmd: string,
): { anchorYmd: string; anchorSource: AlignmentAnchorSource } {
  if (isYmd(firstStage.scheduled_start_date)) {
    return {
      anchorYmd: firstStage.scheduled_start_date,
      anchorSource: 'scheduled_start_date',
    }
  }
  const startedYmd = timestampToChicagoYmd(firstStage.started_at ?? null)
  if (startedYmd) {
    return { anchorYmd: startedYmd, anchorSource: 'started_at' }
  }
  if (isYmd(todayYmd)) {
    return { anchorYmd: todayYmd, anchorSource: 'today' }
  }
  return { anchorYmd: '', anchorSource: 'none' }
}

/**
 * Build the alignment plan for a list of stages.
 *
 * @param stagesIn raw stage rows; sorted defensively by `sequence_order` ASC.
 * @param todayYmd company-calendar "today" YMD used as the final anchor fallback.
 */
export function buildAlignmentPlan(
  stagesIn: readonly AlignStageInput[],
  todayYmd: string,
): AlignmentPlan {
  if (!stagesIn || stagesIn.length === 0) {
    return { rows: [], changedRows: [], anchorSource: 'none', anchorYmd: '' }
  }

  // Defensive sort by `sequence_order`; ties resolved by input order. Mirrors
  // `resolveForecastStages` so the modal's row order matches the chart.
  const sorted = [...stagesIn]
    .map((stage, idx) => ({ stage, idx }))
    .sort((a, b) => {
      if (a.stage.sequence_order !== b.stage.sequence_order) {
        return a.stage.sequence_order - b.stage.sequence_order
      }
      return a.idx - b.idx
    })
    .map((x) => x.stage)

  const firstStage = sorted[0]!
  const { anchorYmd, anchorSource } = resolveAnchor(firstStage, todayYmd)

  const rows: AlignmentRow[] = []
  let cursorEnd: string | null = null

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]!
    const oldStart = isYmd(s.scheduled_start_date) ? s.scheduled_start_date : null
    const oldEnd = isYmd(s.scheduled_end_date) ? s.scheduled_end_date : null
    const { length, repaired, bothSet } = deriveLengthDays(oldStart, oldEnd)

    let newStart: string
    if (i === 0) {
      newStart = anchorYmd || oldStart || todayYmd
    } else {
      newStart = cursorEnd ?? anchorYmd
    }

    const newEnd = ymdAddDays(newStart, length)

    let change: AlignmentRowChange
    if (repaired) {
      change = 'repaired'
    } else if (!bothSet) {
      change = 'filled'
    } else if (oldStart === newStart && oldEnd === newEnd) {
      change = 'unchanged'
    } else {
      change = 'shifted'
    }

    rows.push({
      stageId: s.id,
      sequenceOrder: s.sequence_order,
      name: s.name,
      status: s.status,
      oldStartYmd: oldStart,
      oldEndYmd: oldEnd,
      newStartYmd: newStart,
      newEndYmd: newEnd,
      lengthDays: length,
      change,
      isHistorical: s.status != null && HISTORICAL_STATUSES.has(s.status),
    })

    cursorEnd = newEnd
  }

  const changedRows = rows.filter((r) => r.change !== 'unchanged')

  return { rows, changedRows, anchorSource, anchorYmd }
}

/** Roles allowed to write `project_workflow_steps.scheduled_*` per the table's UPDATE
 *  RLS policy. Re-exported here so the toolbar button + modal can share gating. */
export const ALIGN_EDITOR_ROLES = new Set<string>([
  'dev',
  'master_technician',
  'assistant',
  'superintendent',
  'controller',
])

export function canAlignStages(role: string | null | undefined): boolean {
  return typeof role === 'string' && ALIGN_EDITOR_ROLES.has(role)
}
