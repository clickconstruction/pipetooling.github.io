/**
 * "What will send" preview for the Schedule Share and Day-email modals
 * (journey map J18-F9). Both edge functions build their email from the same
 * RPC rows the client can read — `list_schedule_blocks_for_share` (Share,
 * grouped by person in the sharer's visibility) and
 * `list_job_schedule_blocks_for_schedule_email` (Day email, time order in the
 * recipient's visibility). This module turns those rows into display lines the
 * same way `supabase/functions/_shared/scheduleShareCore.ts` does, so the
 * preview lists exactly the rows the email will — bid visits included
 * (`B<number>` display fallback from migration 20260814033856).
 */

import { scheduleFormatWindow } from './jobScheduleChicago'

/** Row shape shared by both schedule-email RPCs (only the display columns are read). */
export interface SchedulePreviewBlockRow {
  id: string
  work_date: string
  time_start: string
  time_end: string
  note: string | null
  assignee_name: string | null
  job_hcp_number: string | null
  job_name: string | null
  job_address: string | null
}

export interface SchedulePreviewLine {
  id: string
  workDate: string
  /** `Wed, Sep 2` — same shape as the email's date cell. */
  dateLabel: string
  /** `7:00 AM–3:30 PM` — same shape as the email's window cell. */
  window: string
  person: string
  /** `J512 · Smith House Repipe` / `B412 · Oakmont Clubhouse` / `— · Job`. */
  jobLabel: string
  address: string
  note: string
}

export interface SchedulePreviewPersonGroup {
  person: string
  lines: SchedulePreviewLine[]
}

export interface SchedulePreviewSummary {
  blockCount: number
  personCount: number
  dayCount: number
}

/** Mirrors the email's fallback for a block with no assignee name. */
export const SCHEDULE_PREVIEW_UNASSIGNED = '(Unassigned)'

/** `YYYY-MM-DD` → `Wed, Sep 2` (UTC anchor, so digits match the stored calendar day). */
export function schedulePreviewDateLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** `<number or —> · <name or Job>` — the email's job cell, verbatim. */
export function schedulePreviewJobLabel(row: Pick<SchedulePreviewBlockRow, 'job_hcp_number' | 'job_name'>): string {
  const num = (row.job_hcp_number ?? '').trim() || '—'
  const name = (row.job_name ?? '').trim() || 'Job'
  return `${num} · ${name}`
}

/**
 * RPC rows → display lines, keeping the RPC's order (Share: person, date,
 * time; Day email: time, person). When `dates` is non-empty the rows are
 * filtered to that set — the share edge function fetches `p_start..p_end` and
 * drops the days in between that the Include options skip.
 */
export function schedulePreviewLines(rows: readonly SchedulePreviewBlockRow[], dates: readonly string[] = []): SchedulePreviewLine[] {
  const keep = dates.length > 0 ? new Set(dates) : null
  const out: SchedulePreviewLine[] = []
  for (const r of rows) {
    const workDate = String(r.work_date ?? '').slice(0, 10)
    if (keep && !keep.has(workDate)) continue
    out.push({
      id: r.id,
      workDate,
      dateLabel: schedulePreviewDateLabel(workDate),
      window: scheduleFormatWindow(r.time_start, r.time_end),
      person: (r.assignee_name ?? '').trim() || SCHEDULE_PREVIEW_UNASSIGNED,
      jobLabel: schedulePreviewJobLabel(r),
      address: (r.job_address ?? '').trim(),
      note: (r.note ?? '').trim(),
    })
  }
  return out
}

/** Group lines by person in first-seen order — the Share email's section order. */
export function schedulePreviewByPerson(lines: readonly SchedulePreviewLine[]): SchedulePreviewPersonGroup[] {
  const groups = new Map<string, SchedulePreviewLine[]>()
  for (const line of lines) {
    const arr = groups.get(line.person)
    if (arr) arr.push(line)
    else groups.set(line.person, [line])
  }
  return [...groups.entries()].map(([person, personLines]) => ({ person, lines: personLines }))
}

export function schedulePreviewSummary(lines: readonly SchedulePreviewLine[]): SchedulePreviewSummary {
  const people = new Set<string>()
  const days = new Set<string>()
  for (const line of lines) {
    people.add(line.person)
    days.add(line.workDate)
  }
  return { blockCount: lines.length, personCount: people.size, dayCount: days.size }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * One-line headline for the preview panel. `dayCount` is shown only when the
 * email covers more than one day (single-day emails name the day elsewhere).
 */
export function schedulePreviewSummaryLabel(summary: SchedulePreviewSummary, opts: { multiDay: boolean }): string {
  if (summary.blockCount === 0) return 'Nothing scheduled — the email will say so.'
  const parts = [plural(summary.blockCount, 'block', 'blocks'), plural(summary.personCount, 'person', 'people')]
  if (opts.multiDay) parts.push(plural(summary.dayCount, 'day', 'days'))
  return parts.join(' · ')
}
