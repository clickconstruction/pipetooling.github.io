/** Minimal clock row for Calendar “recorded time” aggregation. */
export type CalendarClockSessionSlice = {
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  rejected_at: string | null
  revoked_at: string | null
}

export type CalendarRecordedByDate = {
  /** Closed sessions only; non-rejected, non-revoked. */
  hours: number
  /** Sessions still clocked in (not rejected/revoked). */
  openCount: number
}

function isActiveClockRow(r: CalendarClockSessionSlice): boolean {
  return r.rejected_at == null && r.revoked_at == null
}

/**
 * Sum payable clock duration per work_date (closed segments only).
 * Open sessions contribute to `openCount` only.
 */
export function aggregateCalendarClockedHoursByDate(
  rows: CalendarClockSessionSlice[]
): Record<string, CalendarRecordedByDate> {
  const out: Record<string, CalendarRecordedByDate> = {}

  for (const r of rows) {
    const key = r.work_date
    if (!out[key]) out[key] = { hours: 0, openCount: 0 }

    if (!isActiveClockRow(r)) continue

    if (r.clocked_out_at == null) {
      out[key]!.openCount += 1
      continue
    }

    const t0 = new Date(r.clocked_in_at).getTime()
    const t1 = new Date(r.clocked_out_at).getTime()
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue
    out[key]!.hours += (t1 - t0) / 3600000
  }

  return out
}
