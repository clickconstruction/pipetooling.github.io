/**
 * The History tab's range bar on a phone (v2.3237): the dates as one short
 * phrase, the preset that produced them (if any), and a caption with the
 * summary numbers. Pure; the component only lays it out.
 */

import { ymdAddDays } from '../../utils/dateUtils'
import { daysBetweenYmd } from './jobHistoryDayList'

export const HISTORY_RANGE_PRESETS = [90, 180, 365] as const
export type HistoryRangePreset = (typeof HISTORY_RANGE_PRESETS)[number]

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The range a preset means: today − N days through today. */
export function presetRange(days: HistoryRangePreset, todayYmd: string): { start: string; end: string } {
  return { start: ymdAddDays(todayYmd, -days), end: todayYmd }
}

/** Which preset the current range is, or null for a hand-picked range. */
export function rangePreset(start: string, end: string, todayYmd: string): HistoryRangePreset | null {
  if (end !== todayYmd) return null
  for (const n of HISTORY_RANGE_PRESETS) if (ymdAddDays(todayYmd, -n) === start) return n
  return null
}

/**
 * "Mar 14" for a date in today's year, "Nov 3, 25" for any other year — the
 * year only when it carries information.
 */
export function formatRangeDate(ymd: string, todayYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const y = m[1]!
  const mo = Number(m[2])
  const d = Number(m[3])
  const base = `${MONTH_SHORT[mo - 1] ?? m[2]} ${d}`
  return y === todayYmd.slice(0, 4) ? base : `${base}, ${y.slice(2)}`
}

/**
 * The two halves of "Mar 14–Sep 10": the component joins them with an en dash
 * and a break opportunity after it, so the phrase stays on one line when it
 * fits and wraps only at the dash when it must.
 */
export function rangeDateParts(start: string, end: string, todayYmd: string): { from: string; to: string } {
  return { from: formatRangeDate(start, todayYmd), to: formatRangeDate(end, todayYmd) }
}

/**
 * "last 180 days · 142 worked · up to 9 people" on a preset;
 * "311 days · 168 worked · up to 9 people" on a hand-picked range;
 * "… · no days worked" when nothing was.
 */
export function rangeCaption(input: { start: string; end: string; todayYmd: string; daysWorked: number; maxPeople: number }): string {
  const preset = rangePreset(input.start, input.end, input.todayYmd)
  const span = preset ? `last ${preset} days` : `${daysBetweenYmd(input.start, input.end) + 1} days`
  if (input.daysWorked === 0) return `${span} · no days worked`
  const people = input.maxPeople === 1 ? '1 person' : `up to ${input.maxPeople} people`
  return `${span} · ${input.daysWorked} worked · ${people}`
}
