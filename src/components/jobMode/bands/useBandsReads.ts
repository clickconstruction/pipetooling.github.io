import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../../../utils/dateUtils'
import { dayBookWeekOf } from '../../../lib/people/dayBook'
import { buildSupervisedView, type SupervisedDaysPayload, type SupervisedView } from '../../../lib/people/supervisedDays'
import { buildSupervisorDeck, type SupervisorDeckPayload } from '../../../lib/people/supervisorReviews'
import { currentReviewMonth } from '../../../lib/prospects/teamMemberReviews'
import { fetchJobActivityEventsForJobLedger } from '../../../lib/fetchJobActivityEventsForJobLedger'
import { jobActivityEventsFromRpc } from '../../../lib/jobActivityEventsFromRpc'
import type { JobActivityEvent } from '../../../lib/jobActivityEvent'
import { effectiveJobLedgerNumber } from '../../../lib/ledgerDisplayPrefixes'
import { useLedgerPrefixMap } from '../../../contexts/LedgerDisplayPrefixContext'
import { ymdPlus, type WeekBlock } from '../../../lib/jobMode/bands'

/** The roles `get_supervised_days_payload` answers for (the Dashboard's My crew holds the same set). */
const SUPERVISOR_ROLES = new Set(['master_technician', 'helpers', 'subcontractor'])

export type BandsReads = {
  today: string
  payload: SupervisedDaysPayload | null
  view: SupervisedView
  /** People still to rate this month. */
  toRate: number
  reviewMonth: string
  weekBlocks: WeekBlock[]
  /** The job's feed, oldest first. Null while it is being read or when the card names no job. */
  jobEvents: JobActivityEvent[] | null
  /** Read the crew and the rating again, after a report or a rating is saved. */
  reread: () => void
}

/**
 * The reads of the bands page's two new bands (design spike). Every one is a read some other screen already
 * makes: My crew's week and its rating deck, the person's own schedule blocks, the job's activity feed. A read
 * that fails leaves its part of the band empty: the bands are a view over what the rest of the page still holds.
 */
export function useBandsReads(userId: string, role: string | null, jobId: string | null): BandsReads {
  const today = useMemo(() => todayYmdInAppTz(), [])
  const prefixMap = useLedgerPrefixMap()
  const reviewMonth = useMemo(() => currentReviewMonth(APP_CALENDAR_TZ), [])
  const supervisor = role != null && SUPERVISOR_ROLES.has(role)
  const [rev, setRev] = useState(0)
  const [payload, setPayload] = useState<SupervisedDaysPayload | null>(null)
  const [toRate, setToRate] = useState(0)
  const [weekBlocks, setWeekBlocks] = useState<WeekBlock[]>([])
  const [jobEvents, setJobEvents] = useState<JobActivityEvent[] | null>(null)

  useEffect(() => {
    if (!supervisor) return
    let alive = true
    const range = dayBookWeekOf(today)
    withSupabaseRetry(() => supabase.rpc('get_supervised_days_payload' as never, { p_from: range.from, p_to: range.to } as never), 'bands crew')
      .then((data) => alive && setPayload((data as unknown as SupervisedDaysPayload | null) ?? null))
      .catch(() => alive && setPayload(null))
    withSupabaseRetry(() => supabase.rpc('get_supervisor_review_deck' as never, { p_month: reviewMonth } as never), 'bands rating deck')
      .then((data) => alive && setToRate(buildSupervisorDeck((data as unknown as SupervisorDeckPayload | null) ?? null).filter((c) => !c.reviewed).length))
      .catch(() => alive && setToRate(0))
    return () => {
      alive = false
    }
  }, [supervisor, today, reviewMonth, rev])

  useEffect(() => {
    let alive = true
    withSupabaseRetry(
      async () =>
        supabase
          .from('job_schedule_blocks')
          .select('work_date, job_id, jobs_ledger(hcp_number, click_number, job_name)')
          .eq('assignee_user_id', userId)
          .gte('work_date', today)
          .lte('work_date', ymdPlus(today, 6))
          .order('work_date', { ascending: true }),
      'bands week',
    )
      .then((rows) => {
        if (!alive) return
        const list = (rows ?? []) as unknown as Array<{ work_date: string; job_id: string | null; jobs_ledger: { hcp_number: string | null; click_number: string | null; job_name: string | null } | null }>
        setWeekBlocks(list.map((r) => ({ workDate: r.work_date, jobId: r.job_id, label: effectiveJobLedgerNumber(r.jobs_ledger?.hcp_number, r.jobs_ledger?.click_number) || (r.jobs_ledger?.job_name ?? '').trim().slice(0, 10) || 'Job' })))
      })
      .catch(() => alive && setWeekBlocks([]))
    return () => {
      alive = false
    }
  }, [userId, today])

  useEffect(() => {
    setJobEvents(null)
    if (!jobId) return
    let alive = true
    void fetchJobActivityEventsForJobLedger(jobId).then(({ data, error }) => {
      if (!alive) return
      setJobEvents(error ? [] : jobActivityEventsFromRpc(data).map((i) => i.event))
    })
    return () => {
      alive = false
    }
  }, [jobId])

  const view = useMemo(() => buildSupervisedView(payload, { todayYmd: today, nowMs: Date.now(), prefixMap }), [payload, today, prefixMap])
  return { today, payload, view, toRate, reviewMonth, weekBlocks, jobEvents, reread: () => setRev((n) => n + 1) }
}
