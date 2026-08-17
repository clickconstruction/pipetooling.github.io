import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/**
 * Job hours story (v2.1766): the man-hours chip on a Pipeline row opens a
 * modal telling the job's work story — every clock session (who, when, how
 * long, what they did) optionally overlaid with the dispatch calendar's
 * scheduled blocks. Pure helpers here: grouping, totals, the copyable
 * summary, and the printable document. No React, no DB.
 */

export type JobHoursClockSession = {
  id: string
  userName: string
  /** ISO instants. Null clockedOutAt = still clocked in. */
  clockedInAt: string
  clockedOutAt: string | null
  /** YYYY-MM-DD in company time — the day the session belongs to. */
  workDate: string
  notes: string
}

export type JobHoursScheduleBlock = {
  id: string
  userName: string
  /** YYYY-MM-DD. */
  workDate: string
  /** 'HH:MM' or 'HH:MM:SS' local times. */
  timeStart: string
  timeEnd: string
  note: string | null
}

export type JobHoursEntry = {
  kind: 'clock' | 'schedule'
  id: string
  who: string
  timeLabel: string
  /** Whole minutes; null for schedule blocks and still-open sessions. */
  durationMinutes: number | null
  note: string
  stillClockedIn: boolean
}

export type JobHoursDay = {
  /** YYYY-MM-DD (sort key). */
  ymd: string
  label: string
  entries: JobHoursEntry[]
}

export function formatJobHoursDayLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function clockTimeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/** '13:30' / '13:30:00' → '1:30 PM'; malformed values echo back. */
export function formatBlockTime(hms: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hms.trim())
  if (!m) return hms
  const h = Number(m[1])
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${suffix}`
}

export function formatMinutesAsHhMm(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function sessionDurationMinutes(s: JobHoursClockSession): number | null {
  if (!s.clockedOutAt) return null
  const a = new Date(s.clockedInAt).getTime()
  const b = new Date(s.clockedOutAt).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return Math.round((b - a) / 60000)
}

function clockEntry(s: JobHoursClockSession): JobHoursEntry {
  const dur = sessionDurationMinutes(s)
  const open = !s.clockedOutAt
  return {
    kind: 'clock',
    id: s.id,
    who: s.userName,
    timeLabel: `${clockTimeLabel(s.clockedInAt)} – ${open ? 'now' : clockTimeLabel(s.clockedOutAt ?? '')}`,
    durationMinutes: dur,
    note: (s.notes ?? '').trim(),
    stillClockedIn: open,
  }
}

function scheduleEntry(b: JobHoursScheduleBlock): JobHoursEntry {
  return {
    kind: 'schedule',
    id: b.id,
    who: b.userName,
    timeLabel: `${formatBlockTime(b.timeStart)} – ${formatBlockTime(b.timeEnd)}`,
    durationMinutes: null,
    note: (b.note ?? '').trim(),
    stillClockedIn: false,
  }
}

/**
 * Day-grouped story, oldest day first. Within a day: clock sessions (by
 * clock-in) first, then — when the overlay is on — the scheduled blocks (by
 * start time), tinted differently by the modal.
 */
export function buildJobHoursStoryDays(
  sessions: JobHoursClockSession[],
  blocks: JobHoursScheduleBlock[],
  includeSchedule: boolean,
): JobHoursDay[] {
  const byDay = new Map<string, JobHoursDay>()
  const dayFor = (ymd: string): JobHoursDay => {
    let d = byDay.get(ymd)
    if (!d) {
      d = { ymd, label: formatJobHoursDayLabel(ymd), entries: [] }
      byDay.set(ymd, d)
    }
    return d
  }
  for (const s of [...sessions].sort((a, b) => a.clockedInAt.localeCompare(b.clockedInAt))) {
    dayFor(s.workDate).entries.push(clockEntry(s))
  }
  if (includeSchedule) {
    for (const b of [...blocks].sort((a, b) => a.workDate.localeCompare(b.workDate) || a.timeStart.localeCompare(b.timeStart))) {
      dayFor(b.workDate).entries.push(scheduleEntry(b))
    }
  }
  return [...byDay.values()].sort((a, b) => a.ymd.localeCompare(b.ymd))
}

export type JobHoursTotals = {
  totalMinutes: number
  peopleCount: number
  dayCount: number
  openSessionCount: number
}

export function jobHoursStoryTotals(sessions: JobHoursClockSession[]): JobHoursTotals {
  let totalMinutes = 0
  let openSessionCount = 0
  const people = new Set<string>()
  const days = new Set<string>()
  for (const s of sessions) {
    const dur = sessionDurationMinutes(s)
    if (dur != null) totalMinutes += dur
    if (!s.clockedOutAt) openSessionCount += 1
    people.add(s.userName)
    days.add(s.workDate)
  }
  return { totalMinutes, peopleCount: people.size, dayCount: days.size, openSessionCount }
}

/**
 * The "what did you do on the job" text: dated lines for every described
 * clock session (undescribed sessions are skipped — they add nothing to the
 * customer answer). Schedule notes are included only when the overlay is on.
 */
export function buildJobHoursSummaryText(days: JobHoursDay[], jobLabel: string): string {
  const lines: string[] = [jobLabel]
  for (const d of days) {
    for (const e of d.entries) {
      if (!e.note) continue
      lines.push(`${d.label} — ${e.who}: ${e.note}${e.kind === 'schedule' ? ' (scheduled)' : ''}`)
    }
  }
  return lines.length === 1 ? `${jobLabel}\n(no work descriptions recorded yet)` : lines.join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Printable document body (always light — printing pins light per app convention). */
export function buildJobHoursPrintHtml(jobLabel: string, days: JobHoursDay[], totals: JobHoursTotals): string {
  const dayBlocks = days
    .map((d) => {
      const rows = d.entries
        .map(
          (e) =>
            `<tr>
              <td style="padding:2px 10px 2px 0;white-space:nowrap;vertical-align:top;">${e.kind === 'schedule' ? '📅' : '⏱'} ${escapeHtml(e.who)}</td>
              <td style="padding:2px 10px 2px 0;white-space:nowrap;vertical-align:top;color:#555;">${escapeHtml(e.timeLabel)}${e.durationMinutes != null ? ` · ${formatMinutesAsHhMm(e.durationMinutes)}` : e.kind === 'schedule' ? ' · scheduled' : e.stillClockedIn ? ' · in progress' : ''}</td>
              <td style="padding:2px 0;vertical-align:top;">${e.note ? escapeHtml(e.note) : '<span style="color:#999;">—</span>'}</td>
            </tr>`,
        )
        .join('')
      return `<h3 style="margin:14px 0 4px;font-size:12pt;">${escapeHtml(d.label)}</h3><table style="border-collapse:collapse;font-size:10.5pt;width:100%;">${rows}</table>`
    })
    .join('')
  return `<h1 style="font-size:15pt;margin:0 0 2px;">Work on ${escapeHtml(jobLabel)}</h1>
<p style="margin:0 0 10px;color:#555;font-size:10.5pt;">${formatMinutesAsHhMm(totals.totalMinutes)} worked · ${totals.peopleCount} ${totals.peopleCount === 1 ? 'person' : 'people'} · ${totals.dayCount} ${totals.dayCount === 1 ? 'day' : 'days'}${totals.openSessionCount > 0 ? ` · ${totals.openSessionCount} still clocked in` : ''}</p>
${dayBlocks}`
}
