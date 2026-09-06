import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchScheduleBlocksForAssigneesOnDay, type JobScheduleBlockRow } from '../lib/jobScheduleBlocks'
import { useRealtimeChannel } from './useRealtimeChannel'
import {
  fetchJobsLedgerForScheduleDispatchHub,
  fetchBidTitlesForScheduleBlocks,
  type ScheduleDispatchHubJobRow,
} from '../lib/scheduleDispatchHub'
import { addBidAnchorTitles, collectScheduledBidIds, scheduleBlockTitle } from '../lib/scheduleBlockTitle'
import { type ClockSessionForDispatchBand } from '../lib/clockSessionsToDispatchSecondaryBands'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'

export type PersonDayScheduleData = {
  loading: boolean
  blocks: JobScheduleBlockRow[]
  sessions: ClockSessionForDispatchBand[]
  jobTitleById: ReadonlyMap<string, string>
  bidTitleById: ReadonlyMap<string, string>
  hubJobsForPicker: ScheduleDispatchHubJobRow[]
  reload: (options?: { quiet?: boolean }) => Promise<void>
}

/**
 * Load job_schedule_blocks + clock_sessions for one assignee on one work day, plus job list for add-block picker.
 * Mirrors the Quickfill schedule section data path, scoped to a single user.
 */
export function usePersonDayScheduleData(
  userId: string | null,
  workDateYmd: string | null,
  onDataError: (message: string, variant: 'error' | 'warning') => void,
): PersonDayScheduleData {
  const ledgerPrefixMap = useLedgerPrefixMap()
  const [loading, setLoading] = useState(false)
  const [blocks, setBlocks] = useState<JobScheduleBlockRow[]>([])
  const [sessions, setSessions] = useState<ClockSessionForDispatchBand[]>([])
  const [jobTitleById, setJobTitleById] = useState<Map<string, string>>(() => new Map())
  const [bidTitleById, setBidTitleById] = useState<Map<string, string>>(() => new Map())
  const [hubJobsForPicker, setHubJobsForPicker] = useState<ScheduleDispatchHubJobRow[]>([])

  const load = useCallback(
    async (options?: { quiet?: boolean }) => {
      const quiet = options?.quiet === true
      if (!userId || !workDateYmd) {
        setBlocks([])
        setSessions([])
        setJobTitleById(new Map())
        setBidTitleById(new Map())
        setHubJobsForPicker([])
        return
      }
      if (!quiet) setLoading(true)
      try {
        const jobsRes = await fetchJobsLedgerForScheduleDispatchHub()
        const jMap = new Map<string, string>()
        if (!jobsRes.error) {
          setHubJobsForPicker(jobsRes.data)
          for (const j of jobsRes.data) {
            jMap.set(
              j.id,
              scheduleBlockTitle({ kind: 'job', hcpNumber: j.hcp_number, jobTitle: j.job_name, clickNumber: j.click_number }),
            )
          }
        } else {
          setHubJobsForPicker([])
        }
        setJobTitleById(jMap)

        const { data: blockRows, error: blockErr } = await fetchScheduleBlocksForAssigneesOnDay(
          [userId],
          workDateYmd,
        )
        if (blockErr) {
          onDataError(blockErr, 'error')
        }
        const list = !blockErr ? [...blockRows] : []
        list.sort((a, b) => a.time_start.localeCompare(b.time_start))
        setBlocks(list)

        let sessionRows: ClockSessionForDispatchBand[] = []
        try {
          const raw = await withSupabaseRetry(
            async () =>
              await supabase
                .from('clock_sessions')
                .select('id, user_id, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, notes')
                .eq('user_id', userId)
                .eq('work_date', workDateYmd)
                .is('rejected_at', null)
                .is('revoked_at', null)
                .order('clocked_in_at', { ascending: true }),
            'person day schedule clock_sessions',
          )
          sessionRows = (raw ?? []) as ClockSessionForDispatchBand[]
        } catch (e) {
          onDataError(formatErrorMessage(e, 'Could not load clock sessions'), 'warning')
        }

        // Bids to name: SCHEDULED (block anchors) plus CLOCKED (sessions) — Tier-2 #22, J18-F4.
        const bidIds = collectScheduledBidIds(list, sessionRows)
        const bidRes = await fetchBidTitlesForScheduleBlocks(bidIds, ledgerPrefixMap, 'person day schedule bid titles')
        if (bidRes.error) onDataError(bidRes.error, 'warning')
        const bidMap = bidRes.data
        setBidTitleById(bidMap)
        // `bid:<uuid>` anchor entries so the block renderers' id-keyed lookups resolve for bids too.
        setJobTitleById(addBidAnchorTitles(jMap, bidMap))
        setSessions(sessionRows)
      } catch (e) {
        onDataError(formatErrorMessage(e, 'Could not load schedule'), 'error')
        setBlocks([])
        setSessions([])
        setHubJobsForPicker([])
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [userId, workDateYmd, onDataError, ledgerPrefixMap],
  )

  useEffect(() => {
    void load()
  }, [load])

  const personDayScheduleFilters = useMemo(
    () =>
      workDateYmd
        ? [{ event: '*' as const, schema: 'public', table: 'job_schedule_blocks', filter: `work_date=eq.${workDateYmd}` }]
        : [],
    [workDateYmd],
  )
  useRealtimeChannel(
    !!workDateYmd,
    `user-day-schedule-blocks-${workDateYmd ?? 'none'}`,
    personDayScheduleFilters,
    () => {
      void load({ quiet: true })
    },
    { debounceMs: 400 },
  )

  return {
    loading,
    blocks,
    sessions,
    jobTitleById,
    bidTitleById,
    hubJobsForPicker,
    reload: load,
  }
}
