import type { JobThreadActivityItem } from '../components/JobThreadNotesPanel'
import { bucketForEvent } from './jobActivityEvent'

/** Segmented filter buckets for the Job activity / notes panel. */
export type ActivityFilter = 'all' | 'notes' | 'status' | 'billing' | 'crew'

export const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'notes', label: 'Notes' },
  { value: 'status', label: 'Status' },
  { value: 'billing', label: 'Billing' },
  { value: 'crew', label: 'Crew' },
]

/**
 * Membership of a timeline item in a filter bucket:
 * - notes  → thread notes + field reports
 * - status → status-change events
 * - billing→ payment/invoice events
 * - crew   → crew events + clock sessions + dispatch schedule blocks
 * - 'other' events (material/fixture/field-edit/combine) appear only under 'all'.
 */
export function activityItemMatchesFilter(item: JobThreadActivityItem, filter: ActivityFilter): boolean {
  if (filter === 'all') return true
  switch (item.kind) {
    case 'note':
    case 'report':
      return filter === 'notes'
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
