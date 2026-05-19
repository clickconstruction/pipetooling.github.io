/**
 * Projects → Forecast → Specific: sparse-calendar Gantt grid (Specific-tab only).
 *
 * Mirrors the visual idiom of the dense `ProjectsForecastTimelineGrid` (sticky 2-tier
 * date header, today vertical line, weekend tinting, sticky left gutter, horizontally-
 * scrollable timeline body) but every column comes from
 * `buildSpecificForecastColumns(...)` — a mix of `kind: 'day'` and `kind: 'ellipsis'`.
 *
 * Per-row stage bars are positioned via precomputed `SpecificForecastStageSpan` indices
 * passed in by the parent. A long stage's bar naturally spans across any ellipsis cells
 * inside its date range, which is the whole point — "the bar continues" visually while
 * the calendar itself stays compact.
 *
 * The All Stages sub-tab still uses the dense `ProjectsForecastTimelineGrid`. This
 * component is intentionally NOT shared so the dense grid can stay simple.
 */

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { forecastBarSwatch } from '../../lib/projectsForecastColors'
import type { ResolvedStageBar } from '../../lib/projectsForecastStageResolver'
import type {
  SpecificForecastColumn,
  SpecificForecastStageSpan,
} from '../../lib/projectsForecastSpecificColumns'

export const FORECAST_SPECIFIC_COL_W = 44
export const FORECAST_SPECIFIC_ROW_H = 44
export const FORECAST_SPECIFIC_HEADER_MONTH_H = 22
export const FORECAST_SPECIFIC_HEADER_DAY_H = 22

const HEADER_TOTAL_H = FORECAST_SPECIFIC_HEADER_MONTH_H + FORECAST_SPECIFIC_HEADER_DAY_H

type Props = {
  columns: readonly SpecificForecastColumn[]
  stages: readonly ResolvedStageBar[]
  /** Map keyed by `stageId` → precomputed `[startColIdx, endColIdx]` for bar placement. */
  spanByStageId: ReadonlyMap<string, SpecificForecastStageSpan>
  /** ymd → column index, for the today-line lookup. Ellipsis cols are not in here. */
  dayKeyIndex: ReadonlyMap<string, number>
  todayYmd: string
  /** Left-gutter renderer for each row. Mirrors the dense grid's `rowLabel` prop shape;
   *  receives the row index (0-based) so the caller can display a row-position number
   *  (1..N) instead of the raw `sequence_order` (which is sparse). */
  rowLabel: (stage: ResolvedStageBar, idx: number) => ReactNode
  /** Click handler — fires for both the gutter label and the bar. */
  onOpenWorkflow: (stageId: string) => void
  /** Optional pinned message when `stages` is empty. */
  emptyState?: ReactNode
  /** Pixel width reserved for the gutter. Defaults to 260px (matches the dense grid). */
  labelGutterWidth?: number
}

type MonthRun = { startIdx: number; endIdx: number; label: string }

const MONTH_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  month: 'short',
  year: 'numeric',
})
const DAY_DIGIT_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  day: 'numeric',
})
const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  weekday: 'short',
})

function buildMonthRuns(columns: readonly SpecificForecastColumn[]): MonthRun[] {
  if (columns.length === 0) return []
  const runs: MonthRun[] = []
  let currentLabel: string | null = null
  let currentStart = 0
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!
    if (col.kind === 'day') {
      const label = MONTH_FMT.format(referenceDateForWorkDateYmd(col.ymd))
      if (label !== currentLabel) {
        if (currentLabel != null) {
          runs.push({ startIdx: currentStart, endIdx: i - 1, label: currentLabel })
        }
        currentLabel = label
        currentStart = i
      }
    } else {
      // Ellipsis column breaks the run — month strip stays empty over `…` cells.
      if (currentLabel != null) {
        runs.push({ startIdx: currentStart, endIdx: i - 1, label: currentLabel })
        currentLabel = null
      }
    }
  }
  if (currentLabel != null) {
    runs.push({ startIdx: currentStart, endIdx: columns.length - 1, label: currentLabel })
  }
  return runs
}

function buildWeekendFlags(columns: readonly SpecificForecastColumn[]): boolean[] {
  return columns.map((col) => {
    if (col.kind !== 'day') return false
    const w = WEEKDAY_FMT.format(referenceDateForWorkDateYmd(col.ymd))
    return w === 'Sat' || w === 'Sun'
  })
}

function buildDayDigits(columns: readonly SpecificForecastColumn[]): string[] {
  return columns.map((col) =>
    col.kind === 'day' ? DAY_DIGIT_FMT.format(referenceDateForWorkDateYmd(col.ymd)) : '…',
  )
}

/** Pixel offset of the "today" line within the timeline body, or null when out of range.
 *  A visible day → snaps to the column's left edge. A day inside an ellipsis range →
 *  centers within that ellipsis column so the user still sees "we're somewhere in here". */
function todayColumnPositionPx(
  todayYmd: string,
  columns: readonly SpecificForecastColumn[],
  dayKeyIndex: ReadonlyMap<string, number>,
  colW: number,
): number | null {
  if (columns.length === 0) return null
  const idx = dayKeyIndex.get(todayYmd)
  if (idx != null) return idx * colW
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!
    if (
      col.kind === 'ellipsis' &&
      col.firstHiddenYmd <= todayYmd &&
      todayYmd <= col.lastHiddenYmd
    ) {
      return (i + 0.5) * colW
    }
  }
  return null
}

export function ProjectsForecastSpecificGrid({
  columns,
  stages,
  spanByStageId,
  dayKeyIndex,
  todayYmd,
  rowLabel,
  onOpenWorkflow,
  emptyState,
  labelGutterWidth = 260,
}: Props) {
  const monthRuns = useMemo(() => buildMonthRuns(columns), [columns])
  const weekendFlags = useMemo(() => buildWeekendFlags(columns), [columns])
  const dayDigits = useMemo(() => buildDayDigits(columns), [columns])

  const totalWidth = columns.length * FORECAST_SPECIFIC_COL_W
  const gridTemplateColumns = `repeat(${columns.length}, ${FORECAST_SPECIFIC_COL_W}px)`
  const todayLeftPx = todayColumnPositionPx(
    todayYmd,
    columns,
    dayKeyIndex,
    FORECAST_SPECIFIC_COL_W,
  )

  // Auto-scroll today into the center the first time the layout lands (or whenever
  // the column count / today position changes). Mirrors the dense grid's behavior.
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const apply = () => {
      if (todayLeftPx != null) {
        const target = Math.max(
          0,
          todayLeftPx - el.clientWidth / 2 + FORECAST_SPECIFIC_COL_W / 2,
        )
        el.scrollLeft = Math.min(target, Math.max(0, el.scrollWidth - el.clientWidth))
      } else {
        el.scrollLeft = 0
      }
    }
    apply()
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [columns.length, todayLeftPx])

  const gutter = labelGutterWidth

  return (
    <div
      style={{
        // Right-only full-bleed — matches the dense grid so wide column lists can extend
        // past the page's right padding. Left stays aligned with normal content padding so
        // the sticky gutter labels sit at the same x-position as other page content.
        marginRight: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
        borderTop: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'stretch',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          width: gutter,
          minWidth: gutter,
          maxWidth: gutter,
          borderRight: '1px solid #e5e7eb',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            height: HEADER_TOTAL_H,
            borderBottom: '1px solid #e5e7eb',
            background: '#f8fafc',
          }}
        />
        {stages.length === 0 ? (
          <div style={{ height: FORECAST_SPECIFIC_ROW_H, borderBottom: '1px solid #f1f5f9' }} />
        ) : (
          stages.map((stage, idx) => (
            <div
              key={`gutter-${stage.stageId}`}
              style={{
                height: FORECAST_SPECIFIC_ROW_H,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '0.8125rem',
                color: '#0f172a',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {rowLabel(stage, idx)}
            </div>
          ))
        )}
      </div>

      <div
        ref={scrollerRef}
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <div
          style={{
            width: totalWidth,
            minWidth: '100%',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              background: '#ffffff',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns,
                height: FORECAST_SPECIFIC_HEADER_MONTH_H,
                borderBottom: '1px solid #f1f5f9',
                fontSize: '0.75rem',
                color: '#374151',
                background: '#f8fafc',
              }}
            >
              {monthRuns.map((run) => (
                <div
                  key={`${run.startIdx}-${run.label}`}
                  style={{
                    gridColumn: `${run.startIdx + 1} / ${run.endIdx + 2}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingLeft: 6,
                    fontWeight: 600,
                    background: '#f8fafc',
                    borderRight: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {run.label}
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns,
                height: FORECAST_SPECIFIC_HEADER_DAY_H,
                fontSize: '0.6875rem',
                color: '#374151',
              }}
            >
              {columns.map((col, i) => {
                const isDay = col.kind === 'day'
                const isToday = isDay && col.ymd === todayYmd
                const weekend = weekendFlags[i]
                const digit = dayDigits[i]
                const cellTitle = isDay
                  ? col.ymd
                  : `${col.daysCollapsed} ${col.daysCollapsed === 1 ? 'day' : 'days'} hidden (${col.firstHiddenYmd} → ${col.lastHiddenYmd})`
                return (
                  <div
                    key={isDay ? col.ymd : `ellipsis-${i}`}
                    title={cellTitle}
                    aria-label={cellTitle}
                    data-projects-forecast-specific-day={isDay ? col.ymd : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isToday
                        ? '#fff7ed'
                        : !isDay
                          ? '#fafafa'
                          : weekend
                            ? '#f1f5f9'
                            : '#ffffff',
                      color: isToday
                        ? '#b45309'
                        : !isDay
                          ? '#94a3b8'
                          : weekend
                            ? '#94a3b8'
                            : '#374151',
                      fontWeight: isDay && digit === '1' ? 700 : 400,
                      borderRight: '1px solid #f1f5f9',
                    }}
                  >
                    {digit}
                  </div>
                )
              })}
            </div>
          </div>

          {todayLeftPx != null && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: HEADER_TOTAL_H,
                bottom: 0,
                left: todayLeftPx,
                width: 2,
                background: '#fb923c',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
          )}

          {stages.length === 0 ? (
            <div
              style={{
                height: FORECAST_SPECIFIC_ROW_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                fontSize: '0.8125rem',
                fontStyle: 'italic',
              }}
            >
              {emptyState ?? null}
            </div>
          ) : (
            stages.map((stage) => {
              const span = spanByStageId.get(stage.stageId)
              if (!span) return null
              return (
                <div
                  key={stage.stageId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns,
                    height: FORECAST_SPECIFIC_ROW_H,
                    position: 'relative',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  {/* Per-cell backdrops — weekend tinting on day cols, neutral grey on
                      ellipsis cols. Drawn once per row so they line up with the header. */}
                  {columns.map((col, i) => {
                    const isDay = col.kind === 'day'
                    const weekend = weekendFlags[i]
                    const showBackdrop = !isDay || weekend
                    if (!showBackdrop) return null
                    return (
                      <div
                        key={`bg-${i}`}
                        aria-hidden
                        style={{
                          gridColumn: `${i + 1} / ${i + 2}`,
                          gridRow: 1,
                          background: !isDay ? '#fafafa' : '#f8fafc',
                        }}
                      />
                    )
                  })}
                  <StageBar
                    stage={stage}
                    span={span}
                    onClick={() => onOpenWorkflow(stage.stageId)}
                  />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function StageBar({
  stage,
  span,
  onClick,
}: {
  stage: ResolvedStageBar
  span: SpecificForecastStageSpan
  onClick: () => void
}) {
  const swatch = forecastBarSwatch(stage.colorKey)
  const isUnscheduled = stage.isUnscheduled
  const isInferred = stage.isInferred && !isUnscheduled

  const startCol = span.startColIdx + 1
  const endColExclusive = span.endColIdx + 2

  const barStyle: CSSProperties = {
    gridColumn: `${startCol} / ${endColExclusive}`,
    gridRow: 1,
    alignSelf: 'center',
    height: 28,
    minWidth: Math.max(FORECAST_SPECIFIC_COL_W - 4, 18),
    borderRadius: 4,
    background: swatch.background,
    border: `${isUnscheduled ? '1.5px' : '1px'} ${swatch.borderStyle} ${swatch.borderColor}`,
    color: swatch.textColor,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
    textDecoration: swatch.textDecoration,
    boxSizing: 'border-box',
  }

  const tooltipParts = [
    stage.name,
    `${stage.startYmd} → ${stage.endYmd}`,
    isUnscheduled
      ? '(unscheduled — placeholder)'
      : isInferred
        ? '(some dates inferred)'
        : null,
    stage.assignee ? `Assignee: ${stage.assignee}` : null,
  ].filter(Boolean)

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltipParts.join('\n')}
      aria-label={`Stage ${stage.name} from ${stage.startYmd} to ${stage.endYmd}`}
      style={barStyle}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {stage.name}
        {isInferred ? ' (inferred)' : ''}
      </span>
    </button>
  )
}
