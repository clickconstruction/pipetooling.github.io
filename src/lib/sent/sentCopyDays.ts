/**
 * Documents → Sent copies by day (the Documents spike of 2026-11-01): the lines of the list under one heading per day in
 * the company's calendar, *Today · Sat, Nov 1*, *Yesterday · Fri, Oct 31*, then the day alone, the way Documents → Photos
 * groups its shots (`photos/uploadedPhotos.ts` `dayGroups`). Under a day heading a line's grey words carry only the time.
 */
import { calendarYmdInAppTzFromIso, formatDenverTimeOnly, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'
import type { SentCopyLine } from './sentCopies'

export type SentCopyDayGroup = { ymd: string; label: string; lines: SentCopyLine[] }

/** The lines by day in the company's calendar, in the order given (newest first). */
export function sentCopyDayGroups(lines: ReadonlyArray<SentCopyLine>, todayYmd: string): SentCopyDayGroup[] {
  const yesterday = ymdBefore(todayYmd)
  const out: SentCopyDayGroup[] = []
  for (const line of lines) {
    const ymd = Number.isFinite(Date.parse(line.row.sentAt)) ? calendarYmdInAppTzFromIso(line.row.sentAt) : ''
    const last = out[out.length - 1]
    if (last && last.ymd === ymd) {
      last.lines.push(line)
      continue
    }
    const day = ymd ? formatWorkDateYmdWeekdayShortFriendly(ymd) : 'No date'
    const label = ymd === todayYmd ? `Today · ${day}` : ymd === yesterday ? `Yesterday · ${day}` : day
    out.push({ ymd, label, lines: [line] })
  }
  return out
}

/** The time alone, for a line under its day heading: *11:51 AM*; '' for a time that does not parse. */
export function sentCopyTimeOnly(iso: string): string {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDenverTimeOnly(ms) : ''
}

function ymdBefore(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(Date.UTC(y, m - 1, d - 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
