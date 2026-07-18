import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { canLeaveJobFieldReport } from '../lib/canLeaveJobFieldReport'
import { isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
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
 * `canLeaveJobFieldReport(role)` — NOT just subcontractor-like roles — because
 * `leaveReportReminderForJobRow` drives the leave-report reminder icons on the
 * job-row sections (Team Ready to Bill / Assigned Jobs) for every
 * leave-report-capable role, even though only subcontractor-like roles render
 * the My Schedule section itself (loading spinner, labels, and phones stay
 * subcontractor-like-only).
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
  const [scheduleReminderNow, setScheduleReminderNow] = useState(() => new Date())

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
      if (isSubcontractorLikeRole(role)) setSubScheduleLoading(true)
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
  }, [authUserId, role, showToast])

  useEffect(() => {
    if (!isSubcontractorLikeRole(role) || !authUserId) {
      setSubScheduleLabels(new Map())
      return
    }
    if (subScheduleRows.length === 0) {
      setSubScheduleLabels(new Map())
      return
    }
    const jobIds = [...new Set(subScheduleRows.map((b) => b.job_id))]
    const labelMap = new Map<string, string>()
    for (const j of [...assignedJobs, ...assignedReadyToBillJobs]) {
      if (jobIds.includes(j.id)) {
        labelMap.set(j.id, subScheduleJobLabel(j.hcp_number, j.job_name))
      }
    }
    const missing = jobIds.filter((id) => !labelMap.has(id))
    if (missing.length === 0) {
      setSubScheduleLabels(new Map(labelMap))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', missing),
          'dashboardSubScheduleJobLabels',
        )
        if (cancelled) return
        for (const r of (rows ?? []) as Array<{
          id: string
          hcp_number: string | null
          job_name: string | null
        }>) {
          labelMap.set(r.id, subScheduleJobLabel(r.hcp_number, r.job_name))
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

  useEffect(() => {
    if (!isSubcontractorLikeRole(role) || !authUserId) {
      setSubSchedulePhones(new Map())
      return
    }
    if (subScheduleRows.length === 0) {
      setSubSchedulePhones(new Map())
      return
    }
    const jobIds = [...new Set(subScheduleRows.map((b) => b.job_id))]
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase.from('jobs_ledger').select('id, customer_phone').in('id', jobIds),
          'dashboardSubScheduleJobPhones',
        )
        if (cancelled) return
        const m = new Map<string, string | null>()
        for (const r of (rows ?? []) as Array<{ id: string; customer_phone: string | null }>) {
          m.set(r.id, r.customer_phone)
        }
        setSubSchedulePhones(m)
      } catch {
        if (!cancelled) setSubSchedulePhones(new Map())
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
    scheduleReminderNow,
    subScheduleDayPartition,
    leaveReportReminderForJobRow,
  }
}
