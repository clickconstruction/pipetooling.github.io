/**
 * Projects → Forecast: stage date resolver (pure).
 *
 * Given an ordered list of `project_workflow_steps` for a single workflow (sorted by
 * `sequence_order` ASC) and a "today" anchor YMD, this helper resolves each stage into a
 * `ResolvedStageBar` with concrete YMD `startYmd` / `endYmd` plus a `colorKey` for rendering.
 *
 * The Forecast Gantt timeline never wants a missing date — every stage must place SOMEWHERE
 * on the chart. The rules:
 *
 *   1. **Start**:
 *        a. `scheduled_start_date` if set.
 *        b. else the *prior resolved stage's* `endYmd` (chaining — fills the gap visually
 *           and matches the "next stage starts where the previous one ends" mental model
 *           used elsewhere in the app, e.g. Workflow's expected-dates modal default).
 *        c. else the actual `started_at` calendar day if set.
 *        d. else `todayYmd` (no prior end to chain from — anchor at today).
 *   2. **End**:
 *        a. `scheduled_end_date` if set.
 *        b. else `ended_at` calendar day if set.
 *        c. else `ymdAddDays(start, 1)` — one calendar day so the bar is visible.
 *   3. **Unscheduled flag** (drives the grey dashed `'unscheduled'` colorKey):
 *        `!scheduled_start_date && !scheduled_end_date && !started_at && !ended_at`
 *
 * The resolver intentionally:
 *   - **does NOT clamp** `endYmd >= startYmd` — bad data in the database (end before start)
 *     is surfaced as-is so the issue is visible on the Gantt. (Adding a clamp here would
 *     silently hide the bug.)
 *   - **does NOT skip skipped stages** — they still need a position on the chart so the user
 *     can see the gap. They get the `skipped` color (muted + strikethrough).
 *   - **preserves the input order** even when two stages share the same `startYmd` (ties are
 *     resolved by `sequence_order`).
 *
 * The helper is intentionally generic over the input row shape so callers can pass a slim
 * subset of `project_workflow_steps` columns. The shape is captured by `ForecastStageInput`.
 */

import { APP_CALENDAR_TZ, ymdAddDays } from '../utils/dateUtils'
import {
  forecastStageColorKey,
  type ForecastBarColorKey,
  type ForecastStageStatus,
} from './projectsForecastColors'

export type ForecastStageInput = {
  id: string
  sequence_order: number
  name: string
  status: ForecastStageStatus | null
  assigned_to_name: string | null
  scheduled_start_date: string | null
  scheduled_end_date: string | null
  started_at: string | null
  ended_at: string | null
  skipped_reason?: string | null
}

export type ResolvedStageBar = {
  stageId: string
  sequenceOrder: number
  name: string
  status: ForecastStageStatus | null
  assignee: string | null
  startYmd: string
  endYmd: string
  /** True when at least one of the start/end YMDs was inferred (chained from prior end, used
   *  the actual timestamp's day, or defaulted to a 1-day window). Useful for "(inferred)"
   *  badges or tooltips. */
  isInferred: boolean
  /** True when nothing about this stage is scheduled or recorded yet → render as a 1-day
   *  grey dashed placeholder. */
  isUnscheduled: boolean
  colorKey: ForecastBarColorKey
}

const YMD_RX = /^\d{4}-\d{2}-\d{2}$/

function isYmd(value: string | null | undefined): value is string {
  return typeof value === 'string' && YMD_RX.test(value)
}

// Robust YMD extractor in the company calendar TZ. Uses `formatToParts` instead of relying on
// a locale-specific string format (e.g. `en-CA` returns `YYYY-MM-DD` on browsers but a few
// Node ICU builds, including the one our test environment uses, return `MM/DD/YYYY` instead).
const CHICAGO_YMD_PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function instantMsToChicagoYmd(ms: number): string {
  const parts = CHICAGO_YMD_PARTS_FMT.formatToParts(new Date(ms))
  let year = ''
  let month = ''
  let day = ''
  for (const p of parts) {
    if (p.type === 'year') year = p.value
    else if (p.type === 'month') month = p.value
    else if (p.type === 'day') day = p.value
  }
  return `${year}-${month}-${day}`
}

/** Convert a Postgres timestamp string (`'2026-05-18 14:32:00+00'`) or YMD to a Chicago
 *  calendar YMD. Returns null when the input is empty or unparseable. */
function timestampToChicagoYmd(value: string | null): string | null {
  if (!value) return null
  if (isYmd(value)) return value
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return instantMsToChicagoYmd(ms)
}

export function resolveForecastStages(
  stagesIn: readonly ForecastStageInput[],
  todayYmd: string,
): ResolvedStageBar[] {
  if (!stagesIn || stagesIn.length === 0) return []
  // Defensive sort by `sequence_order` so callers don't have to guarantee order. Ties keep
  // input order via index fallback.
  const stages = [...stagesIn]
    .map((s, i) => ({ stage: s, idx: i }))
    .sort((a, b) => {
      if (a.stage.sequence_order !== b.stage.sequence_order) {
        return a.stage.sequence_order - b.stage.sequence_order
      }
      return a.idx - b.idx
    })
    .map((x) => x.stage)

  const out: ResolvedStageBar[] = []
  let priorEnd: string | null = null
  for (const s of stages) {
    const startedYmd = timestampToChicagoYmd(s.started_at)
    const endedYmd = timestampToChicagoYmd(s.ended_at)

    const hasScheduledStart = isYmd(s.scheduled_start_date)
    const hasScheduledEnd = isYmd(s.scheduled_end_date)
    const hasActualStart = startedYmd != null
    const hasActualEnd = endedYmd != null

    const isUnscheduled =
      !hasScheduledStart && !hasScheduledEnd && !hasActualStart && !hasActualEnd

    let startYmd: string
    let startInferred: boolean
    if (hasScheduledStart) {
      startYmd = s.scheduled_start_date as string
      startInferred = false
    } else if (priorEnd != null) {
      startYmd = priorEnd
      startInferred = true
    } else if (hasActualStart) {
      startYmd = startedYmd as string
      startInferred = false
    } else {
      startYmd = todayYmd
      startInferred = true
    }

    let endYmd: string
    let endInferred: boolean
    if (hasScheduledEnd) {
      endYmd = s.scheduled_end_date as string
      endInferred = false
    } else if (hasActualEnd) {
      endYmd = endedYmd as string
      endInferred = false
    } else {
      endYmd = ymdAddDays(startYmd, 1)
      endInferred = true
    }

    const isInferred = startInferred || endInferred

    out.push({
      stageId: s.id,
      sequenceOrder: s.sequence_order,
      name: s.name,
      status: s.status,
      assignee: s.assigned_to_name ?? null,
      startYmd,
      endYmd,
      isInferred,
      isUnscheduled,
      colorKey: forecastStageColorKey(s.status, isUnscheduled),
    })

    // Chain pointer = the end we just resolved (the next stage's start defaults to this
    // unless the next stage has its own `scheduled_start_date`).
    priorEnd = endYmd
  }
  return out
}

/** Convenience: pull the overall `[min(startYmd), max(endYmd)]` envelope from a list of
 *  resolved bars. Returns `null` if the list is empty. */
export function resolvedStagesEnvelope(
  resolved: readonly ResolvedStageBar[],
): { startYmd: string; endYmd: string } | null {
  if (resolved.length === 0) return null
  let minStart = resolved[0]!.startYmd
  let maxEnd = resolved[0]!.endYmd
  for (let i = 1; i < resolved.length; i++) {
    const r = resolved[i]!
    if (r.startYmd < minStart) minStart = r.startYmd
    if (r.endYmd > maxEnd) maxEnd = r.endYmd
  }
  return { startYmd: minStart, endYmd: maxEnd }
}
