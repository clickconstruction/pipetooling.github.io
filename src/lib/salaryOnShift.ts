import type { Database } from '../types/database'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { overrideIsMeaningful, resolveCalendarWorkday } from './resolveCalendarWorkday'

type TemplateRow = Database['public']['Tables']['salary_work_schedule_templates']['Row']
type OverrideRo = Database['public']['Tables']['salary_work_schedule_day_overrides']['Row']
type TimeOffRow = Database['public']['Tables']['user_time_off']['Row']

function effectiveSalaryTz(template: TemplateRow | null, override: OverrideRo | null | undefined): string {
  const o = override?.timezone?.trim()
  if (o) return o
  const t = template?.timezone?.trim()
  if (t) return t
  return APP_CALENDAR_TZ
}

function pgTimeToHms(t: string): { h: number; m: number; s: number } {
  const p = t.split(':').map((x) => Number(x))
  return { h: p[0] ?? 0, m: p[1] ?? 0, s: p[2] ?? 0 }
}

/** Wall clock in `timeZone` on civil `workDateYmd` → UTC ms (matches Postgres `timestamp AT TIME ZONE`). */
function zonedWallClockToUtcMs(workDateYmd: string, hour: number, minute: number, second: number, timeZone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDateYmd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const matches = (ms: number): boolean => {
    const parts = formatter.formatToParts(new Date(ms))
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN)
    const yy = get('year')
    const mm = get('month')
    const dd = get('day')
    const hh = get('hour')
    const min = get('minute')
    const ss = get('second')
    return yy === y && mm === mo && dd === d && hh === hour && min === minute && ss === second
  }

  const anchor = Date.UTC(y, mo - 1, d, 0, 0, 0)
  for (let deltaMin = -420; deltaMin <= 1500; deltaMin++) {
    const ms = anchor + deltaMin * 60 * 1000
    if (matches(ms)) return ms
  }
  return null
}

function buildScheduleWindowsUtc(
  workDateYmd: string,
  template: TemplateRow,
  overrideForDate: OverrideRo | null | undefined,
): Array<{ start: number; end: number }> | null {
  const ov = overrideIsMeaningful(overrideForDate) ? overrideForDate : null
  const mode = (ov?.mode ?? template.mode) === 'split' ? 'split' : 'continuous'
  const saTimeStr = ov?.segment_a_start_local ?? template.segment_a_start_local ?? '08:00:00'
  const saDur = ov?.segment_a_duration_minutes ?? template.segment_a_duration_minutes ?? 480
  const tz = effectiveSalaryTz(template, overrideForDate)

  const t0 = pgTimeToHms(saTimeStr)
  const start0 = zonedWallClockToUtcMs(workDateYmd, t0.h, t0.m, t0.s, tz)
  if (start0 == null) return null
  const windows: Array<{ start: number; end: number }> = [{ start: start0, end: start0 + saDur * 60 * 1000 }]

  if (mode === 'split') {
    const sbTimeStr = ov?.segment_b_start_local ?? template.segment_b_start_local
    const sbDur = ov?.segment_b_duration_minutes ?? template.segment_b_duration_minutes
    if (sbTimeStr && sbDur != null) {
      const t1 = pgTimeToHms(sbTimeStr)
      const start1 = zonedWallClockToUtcMs(workDateYmd, t1.h, t1.m, t1.s, tz)
      if (start1 != null) {
        windows.push({ start: start1, end: start1 + sbDur * 60 * 1000 })
      }
    }
  }
  return windows
}

/** If `nowMs` falls in an active salary block for `workDateYmd`, return block start as ISO (for strip "clocked in" time). */
export function getSalarySyntheticClockInIso(params: {
  workDateYmd: string
  nowMs: number
  timeOffRows: TimeOffRow[]
  template: TemplateRow
  overrideForDate: OverrideRo | null | undefined
}): string | null {
  const { workDateYmd, nowMs, timeOffRows, template, overrideForDate } = params
  const resolution = resolveCalendarWorkday({
    workDateYmd,
    timeOffRows,
    template,
    overrideForDate,
  })
  if (resolution.kind !== 'scheduled') return null

  const windows = buildScheduleWindowsUtc(workDateYmd, template, overrideForDate)
  if (!windows || windows.length === 0) return null

  for (const w of windows) {
    if (nowMs >= w.start && nowMs < w.end) {
      return new Date(w.start).toISOString()
    }
  }
  return null
}
