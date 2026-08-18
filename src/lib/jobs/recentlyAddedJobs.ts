/**
 * Pipeline "Recently added" view (v2.1809): a flat list of the last 100 jobs
 * by when they were added to the app (jobs_ledger.created_at), any status —
 * including Paid, which the board doesn't even load until expanded. Answers
 * "I just added a job, where did it go?". This kernel shapes fetched lean
 * rows for display; the fetch itself lives in the component (own one-shot
 * query — never the board cache).
 */

import { calendarYmdInAppTzFromIso, formatDenverCalendarDayShort, formatDenverTimeOnly } from '../../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { normalizeJobsLedgerStatus, type JobsLedgerPipelineStatus } from '../jobsLedgerStatusPipeline'

export const RECENTLY_ADDED_LIMIT = 100

export type RecentlyAddedLeanJob = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  customer_name: string | null
  status: string | null
  created_at: string | null
}

export type RecentlyAddedJobRow = {
  id: string
  /** Display number — HCP wins over Click, matching effectiveJobLedgerNumber. */
  label: string
  jobName: string
  customerName: string
  status: JobsLedgerPipelineStatus | null
  /** "today 12:04 PM" for jobs added today (company TZ), else "Aug 17". */
  addedLabel: string
}

function addedLabel(createdAt: string | null, now: Date): string {
  if (!createdAt) return '—'
  const ms = Date.parse(createdAt)
  if (!Number.isFinite(ms)) return '—'
  if (calendarYmdInAppTzFromIso(createdAt) === calendarYmdInAppTzFromIso(now.toISOString())) {
    return `today ${formatDenverTimeOnly(ms)}`
  }
  return formatDenverCalendarDayShort(ms)
}

/** Newest first; rows without a created_at sink to the end. */
export function buildRecentlyAddedRows(jobs: RecentlyAddedLeanJob[], now: Date = new Date()): RecentlyAddedJobRow[] {
  return [...jobs]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .map((j) => ({
      id: j.id,
      label: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
      jobName: (j.job_name ?? '').trim(),
      customerName: (j.customer_name ?? '').trim(),
      // Null status renders as Working on the board; mirror that here.
      status: normalizeJobsLedgerStatus(j.status) ?? (j.status == null ? 'working' : null),
      addedLabel: addedLabel(j.created_at, now),
    }))
}
