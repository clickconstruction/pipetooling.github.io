import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import {
  isDashboardTeamReadyToBillRole,
  type DashboardTeamAssignedJobRow,
} from '../lib/dashboardTeamAssignedJobRow'
import type { UserRole } from './useAuth'
import { useZzTestJobsHidden } from '../lib/jobs/zzTestJobSwitch'
import { withoutZzTestJobRows } from '../lib/jobs/zzTestJobVisibility'
import { useZzTestJobIds } from './useZzTestJobIds'

export type UseDashboardAssignedJobsInput = {
  authUserId: string | undefined
  role: UserRole | null
}

/**
 * Dashboard assigned-jobs data seam (extraction-series refactor; no behavior
 * change). Owns the three team job lists — Assigned Jobs
 * (`list_assigned_jobs_for_dashboard`), team Ready to Bill
 * (`list_ready_to_bill_assigned_jobs_for_dashboard`), and Superintendent Jobs
 * (`list_superintendent_jobs_for_dashboard`) — their loader effects, the
 * `refreshDashboardAssignedJobLists` reload-all (report modals +
 * ClockInOutButton field-report save + the billing engine's `updateJobStatus`)
 * and `refreshAssignedReadyToBill` (CollectPaymentModal.onFlowChanged).
 *
 * The setters are returned because the billing engine's `updateJobStatus`
 * (in `useDashboardBillingInvoices` as of v2.727, which takes them as inputs)
 * optimistically prunes and then reloads these lists inline.
 *
 * `resyncDashboardAfterUpdateJobStatusFailureRef` (quirk #10 in
 * DASHBOARD_SECTIONS_ARCHITECTURE.md): the hook declares the ref; its
 * `.current` is assigned in `useDashboardBillingInvoices`' body during render
 * (the resync closure calls that engine's `refreshInvoices` before reloading
 * these lists). Preserve the render-body assignment pattern; do not convert
 * it to an effect.
 */
/** The held lists' one empty array (a stable identity). */
const NO_ROWS: DashboardTeamAssignedJobRow[] = []

export function useDashboardAssignedJobs({ authUserId, role }: UseDashboardAssignedJobsInput) {
  /**
   * ZZ test jobs (punch list #61, v2.5122): the three lists keep every row they read and hand out the
   * rows without ZZ jobs for every role but a dev who shows them, by the job's name and the shared
   * ids (two of the RPCs return no customer name). Like Ready to bill (review on #5241), they hold
   * until the ids land and stay held after a failed read. The Jobs map card reuses these rows.
   */
  const hideZz = useZzTestJobsHidden(role)
  const zz = useZzTestJobIds(hideZz && Boolean(authUserId), authUserId)
  const zzHeld = hideZz && zz.status !== 'ready'
  const zzJobIds = zz.ids
  const shown = useCallback(
    (rows: DashboardTeamAssignedJobRow[]) =>
      !hideZz ? rows : zzHeld ? NO_ROWS : withoutZzTestJobRows(rows, (j) => j.id, zzJobIds),
    [hideZz, zzHeld, zzJobIds],
  )
  const zzLoading = hideZz && zz.status === 'loading'
  const [assignedJobsAll, setAssignedJobs] = useState<DashboardTeamAssignedJobRow[]>([])
  const assignedJobs = useMemo(() => shown(assignedJobsAll), [shown, assignedJobsAll])
  const [assignedJobsLoading, setAssignedJobsLoading] = useState(false)
  const [assignedReadyToBillJobsAll, setAssignedReadyToBillJobs] = useState<DashboardTeamAssignedJobRow[]>([])
  const assignedReadyToBillJobs = useMemo(() => shown(assignedReadyToBillJobsAll), [shown, assignedReadyToBillJobsAll])
  const [assignedReadyToBillLoading, setAssignedReadyToBillLoading] = useState(false)
  const [superintendentJobsAll, setSuperintendentJobs] = useState<DashboardTeamAssignedJobRow[]>([])
  const superintendentJobs = useMemo(() => shown(superintendentJobsAll), [shown, superintendentJobsAll])
  const [superintendentJobsLoading, setSuperintendentJobsLoading] = useState(false)
  /** Assigned in `useDashboardBillingInvoices`' body during render (quirk #10); reloads dashboard job lists on `update_job_status` RPC failure. */
  const resyncDashboardAfterUpdateJobStatusFailureRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!authUserId) return
    setAssignedJobsLoading(true)
    supabase
      .rpc('list_assigned_jobs_for_dashboard')
      .then(({ data, error }) => {
        setAssignedJobsLoading(false)
        if (error) return
        setAssignedJobs((data ?? []) as unknown as DashboardTeamAssignedJobRow[])
      })
  }, [authUserId])

  const refreshDashboardAssignedJobLists = useCallback(async () => {
    if (!authUserId) return
    try {
      const { data: assignedData } = await supabase.rpc('list_assigned_jobs_for_dashboard')
      if (assignedData) setAssignedJobs(assignedData as unknown as DashboardTeamAssignedJobRow[])
      if (isDashboardTeamReadyToBillRole(role)) {
        const { data: rtbAssignedData } = await supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard')
        if (rtbAssignedData) setAssignedReadyToBillJobs(rtbAssignedData as unknown as DashboardTeamAssignedJobRow[])
      }
      if (role === 'superintendent') {
        const { data: superintendentData } = await supabase.rpc('list_superintendent_jobs_for_dashboard')
        if (superintendentData) setSuperintendentJobs(superintendentData as unknown as DashboardTeamAssignedJobRow[])
      }
    } catch {
      /* keep prior lists */
    }
  }, [authUserId, role])

  useEffect(() => {
    if (!authUserId || !isDashboardTeamReadyToBillRole(role)) {
      setAssignedReadyToBillJobs([])
      setAssignedReadyToBillLoading(false)
      return
    }
    let cancelled = false
    setAssignedReadyToBillLoading(true)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard'),
          'list_ready_to_bill_assigned_jobs_for_dashboard',
        )
        if (cancelled) return
        setAssignedReadyToBillJobs((data ?? []) as unknown as DashboardTeamAssignedJobRow[])
      } catch {
        /* keep prior list */
      } finally {
        if (!cancelled) setAssignedReadyToBillLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId, role])

  const refreshAssignedReadyToBill = useCallback(() => {
    if (!authUserId || !isDashboardTeamReadyToBillRole(role)) return
    void supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard').then(({ data, error }) => {
      if (!error && data) {
        setAssignedReadyToBillJobs(data as unknown as DashboardTeamAssignedJobRow[])
      }
    })
  }, [authUserId, role])

  useEffect(() => {
    if (!authUserId || role !== 'superintendent') return
    setSuperintendentJobsLoading(true)
    supabase
      .rpc('list_superintendent_jobs_for_dashboard')
      .then(({ data, error }) => {
        setSuperintendentJobsLoading(false)
        if (error) return
        setSuperintendentJobs((data ?? []) as unknown as typeof superintendentJobs)
      })
  }, [authUserId, role])

  return {
    assignedJobs,
    setAssignedJobs,
    assignedJobsLoading: assignedJobsLoading || zzLoading,
    assignedReadyToBillJobs,
    setAssignedReadyToBillJobs,
    assignedReadyToBillLoading: assignedReadyToBillLoading || zzLoading,
    superintendentJobs,
    setSuperintendentJobs,
    superintendentJobsLoading: superintendentJobsLoading || zzLoading,
    refreshDashboardAssignedJobLists,
    refreshAssignedReadyToBill,
    resyncDashboardAfterUpdateJobStatusFailureRef,
  }
}
