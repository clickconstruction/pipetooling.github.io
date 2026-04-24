import type { JobWithDetails } from '../types/jobWithDetails'

const HCP_NUMERIC_RE = /^\d+$/

/**
 * Job Summary HCP # floor: keep jobs with no HCP, non-numeric HCP, or numeric HCP &gt; minExclusive.
 * Compare only when the entire trimmed value is base-10 digits.
 */
export function applyMinHcpFilter(jobs: JobWithDetails[], minExclusive: number): JobWithDetails[] {
  return jobs.filter((job) => {
    const t = (job.hcp_number ?? '').trim()
    if (!t) return true
    if (!HCP_NUMERIC_RE.test(t)) return true
    const n = parseInt(t, 10)
    return n > minExclusive
  })
}

const JOBS_JOB_SUMMARY_MIN_HCP_STORAGE_KEY = 'jobs_jobSummary_minHcpExclusive'

const DEFAULT_MIN_HCP_EXCLUSIVE = 500

export function readJobSummaryMinHcpExclusiveFromStorage(): number {
  if (typeof window === 'undefined') return DEFAULT_MIN_HCP_EXCLUSIVE
  try {
    const s = localStorage.getItem(JOBS_JOB_SUMMARY_MIN_HCP_STORAGE_KEY)
    if (s == null || s === '') return DEFAULT_MIN_HCP_EXCLUSIVE
    const n = parseInt(s, 10)
    if (Number.isNaN(n) || n < -1) return DEFAULT_MIN_HCP_EXCLUSIVE
    return n
  } catch {
    return DEFAULT_MIN_HCP_EXCLUSIVE
  }
}

export function writeJobSummaryMinHcpExclusiveToStorage(n: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(JOBS_JOB_SUMMARY_MIN_HCP_STORAGE_KEY, String(n))
  } catch {
    /* ignore */
  }
}
