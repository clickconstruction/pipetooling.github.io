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

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from 'react'
import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../../utils/dateUtils'

export const FORECAST_COL_W = 36
export const FORECAST_ROW_H = 44
export const FORECAST_HEADER_MONTH_H = 22
export const FORECAST_HEADER_DAY_H = 22
/** Width (px) of each sticky pan-pillar button rendered at the timeline's left/right
 *  edges when `onPanLeft` / `onPanRight` are provided. Wide enough to read the chevron
 *  glyph at a glance, narrow enough that it only overlays one day column of the rail. */
const PAN_PILLAR_W_PX = 36

/** Imperative handle exposed to callers that need to programmatically adjust the
 *  timeline scroller's horizontal position. Forecast Specific uses this to preserve
 *  the user's visual position after a `←` pan-pillar click: clicking `←` inserts
 *  new day columns at the START of the rail, which (with the browser's default
 *  scroll behavior) shifts every existing cell to the right relative to `scrollLeft`.
 *  Without an explicit adjustment, the user would suddenly be looking at the freshly-
 *  loaded historical days instead of the cells they were reading a moment ago. The
 *  parent calls `adjustScrollLeftByPx(addedDays * COL_W)` from a `useLayoutEffect`
 *  AFTER the new columns have laid out so the visible cells stay in the same
 *  on-screen position. `→` pan clicks don't need any adjustment — they extend the
 *  rail to the right, beyond the visible viewport, so `scrollLeft` is naturally
 *  preserved. */
export interface ForecastTimelineGridHandle {
  /** Add `deltaPx` to the scroller's `scrollLeft`, clamping to a minimum of 0. Used
   *  by Forecast Specific's `←` pan-pillar to keep the user's visual position fixed
   *  after the rail grows on the left. */
  adjustScrollLeftByPx(deltaPx: number): void
}

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
  /** Optional content for the sticky left gutter header (the strip directly above the row
   *  labels, aligned to the 2-tier timeline header). When omitted the gutter header stays
   *  empty (the default for All Stages). Forecast Specific passes a right-aligned `%` to
   *  label its per-row percent-complete cell. The caller is responsible for matching the
   *  cell's right-aligned positioning so the header sits over the value column. */
  gutterHeader?: ReactNode
  /** When provided, the grid renders an in-line `←` pillar column at the START of the
   *  day rail (the first flex child inside the scroller). It scrolls WITH the rail, so
   *  the user only sees it after scrolling all the way to the left edge — then a click
   *  extends the visible window 90 days back. Omit (the default) to suppress the pillar
   *  entirely — All Stages doesn't have a pannable window. */
  onPanLeft?: () => void
  /** Mirror of `onPanLeft` for the END of the day rail. The `→` pillar is the LAST flex
   *  child inside the scroller; it appears when the user has scrolled all the way to
   *  the right edge of the rail (e.g. `... | 22 | 23 | 24 | →`). */
  onPanRight?: () => void
  /** aria-label + tooltip for the left pillar. Defaults to "Load 90 more days back". */
  panLeftLabel?: string
  /** aria-label + tooltip for the right pillar. Defaults to "Load 90 more days forward". */
  panRightLabel?: string
  /** When set, the auto-center-on-today effect re-fires ONLY when this key changes.
   *  Forecast Specific passes `selectedJobId` so pan clicks (which mutate `dayKeys` but
   *  not the job) don't yank the scroll position back to today after every pan; the tab
   *  uses the imperative `scrollToEdge` handle to position scroll after a pan instead.
   *  When `undefined` (All Stages), the legacy `[rangeStart, rangeEnd, todayIndex]`
   *  deps are used so existing behavior is unchanged. */
  autoCenterTodayResetKey?: string
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

function ProjectsForecastTimelineGridInner<TRow>(
  {
    rows,
    rowKey,
    dayKeys,
    todayYmd,
    rowLabel,
    labelGutterWidth = 220,
    renderRow,
    emptyState,
    gutterHeader,
    onPanLeft,
    onPanRight,
    panLeftLabel,
    panRightLabel,
    autoCenterTodayResetKey,
  }: Props<TRow>,
  ref: ForwardedRef<ForecastTimelineGridHandle>,
) {
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

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const rangeStart = dayKeys[0] ?? ''
  const rangeEnd = dayKeys[dayKeys.length - 1] ?? ''

  // Imperative scroll handle. Used by Forecast Specific to preserve the user's
  // visual position after a `←` pan-pillar click (see the handle's JSDoc). Reading
  // / writing `scrollLeft` here works inside the parent's `useLayoutEffect` because
  // the new columns have already been laid out by the time the parent invokes us —
  // React commits DOM mutations before useLayoutEffect runs.
  useImperativeHandle(
    ref,
    () => ({
      adjustScrollLeftByPx(deltaPx) {
        const el = scrollerRef.current
        if (!el) return
        el.scrollLeft = Math.max(0, el.scrollLeft + deltaPx)
      },
    }),
    [],
  )

  // The `todayIndex` ref decouples the "re-center on key change" effect below from
  // `todayIndex` itself — when the parent extends the range, `todayIndex` shifts but
  // we DON'T want to re-fire the centering effect. Reading the ref inside the effect
  // closure picks up the latest index without making the effect depend on it.
  const todayIndexRef = useRef(todayIndex)
  todayIndexRef.current = todayIndex

  // When the optional `←` pan pillar is rendered it sits as the FIRST flex child
  // inside the scroller, so the day-grid block's horizontal origin shifts right by
  // PAN_PILLAR_W_PX. The auto-center math has to add that offset so "today" still
  // visually lands at the center of the viewport (without it the rail would be
  // off-center by half a pillar width). The right pillar doesn't contribute here
  // — it's beyond the day grid, so it doesn't move "today" horizontally.
  const leftPillarOffsetPx = onPanLeft != null ? PAN_PILLAR_W_PX : 0

  // Legacy auto-scroll (All Stages and any caller that doesn't opt into the Specific
  // reset-key behavior): re-center "today" any time the range changes. This is what
  // the grid did before the pan-pillar feature shipped — preserved here so All Stages
  // behaves identically.
  useEffect(() => {
    if (autoCenterTodayResetKey !== undefined) return
    const el = scrollerRef.current
    if (!el) return
    const apply = () => {
      if (todayIndex >= 0) {
        const target = Math.max(
          0,
          leftPillarOffsetPx +
            todayIndex * FORECAST_COL_W -
            el.clientWidth / 2 +
            FORECAST_COL_W / 2,
        )
        el.scrollLeft = Math.min(target, Math.max(0, el.scrollWidth - el.clientWidth))
      } else {
        el.scrollLeft = 0
      }
    }
    apply()
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [autoCenterTodayResetKey, rangeStart, rangeEnd, todayIndex, leftPillarOffsetPx])

  // Forecast Specific auto-scroll: re-center "today" ONLY when the reset key changes
  // (e.g. the user switches to a different job). Pan clicks change `rangeStart` /
  // `rangeEnd` but keep the reset key stable, so the scroll position survives a pan
  // (and the parent's `scrollToEdge` handle then snaps to the freshly-loaded edge).
  useEffect(() => {
    if (autoCenterTodayResetKey === undefined) return
    const el = scrollerRef.current
    if (!el) return
    const apply = () => {
      const idx = todayIndexRef.current
      if (idx >= 0) {
        const target = Math.max(
          0,
          leftPillarOffsetPx +
            idx * FORECAST_COL_W -
            el.clientWidth / 2 +
            FORECAST_COL_W / 2,
        )
        el.scrollLeft = Math.min(target, Math.max(0, el.scrollWidth - el.clientWidth))
      } else {
        el.scrollLeft = 0
      }
    }
    apply()
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [autoCenterTodayResetKey, leftPillarOffsetPx])

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
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--surface)',
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
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Gutter header — empty by default; if `gutterHeader` is provided it's rendered
              into a height-matched cell aligned with the 2-tier timeline header. Used by
              Forecast Specific to label its right-side `%` column. */}
          <div
            style={{
              height: FORECAST_HEADER_MONTH_H + FORECAST_HEADER_DAY_H,
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-slate-tint)',
            }}
          >
            {gutterHeader ?? null}
          </div>
          {rows.length === 0 ? (
            <div style={{ height: FORECAST_ROW_H, borderBottom: '1px solid var(--border)' }} />
          ) : (
            rows.map((row, idx) => (
              <div
                key={`gutter-${rowKey(row, idx)}`}
                style={{
                  height: FORECAST_ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-slate-900)',
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
        {/* Pan-pillar layout: the day-grid block sits between two optional pan-pillar
            buttons (`←` start of rail, `→` end of rail). All three are inline-flex
            children of this container so the pillars scroll WITH the rail — the user
            only sees them when scrolled all the way to the corresponding edge. The
            `minWidth: '100%'` was previously on the day-grid block; lifting it here
            preserves the "rail fills viewport when content is narrower than scroller"
            behavior for the whole row (pillars + grid). `alignItems: 'stretch'` makes
            the pillars match the day-grid block's full height (header + all rows). */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            minWidth: '100%',
          }}
        >
          {onPanLeft != null && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPanLeft()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={panLeftLabel ?? 'Load 90 more days back'}
              title={panLeftLabel ?? 'Load 90 more days back'}
              style={{
                flex: `0 0 ${PAN_PILLAR_W_PX}px`,
                background: 'var(--bg-slate-tint)',
                border: 'none',
                borderRight: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--text-slate-600)',
                padding: 0,
              }}
            >
              {'\u2190'}
            </button>
          )}
          <div
            style={{
              // `flex: 1 0 auto` so the day-grid block grows to fill any space left over
              // when the pillars + totalWidth come in under the viewport width (rare,
              // since the default 180-day window is usually wider than the viewport).
              // `width: totalWidth` sets the natural size; flex-grow only matters in
              // that narrow-rail edge case.
              flex: '1 0 auto',
              width: totalWidth,
              position: 'relative',
            }}
          >
          {/* Sticky 2-tier header */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns,
                height: FORECAST_HEADER_MONTH_H,
                borderBottom: '1px solid var(--border)',
                fontSize: '0.75rem',
                color: 'var(--text-700)',
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
                    background: 'var(--bg-slate-tint)',
                    borderRight: '1px solid var(--border)',
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
                color: 'var(--text-700)',
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
                      background: isToday ? '#fff7ed' : weekend ? 'var(--bg-slate-100)' : 'var(--surface)',
                      color: isToday ? '#b45309' : weekend ? 'var(--text-slate-400)' : 'var(--text-700)',
                      fontWeight: digit?.isFirstOfMonth ? 700 : 400,
                      borderRight: '1px solid var(--border)',
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
                color: 'var(--text-muted)',
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
                  borderBottom: '1px solid var(--border)',
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
                        background: 'var(--bg-slate-tint)',
                      }}
                    />
                  ) : null,
                )}
                {renderRow(row, idx, { gridTemplateColumns })}
              </div>
            ))
          )}
          </div>
          {onPanRight != null && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPanRight()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={panRightLabel ?? 'Load 90 more days forward'}
              title={panRightLabel ?? 'Load 90 more days forward'}
              style={{
                flex: `0 0 ${PAN_PILLAR_W_PX}px`,
                background: 'var(--bg-slate-tint)',
                border: 'none',
                borderLeft: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--text-slate-600)',
                padding: 0,
              }}
            >
              {'\u2192'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// `forwardRef` erases generics, so we re-cast the exported binding to preserve the
// `<TRow>` parameter for callers. This is the standard React+TypeScript pattern for
// "generic component with a forwarded ref"; see the React docs on `forwardRef` typing.
export const ProjectsForecastTimelineGrid = forwardRef(
  ProjectsForecastTimelineGridInner,
) as <TRow>(
  props: Props<TRow> & { ref?: ForwardedRef<ForecastTimelineGridHandle> },
) => ReactElement | null

/** Helper for callers that need access to the same `dayKeyIndex` the grid builds internally,
 *  e.g. to pre-compute bar spans before render. */
export function buildForecastDayKeyIndex(dayKeys: readonly string[]): Map<string, number> {
  const m = new Map<string, number>()
  dayKeys.forEach((k, i) => m.set(k, i))
  return m
}
