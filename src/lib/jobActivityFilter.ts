import type { JobThreadActivityItem } from '../components/JobThreadNotesPanel'
import { bucketForEvent } from './jobActivityEvent'

/** Segmented filter buckets for the Job activity / notes panel. */
export type ActivityFilter = 'all' | 'notes' | 'reports' | 'status' | 'billing' | 'crew'

export const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'notes', label: 'Notes' },
  { value: 'reports', label: 'Reports' },
  { value: 'status', label: 'Status' },
  { value: 'billing', label: 'Billing' },
  { value: 'crew', label: 'Crew' },
]

/**
 * Job activity's buckets (Jobs → Pipeline): the panel's, and the customer's calls, texts and emails from Messages
 * (cut 10). Quickfill and Dispatch's customer summary keep {@link ACTIVITY_FILTERS} and read no messages. Since v2.5527
 * Job Mode's Job updates and the Job detail window take this set for a tech (`jobs/jobUpdatesCustomerLines.ts`). The lines' own counts are `countJobActivityLines` in `jobs/jobActivityLine.ts`.
 */
export type JobActivityFilter = ActivityFilter | 'customer'

export const JOB_ACTIVITY_FILTERS: { value: JobActivityFilter; label: string }[] = [
  ...ACTIVITY_FILTERS,
  { value: 'customer', label: 'Customer' },
]

/**
 * What this viewer reads on this job, for the two chips that are not everyone's (2026-11-20, the owner's phone walk).
 * Billing follows the money half of `can_read_job_activity(job, financial)`. Reports follow the job leg of
 * `list_reports_for_job_ledger`. Where the answers come from: `jobs/jobActivityChipAccess.ts`.
 */
export type ActivityFilterAccess = { canSeeBilling: boolean; canSeeReports: boolean }

/** Every chip: the office, which reads both halves on every job. */
export const FULL_ACTIVITY_FILTER_ACCESS: ActivityFilterAccess = { canSeeBilling: true, canSeeReports: true }

/** The chips that ask about access. Every other chip is drawn for everyone who reads the feed. */
const GATED_FILTERS = { reports: 'canSeeReports', billing: 'canSeeBilling' } as const

/**
 * The chips this viewer is drawn, in the list's own order. A gated chip (Reports, Billing) is drawn when the viewer
 * reads that kind of line on this job, or when the feed they were handed holds one: a helper's own report, a
 * line the database gave them. So a chip is never hidden over a line the person can read under All, and a
 * person with access and nothing yet keeps the dim chip.
 */
export function visibleActivityFilters<F extends string>(
  filters: readonly { value: F; label: string }[],
  access: ActivityFilterAccess,
  counts?: Partial<Record<string, number>> | null,
): { value: F; label: string }[] {
  return filters.filter((f) => {
    const key = (GATED_FILTERS as Record<string, keyof ActivityFilterAccess | undefined>)[f.value]
    if (!key) return true
    return access[key] || (counts?.[f.value] ?? 0) > 0
  })
}

/** The filter to show: the chosen one when its chip is drawn, else All (a kept or linked filter the viewer cannot see). */
export function resolveActivityFilter<F extends string>(
  selected: F,
  visible: readonly { value: F }[],
): F | 'all' {
  return visible.some((f) => f.value === selected) ? selected : 'all'
}

/**
 * Membership of a timeline item in a filter bucket:
 * - notes  → thread notes
 * - reports→ field reports
 * - status → status-change events
 * - billing→ payment/invoice events
 * - crew   → crew events + clock sessions + dispatch schedule blocks
 * - 'other' events (material/fixture/field-edit/combine) appear only under 'all'.
 */
export function activityItemMatchesFilter(item: JobThreadActivityItem, filter: ActivityFilter): boolean {
  if (filter === 'all') return true
  switch (item.kind) {
    case 'note':
      return filter === 'notes'
    case 'report':
      return filter === 'reports'
    case 'schedule_block':
    case 'clock_session':
      return filter === 'crew'
    case 'event': {
      const bucket = bucketForEvent(item.event.type)
      if (bucket === 'status') return filter === 'status'
      if (bucket === 'billing') return filter === 'billing'
      if (bucket === 'crew') return filter === 'crew'
      return false // 'other' bucket → only under 'all'
    }
    default:
      return false
  }
}

export function filterActivity(
  items: JobThreadActivityItem[],
  filter: ActivityFilter,
): JobThreadActivityItem[] {
  if (filter === 'all') return items
  return items.filter((it) => activityItemMatchesFilter(it, filter))
}

/**
 * Per-bucket item counts for the filter pills. 'all' is the total item count —
 * it can exceed the other buckets' sum because 'other' events (material/
 * fixture/field-edit/combine) appear only under 'all'. Computed from the same
 * array `filterActivity` filters, so a pill's count always matches what
 * clicking it reveals.
 */
export function countActivityByFilter(items: JobThreadActivityItem[]): Record<ActivityFilter, number> {
  const counts: Record<ActivityFilter, number> = { all: items.length, notes: 0, reports: 0, status: 0, billing: 0, crew: 0 }
  for (const it of items) {
    for (const f of ['notes', 'reports', 'status', 'billing', 'crew'] as const) {
      if (activityItemMatchesFilter(it, f)) {
        counts[f]++
        break // buckets are disjoint — an item lives in at most one
      }
    }
  }
  return counts
}
