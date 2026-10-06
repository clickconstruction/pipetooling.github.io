// The reads behind Job Parts Tally → Transactions → Team (punch list #72, PR 2a). IO only; the
// day cards are built by `tallyTeamQueue.ts`. Four reads for the queue, one for the job labels,
// one for the Sorted list.

import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { ymdAddDays } from '../../utils/dateUtils'
import { CARD_CHARGES_WINDOW_MAX_DAYS, fetchCardChargesWindow, type CardChargeWindowRow } from '../banking/cardChargesWindow'
import { formatJobLedgerShortLine, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import type { SortedTeamPurchaseRow } from '../teamPurchasesSorted'
import type { StaleStaffRow } from './teamPurchaseRows'
import { TALLY_NEIGHBOUR_REACH_DAYS, TALLY_STORE_LOOKBACK_DAYS, tallyDayKey } from './tallySortSuggestion'
import { tallyChargeMadeAt, type TallyQueueScheduleRow, type TallyQueueSessionRow } from './tallyTeamQueue'

export type TallyTeamQueueReads = {
  queue: StaleStaffRow[]
  history: CardChargeWindowRow[]
  sessions: TallyQueueSessionRow[]
  schedule: TallyQueueScheduleRow[]
}

/** How far back the Sorted list reads (days since a charge was last sorted), as in Team purchases. */
export const TALLY_TEAM_SORTED_WINDOW_DAYS = 30

/**
 * The team's unsorted charges (the staff queue, which applies the viewer's circle, the date floor
 * and the hide-dev setting), the holders' card history from 30 days before the oldest of them, and
 * their clock sessions and schedule blocks from 3 days either side.
 */
export async function fetchTallyTeamQueue(): Promise<TallyTeamQueueReads> {
  const queueData = await withSupabaseRetry(
    async () =>
      supabase.rpc('list_stale_unlinked_mercury_transactions_for_tally_staff', {
        min_age_days: 0,
        include_all_unlinked: true,
      }),
    'tally team queue',
  )
  const queue = (Array.isArray(queueData) ? queueData : []) as StaleStaffRow[]
  const ymds = queue
    .map((r) => {
      const madeAt = tallyChargeMadeAt(r)
      return madeAt ? tallyDayKey(madeAt) : null
    })
    .filter((d): d is string => d != null)
  if (ymds.length === 0) return { queue, history: [], sessions: [], schedule: [] }

  const oldest = ymds.reduce((a, b) => (b < a ? b : a))
  const newest = ymds.reduce((a, b) => (b > a ? b : a))
  const lookbackStart = ymdAddDays(oldest, -TALLY_STORE_LOOKBACK_DAYS)
  const widestStart = ymdAddDays(newest, -(CARD_CHARGES_WINDOW_MAX_DAYS - 1))
  const historyStart = lookbackStart < widestStart ? widestStart : lookbackStart
  const holders = [...new Set(queue.map((r) => r.target_user_id))]
  const workFrom = ymdAddDays(oldest, -TALLY_NEIGHBOUR_REACH_DAYS)
  const workTo = ymdAddDays(newest, TALLY_NEIGHBOUR_REACH_DAYS)

  const [history, sessions, schedule] = await Promise.all([
    fetchCardChargesWindow({ startYmd: historyStart, endYmd: newest }, supabase, 'tally team queue history'),
    fetchAllRowsChunkedIn(
      holders,
      (chunk, from, to) =>
        supabase
          .from('clock_sessions')
          .select('user_id, work_date, job_ledger_id, clocked_in_at, clocked_out_at')
          .in('user_id', chunk)
          .gte('work_date', workFrom)
          .lte('work_date', workTo)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .order('id')
          .range(from, to),
      'tally team queue clock sessions',
    ) as Promise<TallyQueueSessionRow[]>,
    fetchAllRowsChunkedIn(
      holders,
      (chunk, from, to) =>
        supabase
          .from('job_schedule_blocks')
          .select('assignee_user_id, work_date, job_id, time_start')
          .in('assignee_user_id', chunk)
          .gte('work_date', workFrom)
          .lte('work_date', workTo)
          .order('work_date')
          .order('time_start')
          .order('id')
          .range(from, to),
      'tally team queue schedule',
    ) as Promise<TallyQueueScheduleRow[]>,
  ])
  return { queue, history, sessions, schedule }
}

/** Short job lines ("JP942 · Spigots replaced") for the chips, by job id. */
export async function fetchTallyJobLabels(jobIds: readonly string[], prefixMap: LedgerPrefixMap): Promise<Record<string, string>> {
  const ids = [...new Set(jobIds.filter(Boolean))]
  if (ids.length === 0) return {}
  const rows = await fetchAllRowsChunkedIn(
    ids,
    (chunk, from, to) =>
      supabase
        .from('jobs_ledger')
        .select('id, hcp_number, click_number, job_name, service_type_id')
        .in('id', chunk)
        .order('id')
        .range(from, to),
    'tally team queue job labels',
  )
  const out: Record<string, string> = {}
  for (const r of rows as Array<{
    id: string
    hcp_number: string | null
    click_number: string | null
    job_name: string | null
    service_type_id: string | null
  }>) {
    out[r.id] =
      formatJobLedgerShortLine(prefixMap, r.service_type_id, r.hcp_number?.trim() || null, r.job_name?.trim() || null, r.click_number).trim() ||
      `Job ${r.id.slice(0, 8)}…`
  }
  return out
}

/** The office's recent sorts (Team purchases → Sorted, v2.4566); null when the read is refused. */
export async function fetchRecentlySortedTeamPurchases(): Promise<SortedTeamPurchaseRow[] | null> {
  try {
    const { data, error } = await supabase.rpc(
      'list_recently_sorted_mercury_transactions_for_tally_staff' as never,
      { p_days: TALLY_TEAM_SORTED_WINDOW_DAYS } as never,
    )
    return !error && Array.isArray(data) ? (data as SortedTeamPurchaseRow[]) : null
  } catch {
    return null
  }
}
