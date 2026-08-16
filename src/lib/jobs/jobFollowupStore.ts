import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  DEFAULT_JOB_FOLLOWUP_SETTINGS,
  JOB_FOLLOWUP_STAGES,
  type JobFollowupCandidate,
  type JobFollowupReview,
  type JobFollowupSettings,
  type JobFollowupStage,
} from './jobFollowupQueue'

/**
 * IO for Job Follow-Up Mode (v2.1718). Every fetch degrades to
 * defaults/empty so a client deployed ahead of the migration renders an
 * empty queue instead of crashing.
 */

type SettingsRow = {
  working_days: number
  waiting_days: number
  ready_to_bill_days: number
  billed_days: number
  collections_days: number
  rest_days: number
}

export function followupSettingsFromRow(row: SettingsRow | null | undefined): JobFollowupSettings {
  if (!row) return DEFAULT_JOB_FOLLOWUP_SETTINGS
  return {
    workingDays: row.working_days,
    waitingDays: row.waiting_days,
    readyToBillDays: row.ready_to_bill_days,
    billedDays: row.billed_days,
    collectionsDays: row.collections_days,
    restDays: row.rest_days,
  }
}

export function followupSettingsToRow(s: JobFollowupSettings): SettingsRow {
  return {
    working_days: s.workingDays,
    waiting_days: s.waitingDays,
    ready_to_bill_days: s.readyToBillDays,
    billed_days: s.billedDays,
    collections_days: s.collectionsDays,
    rest_days: s.restDays,
  }
}

export async function fetchJobFollowupSettings(): Promise<JobFollowupSettings> {
  try {
    const data = await withSupabaseRetry(
      async () => supabase.from('job_followup_settings').select('*').limit(1),
      'followup settings',
    )
    return followupSettingsFromRow(((data ?? []) as unknown as SettingsRow[])[0])
  } catch {
    return DEFAULT_JOB_FOLLOWUP_SETTINGS
  }
}

export async function saveJobFollowupSettings(s: JobFollowupSettings, userId: string | null): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('job_followup_settings')
        .update({ ...followupSettingsToRow(s), updated_at: new Date().toISOString(), updated_by: userId } as never)
        .eq('id' as never, true as never),
    'save followup settings',
  )
}

export async function fetchJobFollowupReviews(): Promise<JobFollowupReview[]> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        supabase.from('job_followup_reviews')
          .select('job_id, reviewed_at, snoozed_until')
          .order('reviewed_at', { ascending: false })
          .limit(5000),
      'followup reviews',
    )
    return ((data ?? []) as unknown as { job_id: string; reviewed_at: string; snoozed_until: string | null }[]).map(
      (r) => ({ jobId: r.job_id, reviewedAt: r.reviewed_at, snoozedUntil: r.snoozed_until }),
    )
  } catch {
    return []
  }
}

export async function recordJobFollowupReview(
  jobId: string,
  userId: string | null,
  snoozedUntil: string | null,
): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('job_followup_reviews').insert({
        job_id: jobId,
        reviewed_by: userId,
        snoozed_until: snoozedUntil,
      } as never),
    'record followup review',
  )
}

export async function fetchJobFollowupCandidates(todayYmd: string): Promise<JobFollowupCandidate[]> {
  const [jobsData, activityData] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase
          .from('jobs_ledger')
          .select('id, hcp_number, job_name, job_address, status, customer_name, pct_complete, revenue, payments_made')
          .in('status', JOB_FOLLOWUP_STAGES),
      'followup jobs',
    ),
    withSupabaseRetry(
      async () =>
        supabase.rpc('list_job_followup_activity', {
          p_today: todayYmd,
        } as never),
      'followup activity',
    ).catch(() => []),
  ])

  const activityByJob = new Map<string, { latest_activity_at: string; next_scheduled_on: string | null }>()
  for (const row of (activityData ?? []) as unknown as {
    job_id: string
    latest_activity_at: string
    next_scheduled_on: string | null
  }[]) {
    activityByJob.set(row.job_id, row)
  }

  return ((jobsData ?? []) as unknown as {
    id: string
    hcp_number: string
    job_name: string
    job_address: string
    status: string
    customer_name: string | null
    pct_complete: number | null
    revenue: number | null
    payments_made: number | null
  }[]).map((j) => {
    const activity = activityByJob.get(j.id)
    return {
      id: j.id,
      stage: j.status as JobFollowupStage,
      hcpNumber: j.hcp_number,
      jobName: j.job_name,
      address: j.job_address,
      customerName: j.customer_name,
      pctComplete: j.pct_complete,
      revenue: j.revenue,
      paymentsMade: j.payments_made,
      // No RPC row (migration not applied yet, or brand-new job): treat the
      // job as active today so it never shows a bogus "quiet forever".
      latestActivityAt: activity?.latest_activity_at ?? new Date().toISOString(),
      nextScheduledOn: activity?.next_scheduled_on ?? null,
    }
  })
}
