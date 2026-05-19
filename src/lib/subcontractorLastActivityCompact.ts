import {
  SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER,
  subcontractorActivitySourceLabel,
  type SubcontractorActivitySource,
} from './subcontractorJobActivityCopy'

/**
 * Subset of `DashboardTeamAssignedJobRow` consumed by mobile "Last activity" rendering.
 * Kept lib-local so this module doesn't reach into `src/pages/Dashboard.tsx`.
 */
export type SubcontractorLastActivityFields = {
  last_job_activity_at?: string | null
  last_thread_note_at?: string | null
  last_report_at?: string | null
  last_clock_activity_at?: string | null
  last_schedule_activity_at?: string | null
}

/**
 * Terse "N<unit> ago" phrase for the mobile "Last Activity" single-line collapse.
 * Units mirror `formatTimeSince`'s buckets (floor, same boundaries) so the value
 * never drifts from the desktop multi-line rendering.
 *
 * - blank / invalid ISO → `—`
 * - < 1 minute ago or any future instant → `just now`
 * - else → `5m ago / 23h ago / 2d ago / 3w ago / 4mo ago / 1y ago`
 *
 * `mo` (months) is two letters to avoid colliding with `m` (minutes).
 */
export function compactTimeAgo(iso: string | null | undefined, now?: Date): string {
  const t = (iso ?? '').trim()
  if (!t) return '—'
  const then = new Date(t).getTime()
  if (Number.isNaN(then)) return '—'
  const nowMs = (now ?? new Date()).getTime()
  const diffMs = nowMs - then
  if (diffMs < 60000) {
    // <1min ago, just-now, or any future instant: collapse to "just now"
    return 'just now'
  }
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffMs / 604800000)
  const diffMonths = Math.floor(diffMs / 2592000000)
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${Math.floor(diffMonths / 12)}y ago`
}

/**
 * Long relative phrase for the `aria-label` (so screen readers hear the same
 * thing they'd see on desktop): `Just now`, `23 hours ago`, `No activity yet`.
 * Hours/days/etc. use singular vs plural like the desktop `formatTimeSince`.
 */
export function longTimeAgoPhrase(iso: string | null | undefined, now?: Date): string {
  const t = (iso ?? '').trim()
  if (!t) return 'No activity yet'
  const then = new Date(t).getTime()
  if (Number.isNaN(then)) return 'No activity yet'
  const nowMs = (now ?? new Date()).getTime()
  const diffMs = nowMs - then
  if (diffMs < 60000) return 'Just now'
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffMs / 604800000)
  const diffMonths = Math.floor(diffMs / 2592000000)
  const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''} ago`
  if (diffMins < 60) return plural(diffMins, 'minute')
  if (diffHours < 24) return plural(diffHours, 'hour')
  if (diffDays < 7) return plural(diffDays, 'day')
  if (diffWeeks < 4) return plural(diffWeeks, 'week')
  if (diffMonths < 12) return plural(diffMonths, 'month')
  const diffYears = Math.floor(diffMonths / 12)
  return plural(diffYears, 'year')
}

function lastActivityTimeMs(iso: string | null | undefined): number | null {
  const t = (iso ?? '').trim()
  if (!t) return null
  const ms = new Date(t).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Comma-joined source labels matching the `last_job_activity_at` instant.
 * When multiple sources share the same ms (a tie), labels are joined in the
 * fixed `SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER`. Returns `null` when no source
 * row aligns with the activity timestamp (or `last_job_activity_at` is blank).
 */
export function subcontractorLastActivitySourceLine(
  j: SubcontractorLastActivityFields,
): string | null {
  const activity = (j.last_job_activity_at ?? '').trim()
  if (!activity) return null
  const winMs = new Date(activity).getTime()
  if (Number.isNaN(winMs)) return null

  const sources: { key: SubcontractorActivitySource; ms: number | null }[] = [
    { key: 'thread_note', ms: lastActivityTimeMs(j.last_thread_note_at) },
    { key: 'field_report', ms: lastActivityTimeMs(j.last_report_at) },
    { key: 'clock', ms: lastActivityTimeMs(j.last_clock_activity_at) },
    { key: 'schedule', ms: lastActivityTimeMs(j.last_schedule_activity_at) },
  ]
  const winners = new Set(
    sources.filter((s) => s.ms != null && s.ms === winMs).map((s) => s.key),
  )
  if (winners.size === 0) return null
  return SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER.filter((k) => winners.has(k))
    .map((k) => subcontractorActivitySourceLabel[k])
    .join(', ')
}

export type SubcontractorLastActivityMobileLine = {
  /** Visible single-line label, e.g. `Last Activity 23h ago: Field report`. */
  text: string
  /** True when there's a known activity instant (so the line opens the explainer modal). */
  clickable: boolean
  /** `title` tooltip (long datetime when known; explainer phrase when no activity). */
  title: string
  /** Full a11y phrase: `Last activity: 23 hours ago, Field report`. */
  aria: string
}

const NO_ACTIVITY_TITLE =
  'No thread notes, field reports, work sessions, or schedule activity on this job yet'

/**
 * Builds the single-line mobile "Last Activity" payload for subcontractor-like
 * Dashboard rows. Mirrors `subcontractorLastActivityBlock` (desktop 3-line) but
 * collapses it to one terse string prefixed with `Last Activity`.
 *
 * `formatTitle` is injected so the caller can reuse its existing locale-aware
 * datetime formatter without bringing locale logic into this lib (tests pass a
 * deterministic stub).
 */
export function subcontractorLastActivityMobileLine(
  j: SubcontractorLastActivityFields,
  opts?: {
    now?: Date
    formatTitle?: (iso: string) => string
  },
): SubcontractorLastActivityMobileLine {
  const activity = (j.last_job_activity_at ?? '').trim()
  if (!activity || Number.isNaN(new Date(activity).getTime())) {
    return {
      text: 'Last Activity: No activity yet',
      clickable: false,
      title: NO_ACTIVITY_TITLE,
      aria: 'Last activity: No activity yet',
    }
  }
  const compact = compactTimeAgo(activity, opts?.now)
  const longRel = longTimeAgoPhrase(activity, opts?.now)
  const sourceLine = subcontractorLastActivitySourceLine(j)
  const formatter = opts?.formatTitle ?? ((iso) => iso)
  const text = sourceLine ? `Last Activity ${compact}: ${sourceLine}` : `Last Activity ${compact}`
  const ariaTail = sourceLine ? `${longRel}, ${sourceLine}` : longRel
  return {
    text,
    clickable: true,
    title: `Latest activity: ${formatter(activity)}`,
    aria: `Last activity: ${ariaTail}`,
  }
}
