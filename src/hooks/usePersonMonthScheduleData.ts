import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchScheduleBlocksForAssigneeDateRange,
  type JobScheduleBlockRow,
} from '../lib/jobScheduleBlocks'
import { useRealtimeChannel } from './useRealtimeChannel'
import { type ClockSessionForDispatchBand } from '../lib/clockSessionsToDispatchSecondaryBands'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import {
  fetchJobsLedgerForScheduleDispatchHub,
  formatScheduleDispatchHubJobTitle,
} from '../lib/scheduleDispatchHub'
import { formatBidLedgerShortLine } from '../lib/ledgerDisplayPrefixes'
import { ymdAddDays } from '../utils/dateUtils'

/** Rolling-window length (days) for the Month mode in the User Review modal. */
export const PERSON_MONTH_SCHEDULE_WINDOW_DAYS = 30

export type PersonMonthScheduleData = {
  loading: boolean
  /** YYYY-MM-DD keys spanning the rolling window, oldest first, anchor day last. */
  daysYmd: string[]
  blocksByDayYmd: Map<string, JobScheduleBlockRow[]>
  sessionsByDayYmd: Map<string, ClockSessionForDispatchBand[]>
  jobTitleById: ReadonlyMap<string, string>
  bidTitleById: ReadonlyMap<string, string>
  reload: (options?: { quiet?: boolean }) => Promise<void>
}

/**
 * Load all `job_schedule_blocks` + `clock_sessions` for one assignee over a rolling 30-day window ending on
 * `anchorYmd`. Returns rows grouped by `work_date` for per-day rendering, plus title maps for job/bid labels.
 *
 * Mirrors `usePersonWeekScheduleData` over a longer window. One ranged `job_schedule_blocks` query + one
 * ranged `clock_sessions` query. Used by `UserMonthScheduleSection` in the User Review modal's Month mode.
 */
export function usePersonMonthScheduleData(
  userId: string | null,
  anchorYmd: string | null,
  onDataError: (message: string, variant: 'error' | 'warning') => void,
): PersonMonthScheduleData {
  const ledgerPrefixMap = useLedgerPrefixMap()
  const [loading, setLoading] = useState(false)
  const [blocksByDayYmd, setBlocksByDayYmd] = useState<Map<string, JobScheduleBlockRow[]>>(
    () => new Map(),
  )
  const [sessionsByDayYmd, setSessionsByDayYmd] = useState<
    Map<string, ClockSessionForDispatchBand[]>
  >(() => new Map())
  const [jobTitleById, setJobTitleById] = useState<Map<string, string>>(() => new Map())
  const [bidTitleById, setBidTitleById] = useState<Map<string, string>>(() => new Map())

  const daysYmd = useMemo(() => {
    if (!anchorYmd) return [] as string[]
    return Array.from({ length: PERSON_MONTH_SCHEDULE_WINDOW_DAYS }, (_, i) =>
      ymdAddDays(anchorYmd, -(PERSON_MONTH_SCHEDULE_WINDOW_DAYS - 1 - i)),
    )
  }, [anchorYmd])

  const monthStartYmd = useMemo(
    () => (daysYmd.length > 0 ? daysYmd[0]! : null),
    [daysYmd],
  )
  const monthEndYmd = useMemo(
    () => (daysYmd.length > 0 ? daysYmd[daysYmd.length - 1]! : null),
    [daysYmd],
  )

  const load = useCallback(
    async (options?: { quiet?: boolean }) => {
      const quiet = options?.quiet === true
      if (!userId || !monthStartYmd || !monthEndYmd) {
        setBlocksByDayYmd(new Map())
        setSessionsByDayYmd(new Map())
        setJobTitleById(new Map())
        setBidTitleById(new Map())
        return
      }
      if (!quiet) setLoading(true)
      try {
        const blocksRes = await fetchScheduleBlocksForAssigneeDateRange(
          userId,
          monthStartYmd,
          monthEndYmd,
        )
        if (blocksRes.error) onDataError(blocksRes.error, 'error')
        const blocksByDay = new Map<string, JobScheduleBlockRow[]>()
        for (const b of blocksRes.data) {
          const key = b.work_date
          const list = blocksByDay.get(key)
          if (list) list.push(b)
          else blocksByDay.set(key, [b])
        }
        for (const list of blocksByDay.values()) {
          list.sort((a, b) => a.time_start.localeCompare(b.time_start))
        }
        setBlocksByDayYmd(blocksByDay)

        const jobIdsFromBlocks = new Set<string>()
        for (const b of blocksRes.data) {
          if (b.job_id) jobIdsFromBlocks.add(b.job_id)
        }

        let sessionRows: ClockSessionForDispatchBand[] = []
        try {
          const raw = await withSupabaseRetry(
            async () =>
              await supabase
                .from('clock_sessions')
                .select('id, user_id, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, notes, work_date')
                .eq('user_id', userId)
                .gte('work_date', monthStartYmd)
                .lte('work_date', monthEndYmd)
                .is('rejected_at', null)
                .is('revoked_at', null)
                .order('clocked_in_at', { ascending: true }),
            'person month schedule clock_sessions',
          )
          sessionRows = (raw ?? []) as ClockSessionForDispatchBand[]
        } catch (e) {
          onDataError(formatErrorMessage(e, 'Could not load clock sessions'), 'warning')
        }

        const sessionsByDay = new Map<string, ClockSessionForDispatchBand[]>()
        for (const s of sessionRows) {
          const key = (s as { work_date?: string | null }).work_date ?? ''
          if (!key) continue
          const list = sessionsByDay.get(key)
          if (list) list.push(s)
          else sessionsByDay.set(key, [s])
        }
        setSessionsByDayYmd(sessionsByDay)

        const jobIds = new Set<string>(jobIdsFromBlocks)
        for (const s of sessionRows) {
          if (s.job_ledger_id) jobIds.add(s.job_ledger_id)
        }

        const jMap = new Map<string, string>()
        if (jobIds.size > 0) {
          try {
            const jobsRes = await fetchJobsLedgerForScheduleDispatchHub()
            if (!jobsRes.error) {
              for (const j of jobsRes.data) {
                jMap.set(j.id, formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name))
              }
            }
          } catch (e) {
            onDataError(formatErrorMessage(e, 'Could not load job titles'), 'warning')
          }
        }
        setJobTitleById(jMap)

        const bidIds = new Set<string>()
        for (const r of sessionRows) {
          if (r.bid_id) bidIds.add(r.bid_id)
        }
        const bidMap = new Map<string, string>()
        if (bidIds.size > 0) {
          try {
            const bidRows = await withSupabaseRetry(
              async () =>
                await supabase
                  .from('bids')
                  .select('id, bid_number, project_name, service_type_id')
                  .in('id', [...bidIds]),
              'person month schedule bids for clock',
            )
            for (const br of bidRows ?? []) {
              const b = br as {
                id: string
                bid_number: string | null
                project_name: string | null
                service_type_id: string | null
              }
              const num = b.bid_number?.trim()
              const pn = (b.project_name ?? '').trim()
              const label = num
                ? formatBidLedgerShortLine(ledgerPrefixMap, b.service_type_id, b.bid_number, b.project_name)
                : pn || 'Bid'
              bidMap.set(b.id, label)
            }
          } catch (e) {
            onDataError(formatErrorMessage(e, 'Could not load bid names for clock sessions'), 'warning')
          }
        }
        setBidTitleById(bidMap)
      } catch (e) {
        onDataError(formatErrorMessage(e, 'Could not load schedule'), 'error')
        setBlocksByDayYmd(new Map())
        setSessionsByDayYmd(new Map())
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [userId, monthStartYmd, monthEndYmd, onDataError, ledgerPrefixMap],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Realtime: refresh on any job_schedule_blocks change in the window. The filter is best-effort
  // by lower bound; one quiet refetch covers the worst case.
  const personMonthScheduleFilters = useMemo(
    () =>
      monthStartYmd && monthEndYmd
        ? [
            {
              event: '*' as const,
              schema: 'public',
              table: 'job_schedule_blocks',
              filter: `work_date=gte.${monthStartYmd}`,
            },
          ]
        : [],
    [monthStartYmd, monthEndYmd],
  )
  useRealtimeChannel(
    !!monthStartYmd && !!monthEndYmd && !!userId,
    `user-month-schedule-blocks-${userId ?? 'none'}-${monthStartYmd ?? 'none'}`,
    personMonthScheduleFilters,
    () => {
      void load({ quiet: true })
    },
    { debounceMs: 400 },
  )

  return {
    loading,
    daysYmd,
    blocksByDayYmd,
    sessionsByDayYmd,
    jobTitleById,
    bidTitleById,
    reload: load,
  }
}
