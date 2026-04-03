import type { Database } from '../types/database'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { overrideIsMeaningful, resolveCalendarWorkday } from './resolveCalendarWorkday'
import { salaryPgTimeToHms, salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'

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

  const t0 = salaryPgTimeToHms(saTimeStr)
  const start0 = salaryZonedWallClockToUtcMs(workDateYmd, t0.h, t0.m, t0.s, tz)
  if (start0 == null) return null
  const windows: Array<{ start: number; end: number }> = [{ start: start0, end: start0 + saDur * 60 * 1000 }]

  if (mode === 'split') {
    const sbTimeStr = ov?.segment_b_start_local ?? template.segment_b_start_local
    const sbDur = ov?.segment_b_duration_minutes ?? template.segment_b_duration_minutes
    if (sbTimeStr && sbDur != null) {
      const t1 = salaryPgTimeToHms(sbTimeStr)
      const start1 = salaryZonedWallClockToUtcMs(workDateYmd, t1.h, t1.m, t1.s, tz)
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
