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
          .select('job_id, reviewed_at, snoozed_until, reviewed_by')
          .order('reviewed_at', { ascending: false })
          .limit(5000),
      'followup reviews',
    )
    return ((data ?? []) as unknown as {
      job_id: string
      reviewed_at: string
      snoozed_until: string | null
      reviewed_by: string | null
    }[]).map((r) => ({
      jobId: r.job_id,
      reviewedAt: r.reviewed_at,
      snoozedUntil: r.snoozed_until,
      reviewedBy: r.reviewed_by,
    }))
  } catch {
    return []
  }
}

/** Reviewer display names for the history view (v2.1722). */
export async function fetchJobFollowupReviewerNames(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {}
  try {
    const data = await withSupabaseRetry(
      async () => supabase.from('users').select('id, name').in('id', userIds),
      'followup reviewer names',
    )
    const out: Record<string, string> = {}
    for (const u of (data ?? []) as { id: string; name: string | null }[]) {
      if (u.name) out[u.id] = u.name
    }
    return out
  } catch {
    return {}
  }
}

/** Labels for reviewed jobs that have since left the open stages (paid/closed). */
export async function fetchJobFollowupJobLabels(jobIds: string[]): Promise<Record<string, string>> {
  if (jobIds.length === 0) return {}
  try {
    const data = await withSupabaseRetry(
      async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', jobIds),
      'followup history job labels',
    )
    const out: Record<string, string> = {}
    for (const j of (data ?? []) as { id: string; hcp_number: string; job_name: string }[]) {
      out[j.id] = `${j.hcp_number} · ${j.job_name}`.trim()
    }
    return out
  } catch {
    return {}
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

/**
 * Candidates cache (v2.1920): the banner runs the candidates fetch (a
 * jobs_ledger select + the list_job_followup_activity RPC) on EVERY office
 * Dashboard mount, and clicking through to the deck immediately ran the same
 * fetch again. Within the TTL, remounts and the banner→deck handoff reuse one
 * result; the deck passes `force: true` so a deliberately opened deck is never
 * stale. The in-flight promise is shared too, so concurrent callers coalesce.
 */
const CANDIDATES_CACHE_TTL_MS = 5 * 60_000
let candidatesCache: { todayYmd: string; at: number; promise: Promise<JobFollowupCandidate[]> } | null = null

export function invalidateJobFollowupCandidatesCache(): void {
  candidatesCache = null
}

export async function fetchJobFollowupCandidates(
  todayYmd: string,
  options?: { force?: boolean },
): Promise<JobFollowupCandidate[]> {
  const cached = candidatesCache
  if (!options?.force && cached && cached.todayYmd === todayYmd && Date.now() - cached.at < CANDIDATES_CACHE_TTL_MS) {
    return cached.promise
  }
  const promise = fetchJobFollowupCandidatesUncached(todayYmd)
  candidatesCache = { todayYmd, at: Date.now(), promise }
  // A failed fetch must not poison the cache window with a rejected promise.
  promise.catch(() => {
    if (candidatesCache?.promise === promise) candidatesCache = null
  })
  return promise
}

async function fetchJobFollowupCandidatesUncached(todayYmd: string): Promise<JobFollowupCandidate[]> {
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

/**
 * Un-review (v2.1771): delete the job's NEWEST review row so the deck's
 * "Put back in queue" undoes a hasty ✓/snooze. Only the latest row goes —
 * older reviews stay in History. Returns false when there's nothing to delete.
 */
export async function deleteLatestJobFollowupReview(jobId: string): Promise<boolean> {
  try {
    const rows = await withSupabaseRetry(
      async () =>
        supabase
          .from('job_followup_reviews')
          .select('id')
          .eq('job_id', jobId)
          .order('reviewed_at', { ascending: false })
          .limit(1),
      'find latest followup review',
    )
    const id = ((rows ?? []) as Array<{ id: string }>)[0]?.id
    if (!id) return false
    await withSupabaseRetry(
      async () => supabase.from('job_followup_reviews').delete().eq('id', id),
      'delete followup review',
    )
    return true
  } catch {
    return false
  }
}
