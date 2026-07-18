/**
 * Pure row helpers for the Dashboard job-row family (Team Ready to Bill /
 * Assigned Jobs / Superintendent Jobs). Moved verbatim from
 * `src/pages/Dashboard.tsx` module scope (extraction-series refactor; no
 * behavior change) so the section components and the page share one
 * definition. `formatTimeSince` and `subcontractorLastActivityBlock` take
 * `now` as a parameter (defaulting to `new Date()`, call sites unchanged) so
 * tests are deterministic.
 */
import { formatDatetime } from './dashboardProjectsCard'
import {
  SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER,
  subcontractorActivitySourceLabel,
  type SubcontractorActivitySource,
} from './subcontractorJobActivityCopy'
import type { DashboardTeamAssignedJobRow } from './dashboardTeamAssignedJobRow'

/** Relative "time since" label for job/invoice "Open …" chips ("just now", "3 hours", "2 weeks", …). */
export function formatTimeSince(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—'
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffMs / 604800000)
  const diffMonths = Math.floor(diffMs / 2592000000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`
  return `${Math.floor(diffMonths / 12)} year${Math.floor(diffMonths / 12) !== 1 ? 's' : ''}`
}

/** "Stage: …" line under a subcontractor-like Assigned Jobs row (null = no line). */
export function subcontractorAssignedJobStageDisplay(
  j: Pick<DashboardTeamAssignedJobRow, 'in_progress_stage_name' | 'project_id'>,
): { line: string; title: string | undefined } | null {
  const name = j.in_progress_stage_name?.trim()
  if (name) {
    return { line: `Stage: ${name}`, title: undefined }
  }
  if (j.project_id) {
    return {
      line: 'Stage: —',
      title: 'No step is currently in progress for this project',
    }
  }
  return null
}

function subcontractorLastActivityTimeMs(iso: string | null | undefined): number | null {
  const t = (iso ?? '').trim()
  if (!t) return null
  const ms = new Date(t).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Which source(s) share the same instant as `last_job_activity_at` (ms tie → comma-joined labels). */
export function subcontractorLastActivityTypeLine(
  j: Pick<
    DashboardTeamAssignedJobRow,
    | 'last_job_activity_at'
    | 'last_thread_note_at'
    | 'last_report_at'
    | 'last_clock_activity_at'
    | 'last_schedule_activity_at'
  >,
): string {
  const activity = (j.last_job_activity_at ?? '').trim()
  if (!activity) return 'Activity'
  const winMs = new Date(activity).getTime()
  if (Number.isNaN(winMs)) return 'Activity'

  const sources: { key: SubcontractorActivitySource; ms: number | null }[] = [
    { key: 'thread_note', ms: subcontractorLastActivityTimeMs(j.last_thread_note_at) },
    { key: 'field_report', ms: subcontractorLastActivityTimeMs(j.last_report_at) },
    { key: 'clock', ms: subcontractorLastActivityTimeMs(j.last_clock_activity_at) },
    { key: 'schedule', ms: subcontractorLastActivityTimeMs(j.last_schedule_activity_at) },
  ]
  const winners = new Set(sources.filter((s) => s.ms != null && s.ms === winMs).map((s) => s.key))
  if (winners.size === 0) return 'Activity'
  return SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER.filter((k) => winners.has(k))
    .map((k) => subcontractorActivitySourceLabel[k])
    .join(', ')
}

export type SubcontractorLastActivityLines = { title: string; line1: string; line2: string; line3?: string }

/** Desktop "Last activity" block for a subcontractor-like job row (`line3` clickable → activity modal). */
export function subcontractorLastActivityBlock(
  j: Pick<
    DashboardTeamAssignedJobRow,
    | 'last_job_activity_at'
    | 'last_thread_note_at'
    | 'last_report_at'
    | 'last_clock_activity_at'
    | 'last_schedule_activity_at'
  >,
  now: Date = new Date(),
): SubcontractorLastActivityLines {
  const activity = (j.last_job_activity_at ?? '').trim()
  if (!activity) {
    return {
      title: 'No thread notes, field reports, work sessions, or schedule activity on this job yet',
      line1: 'Last activity:',
      line2: 'No activity yet',
    }
  }
  const rel = formatTimeSince(activity, now)
  const relLine = rel === 'just now' ? 'Just now' : `${rel} ago`
  return {
    title: `Latest activity: ${formatDatetime(activity)}`,
    line1: 'Last activity:',
    line2: relLine,
    line3: subcontractorLastActivityTypeLine(j),
  }
}
