import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { chunkIds } from '../lib/supabasePaging'
import {
  buildWorkMonthsByJob,
  type JobWorkMonths,
  type WorkMonthJobContext,
  type WorkSessionInput,
} from '../lib/jobs/forecastWorkMonths'

export type ForecastWorkMonthsJob = {
  id: string
  gc_customer_id: string | null
  customer_address_id: string | null
}

/**
 * The work months under the Payment forecast's rows: one clock-sessions
 * fetch for the open-bill jobs (rejected and revoked sessions left out),
 * the crew's names, each job's property kind for the lien clock, and the
 * live § 53.056 notices so a noticed month reads "sent". Null while
 * loading; empty on error so the modal simply shows no chevrons.
 */
export function useForecastWorkMonths(
  jobs: ReadonlyArray<ForecastWorkMonthsJob> | null,
  todayYmd: string,
): { byJob: Record<string, JobWorkMonths> | null; loading: boolean } {
  const [byJob, setByJob] = useState<Record<string, JobWorkMonths> | null>(null)
  const [loading, setLoading] = useState(false)
  // A stable key so re-rendered but unchanged row lists don't refetch.
  const jobsKey = jobs ? jobs.map((j) => `${j.id}:${j.gc_customer_id ?? ''}:${j.customer_address_id ?? ''}`).join('|') : ''

  useEffect(() => {
    if (!jobs || jobs.length === 0) {
      setByJob(jobs ? {} : null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const ids = [...new Set(jobs.map((j) => j.id))]
        const sessionRows: {
          job_ledger_id: string | null
          user_id: string
          work_date: string
          clocked_in_at: string
          clocked_out_at: string | null
          approved_at: string | null
        }[] = []
        const noticeRows: { job_id: string; months_covered: string[] | null }[] = []
        for (const chunk of chunkIds(ids)) {
          const [sessions, notices] = await Promise.all([
            withSupabaseRetry(
              () =>
                supabase
                  .from('clock_sessions')
                  .select('job_ledger_id, user_id, work_date, clocked_in_at, clocked_out_at, approved_at')
                  .in('job_ledger_id', chunk)
                  .is('rejected_at', null)
                  .is('revoked_at', null)
                  .order('work_date', { ascending: true })
                  .limit(5000),
              'forecast work months: clock sessions',
            ),
            withSupabaseRetry(
              () =>
                supabase
                  .from('job_lien_filings')
                  .select('job_id, months_covered')
                  .in('job_id', chunk)
                  .eq('kind', 'notice_53_056')
                  .is('voided_at', null),
              'forecast work months: notices',
            ),
          ])
          sessionRows.push(...((sessions ?? []) as typeof sessionRows))
          noticeRows.push(...((notices ?? []) as typeof noticeRows))
        }
        if (cancelled) return
        const userIds = [...new Set(sessionRows.map((r) => r.user_id))]
        const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
        const [userRows, addrRows] = await Promise.all([
          userIds.length
            ? withSupabaseRetry(
                () => supabase.from('users').select('id, name').in('id', userIds),
                'forecast work months: names',
              )
            : Promise.resolve([] as { id: string; name: string | null }[]),
          addressIds.length
            ? withSupabaseRetry(
                () => supabase.from('customer_addresses').select('id, property_kind').in('id', addressIds),
                'forecast work months: property kind',
              )
            : Promise.resolve([] as { id: string; property_kind: string | null }[]),
        ])
        if (cancelled) return
        const userNames: Record<string, string> = {}
        for (const u of (userRows ?? []) as { id: string; name: string | null }[]) userNames[u.id] = u.name ?? ''
        const kindById = new Map<string, string>()
        for (const a of (addrRows ?? []) as { id: string; property_kind: string | null }[]) kindById.set(a.id, a.property_kind ?? '')
        const noticedByJob = new Map<string, Set<string>>()
        for (const n of noticeRows) {
          const set = noticedByJob.get(n.job_id) ?? new Set<string>()
          for (const m of n.months_covered ?? []) set.add(m)
          noticedByJob.set(n.job_id, set)
        }
        const sessions: WorkSessionInput[] = sessionRows
          .filter((r) => r.job_ledger_id)
          .map((r) => ({
            jobId: r.job_ledger_id as string,
            userId: r.user_id,
            workDate: r.work_date,
            clockedInAt: r.clocked_in_at,
            clockedOutAt: r.clocked_out_at,
            approved: r.approved_at != null,
          }))
        const contexts: WorkMonthJobContext[] = jobs.map((j) => ({
          jobId: j.id,
          isSub: Boolean(j.gc_customer_id),
          propertyKind: j.customer_address_id ? kindById.get(j.customer_address_id) ?? '' : '',
          noticedMonths: noticedByJob.get(j.id) ?? new Set<string>(),
        }))
        setByJob(buildWorkMonthsByJob(sessions, contexts, userNames, todayYmd))
      } catch {
        if (!cancelled) setByJob({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsKey, todayYmd])

  return { byJob, loading }
}
