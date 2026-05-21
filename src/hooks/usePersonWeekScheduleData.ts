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

export type PersonWeekScheduleData = {
  loading: boolean
  /** Array of 7 YYYY-MM-DD keys starting from the anchor week-start (inclusive). */
  daysYmd: string[]
  blocksByDayYmd: Map<string, JobScheduleBlockRow[]>
  sessionsByDayYmd: Map<string, ClockSessionForDispatchBand[]>
  jobTitleById: ReadonlyMap<string, string>
  bidTitleById: ReadonlyMap<string, string>
  reload: (options?: { quiet?: boolean }) => Promise<void>
}

/**
 * Load all `job_schedule_blocks` + `clock_sessions` for one assignee over a 7-day window starting at
 * `weekStartYmd` (the company-week Sunday). Returns rows grouped by `work_date` for per-day rendering.
 *
 * One ranged `job_schedule_blocks` query + one ranged `clock_sessions` query — mirrors the day-mode hook
 * but folded to span seven days. Used by `UserWeekScheduleSection` in the User Review modal's Week mode.
 */
export function usePersonWeekScheduleData(
  userId: string | null,
  weekStartYmd: string | null,
  onDataError: (message: string, variant: 'error' | 'warning') => void,
): PersonWeekScheduleData {
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
    if (!weekStartYmd) return [] as string[]
    return Array.from({ length: 7 }, (_, i) => ymdAddDays(weekStartYmd, i))
  }, [weekStartYmd])

  const weekEndYmd = useMemo(
    () => (daysYmd.length > 0 ? daysYmd[daysYmd.length - 1]! : null),
    [daysYmd],
  )

  const load = useCallback(
    async (options?: { quiet?: boolean }) => {
      const quiet = options?.quiet === true
      if (!userId || !weekStartYmd || !weekEndYmd) {
        setBlocksByDayYmd(new Map())
        setSessionsByDayYmd(new Map())
        setJobTitleById(new Map())
        setBidTitleById(new Map())
        return
      }
      if (!quiet) setLoading(true)
      try {
        const blocksRes = await fetchScheduleBlocksForAssigneeDateRange(userId, weekStartYmd, weekEndYmd)
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
                .gte('work_date', weekStartYmd)
                .lte('work_date', weekEndYmd)
                .is('rejected_at', null)
                .is('revoked_at', null)
                .order('clocked_in_at', { ascending: true }),
            'person week schedule clock_sessions',
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
              'person week schedule bids for clock',
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
    [userId, weekStartYmd, weekEndYmd, onDataError, ledgerPrefixMap],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Realtime: refresh on any job_schedule_blocks change in the week window. Filter is best-effort
  // per-row work_date; we just refetch on any change since the worst case is one quiet refetch.
  const personWeekScheduleFilters = useMemo(
    () =>
      weekStartYmd && weekEndYmd
        ? [
            {
              event: '*' as const,
              schema: 'public',
              table: 'job_schedule_blocks',
              filter: `work_date=gte.${weekStartYmd}`,
            },
          ]
        : [],
    [weekStartYmd, weekEndYmd],
  )
  useRealtimeChannel(
    !!weekStartYmd && !!weekEndYmd && !!userId,
    `user-week-schedule-blocks-${userId ?? 'none'}-${weekStartYmd ?? 'none'}`,
    personWeekScheduleFilters,
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
