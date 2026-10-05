/**
 * The Man hours card's picture, as numbers: the hours axis, the stacked bar
 * for each period, the office-share line under it, and the one-line headline.
 * The component only draws what this returns.
 *
 * Two charts on one set of columns, never two scales on one chart: hours are
 * stacked bars (field, office, bids, not on a job, bottom to top) and the
 * office share is its own line below, 0 to 50% (0 to 100% once any period
 * passes 50%).
 *
 * Pure: no React, no Supabase.
 */

import { manHoursPeriodLabel, type ManHoursPeriod, type ManHoursSide, type ManHoursZoom } from './manHoursByPeriod'

/** The four sides in stack order, bottom first, with the color each one wears. */
export const MAN_HOURS_SIDES: ReadonlyArray<{ key: ManHoursSide; label: string; color: string }> = [
  { key: 'field', label: 'Field', color: 'var(--man-hours-field)' },
  { key: 'office', label: 'Office', color: 'var(--man-hours-office)' },
  { key: 'bid', label: 'Bids', color: 'var(--man-hours-bids)' },
  { key: 'unassigned', label: 'Not on a job', color: 'var(--text-faint)' },
]

export function manHoursSideHours(period: ManHoursPeriod, side: ManHoursSide): number {
  if (side === 'field') return period.fieldHours
  if (side === 'office') return period.officeHours
  if (side === 'bid') return period.bidHours
  return period.unassignedHours
}

/** A round axis that holds `value` in at most five steps: 2,551 → 0, 1,000, 2,000, 3,000. */
export function manHoursAxis(value: number): { max: number; step: number; ticks: number[] } {
  const top = value > 0 ? value : 1
  const pow = 10 ** Math.floor(Math.log10(top / 5))
  const step = ([1, 2, 2.5, 5, 10].find((m) => top / (m * pow) <= 5) ?? 10) * pow
  const steps = Math.max(1, Math.ceil(top / step))
  return { max: steps * step, step, ticks: Array.from({ length: steps + 1 }, (_, i) => i * step) }
}

export type ManHoursChartBox = { width: number; height: number; left: number; right: number; top: number; bottom: number }

export type ManHoursBarSegment = { side: ManHoursSide; y: number; height: number; top: boolean }

export type ManHoursBarColumn = {
  key: string
  /** The column's whole slot: the hover and click target. */
  slotX: number
  slotWidth: number
  centerX: number
  barX: number
  barWidth: number
  /** The band drawn behind a hovered or picked bar: the bar and a little air, never wider than the slot. */
  bandX: number
  bandWidth: number
  /** Bottom first. Sides with no hours are left out; `top` marks the rounded end. */
  segments: ManHoursBarSegment[]
}

/** One stacked bar per period, laid out in `box` at real pixel size. The bar is at most 46 wide and never under 6. */
export function buildManHoursBars(
  periods: readonly ManHoursPeriod[],
  box: ManHoursChartBox,
): { axis: ReturnType<typeof manHoursAxis>; baseline: number; yOf: (hours: number) => number; columns: ManHoursBarColumn[] } {
  const axis = manHoursAxis(Math.max(0, ...periods.map((p) => p.totalHours)))
  const plotHeight = box.height - box.top - box.bottom
  const baseline = box.height - box.bottom
  const yOf = (hours: number): number => baseline - (hours / axis.max) * plotHeight
  const slotWidth = periods.length > 0 ? (box.width - box.left - box.right) / periods.length : 0
  const barWidth = Math.max(6, Math.min(46, slotWidth * 0.62))
  const bandWidth = Math.max(0, Math.min(slotWidth - 2, barWidth + 16))
  const columns = periods.map((p, i) => {
    const slotX = box.left + i * slotWidth
    const centerX = slotX + slotWidth / 2
    const sides = MAN_HOURS_SIDES.filter((s) => manHoursSideHours(p, s.key) > 0)
    let below = 0
    const segments = sides.map((s, si) => {
      const hours = manHoursSideHours(p, s.key)
      const y = yOf(below + hours)
      const height = yOf(below) - y
      below += hours
      return { side: s.key, y, height, top: si === sides.length - 1 }
    })
    return { key: p.key, slotX, slotWidth, centerX, barX: centerX - barWidth / 2, barWidth, bandX: centerX - bandWidth / 2, bandWidth, segments }
  })
  return { axis, baseline, yOf, columns }
}

/** The room an axis label needs, in pixels at 11px type: "Sep 27", "Sep", "Q3", "2026". */
const LABEL_ROOM: Record<ManHoursZoom, number> = { week: 46, month: 30, quarter: 26, year: 36 }

/**
 * Which columns carry their axis label when the slots are too narrow for all
 * of them (a phone): every nth, counted back from the newest so the newest is
 * always named. A `forced` column (the picked one, the hovered one) is always
 * named, and a regular label too close to it steps aside.
 */
export function manHoursLabeledColumns(count: number, slotWidth: number, zoom: ManHoursZoom, forced: readonly number[] = []): boolean[] {
  const every = slotWidth > 0 ? Math.max(1, Math.ceil(LABEL_ROOM[zoom] / slotWidth)) : 1
  return Array.from({ length: count }, (_, i) => {
    if (forced.includes(i)) return true
    if ((count - 1 - i) % every !== 0) return false
    return !forced.some((f) => f >= 0 && f < count && Math.abs(f - i) < every)
  })
}

export type ManHoursSharePoint = { key: string; x: number; y: number; share: number; soFar: boolean; labeled: boolean }

/**
 * The office-share line on the same columns as the bars. A period with no
 * share (no hours on a job or a bid) has no point and breaks nothing: the line
 * runs between the points that exist. The first point and the last finished
 * one carry their number.
 */
export function buildManHoursShareLine(
  periods: readonly ManHoursPeriod[],
  box: ManHoursChartBox,
): { max: number; ticks: number[]; yOf: (share: number) => number; points: ManHoursSharePoint[] } {
  const max = periods.some((p) => (p.officeShare ?? 0) > 0.5) ? 1 : 0.5
  const plotHeight = box.height - box.top - box.bottom
  const yOf = (share: number): number => box.height - box.bottom - (Math.min(share, max) / max) * plotHeight
  const slotWidth = periods.length > 0 ? (box.width - box.left - box.right) / periods.length : 0
  const points: ManHoursSharePoint[] = []
  periods.forEach((p, i) => {
    if (p.officeShare == null) return
    points.push({ key: p.key, x: box.left + i * slotWidth + slotWidth / 2, y: yOf(p.officeShare), share: p.officeShare, soFar: p.soFar, labeled: false })
  })
  const first = points[0]
  if (first) first.labeled = true
  const lastFinished = [...points].reverse().find((pt) => !pt.soFar) ?? points[points.length - 1]
  if (lastFinished) lastFinished.labeled = true
  return { max, ticks: [0, max / 2, max], yOf, points }
}

export type ManHoursHeadline = {
  /** The newest finished period, or the open one when nothing is finished yet. */
  period: ManHoursPeriod
  /** The period before it, when both have a share to compare. */
  prior: ManHoursPeriod | null
  open: boolean
}

export function pickManHoursHeadline(periods: readonly ManHoursPeriod[]): ManHoursHeadline | null {
  if (periods.length === 0) return null
  let index = -1
  periods.forEach((p, i) => {
    if (!p.soFar) index = i
  })
  if (index < 0) return { period: periods[periods.length - 1] as ManHoursPeriod, prior: null, open: true }
  const period = periods[index] as ManHoursPeriod
  const before = index > 0 ? (periods[index - 1] as ManHoursPeriod) : null
  return { period, prior: before && before.officeShare != null && period.officeShare != null ? before : null, open: false }
}

const hoursWord = (h: number): string => `${Math.round(h).toLocaleString('en-US')} hours`
const pctWord = (share: number): string => `${Math.round(share * 100)}%`

/** "September 2026:" + "1,435 hours. Office share 25%, down from 28% the month before." */
export function manHoursHeadlineWords(headline: ManHoursHeadline, zoom: ManHoursZoom): { lead: string; rest: string } {
  const { period, prior, open } = headline
  const lead = `${manHoursPeriodLabel(period, zoom)}${open ? ' so far' : ''}:`
  let rest = `${hoursWord(period.totalHours)}.`
  if (period.officeShare != null) {
    const now = Math.round(period.officeShare * 100)
    const was = prior?.officeShare != null ? Math.round(prior.officeShare * 100) : null
    if (was == null) rest += ` Office share ${pctWord(period.officeShare)}.`
    else if (now === was) rest += ` Office share ${now}%, the same as the ${zoom} before.`
    else rest += ` Office share ${now}%, ${now < was ? 'down' : 'up'} from ${was}% the ${zoom} before.`
  }
  return { lead, rest }
}
