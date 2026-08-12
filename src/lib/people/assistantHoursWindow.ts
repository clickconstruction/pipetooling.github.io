/**
 * People → Hours assistant visibility window (v2.1592).
 *
 * Assistants see only the current week plus N-1 previous weeks on the Hours tab
 * (org-configurable via `app_settings.assistant_hours_window_weeks_v1` — see
 * `appSettingsKeys.ts`). These pure helpers compute the earliest visible date
 * ("floor") and clamp a date range to it. Weeks start on Sunday, matching the
 * Hours tab's default week (`d.getDate() - d.getDay()` in People.tsx).
 *
 * Dates are local-day `YYYY-MM-DD` strings (en-CA), which sort chronologically.
 */

/**
 * Earliest visible YMD for a window of `weeks` (current week counts as 1), or
 * null for no limit (`weeks <= 0` — the "unlimited" setting).
 * weeks=3 on a Wednesday → the Sunday two weeks before this week's Sunday.
 */
export function assistantHoursWindowFloorYmd(todayYmd: string, weeks: number): string | null {
  if (!Number.isFinite(weeks) || weeks <= 0) return null
  const d = new Date(todayYmd + 'T12:00:00')
  d.setDate(d.getDate() - d.getDay() - (Math.floor(weeks) - 1) * 7)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Clamp a single day to the floor (v2.1593 — clock strip day nav). Null floor = unchanged. */
export function clampYmdToFloor(ymd: string, floorYmd: string | null): string {
  return floorYmd != null && ymd < floorYmd ? floorYmd : ymd
}

/**
 * Clamp a start/end range to the floor. Start never precedes the floor; end
 * never precedes the (possibly clamped) start. Null floor = unchanged.
 */
export function clampHoursRangeToFloor(
  start: string,
  end: string,
  floorYmd: string | null
): { start: string; end: string } {
  if (!floorYmd) return { start, end }
  const s = start < floorYmd ? floorYmd : start
  const e = end < s ? s : end
  return { start: s, end: e }
}
