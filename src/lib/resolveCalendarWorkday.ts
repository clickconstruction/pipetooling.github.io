import type { Database } from '../types/database'
import {
  APP_CALENDAR_TZ,
  formatIanaTimeZoneLongOffsetLabel,
  formatIanaTimeZoneShortAbbrev,
  referenceDateForWorkDateYmd,
} from '../utils/dateUtils'

type TemplateRow = Database['public']['Tables']['salary_work_schedule_templates']['Row']
type OverrideRo = Database['public']['Tables']['salary_work_schedule_day_overrides']['Row']
type TimeOffRow = Database['public']['Tables']['user_time_off']['Row']

/** Display labels for time-off rows by `user_time_off.kind` ('unpaid' | 'paid'). */
export const UNPAID_TIME_OFF_LABEL = 'Unpaid time off'
export const PAID_TIME_OFF_LABEL = 'Paid time off'

export function timeOffKindLabel(kind: string): string {
  return kind === 'paid' ? PAID_TIME_OFF_LABEL : UNPAID_TIME_OFF_LABEL
}

export type CalendarWorkdayResolution =
  | { kind: 'none' }
  | { kind: 'time_off'; kindLabel: string; note: string | null }
  | {
      kind: 'scheduled'
      source: 'override' | 'template'
      /** Chip labels: wall-clock range in 12h form + short TZ (e.g. CST) from template/override IANA. */
      blocks: Array<{ label: string; segmentIndex?: 1 | 2 }>
    }

function pgTimeToMinutes(t: string): number {
  const parts = t.split(':').map((x) => Number(x))
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  return h * 60 + m
}

function minutesTo12h(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const h24 = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const period = h24 < 12 ? 'AM' : 'PM'
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function blockLabel(
  startLocal: string,
  durationMinutes: number,
  iana: string,
  workDateYmd: string,
): string {
  const startM = pgTimeToMinutes(startLocal.length >= 5 ? startLocal.slice(0, 5) : startLocal)
  const endM = startM + durationMinutes
  const range = `${minutesTo12h(startM)}–${minutesTo12h(endM)}`
  const ref = referenceDateForWorkDateYmd(workDateYmd)
  const tz =
    formatIanaTimeZoneShortAbbrev(iana, ref) ??
    formatIanaTimeZoneLongOffsetLabel(iana, ref) ??
    `(${iana})`
  return `${range} ${tz}`
}

export function overrideIsMeaningful(ov: OverrideRo | null | undefined): ov is OverrideRo {
  return !!(ov && (ov.mode != null || ov.segment_a_start_local != null))
}

/** ISO weekday 1–7 (Mon–Sun) from calendar `YYYY-MM-DD` (UTC date parts; matches `to_char(date, 'ID')` in Postgres). */
function isoWeekdayFromYmd(workDateYmd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDateYmd)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const js = new Date(Date.UTC(y, mo, d)).getUTCDay()
  return js === 0 ? 7 : js
}

function buildScheduledBlocks(
  template: TemplateRow | null,
  override: OverrideRo | null | undefined,
  workDateYmd: string,
): { blocks: Array<{ label: string; segmentIndex?: 1 | 2 }> } {
  const ov = overrideIsMeaningful(override) ? override : null
  const mode = (ov?.mode ?? template?.mode) === 'split' ? 'split' : 'continuous'
  const saTime = ov?.segment_a_start_local ?? template?.segment_a_start_local ?? '08:00:00'
  const saDur = ov?.segment_a_duration_minutes ?? template?.segment_a_duration_minutes ?? 480
  const rawTz = (ov?.timezone ?? template?.timezone ?? '').trim()
  const iana = rawTz || APP_CALENDAR_TZ

  if (mode === 'continuous') {
    return {
      blocks: [{ label: blockLabel(saTime, saDur, iana, workDateYmd) }],
    }
  }

  const sbTime = ov?.segment_b_start_local ?? template?.segment_b_start_local
  const sbDur = ov?.segment_b_duration_minutes ?? template?.segment_b_duration_minutes
  if (!sbTime || sbDur == null) {
    return { blocks: [{ label: blockLabel(saTime, saDur, iana, workDateYmd) }] }
  }

  return {
    blocks: [
      { label: blockLabel(saTime, saDur, iana, workDateYmd), segmentIndex: 1 },
      { label: blockLabel(sbTime, sbDur, iana, workDateYmd), segmentIndex: 2 },
    ],
  }
}

export function resolveCalendarWorkday(params: {
  workDateYmd: string
  timeOffRows: TimeOffRow[]
  template: TemplateRow | null
  overrideForDate: OverrideRo | null | undefined
}): CalendarWorkdayResolution {
  const { workDateYmd, timeOffRows, template, overrideForDate } = params

  const off = timeOffRows.find((r) => workDateYmd >= r.start_date && workDateYmd <= r.end_date)
  if (off) {
    return { kind: 'time_off', kindLabel: timeOffKindLabel(off.kind), note: off.note }
  }

  const isoDow = isoWeekdayFromYmd(workDateYmd)
  if (
    template?.exclude_weekends &&
    !overrideIsMeaningful(overrideForDate) &&
    isoDow != null &&
    (isoDow === 6 || isoDow === 7)
  ) {
    return { kind: 'none' }
  }

  if (overrideIsMeaningful(overrideForDate)) {
    return {
      kind: 'scheduled',
      source: 'override',
      ...buildScheduledBlocks(template, overrideForDate, workDateYmd),
    }
  }

  if (template) {
    return { kind: 'scheduled', source: 'template', ...buildScheduledBlocks(template, null, workDateYmd) }
  }

  return { kind: 'none' }
}
