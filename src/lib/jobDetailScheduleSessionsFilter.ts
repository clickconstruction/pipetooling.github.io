import type { JobDetailClockSessionRow } from './fetchClockSessionsForJobLedger'
import { formatJobDetailModalDateFromYmd } from './formatJobDetailModalDateYmd'
import type { JobScheduleBlockWithAssigneeName } from './jobScheduleBlocks'
import { scheduleFormatDateLongNoWeekday, scheduleFormatWindow } from './jobScheduleChicago'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

function formatClockTimeOnlyChicagoForFilter(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: APP_CALENDAR_TZ,
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatDurationHoursForFilter(inIso: string | null, outIso: string | null): string | null {
  if (!inIso || !outIso) return null
  const a = new Date(inIso).getTime()
  const b = new Date(outIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  const h = (b - a) / 3600000
  return `${h.toLocaleString('en-US', { maximumFractionDigits: 1 })} h`
}

function sessionStatusLabelForFilter(s: JobDetailClockSessionRow): string {
  if (s.rejected_at) return 'Rejected'
  if (s.clocked_out_at && !s.approved_at) return 'Pending approval'
  return ''
}

function scheduleBlockHaystack(b: JobScheduleBlockWithAssigneeName): string {
  const assignee = (b.users?.name ?? '').trim() || (b.assignee_user_id ?? '')
  return [
    b.work_date ?? '',
    scheduleFormatDateLongNoWeekday(b.work_date),
    scheduleFormatWindow(b.time_start, b.time_end),
    b.time_start ?? '',
    b.time_end ?? '',
    (b.note ?? '').trim(),
    assignee,
    b.assignee_user_id ?? '',
  ]
    .join(' ')
    .trim()
}

function clockSessionHaystack(s: JobDetailClockSessionRow): string {
  const name = (s.users?.name ?? '').trim() || s.user_id
  const workDateLine = formatJobDetailModalDateFromYmd(s.work_date) ?? s.work_date ?? '—'
  const notes = (s.notes ?? '').trim()
  const dur = formatDurationHoursForFilter(s.clocked_in_at, s.clocked_out_at) ?? '—'
  const timeStart = formatClockTimeOnlyChicagoForFilter(s.clocked_in_at)
  const timeEnd = s.clocked_out_at ? formatClockTimeOnlyChicagoForFilter(s.clocked_out_at) : '—'
  const status = sessionStatusLabelForFilter(s)
  return [name, workDateLine, s.work_date ?? '', notes, dur, timeStart, timeEnd, status, s.user_id].join(' ').trim()
}

export function filterJobDetailScheduleBlocks(
  blocks: JobScheduleBlockWithAssigneeName[],
  filterQuery: string,
): JobScheduleBlockWithAssigneeName[] {
  const q = filterQuery.trim().toLowerCase()
  if (!q) return blocks
  return blocks.filter((b) => scheduleBlockHaystack(b).toLowerCase().includes(q))
}

export function filterJobDetailClockSessions(
  sessions: JobDetailClockSessionRow[],
  filterQuery: string,
): JobDetailClockSessionRow[] {
  const q = filterQuery.trim().toLowerCase()
  if (!q) return sessions
  return sessions.filter((s) => clockSessionHaystack(s).toLowerCase().includes(q))
}
