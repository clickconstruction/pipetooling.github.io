import { supabase } from './supabase'
import { withSupabaseRetry, formatErrorMessage } from '../utils/errorHandling'
import type { JobThreadActivityItem, JobThreadNoteRow } from '../components/JobThreadNotesPanel'
import { activitySortMs } from './jobThreadActivitySort'
import { fetchJobScheduleBlocksForJob } from './jobScheduleBlocks'
import { scheduleBlocksToScheduleActivityItems } from './jobThreadScheduleActivity'
import { fetchClockSessionsForJobLedger } from './fetchClockSessionsForJobLedger'
import { clockSessionsToActivityItems } from './jobThreadClockActivity'
import { fetchJobActivityEventsForJobLedger } from './fetchJobActivityEventsForJobLedger'
import { jobActivityEventsFromRpc } from './jobActivityEventsFromRpc'
import {
  reportForViewFromJobLedgerRow,
  type ReportForJobLedgerRow,
} from './reportForViewFromJobLedgerRow'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'

/** Cap on jobs aggregated per customer (newest first) — keeps the modal load bounded. */
export const CUSTOMER_SUMMARY_MAX_JOBS = 60

export type CustomerSummaryJob = {
  id: string
  numberLabel: string
  jobName: string
  jobAddress: string
}

/** One thread item tagged with the job it belongs to. */
export type CustomerSummaryItem = {
  jobId: string
  jobNumberLabel: string
  jobAddress: string
  inner: JobThreadActivityItem
}

export type CustomerSummaryData = {
  jobs: CustomerSummaryJob[]
  /** Newest first. */
  items: CustomerSummaryItem[]
  /** True when the customer had more jobs than the cap. */
  truncated: boolean
}

const THREAD_NOTE_SELECT =
  'id, body, created_at, author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)'

/** Per-job loads mirror useJobThreadNotesForModal exactly (same role-aware RPCs). */
async function loadItemsForJob(job: CustomerSummaryJob): Promise<CustomerSummaryItem[]> {
  const [notesRaw, reportsRaw, blocksPack, clockPack, eventsPack] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase
          .from('jobs_ledger_thread_notes')
          .select(THREAD_NOTE_SELECT)
          .eq('job_id', job.id)
          .order('created_at', { ascending: true }),
      'customer summary thread notes',
    ).catch(() => []),
    withSupabaseRetry(
      async () => supabase.rpc('list_reports_for_job_ledger', { p_job_id: job.id }),
      'customer summary reports',
    ).catch(() => []),
    fetchJobScheduleBlocksForJob(job.id),
    fetchClockSessionsForJobLedger(job.id),
    fetchJobActivityEventsForJobLedger(job.id),
  ])
  const noteItems: JobThreadActivityItem[] = (((notesRaw ?? []) as unknown) as JobThreadNoteRow[]).map(
    (n) => ({ kind: 'note' as const, note: n }),
  )
  const reportItems: JobThreadActivityItem[] = (((reportsRaw ?? []) as unknown) as ReportForJobLedgerRow[]).map(
    (r) => ({ kind: 'report' as const, report: reportForViewFromJobLedgerRow(r) }),
  )
  const scheduleItems = scheduleBlocksToScheduleActivityItems(blocksPack.error ? [] : blocksPack.data)
  const clockItems = clockSessionsToActivityItems(clockPack.error ? [] : clockPack.data)
  const eventItems = jobActivityEventsFromRpc(eventsPack.error ? [] : eventsPack.data)
  return [...noteItems, ...reportItems, ...scheduleItems, ...clockItems, ...eventItems].map(
    (inner) => ({
      jobId: job.id,
      jobNumberLabel: job.numberLabel,
      jobAddress: job.jobAddress,
      inner,
    }),
  )
}

/** All interactions across every job of one customer, newest first. */
export async function fetchCustomerSummaryActivity(
  customerId: string,
): Promise<{ data: CustomerSummaryData; error: string | null }> {
  try {
    const jobsRaw = await withSupabaseRetry(
      async () =>
        supabase
          .from('jobs_ledger')
          .select('id, hcp_number, click_number, job_name, job_address, created_at')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false }),
      'customer summary jobs',
    )
    const allJobs = ((jobsRaw ?? []) as Array<{
      id: string
      hcp_number: string | null
      click_number: string | null
      job_name: string | null
      job_address: string | null
    }>).filter((j) => j?.id)
    const truncated = allJobs.length > CUSTOMER_SUMMARY_MAX_JOBS
    const jobs: CustomerSummaryJob[] = allJobs.slice(0, CUSTOMER_SUMMARY_MAX_JOBS).map((j) => ({
      id: j.id,
      numberLabel: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
      jobName: (j.job_name ?? '').trim() || 'Job',
      jobAddress: (j.job_address ?? '').trim(),
    }))
    const perJob = await Promise.all(jobs.map((j) => loadItemsForJob(j)))
    const items = perJob.flat().sort((a, b) => activitySortMs(b.inner) - activitySortMs(a.inner))
    return { data: { jobs, items, truncated }, error: null }
  } catch (e) {
    return { data: { jobs: [], items: [], truncated: false }, error: formatErrorMessage(e) }
  }
}
