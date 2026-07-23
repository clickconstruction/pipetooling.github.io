/**
 * Projects → Job History Gantt timeline (presentational).
 *
 * Receives pre-built `ProjectsJobHistoryBar[]` and a Chicago day-key array; renders a
 * horizontally-scrollable grid where each row is either:
 *   - **Expanded mode** (default): one job per row. Same behavior the page has always shipped.
 *   - **Compact mode**: a "lane" — non-overlapping jobs packed onto the same row, with each
 *     bar reserving a left-side label slot sized from its own label text width so no bar's
 *     label is ever occluded by a previous bar in the same lane.
 *
 * Bars are placed via `grid-column: start / end + 1`; the job label sits just to the LEFT of
 * the bar (`position: absolute; right: 100%`) so it scrolls in lock-step with the timeline.
 *
 * Three distinct click targets per bar:
 *   1. Job label (HCP # • job name) → `onJobLabelClick(bar)` → open Edit Job
 *   2. Bar background (areas without a numbered highlight) → `onBarClick(bar)` → open Job Detail
 *   3. Highlighted day cell (numbered) → `onDayCellClick(bar, ymd)` → open the day-detail modal
 *
 * Pure layout: no data fetching, no Realtime, no Supabase. Drives only off props.
 */

import { useEffect, useMemo, useRef } from 'react'
import {
  formatJobLedgerNumberLabel,
  resolveJobLedgerPrefix,
  type LedgerPrefixMap,
} from '../../lib/ledgerDisplayPrefixes'
import {
  peopleCountColor,
  type ProjectsJobHistoryBar,
} from '../../lib/projectsJobHistoryData'
import {
  labelDayColsFromPx,
  measureLabelWidthPx,
  packBarsIntoLanes,
  type PackInputBar,
  type PackedLane,
  type ProjectsJobHistoryLayoutMode,
} from '../../lib/projectsJobHistoryLanePacking'
import { referenceDateForWorkDateYmd } from '../../utils/dateUtils'

const COL_W = 36
const ROW_H = 44
const BAR_H = 28
const HEADER_MONTH_H = 22
const HEADER_DAY_H = 22

/**
 * Hard ceiling on how many calendar columns a single bar's label may "reserve" in compact
 * mode. Without this, one absurdly long job name could create a 30+ day reservation and
 * defeat the point of compact packing. Labels that exceed the cap still render full-text via
 * the `title` attribute (already present); only the packing math is bounded.
 */
const MAX_LABEL_DAY_COLS = 14

/**
 * Extra calendar column tacked onto every bar's measured `labelDayCols` before packing, so
 * the right edge of one bar and the leading edge of the next bar's label always have at
 * least one empty column of breathing room between them. Without this, a label can render
 * flush against the previous bar's day cells (visually no gap), which makes lane-shared
 * bars look like they belong to the same job. One extra column at `COL_W = 36px` adds a
 * small but noticeable separation.
 */
const LABEL_BREATHING_COLS = 1

/**
 * Pixel chrome added around a label's text content inside its `<button>`:
 *  - padding-left 6 + padding-right 6
 *  - 1px border on each side (×2)
 *  - margin-right 6 (gap between label and bar)
 * = 6 + 6 + 2 + 6 = 20px.
 */
const LABEL_PADDING_AND_BORDER_PX = 20

/** Font shorthand used to measure label text via canvas. Matches the label `<button>` style:
 *  `fontSize: '0.8125rem'` (13px @ 16px root) + `fontWeight: 600`. The family is filled in at
 *  runtime from `document.body`'s computed font-family. */
const LABEL_CANVAS_FONT_SIZE_PX = 13
const LABEL_CANVAS_FONT_WEIGHT = '600'

type Props = {
  bars: readonly ProjectsJobHistoryBar[]
  dayKeys: readonly string[]
  todayYmd: string
  prefixMap: LedgerPrefixMap
  appCalendarTz: string
  /** Click the "HCP # • Job Name" label sitting to the left of the bar → open Edit Job. */
  onJobLabelClick: (bar: ProjectsJobHistoryBar) => void
  /** Click an un-highlighted area of the bar → open Job Detail. */
  onBarClick: (bar: ProjectsJobHistoryBar) => void
  /** Click a highlighted (numbered) day cell → open the day-detail modal. */
  onDayCellClick: (bar: ProjectsJobHistoryBar, workDateYmd: string) => void
  /** `'expanded'` (default) or `'compact'`. See module doc-comment for the difference. */
  layoutMode?: ProjectsJobHistoryLayoutMode
}

type MonthRun = { startIdx: number; endIdx: number; label: string }
type WeekendFlags = boolean[]
type DayDigit = { day: string; isFirstOfMonth: boolean }

function buildMonthRuns(dayKeys: readonly string[], tz: string): MonthRun[] {
  if (dayKeys.length === 0) return []
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'short',
    year: 'numeric',
  })
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

function buildWeekendFlags(dayKeys: readonly string[], tz: string): WeekendFlags {
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

/** Build the label text shown to the left of a bar — same string used for accessibility,
 *  title tooltips, and canvas measurement in compact mode. */
function buildBarLabelText(bar: ProjectsJobHistoryBar, prefixMap: LedgerPrefixMap): string {
  const prefix = resolveJobLedgerPrefix(bar.serviceTypeId, prefixMap)
  const hcpLabel = formatJobLedgerNumberLabel(prefix, bar.hcpNumber, bar.clickNumber)
  return `${hcpLabel} · ${(bar.jobName ?? '').trim() || '—'}`
}

export function ProjectsJobHistoryTimeline({
  bars,
  dayKeys,
  todayYmd,
  prefixMap,
  appCalendarTz,
  onJobLabelClick,
  onBarClick,
  onDayCellClick,
  layoutMode = 'expanded',
}: Props) {
  const totalWidth = dayKeys.length * COL_W
  const monthRuns = useMemo(() => buildMonthRuns(dayKeys, appCalendarTz), [dayKeys, appCalendarTz])
  const weekendFlags = useMemo(() => buildWeekendFlags(dayKeys, appCalendarTz), [dayKeys, appCalendarTz])
  const dayDigits = useMemo(() => buildDayDigits(dayKeys, appCalendarTz), [dayKeys, appCalendarTz])

  const dayKeyIndex = useMemo(() => {
    const m = new Map<string, number>()
    dayKeys.forEach((k, i) => m.set(k, i))
    return m
  }, [dayKeys])

  const rangeStart = dayKeys[0] ?? ''
  const rangeEnd = dayKeys[dayKeys.length - 1] ?? ''
  const todayIndex = dayKeyIndex.get(todayYmd) ?? -1
  const gridTemplateColumns = `repeat(${dayKeys.length}, ${COL_W}px)`

  // Compact-mode lane packing.
  //
  // We measure each bar's label width once via a hidden canvas and derive how many calendar
  // columns to reserve for it. The pack predicate then enforces "at most one bar's label may
  // sit in any given column", so no label is ever visually occluded by a previous bar in the
  // same lane.
  //
  // The measurement memo depends on `bars` and `prefixMap` (a service-type prefix change
  // mid-session re-measures) plus the font signature (in case page-level font CSS changes).
  // Expanded mode skips this work entirely.
  const compactLanes = useMemo<PackedLane<PackInputBar & { bar: ProjectsJobHistoryBar }>[] | null>(() => {
    if (layoutMode !== 'compact') return null
    if (bars.length === 0) return []
    // Resolve the actual font family used on the page so the canvas measurement matches what
    // the user actually sees. Falls back to a sensible default on SSR / very old browsers.
    let fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    if (typeof document !== 'undefined' && document.body) {
      const computed = getComputedStyle(document.body).fontFamily
      if (computed && computed.trim().length > 0) fontFamily = computed
    }
    const fontCss = `${LABEL_CANVAS_FONT_WEIGHT} ${LABEL_CANVAS_FONT_SIZE_PX}px ${fontFamily}`

    // Lazily create a single canvas / 2d-context per render. Cheap to construct and the
    // dependency array (below) keeps allocations rare in practice.
    let ctx: CanvasRenderingContext2D | null = null
    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas')
        ctx = canvas.getContext('2d')
      } catch {
        ctx = null
      }
    }

    const packInputs: Array<PackInputBar & { bar: ProjectsJobHistoryBar }> = bars.map((b) => {
      const labelText = buildBarLabelText(b, prefixMap)
      const px = measureLabelWidthPx(labelText, fontCss, LABEL_PADDING_AND_BORDER_PX, ctx)
      // Add `LABEL_BREATHING_COLS` so the pack predicate reserves one extra empty column
      // between the previous bar's day cells and this bar's leading label edge — keeps the
      // visual separation between lane-shared bars from looking flush.
      const labelDayCols = Math.min(
        MAX_LABEL_DAY_COLS,
        labelDayColsFromPx(px, COL_W) + LABEL_BREATHING_COLS,
      )
      return {
        jobId: b.jobId,
        firstWorkDateYmd: b.firstWorkDateYmd,
        // Open-ended bars already have `lastWorkDateYmd` set to today at the data layer
        // (see `aggregateClockSessionsToBars`), so the pack predicate naturally blocks the
        // lane out to today for any bar that hasn't been clocked out yet.
        lastWorkDateYmd: b.lastWorkDateYmd,
        labelDayCols,
        bar: b,
      }
    })
    return packBarsIntoLanes(packInputs)
  }, [layoutMode, bars, prefixMap])

  // Default view: park the horizontal scroll at the most recent date (right edge) when the range
  // first lands or when the user picks a new range. We key off the range endpoints rather than
  // every render so Realtime bar refreshes don't snap the user back to the right while they're
  // exploring history.
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const apply = () => {
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    }
    apply()
    // One extra frame after layout settles, just in case fonts / sticky header reflowed totalWidth.
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [rangeStart, rangeEnd])

  return (
    <div
      ref={scrollerRef}
      style={{
        width: 'auto',
        overflowX: 'auto',
        marginLeft: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
        marginRight: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
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
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns,
              height: HEADER_MONTH_H,
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
              height: HEADER_DAY_H,
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
                  data-projects-job-history-day={ymd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isToday
                      ? 'var(--bg-orange-tint)'
                      : weekend
                        ? 'var(--bg-slate-100)'
                        : 'var(--surface)',
                    color: isToday ? 'var(--text-amber-700)' : weekend ? 'var(--text-slate-400)' : 'var(--text-700)',
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
              top: HEADER_MONTH_H + HEADER_DAY_H,
              bottom: 0,
              left: todayIndex * COL_W,
              width: 2,
              background: '#fb923c',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Rows */}
        {layoutMode === 'compact' && compactLanes
          ? compactLanes.map((lane, laneIdx) => (
              <CompactLaneRow
                key={`lane-${laneIdx}-${lane.bars[0]?.jobId ?? ''}`}
                lane={lane}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                dayKeyIndex={dayKeyIndex}
                gridTemplateColumns={gridTemplateColumns}
                weekendFlags={weekendFlags}
                todayYmd={todayYmd}
                prefixMap={prefixMap}
                onJobLabelClick={onJobLabelClick}
                onBarClick={onBarClick}
                onDayCellClick={onDayCellClick}
              />
            ))
          : bars.map((bar) => (
              <JobRow
                key={bar.jobId}
                bar={bar}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                dayKeyIndex={dayKeyIndex}
                gridTemplateColumns={gridTemplateColumns}
                weekendFlags={weekendFlags}
                todayYmd={todayYmd}
                prefixMap={prefixMap}
                onJobLabelClick={onJobLabelClick}
                onBarClick={onBarClick}
                onDayCellClick={onDayCellClick}
              />
            ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Row wrappers — one per layout mode. Both render a single grid row of height
// ROW_H with the same weekend tints; the only difference is how many bars they
// place inside that row.
// ─────────────────────────────────────────────────────────────────────────────

type JobRowProps = {
  bar: ProjectsJobHistoryBar
  rangeStart: string
  rangeEnd: string
  dayKeyIndex: Map<string, number>
  gridTemplateColumns: string
  weekendFlags: WeekendFlags
  todayYmd: string
  prefixMap: LedgerPrefixMap
  onJobLabelClick: (bar: ProjectsJobHistoryBar) => void
  onBarClick: (bar: ProjectsJobHistoryBar) => void
  onDayCellClick: (bar: ProjectsJobHistoryBar, workDateYmd: string) => void
}

function JobRow({
  bar,
  rangeStart,
  rangeEnd,
  dayKeyIndex,
  gridTemplateColumns,
  weekendFlags,
  todayYmd,
  prefixMap,
  onJobLabelClick,
  onBarClick,
  onDayCellClick,
}: JobRowProps) {
  if (bar.lastWorkDateYmd < rangeStart || bar.firstWorkDateYmd > rangeEnd) return null
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns,
        height: ROW_H,
        position: 'relative',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Weekend column tint backdrop — rendered as empty grid cells so the bar grid layout stays simple. */}
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
      <JobBarContent
        bar={bar}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        dayKeyIndex={dayKeyIndex}
        todayYmd={todayYmd}
        prefixMap={prefixMap}
        onJobLabelClick={onJobLabelClick}
        onBarClick={onBarClick}
        onDayCellClick={onDayCellClick}
      />
    </div>
  )
}

type CompactLaneRowProps = {
  lane: PackedLane<PackInputBar & { bar: ProjectsJobHistoryBar }>
  rangeStart: string
  rangeEnd: string
  dayKeyIndex: Map<string, number>
  gridTemplateColumns: string
  weekendFlags: WeekendFlags
  todayYmd: string
  prefixMap: LedgerPrefixMap
  onJobLabelClick: (bar: ProjectsJobHistoryBar) => void
  onBarClick: (bar: ProjectsJobHistoryBar) => void
  onDayCellClick: (bar: ProjectsJobHistoryBar, workDateYmd: string) => void
}

function CompactLaneRow({
  lane,
  rangeStart,
  rangeEnd,
  dayKeyIndex,
  gridTemplateColumns,
  weekendFlags,
  todayYmd,
  prefixMap,
  onJobLabelClick,
  onBarClick,
  onDayCellClick,
}: CompactLaneRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns,
        height: ROW_H,
        position: 'relative',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Weekend tints render once per lane (covering the whole lane width). Each bar inside
          the lane shares the same weekend backdrop, identical to expanded mode. */}
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
      {lane.bars.map(({ bar }) => (
        <JobBarContent
          key={bar.jobId}
          bar={bar}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          dayKeyIndex={dayKeyIndex}
          todayYmd={todayYmd}
          prefixMap={prefixMap}
          onJobLabelClick={onJobLabelClick}
          onBarClick={onBarClick}
          onDayCellClick={onDayCellClick}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The bar itself (extracted so expanded and compact modes are byte-identical
// per-bar). Renders only the `<div role="button">` and its inside (day cells +
// label `<button>`); the surrounding grid-row wrapper is the caller's job.
// ─────────────────────────────────────────────────────────────────────────────

type JobBarContentProps = {
  bar: ProjectsJobHistoryBar
  rangeStart: string
  rangeEnd: string
  dayKeyIndex: Map<string, number>
  todayYmd: string
  prefixMap: LedgerPrefixMap
  onJobLabelClick: (bar: ProjectsJobHistoryBar) => void
  onBarClick: (bar: ProjectsJobHistoryBar) => void
  onDayCellClick: (bar: ProjectsJobHistoryBar, workDateYmd: string) => void
}

function JobBarContent({
  bar,
  rangeStart,
  rangeEnd,
  dayKeyIndex,
  todayYmd,
  prefixMap,
  onJobLabelClick,
  onBarClick,
  onDayCellClick,
}: JobBarContentProps) {
  // Clamp the bar to the visible range. Bars entirely outside the range are skipped.
  const barStart = bar.firstWorkDateYmd
  const barEnd = bar.lastWorkDateYmd
  if (barEnd < rangeStart || barStart > rangeEnd) return null

  const clipLeft = barStart < rangeStart
  const clipRight = barEnd > rangeEnd
  const visualStartYmd = clipLeft ? rangeStart : barStart
  const visualEndYmd = clipRight ? rangeEnd : barEnd
  const startIdx = dayKeyIndex.get(visualStartYmd)
  const endIdx = dayKeyIndex.get(visualEndYmd)
  if (startIdx == null || endIdx == null) return null

  const labelText = buildBarLabelText(bar, prefixMap)

  // Per-day count cells inside the bar — only days actually within the visible portion of the bar.
  const cells: Array<{ localX: number; count: number; ymd: string }> = []
  for (const [ymd, n] of bar.perDayCounts) {
    if (n <= 0) continue
    if (ymd < visualStartYmd || ymd > visualEndYmd) continue
    const idx = dayKeyIndex.get(ymd)
    if (idx == null) continue
    cells.push({ localX: (idx - startIdx) * COL_W, count: n, ymd })
  }

  const barColumnStart = startIdx + 1
  const barColumnEnd = endIdx + 2
  const dashedRight = bar.openEnded || clipRight

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onBarClick(bar)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onBarClick(bar)
        }
      }}
      title={`Open job detail — ${labelText}`}
      aria-label={`Open job detail for ${labelText}`}
      style={{
        gridColumn: `${barColumnStart} / ${barColumnEnd}`,
        gridRow: 1,
        alignSelf: 'center',
        position: 'relative',
        height: BAR_H,
        background: 'var(--bg-slate-100)',
        borderTop: '1px solid var(--border-strong)',
        borderBottom: '1px solid var(--border-strong)',
        borderLeft: clipLeft ? '2px dashed #94a3b8' : '2px solid #94a3b8',
        borderRight: dashedRight ? '2px dashed #94a3b8' : '2px solid #94a3b8',
        borderRadius: 4,
        overflow: 'visible',
        cursor: 'pointer',
      }}
    >
      {/*
        Per-day highlight cells. Each cell is its own <button> so clicking a numbered day
        opens the day-detail modal instead of bubbling up to the bar's "open Job Detail"
        handler. `e.stopPropagation()` keeps the bar handler from firing.
      */}
      {cells.map((c) => {
        const palette = peopleCountColor(c.count)
        const isToday = c.ymd === todayYmd
        return (
          <button
            type="button"
            key={c.ymd}
            onClick={(e) => {
              e.stopPropagation()
              onDayCellClick(bar, c.ymd)
            }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`Open ${c.count} ${c.count === 1 ? 'person' : 'people'} on ${c.ymd} for ${labelText}`}
            title={`${c.count} ${c.count === 1 ? 'person' : 'people'} on ${c.ymd}`}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: c.localX,
              width: COL_W,
              background: palette.background,
              color: palette.foreground,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6875rem',
              fontWeight: 700,
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              boxShadow: isToday ? 'inset 0 0 0 1px #fb923c' : undefined,
            }}
          >
            {c.count}
          </button>
        )
      })}

      {/*
        Job-name label, positioned just OUTSIDE the bar's left edge via `right: 100%`.
        Lives inside the bar div so it scrolls in lock-step. Clicking it opens Edit Job
        (separate from clicking the bar background, which opens Job Detail).

        In compact mode the lane-packing algorithm already guarantees there is enough empty
        horizontal space to the left of this bar for the full label to render without
        overlapping a previous bar in the same lane. In expanded mode the label may slide
        past `rangeStart` for the first bar; that's fine — the scroller's `overflow-x: auto`
        plus the page's negative margin clips it naturally and the `title` attribute keeps
        the full string accessible.
      */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onJobLabelClick(bar)
        }}
        onKeyDown={(e) => e.stopPropagation()}
        title={`Edit job — ${labelText}`}
        aria-label={`Edit ${labelText}`}
        style={{
          position: 'absolute',
          top: 0,
          right: '100%',
          marginRight: 6,
          display: 'inline-flex',
          alignItems: 'center',
          height: BAR_H,
          padding: '0 6px',
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text-slate-900)',
          whiteSpace: 'nowrap',
          zIndex: 2,
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        {labelText}
      </button>
    </div>
  )
}
