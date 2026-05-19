/**
 * Projects → Job History: Compact-mode lane packing.
 *
 * In Compact mode we pack non-overlapping job bars onto shared rows ("lanes") to make better
 * use of vertical space. Each bar reserves a left-side "label slot" sized from its own label
 * text width, so a bar's label can never be visually occluded by a previous bar in the same
 * lane — the gap between two bars must be at least as wide as the later bar's label.
 *
 * This module is pure: no React, no DOM, no Supabase. The label-width measurement is split
 * into a separate helper (`measureLabelWidthPx`) that takes a `CanvasRenderingContext2D` so
 * the modal's React component can do the measurement once via a hidden canvas while unit
 * tests can pass `null` (the fallback character-count estimate works there).
 *
 * Layout-mode storage helpers live here too because the toggle state is conceptually part of
 * the same feature surface and only ever consumed by code that also needs lane packing.
 */

import { ymdAddDays } from '../utils/dateUtils'

/** Input to `packBarsIntoLanes`. Callers attach any extra fields they want preserved on the
 *  output lanes via the generic parameter `T`. */
export type PackInputBar = {
  jobId: string
  firstWorkDateYmd: string
  /**
   * Inclusive. For open-ended bars (no closed clock-out yet), the caller MUST already have
   * resolved this to `todayYmd` — this module doesn't know about today. That matches what
   * `aggregateClockSessionsToBars` already does on the data side.
   */
  lastWorkDateYmd: string
  /** How many calendar columns the bar's label occupies to the LEFT of `firstWorkDateYmd`. */
  labelDayCols: number
}

export type PackedLane<T extends PackInputBar> = { bars: T[] }

/**
 * First-fit lane packing for Job History bars.
 *
 *  - Bars are processed in `firstWorkDateYmd` ASC, tie-break by `jobId` lexicographic order
 *    (deterministic across refreshes).
 *  - Bar `B` fits in lane `L` iff `L.lastBar.lastWorkDateYmd < ymdAddDays(B.firstWorkDateYmd, -B.labelDayCols)`.
 *    That is: there must be at least `B.labelDayCols` empty calendar days between the lane's
 *    most-recent bar and `B`'s first work day, so `B`'s label has room to render to the left
 *    of `B`'s bar without overlapping anything.
 *  - On no fit, a new lane is appended.
 *  - Returned lanes are then sorted by `max(lastWorkDateYmd)` DESC so the lane with the most
 *    recent activity appears at the top — matches the user-facing "newest first" intuition
 *    that Expanded mode already uses.
 *
 * Pure function. Stable across identical inputs.
 */
export function packBarsIntoLanes<T extends PackInputBar>(bars: readonly T[]): PackedLane<T>[] {
  if (bars.length === 0) return []

  // Process in ASC order so the first-fit predicate is just "fits to the RIGHT of the lane's
  // current tail". Sorting on a copy keeps the caller's array intact.
  const sorted = [...bars].sort((a, b) => {
    if (a.firstWorkDateYmd !== b.firstWorkDateYmd) {
      return a.firstWorkDateYmd < b.firstWorkDateYmd ? -1 : 1
    }
    return a.jobId.localeCompare(b.jobId)
  })

  const lanes: PackedLane<T>[] = []
  for (const bar of sorted) {
    const requiredLeftYmd = ymdAddDays(bar.firstWorkDateYmd, -Math.max(1, bar.labelDayCols))
    let placed = false
    for (const lane of lanes) {
      const tail = lane.bars[lane.bars.length - 1]
      // Strict `<` — the lane's tail must end at least one day before the bar's label-slot
      // starts. With `labelDayCols >= 1`, two bars can never visually touch in the same lane.
      if (tail && tail.lastWorkDateYmd < requiredLeftYmd) {
        lane.bars.push(bar)
        placed = true
        break
      }
    }
    if (!placed) lanes.push({ bars: [bar] })
  }

  // Display order: lane with the latest "right edge" (max lastWorkDateYmd across its bars)
  // floats to the top. Tie-break by the latest `firstWorkDateYmd` then by first bar's jobId
  // so the result is fully deterministic.
  lanes.sort((a, b) => {
    const aMaxLast = laneMaxLastYmd(a)
    const bMaxLast = laneMaxLastYmd(b)
    if (aMaxLast !== bMaxLast) return aMaxLast > bMaxLast ? -1 : 1
    const aMaxFirst = laneMaxFirstYmd(a)
    const bMaxFirst = laneMaxFirstYmd(b)
    if (aMaxFirst !== bMaxFirst) return aMaxFirst > bMaxFirst ? -1 : 1
    return (a.bars[0]?.jobId ?? '').localeCompare(b.bars[0]?.jobId ?? '')
  })

  return lanes
}

function laneMaxLastYmd<T extends PackInputBar>(lane: PackedLane<T>): string {
  let max = ''
  for (const b of lane.bars) if (b.lastWorkDateYmd > max) max = b.lastWorkDateYmd
  return max
}

function laneMaxFirstYmd<T extends PackInputBar>(lane: PackedLane<T>): string {
  let max = ''
  for (const b of lane.bars) if (b.firstWorkDateYmd > max) max = b.firstWorkDateYmd
  return max
}

/**
 * Convert a measured label pixel width to a calendar-column count. Always reserves at least
 * one column so a 0-width label (defensive) still gives the bar a tiny separator from its
 * lane neighbour.
 */
export function labelDayColsFromPx(labelPx: number, colWidthPx: number): number {
  if (!Number.isFinite(labelPx) || labelPx <= 0) return 1
  if (!Number.isFinite(colWidthPx) || colWidthPx <= 0) return 1
  return Math.max(1, Math.ceil(labelPx / colWidthPx))
}

/**
 * Measure a label's full pixel width including the surrounding padding/border/margin that
 * the rendered `<button>` adds. Returns `labelPx + paddingAndBorderPx`.
 *
 * `fontCss` is the Canvas `font` shorthand (e.g. `'600 13px system-ui'`). When `ctx` is
 * `null` (server / jsdom / very old browsers), falls back to a character-count estimate so
 * the algorithm still runs deterministically.
 */
export function measureLabelWidthPx(
  labelText: string,
  fontCss: string,
  paddingAndBorderPx: number,
  ctx: CanvasRenderingContext2D | null,
): number {
  const text = labelText ?? ''
  if (text.length === 0) return paddingAndBorderPx
  if (ctx) {
    ctx.font = fontCss
    const measured = ctx.measureText(text).width
    if (Number.isFinite(measured) && measured > 0) {
      return Math.ceil(measured) + paddingAndBorderPx
    }
  }
  // Fallback estimate: average ~7px per character at 13px / 600 weight system font.
  return Math.ceil(text.length * 7) + paddingAndBorderPx
}

/** localStorage key for the Expanded / Compact toggle. */
export const PROJECTS_JOB_SCHEDULE_LAYOUT_MODE_STORAGE_KEY =
  'projects_job_history_layout_mode_v1'

export type ProjectsJobHistoryLayoutMode = 'expanded' | 'compact'

/** Read the user's last layout-mode choice; defaults to `'compact'`. SSR-safe. */
export function readProjectsJobHistoryLayoutMode(): ProjectsJobHistoryLayoutMode {
  if (typeof window === 'undefined') return 'compact'
  try {
    const raw = window.localStorage.getItem(PROJECTS_JOB_SCHEDULE_LAYOUT_MODE_STORAGE_KEY)
    if (raw === 'expanded') return 'expanded'
    return 'compact'
  } catch {
    return 'compact'
  }
}

/** Persist the user's layout-mode choice. Silently no-ops if `localStorage` is unavailable. */
export function writeProjectsJobHistoryLayoutMode(mode: ProjectsJobHistoryLayoutMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PROJECTS_JOB_SCHEDULE_LAYOUT_MODE_STORAGE_KEY, mode)
  } catch {
    // ignore quota / disabled-storage
  }
}
