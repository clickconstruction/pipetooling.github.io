import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { canLeaveJobFieldReport } from '../lib/canLeaveJobFieldReport'
import {
  readScheduleBlocksForAssigneeDateRange,
  type JobScheduleBlockRow,
} from '../lib/jobScheduleBlocks'
import { shouldShowLeaveReportScheduleReminder } from '../lib/leaveReportScheduleReminder'
import { scheduleDateKeyAddDays, scheduleTodayDateKey } from '../lib/jobScheduleChicago'
import {
  dedupeSubScheduleBlocks,
  partitionSubScheduleBlocksByDay,
  subScheduleJobLabel,
  type SubScheduleDayPartition,
  type SubScheduleJobMeta,
} from '../lib/dashboardSubSchedule'
import {
  MY_SCHEDULE_KEPT_SCOPES,
  buildMyScheduleKeptRows,
  myScheduleKeptKey,
  myScheduleKeptRowIsValid,
  unpackMyScheduleKeptRows,
  type MyScheduleKeptRow,
} from '../lib/dashboard/myScheduleKeptDay'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { useKeptRead } from './useKeptRead'
import type { DashboardTeamAssignedJobRow } from '../lib/dashboardTeamAssignedJobRow'
import type { UserRole } from './useAuth'

export type UseDashboardSubScheduleInput = {
  authUserId: string | undefined
  role: UserRole | null
  /** Parent-owned assigned-job lists — read only, for schedule-row labels. */
  assignedJobs: DashboardTeamAssignedJobRow[]
  assignedReadyToBillJobs: DashboardTeamAssignedJobRow[]
}

/** The fallback sentence when the schedule read fails with nothing the kernel can name. */
export const MY_SCHEDULE_READ_FAILED_WORDS = 'Could not read your schedule.'

/** What the labels and the meta were read for: the ids of the rows, in order. */
function rowsKeyOf(rows: readonly JobScheduleBlockRow[]): string {
  return rows.map((b) => b.id).join(',')
}

/**
 * Dashboard sub-schedule data seam (extraction-series refactor; no behavior
 * change). Owns the today/tomorrow schedule-blocks loader, the job-label and
 * customer-phone lookups, the 60s reminder clock, and the derived
 * `subScheduleDayPartition` / `leaveReportReminderForJobRow`.
 *
 * The hook stays in the PARENT (`Dashboard.tsx`): the blocks loader gates on
 * `canLeaveJobFieldReport(role)` (every role) because
 * `leaveReportReminderForJobRow` drives the leave-report reminder icons on the
 * job-row sections (Team Ready to Bill / Assigned Jobs). Since v2.782 the
 * My Schedule section renders for all roles, so the loading spinner, labels,
 * and phones are no longer subcontractor-like-only.
 *
 * The kept day (punch list #183 PR 3): the blocks with their labels, phones and job meta are
 * kept on the device through `useKeptRead`, keyed by the user and today's date
 * (`lib/dashboard/myScheduleKeptDay.ts`). While the live read of today's key runs the hook hands
 * out the kept day with `subScheduleKeptAt` set and `subScheduleLoading` off, so the card draws
 * the day as read at 7:52 AM under its stamp instead of two grey bars; once the blocks, the
 * labels and the meta all landed the live day replaces it and is written back (a half day is
 * never kept). A failed read no longer lands as an empty day: the kept day stays up with
 * `subScheduleKeptFailed`, or, with nothing kept, `subScheduleError` carries the failure's class
 * and sentence for the card's `OfflineRetryPanel`.
 */
export function useDashboardSubSchedule({
  authUserId,
  role,
  assignedJobs,
  assignedReadyToBillJobs,
}: UseDashboardSubScheduleInput) {
  const [subScheduleRows, setSubScheduleRows] = useState<JobScheduleBlockRow[]>([])
  const [subScheduleLoading, setSubScheduleLoading] = useState(false)
  /** The last schedule read's failure, with its class; null once a read lands. */
  const [subScheduleError, setSubScheduleError] = useState<OfflineRecoveryLastError | null>(null)
  const [subScheduleLabels, setSubScheduleLabels] = useState<Map<string, string>>(() => new Map())
  const [subSchedulePhones, setSubSchedulePhones] = useState<Map<string, string | null>>(() => new Map())
  const [subScheduleJobMeta, setSubScheduleJobMeta] = useState<Map<string, SubScheduleJobMeta>>(
    () => new Map(),
  )
  /**
   * The rows the labels and the meta were last read for (`rowsKeyOf`), so the kept read's
   * `loading` stays true until both landed for the rows on screen: derived in render, never set
   * from an effect, so there is no render between the blocks landing and the labels' read
   * starting in which a half day could be written.
   */
  const [labelsForRows, setLabelsForRows] = useState<string | null>(null)
  const [metaForRows, setMetaForRows] = useState<string | null>(null)
  const [scheduleReminderNow, setScheduleReminderNow] = useState(() => new Date())
  /** Bumped by self-schedule writes (v2.1568) so My Schedule refetches. */
  const [reloadNonce, setReloadNonce] = useState(0)
  const reloadSubSchedule = useCallback(() => setReloadNonce((n) => n + 1), [])

  useEffect(() => {
    const id = window.setInterval(() => setScheduleReminderNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const canRead = Boolean(authUserId) && canLeaveJobFieldReport(role)

  useEffect(() => {
    if (!authUserId || !canLeaveJobFieldReport(role)) {
      setSubScheduleRows([])
      setSubScheduleLoading(false)
      setSubScheduleError(null)
      return
    }
    let cancelled = false
    const run = async () => {
      setSubScheduleLoading(true)
      setSubScheduleError(null)
      const todayYmd = scheduleTodayDateKey()
      const tomorrowYmd = scheduleDateKeyAddDays(todayYmd, 1) ?? todayYmd
      try {
        const data = await readScheduleBlocksForAssigneeDateRange(authUserId, todayYmd, tomorrowYmd)
        if (cancelled) return
        setSubScheduleRows(dedupeSubScheduleBlocks(data))
      } catch (e) {
        if (cancelled) return
        // Said, never drawn as an empty day (#183 PR 3): the kept day stays up, or the card's panel names the reason.
        setSubScheduleError(recoveryFailureFromError(e, MY_SCHEDULE_READ_FAILED_WORDS))
        setSubScheduleRows([])
      } finally {
        if (!cancelled) setSubScheduleLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [authUserId, role, reloadNonce])

  useEffect(() => {
    if (!authUserId) {
      setSubScheduleLabels(new Map())
      return
    }
    if (subScheduleRows.length === 0) {
      setSubScheduleLabels(new Map())
      return
    }
    const rowsKey = rowsKeyOf(subScheduleRows)
    const jobIds = [...new Set(subScheduleRows.map((b) => b.job_id).filter((id): id is string => id != null))]
    const bidIds = [...new Set(subScheduleRows.map((b) => b.bid_id).filter((id): id is string => id != null))]
    const labelMap = new Map<string, string>()
    for (const j of [...assignedJobs, ...assignedReadyToBillJobs]) {
      if (jobIds.includes(j.id)) {
        labelMap.set(j.id, subScheduleJobLabel(j.hcp_number, j.job_name))
      }
    }
    const missing = jobIds.filter((id) => !labelMap.has(id))
    if (missing.length === 0 && bidIds.length === 0) {
      setSubScheduleLabels(new Map(labelMap))
      setLabelsForRows(rowsKey)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        // Bid-anchored blocks (v2.1613) label from bids, keyed `bid:<uuid>`.
        const [rows, bidRows] = await Promise.all([
          missing.length === 0
            ? Promise.resolve([])
            : withSupabaseRetry(
                async () =>
                  await supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', missing),
                'dashboardSubScheduleJobLabels',
              ),
          bidIds.length === 0
            ? Promise.resolve([])
            : withSupabaseRetry(
                async () =>
                  await supabase.from('bids').select('id, bid_number, project_name').in('id', bidIds),
                'dashboardSubScheduleBidLabels',
              ),
        ])
        if (cancelled) return
        for (const r of (rows ?? []) as Array<{
          id: string
          hcp_number: string | null
          job_name: string | null
        }>) {
          labelMap.set(r.id, subScheduleJobLabel(r.hcp_number, r.job_name))
        }
        for (const r of (bidRows ?? []) as Array<{
          id: string
          bid_number: string | null
          project_name: string | null
        }>) {
          const num = (r.bid_number ?? '').trim()
          labelMap.set(
            `bid:${r.id}`,
            `${num ? `B${num}` : 'Bid'} · ${(r.project_name ?? '').trim() || 'Bid'}`,
          )
        }
        for (const id of missing) {
          if (!labelMap.has(id)) labelMap.set(id, 'Job')
        }
        setSubScheduleLabels(new Map(labelMap))
        setLabelsForRows(rowsKey)
      } catch {
        if (!cancelled) {
          for (const id of missing) {
            if (!labelMap.has(id)) labelMap.set(id, 'Job')
          }
          setSubScheduleLabels(new Map(labelMap))
          setLabelsForRows(rowsKey)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, authUserId, subScheduleRows, assignedJobs, assignedReadyToBillJobs])

  // One query serves both the phone map and the job-meta map: it already spans
  // every scheduled job id (not just the ones missing from the assigned lists),
  // so the pictures link / HCP / address ride along at no extra round-trip.
  useEffect(() => {
    if (!authUserId) {
      setSubSchedulePhones(new Map())
      setSubScheduleJobMeta(new Map())
      return
    }
    if (subScheduleRows.length === 0) {
      setSubSchedulePhones(new Map())
      setSubScheduleJobMeta(new Map())
      return
    }
    const rowsKey = rowsKeyOf(subScheduleRows)
    const jobIds = [...new Set(subScheduleRows.map((b) => b.job_id).filter((id): id is string => id != null))]
    if (jobIds.length === 0) {
      setSubSchedulePhones(new Map())
      setSubScheduleJobMeta(new Map())
      setMetaForRows(rowsKey)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase
              .from('jobs_ledger')
              .select('id, customer_phone, job_pictures_link, hcp_number, click_number, job_address')
              .in('id', jobIds),
          'dashboardSubScheduleJobPhones',
        )
        if (cancelled) return
        const phones = new Map<string, string | null>()
        const meta = new Map<string, SubScheduleJobMeta>()
        for (const r of (rows ?? []) as Array<{
          id: string
          customer_phone: string | null
          job_pictures_link: string | null
          hcp_number: string | null
          click_number: string | null
          job_address: string | null
        }>) {
          phones.set(r.id, r.customer_phone)
          meta.set(r.id, {
            job_pictures_link: r.job_pictures_link,
            hcp_number: r.hcp_number,
            click_number: r.click_number,
            job_address: r.job_address,
          })
        }
        setSubSchedulePhones(phones)
        setSubScheduleJobMeta(meta)
        setMetaForRows(rowsKey)
      } catch {
        if (!cancelled) {
          setSubSchedulePhones(new Map())
          setSubScheduleJobMeta(new Map())
          setMetaForRows(rowsKey)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, authUserId, subScheduleRows])

  // The two days by value, so the memos below hold until the rows or the day move.
  const todayYmd = scheduleTodayDateKey()
  const tomorrowYmd = scheduleDateKeyAddDays(todayYmd, 1) ?? todayYmd

  // The kept day (#183 PR 3). `loading` holds until the labels and the meta landed for the rows
  // on screen, so what is written is the whole day the card drew.
  const liveRowsKey = rowsKeyOf(subScheduleRows)
  const labelsPending = subScheduleRows.length > 0 && labelsForRows !== liveRowsKey
  const metaPending = subScheduleRows.length > 0 && metaForRows !== liveRowsKey
  const rowsToKeep = useMemo(
    () => buildMyScheduleKeptRows({ rows: subScheduleRows, labels: subScheduleLabels, phones: subSchedulePhones, meta: subScheduleJobMeta }),
    [subScheduleRows, subScheduleLabels, subSchedulePhones, subScheduleJobMeta],
  )
  const kept = useKeptRead<MyScheduleKeptRow>(canRead && authUserId ? myScheduleKeptKey(authUserId, todayYmd) : null, rowsToKeep, {
    loading: subScheduleLoading || labelsPending || metaPending,
    scopes: MY_SCHEDULE_KEPT_SCOPES,
    failed: subScheduleError != null,
    rowIsValid: myScheduleKeptRowIsValid,
  })
  const keptDay = useMemo(() => (kept.readAt != null && kept.rows ? unpackMyScheduleKeptRows(kept.rows) : null), [kept.readAt, kept.rows])

  const rowsShown = keptDay ? keptDay.rows : subScheduleRows

  const subScheduleDayPartition = useMemo(
    (): SubScheduleDayPartition => ({
      todayYmd,
      tomorrowYmd,
      ...partitionSubScheduleBlocksByDay(rowsShown, todayYmd, tomorrowYmd),
    }),
    [rowsShown, todayYmd, tomorrowYmd],
  )

  const leaveReportReminderForJobRow = useCallback(
    (j: Pick<DashboardTeamAssignedJobRow, 'id' | 'my_last_report_at'>) =>
      shouldShowLeaveReportScheduleReminder({
        now: scheduleReminderNow,
        todayYmd: scheduleTodayDateKey(scheduleReminderNow),
        jobId: j.id,
        blocks: rowsShown,
        myLastReportAtIso: j.my_last_report_at ?? null,
      }),
    [scheduleReminderNow, rowsShown],
  )

  return {
    subScheduleRows: rowsShown,
    /** Off while the kept day shows: the card draws the day under its stamp, not the bars. */
    subScheduleLoading: keptDay ? false : subScheduleLoading,
    subScheduleLabels: keptDay ? keptDay.labels : subScheduleLabels,
    subSchedulePhones: keptDay ? keptDay.phones : subSchedulePhones,
    subScheduleJobMeta: keptDay ? keptDay.meta : subScheduleJobMeta,
    scheduleReminderNow,
    subScheduleDayPartition,
    leaveReportReminderForJobRow,
    reloadSubSchedule,
    /** Epoch ms the day on screen was read when it is the kept one; null when live (#183 PR 3). */
    subScheduleKeptAt: kept.readAt,
    /** The kept day stayed up because the live read failed: the stamp says so and offers Retry. */
    subScheduleKeptFailed: kept.failed,
    /** The live read's failure, for the card's panel when nothing is kept. */
    subScheduleError,
  }
}
