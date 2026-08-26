/**
 * Manage → Timeline kernels (v2.NNNN, Tier B of pushed-back markers): a
 * calendar-TRUE Gantt strip for dated one-off tasks — the deliberate
 * opposite of the roadmap Timeline's sequence axis. Rows are one-offs with
 * a due date: the solid bar is the current window (start → due), the
 * hatched trail is the slip (original due → current due, from the
 * commitment ledger), and the hollow tick is the original promise, which
 * never moves. Tasks without a due date are simply not rows here — the
 * strip never nags anyone into dating everything. All geometry is
 * fractions of the axis span; all date math is YMD string based.
 */

import { summarizeDuePushes, type DueChangeRow } from './checklistDuePushes'

const DAY_MS = 24 * 60 * 60 * 1000

function ymdToDate(ymd: string): Date {
  return new Date(ymd + 'T12:00:00')
}

function addDays(ymd: string, n: number): string {
  const d = new Date(ymdToDate(ymd).getTime() + n * DAY_MS)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type GanttItemInput = {
  id: string
  title: string
  start_date: string
  due_date: string | null
  /** All occurrences complete (Manage's itemCompletion). */
  complete: boolean
}

export type GanttAxis = {
  /** Inclusive YMD bounds of the strip. */
  startYmd: string
  endYmd: string
  months: Array<{ label: string; left: number; width: number }>
  weekends: Array<{ left: number; width: number }>
  todayLeft: number
  /** Fraction of the axis one day spans. */
  dayWidth: number
}

export type GanttRow = {
  id: string
  title: string
  startYmd: string
  dueYmd: string
  done: boolean
  /** Solid bar (start → due), axis fractions. */
  bar: { left: number; width: number }
  /** Hatched slip trail (original due → current due); null while not pushed back. */
  trail: { left: number; width: number } | null
  /** Hollow tick at the original promise; null while not pushed back. */
  origTickLeft: number | null
  /** "→ pushed ×2 · +5d"; null while not pushed back. */
  badge: string | null
}

/** Fraction of the axis where a YMD falls (day START; a bar to `due` should extend one dayWidth past it). */
export function ganttFraction(axis: Pick<GanttAxis, 'startYmd' | 'endYmd'>, ymd: string): number {
  const start = ymdToDate(axis.startYmd).getTime()
  const span = ymdToDate(axis.endYmd).getTime() - start + DAY_MS
  return Math.min(Math.max((ymdToDate(ymd).getTime() - start) / span, 0), 1)
}

/**
 * Axis spanning the rows: from a week before the earliest start (or today)
 * to two weeks past the latest due (or today+30 with nothing to show), with
 * month labels and weekend bands.
 */
export function checklistGanttAxis(items: ReadonlyArray<GanttItemInput>, todayStr: string): GanttAxis {
  const dated = items.filter((i) => i.due_date != null)
  const startCandidates = [todayStr, ...dated.map((i) => (i.start_date < todayStr ? i.start_date : todayStr))]
  const endCandidates = [addDays(todayStr, 30), ...dated.map((i) => i.due_date!)]
  const startYmd = addDays(startCandidates.reduce((a, b) => (a < b ? a : b)), -7)
  const endYmd = addDays(endCandidates.reduce((a, b) => (a > b ? a : b)), 14)
  const axis = { startYmd, endYmd }
  const spanDays = Math.round((ymdToDate(endYmd).getTime() - ymdToDate(startYmd).getTime()) / DAY_MS) + 1
  const dayWidth = 1 / spanDays

  const months: GanttAxis['months'] = []
  const weekends: GanttAxis['weekends'] = []
  let cursor = startYmd
  for (let i = 0; i < spanDays; i++) {
    const d = ymdToDate(cursor)
    if (i === 0 || d.getDate() === 1) {
      const label =
        d.toLocaleString('en-US', { month: 'short' }).toUpperCase() +
        (d.getFullYear() === ymdToDate(todayStr).getFullYear() ? '' : ` '${String(d.getFullYear()).slice(2)}`)
      months.push({ label, left: ganttFraction(axis, cursor), width: 0 })
    }
    if (d.getDay() === 6) {
      // Saturday: one two-day band covers the weekend.
      weekends.push({ left: ganttFraction(axis, cursor), width: dayWidth * 2 })
    }
    cursor = addDays(cursor, 1)
  }
  for (let i = 0; i < months.length; i++) {
    months[i]!.width = (i + 1 < months.length ? months[i + 1]!.left : 1) - months[i]!.left
  }
  return { startYmd, endYmd, months, weekends, todayLeft: ganttFraction(axis, todayStr), dayWidth }
}

/**
 * Rows for the strip: open dated one-offs, plus completed ones whose due
 * was within the last `doneWindowDays` (the strip doubles as recent
 * history). Sorted most-urgent first — effective due ascending, done rows
 * after open ones.
 */
export function checklistGanttRows(
  items: ReadonlyArray<GanttItemInput>,
  pushesByItem: ReadonlyMap<string, DueChangeRow[]>,
  axis: GanttAxis,
  todayStr: string,
  doneWindowDays = 14,
): GanttRow[] {
  const cutoff = addDays(todayStr, -doneWindowDays)
  const rows: GanttRow[] = []
  for (const it of items) {
    if (it.due_date == null) continue
    if (it.complete && it.due_date < cutoff) continue
    const s = summarizeDuePushes(pushesByItem.get(it.id) ?? [], it.due_date)
    const barStart = it.start_date <= it.due_date ? it.start_date : it.due_date
    const left = ganttFraction(axis, barStart)
    const width = Math.max(ganttFraction(axis, it.due_date) + axis.dayWidth - left, axis.dayWidth)
    let trail: GanttRow['trail'] = null
    let origTickLeft: number | null = null
    let badge: string | null = null
    if (s.pushedBack && s.originalDue != null) {
      const tickAt = ganttFraction(axis, s.originalDue) + axis.dayWidth
      origTickLeft = tickAt
      trail = { left: tickAt, width: Math.max(ganttFraction(axis, it.due_date) + axis.dayWidth - tickAt, 0) }
      badge = `→ pushed ×${Math.max(s.pushCount, 1)} · +${s.netSlipDays}d`
    }
    rows.push({
      id: it.id,
      title: it.title,
      startYmd: barStart,
      dueYmd: it.due_date,
      done: it.complete,
      bar: { left, width },
      trail,
      origTickLeft,
      badge,
    })
  }
  rows.sort((a, b) => (a.done === b.done ? a.dueYmd.localeCompare(b.dueYmd) : a.done ? 1 : -1))
  return rows
}
