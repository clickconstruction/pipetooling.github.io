import type { CSSProperties } from 'react'
import { useLayoutEffect, type RefObject } from 'react'
import { getScheduleDispatchVisibleDayKeys } from '../utils/dateUtils'

export const SCHEDULE_DISPATCH_TODAY_COLUMN_BG = '#fefce8'
export const SCHEDULE_DISPATCH_COLUMN_FOCUS_BG = '#dbeafe'

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
  return '#fafafa'
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
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      })
    }
  }, [args.columnFocusDayYmd, args.loading, args.scrollKey])
}
