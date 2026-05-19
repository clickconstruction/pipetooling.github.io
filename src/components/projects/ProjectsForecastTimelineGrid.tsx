/**
 * Projects → Forecast: shared Gantt-grid primitive.
 *
 * Renders a horizontally-scrollable grid with:
 *   - sticky 2-tier date header (month strip + day-digit strip), today highlighted
 *   - a vertical "today" line spanning the body
 *   - one row per element in `rows`, each rendered by the caller via the `renderRow` prop
 *
 * Both Forecast sub-tabs reuse this component:
 *   - Specific tab passes one row per stage (each row contains exactly one bar).
 *   - All Stages tab passes one row per job (each row contains N stage bars side-by-side).
 *
 * The grid keeps day-cell sizing, weekend tinting, and today marker behavior identical
 * across both views so vertical lookups (e.g. "which day is this stage in?") are visually
 * aligned regardless of which sub-tab is showing.
 *
 * Bar placement helper `forecastBarColumnSpan` is exported so callers compute the
 * `{ startCol, endCol }` they hand to `gridColumn: ${startCol} / ${endCol}` themselves —
 * keeps the grid presentation-only (no knowledge of stages or jobs).
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../../utils/dateUtils'

export const FORECAST_COL_W = 36
export const FORECAST_ROW_H = 44
export const FORECAST_HEADER_MONTH_H = 22
export const FORECAST_HEADER_DAY_H = 22

type Props<TRow> = {
  rows: readonly TRow[]
  /** Stable key per row — used as React `key`. */
  rowKey: (row: TRow, idx: number) => string
  /** Inclusive YMD column keys, sorted ascending. The first key is the left edge, the
   *  last key is the right edge. The number of columns is `dayKeys.length`. */
  dayKeys: readonly string[]
  todayYmd: string
  /** Optional sticky left gutter shown LEFT of the timeline body for each row. When the
   *  caller does not pass one, the grid renders no gutter and the bar content fills the
   *  whole row width. */
  rowLabel?: (row: TRow, idx: number) => ReactNode
  /** Pixel width reserved for the gutter; ignored when `rowLabel` is omitted. */
  labelGutterWidth?: number
  /** Render a single row's content. The caller positions bars via `gridColumn` using
   *  `forecastBarColumnSpan` to compute the column span. The grid passes through the row's
   *  height (`FORECAST_ROW_H`) and grid-template-columns via a CSS context, so the caller's
   *  bars stay aligned with the day header. */
  renderRow: (row: TRow, idx: number, ctx: { gridTemplateColumns: string }) => ReactNode
  /** Optional pinned message shown when `rows` is empty — e.g. "Pick a job above to view its stages." */
  emptyState?: ReactNode
}

type MonthRun = { startIdx: number; endIdx: number; label: string }
type DayDigit = { day: string; isFirstOfMonth: boolean }

function buildMonthRuns(dayKeys: readonly string[], tz: string): MonthRun[] {
  if (dayKeys.length === 0) return []
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', year: 'numeric' })
  const labels: string[] = dayKeys.map((ymd) => fmt.format(referenceDateForWorkDateYmd(ymd)))
  const runs: MonthRun[] = []
  let start = 0
  for (let i = 1; i <= labels.length; i++) {
    if (i === labels.length || labels[i] !== labels[start]) {
      runs.push({ startIdx: start, endIdx: i - 1, label: labels[start]! })
      start = i
    }
  }
  return runs
}

function buildWeekendFlags(dayKeys: readonly string[], tz: string): boolean[] {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
  return dayKeys.map((ymd) => {
    const w = fmt.format(referenceDateForWorkDateYmd(ymd))
    return w === 'Sat' || w === 'Sun'
  })
}

function buildDayDigits(dayKeys: readonly string[], tz: string): DayDigit[] {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' })
  return dayKeys.map((ymd) => {
    const day = fmt.format(referenceDateForWorkDateYmd(ymd))
    return { day, isFirstOfMonth: day === '1' }
  })
}

/**
 * Compute the `[startCol, endCol]` grid columns for a bar whose calendar range is
 * `[startYmd, endYmd]`. The bar is clipped to the visible day range; returns `null` when
 * the bar is entirely outside the range.
 *
 * Columns are 1-indexed (CSS grid convention) and the returned `endCol` is exclusive (the
 * value you hand to `gridColumn: ${startCol} / ${endCol}`).
 */
export function forecastBarColumnSpan(
  startYmd: string,
  endYmd: string,
  dayKeyIndex: ReadonlyMap<string, number>,
  rangeStartYmd: string,
  rangeEndYmd: string,
): { startCol: number; endCol: number; clipLeft: boolean; clipRight: boolean } | null {
  if (endYmd < rangeStartYmd || startYmd > rangeEndYmd) return null
  const clipLeft = startYmd < rangeStartYmd
  const clipRight = endYmd > rangeEndYmd
  const effStart = clipLeft ? rangeStartYmd : startYmd
  const effEnd = clipRight ? rangeEndYmd : endYmd
  const startIdx = dayKeyIndex.get(effStart)
  const endIdx = dayKeyIndex.get(effEnd)
  if (startIdx == null || endIdx == null) return null
  return { startCol: startIdx + 1, endCol: endIdx + 2, clipLeft, clipRight }
}

export function ProjectsForecastTimelineGrid<TRow>({
  rows,
  rowKey,
  dayKeys,
  todayYmd,
  rowLabel,
  labelGutterWidth = 220,
  renderRow,
  emptyState,
}: Props<TRow>) {
  const totalWidth = dayKeys.length * FORECAST_COL_W
  const monthRuns = useMemo(() => buildMonthRuns(dayKeys, APP_CALENDAR_TZ), [dayKeys])
  const weekendFlags = useMemo(() => buildWeekendFlags(dayKeys, APP_CALENDAR_TZ), [dayKeys])
  const dayDigits = useMemo(() => buildDayDigits(dayKeys, APP_CALENDAR_TZ), [dayKeys])

  const dayKeyIndex = useMemo(() => {
    const m = new Map<string, number>()
    dayKeys.forEach((k, i) => m.set(k, i))
    return m
  }, [dayKeys])

  const todayIndex = dayKeyIndex.get(todayYmd) ?? -1
  const gridTemplateColumns = `repeat(${dayKeys.length}, ${FORECAST_COL_W}px)`

  // Auto-scroll to center "today" the first time the range lands, mirroring Job History's
  // "park at right edge" idiom but biased so today is visible without losing forward context.
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const rangeStart = dayKeys[0] ?? ''
  const rangeEnd = dayKeys[dayKeys.length - 1] ?? ''
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const apply = () => {
      // If today is inside the range, center it; otherwise park at left edge so the user sees
      // the earliest visible content.
      if (todayIndex >= 0) {
        const target = Math.max(
          0,
          todayIndex * FORECAST_COL_W - el.clientWidth / 2 + FORECAST_COL_W / 2,
        )
        el.scrollLeft = Math.min(target, Math.max(0, el.scrollWidth - el.clientWidth))
      } else {
        el.scrollLeft = 0
      }
    }
    apply()
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [rangeStart, rangeEnd, todayIndex])

  const showGutter = !!rowLabel
  const gutter = showGutter ? labelGutterWidth : 0

  return (
    <div
      style={{
        // Right-only full-bleed: extend to the page's right edge for maximum timeline width,
        // but keep the LEFT side aligned with the page's normal content padding so the sticky
        // gutter's sequence chip + stage-name label sit at the same x-position as the rest of
        // the page's body content. Job History does full-bleed on both sides because its
        // labels float INSIDE each bar; here the gutter sits OUTSIDE the bars, so a left
        // full-bleed pulls the chip under/off the page's left edge and clips it.
        marginRight: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
        borderTop: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'stretch',
        background: '#ffffff',
      }}
    >
      {/* Sticky left gutter — kept OUTSIDE the horizontal scroller so it stays put while
          the user pans the timeline. Each row's label is rendered into a height-matched cell
          so it lines up with the corresponding row in the scroller. */}
      {showGutter && (
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
          {/* Gutter header — empty, sized to match the timeline's 2-tier header so rows align. */}
          <div
            style={{
              height: FORECAST_HEADER_MONTH_H + FORECAST_HEADER_DAY_H,
              borderBottom: '1px solid #e5e7eb',
              background: '#f8fafc',
            }}
          />
          {rows.length === 0 ? (
            <div style={{ height: FORECAST_ROW_H, borderBottom: '1px solid #f1f5f9' }} />
          ) : (
            rows.map((row, idx) => (
              <div
                key={`gutter-${rowKey(row, idx)}`}
                style={{
                  height: FORECAST_ROW_H,
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
                {rowLabel!(row, idx)}
              </div>
            ))
          )}
        </div>
      )}

      {/* Horizontal scroller — contains the day header + bar rows.
          `minWidth: 0` is REQUIRED on this flex item. Without it, the flex item's default
          `min-width: auto` resolves to the intrinsic width of the inner `totalWidth` content,
          so the scroller refuses to shrink and forces the parent flex container to grow past
          the viewport's right edge — visually, the rightmost day columns get cut off by the
          edge of the page instead of being reachable via horizontal scroll. */}
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
          {/* Sticky 2-tier header */}
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
                height: FORECAST_HEADER_MONTH_H,
                borderBottom: '1px solid #f1f5f9',
                fontSize: '0.75rem',
                color: '#374151',
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
                height: FORECAST_HEADER_DAY_H,
                fontSize: '0.6875rem',
                color: '#374151',
              }}
            >
              {dayKeys.map((ymd, i) => {
                const isToday = ymd === todayYmd
                const weekend = weekendFlags[i]
                const digit = dayDigits[i]
                return (
                  <div
                    key={ymd}
                    title={ymd}
                    data-projects-forecast-day={ymd}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isToday ? '#fff7ed' : weekend ? '#f1f5f9' : '#ffffff',
                      color: isToday ? '#b45309' : weekend ? '#94a3b8' : '#374151',
                      fontWeight: digit?.isFirstOfMonth ? 700 : 400,
                      borderRight: '1px solid #f1f5f9',
                    }}
                  >
                    {digit?.day ?? ''}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Today vertical line */}
          {todayIndex >= 0 && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: FORECAST_HEADER_MONTH_H + FORECAST_HEADER_DAY_H,
                bottom: 0,
                left: todayIndex * FORECAST_COL_W,
                width: 2,
                background: '#fb923c',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Rows */}
          {rows.length === 0 ? (
            <div
              style={{
                height: FORECAST_ROW_H,
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
            rows.map((row, idx) => (
              <div
                key={rowKey(row, idx)}
                style={{
                  display: 'grid',
                  gridTemplateColumns,
                  height: FORECAST_ROW_H,
                  position: 'relative',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                {/* Weekend backdrop — drawn once per row so it lines up with the header. */}
                {weekendFlags.map((isWeekend, i) =>
                  isWeekend ? (
                    <div
                      key={`wk-${i}`}
                      aria-hidden
                      style={{
                        gridColumn: `${i + 1} / ${i + 2}`,
                        gridRow: 1,
                        background: '#f8fafc',
                      }}
                    />
                  ) : null,
                )}
                {renderRow(row, idx, { gridTemplateColumns })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** Helper for callers that need access to the same `dayKeyIndex` the grid builds internally,
 *  e.g. to pre-compute bar spans before render. */
export function buildForecastDayKeyIndex(dayKeys: readonly string[]): Map<string, number> {
  const m = new Map<string, number>()
  dayKeys.forEach((k, i) => m.set(k, i))
  return m
}
