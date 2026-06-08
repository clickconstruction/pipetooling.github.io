import type { JobThreadActivityItem } from '../components/JobThreadNotesPanel'

export function activitySortMs(it: JobThreadActivityItem): number {
  if (it.kind === 'note') return new Date(it.note.created_at).getTime()
  if (it.kind === 'report') return new Date(it.report.created_at).getTime()
  if (it.kind === 'clock_session') return new Date(it.clock.sortAt).getTime()
  if (it.kind === 'event') return new Date(it.event.occurredAt).getTime()
  return new Date(it.schedule.sortAt).getTime()
}

export function sortJobThreadActivity(items: JobThreadActivityItem[]): JobThreadActivityItem[] {
  return [...items].sort((a, b) => activitySortMs(a) - activitySortMs(b))
}
