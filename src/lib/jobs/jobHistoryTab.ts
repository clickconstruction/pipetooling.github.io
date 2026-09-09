import { ymdAddDays } from '../../utils/dateUtils'

/**
 * The History tab on the job window (journey map Tier 5 X13 / J31-adj3).
 *
 * Projects → Job History is a per-job density view (days worked × people) nothing else
 * offers, but it lives under Projects, which links a handful of jobs. Decision 12 stays
 * parked for Projects; Will unparked only the rehome: the same grid mounts as a fourth
 * tab on the job window, for every job, whether or not it has a project.
 */

/** Job · Edit · Bill · Costs · History (Costs split out of Bill — owner call, v2.3182: Bill is money in, Costs is money out). */
export const JOB_WINDOW_TABS = ['job', 'edit', 'bill', 'costs', 'history'] as const
export type JobWindowTabKey = (typeof JOB_WINDOW_TABS)[number]
export const JOB_WINDOW_TAB_LABELS: Record<JobWindowTabKey, string> = { job: 'Job', edit: 'Edit', bill: 'Bill', costs: 'Costs', history: 'History' }

/** The embedded form pane shows on Edit / Bill / Costs (one region at a time); the Job pane's body only on Job. */
export function jobWindowFormPaneHidden(tab: JobWindowTabKey): boolean {
  return tab === 'job' || tab === 'history'
}

/** The form region a window tab shows; the form pane is hidden on the others. */
export type JobWindowFormRegion = 'edit' | 'bill' | 'costs'
export function jobWindowFormRegionForTab(tab: JobWindowTabKey): JobWindowFormRegion {
  return tab === 'bill' ? 'bill' : tab === 'costs' ? 'costs' : 'edit'
}

/** Single-job history looks back further than the Projects default (90 d): a job's life is longer than a quarter. */
export const SINGLE_JOB_HISTORY_DAYS = 180

export function singleJobHistoryRange(todayYmd: string): { start: string; end: string } {
  return { start: ymdAddDays(todayYmd, -SINGLE_JOB_HISTORY_DAYS), end: todayYmd }
}

/** Two mounts (Projects tab + a job window) must not share one realtime channel name. */
export function jobHistoryChannelName(authUserId: string, jobId: string | null | undefined): string {
  return jobId ? `projects-job-history-${authUserId}-job-${jobId}` : `projects-job-history-${authUserId}`
}
