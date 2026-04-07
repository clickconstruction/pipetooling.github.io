import type { ClockSessionRow } from '../types/clockSessions'
import {
  formatClockSessionJobOrBidLabelFromEmbeds,
  shortJobOrBidLabelFromEmbeds,
} from '../types/clockSessions'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

/** PostgREST row shape for CLOCK_SESSION_CALENDAR_SELECT. */
export type CalendarClockSessionRaw = {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string | null
  job_ledger_id: string | null
  bid_id: string | null
  origin: string | null
  rejected_at: string | null
  revoked_at: string | null
  jobs_ledger: ClockSessionRow['jobs_ledger']
  bids: ClockSessionRow['bids']
}

export function calendarRawToClockSessionRow(r: CalendarClockSessionRaw): ClockSessionRow {
  return {
    id: r.id,
    user_id: r.user_id,
    work_date: r.work_date,
    clocked_in_at: r.clocked_in_at,
    clocked_out_at: r.clocked_out_at,
    notes: r.notes ?? '',
    job_ledger_id: r.job_ledger_id,
    bid_id: r.bid_id,
    origin: r.origin ?? undefined,
    salary_segment_index: null,
    clock_in_lat: null,
    clock_in_lng: null,
    clock_out_lat: null,
    clock_out_lng: null,
    approved_at: null,
    approved_by: null,
    rejected_at: r.rejected_at,
    rejected_by: null,
    revoked_at: r.revoked_at,
    revoked_by: null,
    users: null,
    approved_by_user: null,
    rejected_by_user: null,
    revoked_by_user: null,
    jobs_ledger: r.jobs_ledger,
    bids: r.bids,
  }
}

export function isCalendarClockSessionActive(row: {
  rejected_at: string | null
  revoked_at: string | null
}): boolean {
  return row.rejected_at == null && row.revoked_at == null
}

export function groupActiveClockSessionsByWorkDate(
  rows: ClockSessionRow[],
): Record<string, ClockSessionRow[]> {
  const map: Record<string, ClockSessionRow[]> = {}
  for (const r of rows) {
    if (!isCalendarClockSessionActive(r)) continue
    const k = r.work_date
    if (!map[k]) map[k] = []
    map[k]!.push(r)
  }
  for (const k of Object.keys(map)) {
    map[k]!.sort((a, b) => new Date(a.clocked_in_at).getTime() - new Date(b.clocked_in_at).getTime())
  }
  return map
}

const timeOnlyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  hour: 'numeric',
  minute: '2-digit',
})

export function formatSessionRangeCentral(clocked_in_at: string, clocked_out_at: string | null): string {
  const start = timeOnlyFormatter.format(new Date(clocked_in_at))
  if (!clocked_out_at) return `${start} – open`
  return `${start} – ${timeOnlyFormatter.format(new Date(clocked_out_at))}`
}

export function calendarSessionDurationSeconds(
  s: { clocked_in_at: string; clocked_out_at: string | null },
  nowMs: number,
): number {
  const inMs = new Date(s.clocked_in_at).getTime()
  const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowMs
  return Math.max(0, Math.floor((outMs - inMs) / 1000))
}

export function formatCalendarSessionDurationCompact(
  s: { clocked_in_at: string; clocked_out_at: string | null },
  nowMs: number,
): string {
  const sec = calendarSessionDurationSeconds(s, nowMs)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return sec > 0 ? '<1m' : '0m'
}

export const CALENDAR_SESSION_CHIP_CAP = 3

export function calendarSessionChipLabel(s: ClockSessionRow): string {
  const j = shortJobOrBidLabelFromEmbeds(s)
  if (j) return j
  if (s.origin === 'salary_schedule') return 'Scheduled'
  return 'No job'
}

export function calendarSessionChipTooltip(s: ClockSessionRow): string {
  const parts: string[] = []
  const full = formatClockSessionJobOrBidLabelFromEmbeds(s)
  if (full) parts.push(full)
  else if (s.origin === 'salary_schedule') parts.push('Scheduled (salary)')
  const n = (s.notes ?? '').trim()
  if (n) parts.push(n.length > 120 ? `${n.slice(0, 117)}…` : n)
  return parts.join(' · ') || 'Clock session'
}
