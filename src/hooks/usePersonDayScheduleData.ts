import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchScheduleBlocksForAssigneesOnDay, type JobScheduleBlockRow } from '../lib/jobScheduleBlocks'
import {
  fetchJobsLedgerForScheduleDispatchHub,
  formatScheduleDispatchHubJobTitle,
  type ScheduleDispatchHubJobRow,
} from '../lib/scheduleDispatchHub'
import { type ClockSessionForDispatchBand } from '../lib/clockSessionsToDispatchSecondaryBands'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

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
            jMap.set(j.id, formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name))
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
                  .select('id, bid_number, project_name')
                  .in('id', [...bidIds]),
              'person day schedule bids for clock',
            )
            for (const br of bidRows ?? []) {
              const b = br as { id: string; bid_number: string | null; project_name: string | null }
              const num = b.bid_number?.trim()
              const pn = (b.project_name ?? '').trim()
              const label = num ? `B${num}${pn ? ` · ${pn}` : ''}` : pn || 'Bid'
              bidMap.set(b.id, label)
            }
          } catch (e) {
            onDataError(formatErrorMessage(e, 'Could not load bid names for clock sessions'), 'warning')
          }
        }
        setBidTitleById(bidMap)
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
    [userId, workDateYmd, onDataError],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!workDateYmd) return
    const channel = supabase
      .channel(`user-day-schedule-blocks-${workDateYmd}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_schedule_blocks' },
        (payload) => {
          const row =
            (payload.new as { work_date?: string } | null) ?? (payload.old as { work_date?: string } | null)
          const wd = row?.work_date
          if (wd != null && wd !== workDateYmd) return
          void load({ quiet: true })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [workDateYmd, load])

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
