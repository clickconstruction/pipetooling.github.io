import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { canLeaveJobFieldReport } from '../lib/canLeaveJobFieldReport'
import {
  fetchScheduleBlocksForAssigneeDateRange,
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
import type { DashboardTeamAssignedJobRow } from '../lib/dashboardTeamAssignedJobRow'
import type { UserRole } from './useAuth'

export type UseDashboardSubScheduleInput = {
  authUserId: string | undefined
  role: UserRole | null
  /** Parent-owned assigned-job lists — read only, for schedule-row labels. */
  assignedJobs: DashboardTeamAssignedJobRow[]
  assignedReadyToBillJobs: DashboardTeamAssignedJobRow[]
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
 */
export function useDashboardSubSchedule({
  authUserId,
  role,
  assignedJobs,
  assignedReadyToBillJobs,
}: UseDashboardSubScheduleInput) {
  const { showToast } = useToastContext()
  const [subScheduleRows, setSubScheduleRows] = useState<JobScheduleBlockRow[]>([])
  const [subScheduleLoading, setSubScheduleLoading] = useState(false)
  const [subScheduleLabels, setSubScheduleLabels] = useState<Map<string, string>>(() => new Map())
  const [subSchedulePhones, setSubSchedulePhones] = useState<Map<string, string | null>>(() => new Map())
  const [subScheduleJobMeta, setSubScheduleJobMeta] = useState<Map<string, SubScheduleJobMeta>>(
    () => new Map(),
  )
  const [scheduleReminderNow, setScheduleReminderNow] = useState(() => new Date())
  /** Bumped by self-schedule writes (v2.1568) so My Schedule refetches. */
  const [reloadNonce, setReloadNonce] = useState(0)
  const reloadSubSchedule = useCallback(() => setReloadNonce((n) => n + 1), [])

  useEffect(() => {
    const id = window.setInterval(() => setScheduleReminderNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!authUserId || !canLeaveJobFieldReport(role)) {
      setSubScheduleRows([])
      setSubScheduleLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setSubScheduleLoading(true)
      const todayYmd = scheduleTodayDateKey()
      const tomorrowYmd = scheduleDateKeyAddDays(todayYmd, 1) ?? todayYmd
      const { data, error } = await fetchScheduleBlocksForAssigneeDateRange(
        authUserId,
        todayYmd,
        tomorrowYmd,
      )
      if (cancelled) return
      if (error) {
        showToast(error, 'warning')
        setSubScheduleRows([])
        setSubScheduleLoading(false)
        return
      }
      setSubScheduleRows(dedupeSubScheduleBlocks(data ?? []))
      setSubScheduleLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [authUserId, role, showToast, reloadNonce])

  useEffect(() => {
    if (!authUserId) {
      setSubScheduleLabels(new Map())
      return
    }
    if (subScheduleRows.length === 0) {
      setSubScheduleLabels(new Map())
      return
    }
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
      } catch {
        if (!cancelled) {
          for (const id of missing) {
            if (!labelMap.has(id)) labelMap.set(id, 'Job')
          }
          setSubScheduleLabels(new Map(labelMap))
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
    const jobIds = [...new Set(subScheduleRows.map((b) => b.job_id).filter((id): id is string => id != null))]
    if (jobIds.length === 0) {
      setSubSchedulePhones(new Map())
      setSubScheduleJobMeta(new Map())
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
      } catch {
        if (!cancelled) {
          setSubSchedulePhones(new Map())
          setSubScheduleJobMeta(new Map())
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, authUserId, subScheduleRows])

  const subScheduleDayPartition = useMemo((): SubScheduleDayPartition => {
    const todayYmd = scheduleTodayDateKey()
    const tomorrowYmd = scheduleDateKeyAddDays(todayYmd, 1) ?? todayYmd
    return {
      todayYmd,
      tomorrowYmd,
      ...partitionSubScheduleBlocksByDay(subScheduleRows, todayYmd, tomorrowYmd),
    }
  }, [subScheduleRows])

  const leaveReportReminderForJobRow = useCallback(
    (j: Pick<DashboardTeamAssignedJobRow, 'id' | 'my_last_report_at'>) =>
      shouldShowLeaveReportScheduleReminder({
        now: scheduleReminderNow,
        todayYmd: scheduleTodayDateKey(scheduleReminderNow),
        jobId: j.id,
        blocks: subScheduleRows,
        myLastReportAtIso: j.my_last_report_at ?? null,
      }),
    [scheduleReminderNow, subScheduleRows],
  )

  return {
    subScheduleRows,
    subScheduleLoading,
    subScheduleLabels,
    subSchedulePhones,
    subScheduleJobMeta,
    scheduleReminderNow,
    subScheduleDayPartition,
    leaveReportReminderForJobRow,
    reloadSubSchedule,
  }
}
