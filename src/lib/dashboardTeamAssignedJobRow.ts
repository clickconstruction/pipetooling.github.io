/**
 * Dashboard Assigned Jobs + team Ready to Bill rows from list_*_for_dashboard RPCs.
 *
 * Moved verbatim from `src/pages/Dashboard.tsx` (extraction-series refactor; no
 * behavior change) so `useDashboardSubSchedule` / `DashboardMyScheduleSection`
 * — and, later, the job-row-family extraction — can share it with the page.
 */
export type DashboardTeamAssignedJobRow = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  google_drive_link: string | null
  job_plans_link: string | null
  job_pictures_link?: string | null
  revenue: number | null
  created_at: string | null
  last_report_at?: string | null
  /** Latest `reports.created_at` authored by viewer (Dashboard Leave Report nag; 12h silence). */
  my_last_report_at?: string | null
  /** Max of latest thread note, field report, qualifying clock session, and schedule block (Dashboard "Last activity"). */
  last_job_activity_at?: string | null
  last_thread_note_at?: string | null
  last_clock_activity_at?: string | null
  last_schedule_activity_at?: string | null
  in_progress_stage_name?: string | null
  project_id?: string | null
  in_progress_step_id?: string | null
  collect_payment_button_variant?: string | null
  status?: string | null
}

/**
 * Roles that see the Team Ready to Bill section / load
 * `list_ready_to_bill_assigned_jobs_for_dashboard`. Moved verbatim from
 * `src/pages/Dashboard.tsx` module scope (v2.725 `useDashboardAssignedJobs`
 * seam) so the hook and the page share one definition.
 */
export function isDashboardTeamReadyToBillRole(role: string | null | undefined): boolean {
  return (
    role === 'subcontractor' ||
    role === 'helpers' ||
    role === 'primary' ||
    role === 'superintendent' ||
    role === 'estimator'
  )
}
