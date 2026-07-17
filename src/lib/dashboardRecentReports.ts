export type RecentReportRow = {
  id: string
  template_name: string
  job_display_name: string
  created_at: string
  created_by_name: string
  field_values?: Record<string, string>
  reported_at_lat?: number | null
  reported_at_lng?: number | null
}

/** Unread badge count for the "Recent Reports (N)" heading: not hidden and not read. */
export function recentReportsUnreadCount(
  reports: readonly RecentReportRow[],
  hiddenReportIds: ReadonlySet<string>,
  readReportIds: ReadonlySet<string>,
): number {
  return reports.filter((r) => !hiddenReportIds.has(r.id) && !readReportIds.has(r.id)).length
}

/**
 * Rows shown in the list: hidden rows never show; in 'unread' view, read rows
 * show only while they are the currently expanded row.
 */
export function recentReportsVisibleRows(
  reports: readonly RecentReportRow[],
  hiddenReportIds: ReadonlySet<string>,
  readReportIds: ReadonlySet<string>,
  view: 'unread' | 'all',
  expandedReportId: string | null,
): RecentReportRow[] {
  return reports.filter(
    (r) => !hiddenReportIds.has(r.id) && (view === 'all' || !readReportIds.has(r.id) || expandedReportId === r.id),
  )
}
