/**
 * Projects → Forecast → Specific: sparse-calendar Gantt column layout (pure).
 *
 * The Specific sub-tab keeps the shared-x-axis Gantt feel (one row per stage, bars
 * aligned by date so you can see when each stage starts and ends), but compresses the
 * calendar so no single stage forces dozens of columns of horizontal scroll. The rules:
 *
 *   1. Each stage contributes a small set of "visible" days to the global x-axis:
 *        - 1–5 day stages contribute every day in `[startYmd, endYmd]`.
 *        - 6+ day stages contribute only the first 2 (`start`, `start+1`) and last 2
 *          (`end-1`, `end`) days. The middle is hidden.
 *   2. The global column list walks the envelope `[min(startYmd), max(endYmd)]` day by day.
 *      Every day that appears in ANY stage's visible set becomes a `kind: 'day'` column.
 *      Contiguous runs of "not visible to any stage" collapse into a single
 *      `kind: 'ellipsis'` column carrying the hidden-range metadata.
 *   3. Per-stage bar spans are the inclusive column indices of the stage's first and last
 *      visible day. Any ellipsis columns whose hidden range falls between those two
 *      anchors get included in the bar automatically — so a long stage's bar visually
 *      "passes through" the `…` cells that hide its middle days.
 *
 * Overlapping stages work naturally: if stage B's date range punches through stage A's
 * hidden middle, B's visible days promote those calendar days back into `kind: 'day'`
 * columns, and stage A's bar still spans the whole envelope (its bar passes over both
 * the new visible cols AND any remaining ellipsis cols inside its range).
 *
 * The All Stages sub-tab keeps using the dense `ProjectsForecastTimelineGrid` for
 * cross-job calendar comparison — this helper is Specific-only.
 *
 * Defensive: bad dates (`endYmd < startYmd`, malformed YMDs) are surfaced as a single-day
 * cell at `startYmd` rather than being silently fixed, matching the resolver's stance in
 * `projectsForecastStageResolver.ts`.
 */

import { ymdAddDays } from '../utils/dateUtils'

export type SpecificForecastDayColumn = { kind: 'day'; ymd: string }
export type SpecificForecastEllipsisColumn = {
  kind: 'ellipsis'
  daysCollapsed: number
  firstHiddenYmd: string
  lastHiddenYmd: string
}
export type SpecificForecastColumn =
  | SpecificForecastDayColumn
  | SpecificForecastEllipsisColumn

export type SpecificForecastStageInput = {
  stageId: string
  startYmd: string
  endYmd: string
}

export type SpecificForecastStageSpan = {
  stageId: string
  /** Inclusive column indices on the resulting `columns` array. A single-column stage
   *  has `startColIdx === endColIdx`. Always within `[0, columns.length - 1]`. */
  startColIdx: number
  endColIdx: number
}

export type SpecificForecastColumnsResult = {
  columns: readonly SpecificForecastColumn[]
  stageSpans: readonly SpecificForecastStageSpan[]
  /** ymd → column index for any `kind: 'day'` column. Ellipsis columns are not present. */
  dayKeyIndex: ReadonlyMap<string, number>
}

const YMD_RX = /^\d{4}-\d{2}-\d{2}$/

/** Max number of visible day-columns a single stage contributes to the shared x-axis.
 *  Stages of 1–5 days contribute every day; 6+ day stages contribute only the first 2
 *  and last 2 days (4 columns), with their middle absorbed into a global ellipsis run. */
export const FORECAST_SPECIFIC_MAX_VISIBLE_DAYS_PER_STAGE = 5

/** Hard upper bound on day-walks to prevent runaway loops on absurd inputs (~55 years). */
const SAFE_WALK_CAP = 20000

/**
 * Visible-day subset for ONE stage. Exposed for tests + power-user callers; the main
 * entry point is `buildSpecificForecastColumns`.
 */
export function visibleDaysForStage(startYmd: string, endYmd: string): readonly string[] {
  if (!YMD_RX.test(startYmd) || !YMD_RX.test(endYmd)) return [startYmd]
  if (endYmd < startYmd) return [startYmd]
  if (startYmd === endYmd) return [startYmd]

  const days: string[] = [startYmd]
  let cursor = startYmd
  while (cursor < endYmd && days.length <= SAFE_WALK_CAP) {
    cursor = ymdAddDays(cursor, 1)
    days.push(cursor)
  }

  if (days.length <= FORECAST_SPECIFIC_MAX_VISIBLE_DAYS_PER_STAGE) return days
  return [days[0]!, days[1]!, days[days.length - 2]!, days[days.length - 1]!]
}

/**
 * Build the shared sparse-calendar column layout for one job's resolved stages.
 *
 * Walks `[envelopeStart, envelopeEnd]` day by day; a day is "visible" iff at least one
 * stage contributes it (per `visibleDaysForStage`). Contiguous runs of non-visible days
 * collapse into a single ellipsis column. Per-stage bar spans are then keyed off the
 * first and last visible day each stage contributes; any ellipsis column between those
 * two anchors is automatically included in the bar.
 */
export function buildSpecificForecastColumns(
  stages: readonly SpecificForecastStageInput[],
): SpecificForecastColumnsResult {
  if (stages.length === 0) {
    return { columns: [], stageSpans: [], dayKeyIndex: new Map() }
  }

  const perStageVisible: string[][] = stages.map((s) => [
    ...visibleDaysForStage(s.startYmd, s.endYmd),
  ])
  const globalVisible = new Set<string>()
  for (const arr of perStageVisible) for (const d of arr) globalVisible.add(d)

  // Envelope across stages.
  let envStart = stages[0]!.startYmd
  let envEnd = stages[0]!.endYmd
  for (const s of stages) {
    if (s.startYmd < envStart) envStart = s.startYmd
    if (s.endYmd > envEnd) envEnd = s.endYmd
  }

  // Malformed envelope guard: emit one column per stage at its start, keep things visible.
  if (!YMD_RX.test(envStart) || !YMD_RX.test(envEnd) || envEnd < envStart) {
    const columns: SpecificForecastColumn[] = []
    const dayKeyIndex = new Map<string, number>()
    const stageSpans: SpecificForecastStageSpan[] = []
    for (const s of stages) {
      if (!dayKeyIndex.has(s.startYmd)) {
        dayKeyIndex.set(s.startYmd, columns.length)
        columns.push({ kind: 'day', ymd: s.startYmd })
      }
      const idx = dayKeyIndex.get(s.startYmd)!
      stageSpans.push({ stageId: s.stageId, startColIdx: idx, endColIdx: idx })
    }
    return { columns, stageSpans, dayKeyIndex }
  }

  const columns: SpecificForecastColumn[] = []
  const dayKeyIndex = new Map<string, number>()
  let pendingHidden: string[] = []

  const flushHidden = () => {
    if (pendingHidden.length === 0) return
    columns.push({
      kind: 'ellipsis',
      daysCollapsed: pendingHidden.length,
      firstHiddenYmd: pendingHidden[0]!,
      lastHiddenYmd: pendingHidden[pendingHidden.length - 1]!,
    })
    pendingHidden = []
  }

  let cursor = envStart
  let safety = 0
  while (safety++ < SAFE_WALK_CAP) {
    if (globalVisible.has(cursor)) {
      flushHidden()
      dayKeyIndex.set(cursor, columns.length)
      columns.push({ kind: 'day', ymd: cursor })
    } else {
      pendingHidden.push(cursor)
    }
    if (cursor >= envEnd) break
    cursor = ymdAddDays(cursor, 1)
  }
  flushHidden()

  const stageSpans: SpecificForecastStageSpan[] = stages.map((s, i) => {
    const vis = perStageVisible[i]!
    const firstVis = vis[0] ?? s.startYmd
    const lastVis = vis[vis.length - 1] ?? s.endYmd
    const left = dayKeyIndex.get(firstVis) ?? 0
    const right = dayKeyIndex.get(lastVis) ?? Math.max(0, columns.length - 1)
    return { stageId: s.stageId, startColIdx: left, endColIdx: right }
  })

  return { columns, stageSpans, dayKeyIndex }
}
