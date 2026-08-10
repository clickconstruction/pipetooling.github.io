import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'
import { fetchDispatchScheduledJobsForAssigneeDay } from '../jobScheduleBlocks'
import { formatJobLedgerShortLine, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'

/** One tappable job candidate on the Sort screen. */
export type SortModeDayJob = {
  id: string
  /** "JP942 · Spigots replaced" (ledger short line). */
  main: string
  address: string
}

/**
 * Job candidates for sorting a purchase: the union of the user's CLOCK-SESSION
 * jobs and SCHEDULE-BLOCK jobs on the posted day ±1 (Chicago calendar) — the
 * same windows the clock-window allocate modal and the Assign modal's
 * schedule shortcut use, combined. Sessions first (most likely where the
 * material went), then scheduled jobs not already present; order is stable.
 */
export async function fetchSortModeDayJobs(
  userId: string,
  postedAtIso: string,
  ledgerPrefixMap: LedgerPrefixMap,
): Promise<{ data: SortModeDayJob[]; error: string | null }> {
  const ms = new Date(postedAtIso).getTime()
  if (!Number.isFinite(ms)) return { data: [], error: 'Invalid posted date.' }
  const anchor = denverCalendarDayKey(ms)
  const days = [ymdAddDays(anchor, -1), anchor, ymdAddDays(anchor, 1)]

  try {
    const [sessionsRes, ...schedResults] = await Promise.all([
      withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select('work_date, job_ledger_id')
            .eq('user_id', userId)
            .in('work_date', days)
            .is('rejected_at', null)
            .is('revoked_at', null),
        'fetchSortModeDayJobs clock_sessions',
      ),
      // Anchor day first so its scheduled jobs outrank the shoulders.
      fetchDispatchScheduledJobsForAssigneeDay(userId, anchor),
      fetchDispatchScheduledJobsForAssigneeDay(userId, days[0]!),
      fetchDispatchScheduledJobsForAssigneeDay(userId, days[2]!),
    ])

    const ordered: string[] = []
    const seen = new Set<string>()
    const push = (id: string | null | undefined) => {
      if (id && !seen.has(id)) {
        seen.add(id)
        ordered.push(id)
      }
    }
    for (const r of (sessionsRes ?? []) as Array<{ job_ledger_id: string | null }>) {
      push(r.job_ledger_id)
    }
    for (const res of schedResults) {
      for (const j of res.data) push(j.jobId)
    }
    if (ordered.length === 0) return { data: [], error: null }

    const jobRows = await withSupabaseRetry(
      async () =>
        supabase
          .from('jobs_ledger')
          .select('id, hcp_number, click_number, job_name, job_address, service_type_id')
          .in('id', ordered),
      'fetchSortModeDayJobs jobs_ledger',
    )
    const byId = new Map(
      ((jobRows ?? []) as Array<{
        id: string
        hcp_number: string | null
        click_number: string | null
        job_name: string | null
        job_address: string | null
        service_type_id: string | null
      }>).map((j) => [j.id, j]),
    )
    const data: SortModeDayJob[] = ordered.map((id) => {
      const row = byId.get(id)
      const main =
        formatJobLedgerShortLine(
          ledgerPrefixMap,
          row?.service_type_id ?? null,
          row?.hcp_number?.trim() || null,
          row?.job_name?.trim() || null,
          row?.click_number ?? null,
        ).trim() || `Job ${id.slice(0, 8)}…`
      return { id, main, address: row?.job_address?.trim() ?? '' }
    })
    return { data, error: null }
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Could not load your day’s jobs.' }
  }
}
