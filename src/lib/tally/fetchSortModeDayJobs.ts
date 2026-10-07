import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../../utils/dateUtils'
import { fetchDispatchScheduledJobsForAssigneeDay } from '../jobScheduleBlocks'
import { formatJobLedgerShortLine, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { orderSortModeDayJobIds, type SortModeSessionRow } from './sortModeDayJobsOrder'

/** One tappable job candidate on the Sort screen. */
export type SortModeDayJob = {
  id: string
  /** "JP942 · Spigots replaced" (ledger short line). */
  main: string
  address: string
}

/**
 * Job candidates for sorting a purchase: the user's CLOCK-SESSION and SCHEDULE-BLOCK jobs on the
 * day the card was swiped ±1 (company calendar), the same windows the clock-window allocate modal
 * and the Assign modal's schedule shortcut use. Callers pass the swipe time
 * (`mercurySwipeAtIso`), not the posting time, which is often the next day. The order is
 * `orderSortModeDayJobIds`: the swipe day's clocked jobs, its schedule, then the shoulders.
 */
export async function fetchSortModeDayJobs(
  userId: string,
  swipeAtIso: string,
  ledgerPrefixMap: LedgerPrefixMap,
): Promise<{ data: SortModeDayJob[]; error: string | null }> {
  const anchor = calendarYmdInAppTzFromIso(swipeAtIso)
  if (!anchor) return { data: [], error: 'Invalid purchase date.' }
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
            .is('revoked_at', null)
            .order('clocked_in_at'),
        'fetchSortModeDayJobs clock_sessions',
      ),
      // The swipe day's schedule, then the day before's and the day after's.
      fetchDispatchScheduledJobsForAssigneeDay(userId, anchor),
      fetchDispatchScheduledJobsForAssigneeDay(userId, days[0]!),
      fetchDispatchScheduledJobsForAssigneeDay(userId, days[2]!),
    ])

    const [anchorSched, beforeSched, afterSched] = schedResults
    const ordered = orderSortModeDayJobIds({
      anchorYmd: anchor,
      beforeYmd: days[0]!,
      afterYmd: days[2]!,
      sessions: (sessionsRes ?? []) as SortModeSessionRow[],
      scheduledByDay: new Map([
        [anchor, (anchorSched?.data ?? []).map((j) => j.jobId)],
        [days[0]!, (beforeSched?.data ?? []).map((j) => j.jobId)],
        [days[2]!, (afterSched?.data ?? []).map((j) => j.jobId)],
      ]),
    })
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
