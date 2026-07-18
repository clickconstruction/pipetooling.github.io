import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import {
  isDashboardTeamReadyToBillRole,
  type DashboardTeamAssignedJobRow,
} from '../lib/dashboardTeamAssignedJobRow'
import type { UserRole } from './useAuth'

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
 * The setters are returned because the parent's billing engine
 * (`updateJobStatus`, still page-side until the `useDashboardBillingInvoices`
 * seam) optimistically prunes and then reloads these lists inline.
 *
 * `resyncDashboardAfterUpdateJobStatusFailureRef` (quirk #10 in
 * DASHBOARD_SECTIONS_ARCHITECTURE.md): the hook declares the ref, but its
 * `.current` is still assigned in the PARENT's render body — the resync
 * closure calls the billing engine's `refreshInvoices` (parent scope) before
 * reloading these lists, so the target function cannot move until the billing
 * seam exists. Preserve the render-body assignment pattern; do not convert it
 * to an effect.
 */
export function useDashboardAssignedJobs({ authUserId, role }: UseDashboardAssignedJobsInput) {
  const [assignedJobs, setAssignedJobs] = useState<DashboardTeamAssignedJobRow[]>([])
  const [assignedJobsLoading, setAssignedJobsLoading] = useState(false)
  const [assignedReadyToBillJobs, setAssignedReadyToBillJobs] = useState<DashboardTeamAssignedJobRow[]>([])
  const [assignedReadyToBillLoading, setAssignedReadyToBillLoading] = useState(false)
  const [superintendentJobs, setSuperintendentJobs] = useState<DashboardTeamAssignedJobRow[]>([])
  const [superintendentJobsLoading, setSuperintendentJobsLoading] = useState(false)
  /** Assigned by the PARENT in its render body after `refreshInvoices` is defined (quirk #10); reloads dashboard job lists on `update_job_status` RPC failure. */
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
    assignedJobsLoading,
    assignedReadyToBillJobs,
    setAssignedReadyToBillJobs,
    assignedReadyToBillLoading,
    superintendentJobs,
    setSuperintendentJobs,
    superintendentJobsLoading,
    refreshDashboardAssignedJobLists,
    refreshAssignedReadyToBill,
    resyncDashboardAfterUpdateJobStatusFailureRef,
  }
}
