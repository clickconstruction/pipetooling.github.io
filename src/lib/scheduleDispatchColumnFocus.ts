import type { CSSProperties } from 'react'
import { useLayoutEffect, type RefObject } from 'react'
import { getScheduleDispatchVisibleDayKeys } from '../utils/dateUtils'

export const SCHEDULE_DISPATCH_TODAY_COLUMN_BG = 'var(--bg-yellow-tint)'
export const SCHEDULE_DISPATCH_COLUMN_FOCUS_BG = 'var(--bg-blue-200)'

export const SCHEDULE_DISPATCH_COLUMN_DAY_DATA_ATTR = 'data-schedule-column-day'

export function pickDayForScheduleDispatchUrl(
  dayRaw: string,
  weekStart: string,
  hideWeekend: boolean,
): string | undefined {
  const d = dayRaw.trim()
  if (!d) return undefined
  const keys = getScheduleDispatchVisibleDayKeys(weekStart, hideWeekend)
  return keys.includes(d) ? d : undefined
}

type FocusArgs = {
  scheduleTodayYmd: string
  columnFocusDayYmd: string
}

function isFocus(dk: string, columnFocusDayYmd: string): boolean {
  return columnFocusDayYmd !== '' && dk === columnFocusDayYmd
}

export function scheduleDispatchDayColumnHeaderStyle(
  dk: string,
  { scheduleTodayYmd, columnFocusDayYmd }: FocusArgs,
  defaultBg: string,
): CSSProperties {
  const focused = isFocus(dk, columnFocusDayYmd)
  const isToday = dk === scheduleTodayYmd
  if (focused && isToday) {
    return {
      background: SCHEDULE_DISPATCH_COLUMN_FOCUS_BG,
      boxShadow: 'inset 0 -3px 0 #ca8a04',
    }
  }
  if (focused) return { background: SCHEDULE_DISPATCH_COLUMN_FOCUS_BG }
  if (isToday) return { background: SCHEDULE_DISPATCH_TODAY_COLUMN_BG }
  return { background: defaultBg }
}

export function scheduleDispatchDayColumnCellIdleBg(
  dk: string,
  { scheduleTodayYmd, columnFocusDayYmd }: FocusArgs,
): string {
  const focused = isFocus(dk, columnFocusDayYmd)
  const isToday = dk === scheduleTodayYmd
  if (focused && isToday) return SCHEDULE_DISPATCH_COLUMN_FOCUS_BG
  if (focused) return SCHEDULE_DISPATCH_COLUMN_FOCUS_BG
  if (isToday) return SCHEDULE_DISPATCH_TODAY_COLUMN_BG
  return 'var(--surface)'
}

/** Jobs hub numeric summary cells: `undefined` means default (no tint). */
export function scheduleDispatchDayColumnJobsSummaryCellBg(
  dk: string,
  args: FocusArgs,
): string | undefined {
  const focused = isFocus(dk, args.columnFocusDayYmd)
  const isToday = dk === args.scheduleTodayYmd
  if (focused && isToday) return SCHEDULE_DISPATCH_COLUMN_FOCUS_BG
  if (focused) return SCHEDULE_DISPATCH_COLUMN_FOCUS_BG
  if (isToday) return SCHEDULE_DISPATCH_TODAY_COLUMN_BG
  return undefined
}

/** How far to scroll the grid's own container so the column centers horizontally. */
export function scheduleColumnCenterScrollDelta(
  rootLeft: number,
  rootWidth: number,
  elLeft: number,
  elWidth: number,
): number {
  return elLeft + elWidth / 2 - (rootLeft + rootWidth / 2)
}

export function useScrollScheduleDispatchColumnIntoView(args: {
  columnFocusDayYmd: string
  loading: boolean
  scrollRootRef: RefObject<HTMLElement | null>
  scrollKey: string
}): void {
  useLayoutEffect(() => {
    if (!args.columnFocusDayYmd || args.loading) return
    const root = args.scrollRootRef.current
    if (!root) return
    const sel = `[${SCHEDULE_DISPATCH_COLUMN_DAY_DATA_ATTR}="${args.columnFocusDayYmd}"]`
    const el = root.querySelector(sel)
    if (el instanceof HTMLElement) {
      requestAnimationFrame(() => {
        // Scroll ONLY the grid's horizontal container. scrollIntoView would also
        // scroll every ancestor (the page), which yanked Quickfill down to its
        // embedded schedule grids as they finished loading.
        const rootRect = root.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const delta = scheduleColumnCenterScrollDelta(rootRect.left, rootRect.width, elRect.left, elRect.width)
        root.scrollTo({ left: root.scrollLeft + delta, behavior: 'smooth' })
      })
    }
  }, [args.columnFocusDayYmd, args.loading, args.scrollKey])
}
