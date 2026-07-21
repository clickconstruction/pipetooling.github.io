import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { fetchJobsLedgerWithDetailsForStages } from '../lib/fetchJobsLedgerWithDetailsForStages'
import {
  applyMinHcpFilter,
  readJobSummaryMinHcpExclusiveFromStorage,
} from '../lib/jobSummaryHcpFilter'
import { CLOCK_SESSION_LIST_SELECT } from '../lib/clockSessionSelect'
import { fetchMercuryJobAllocationsWithAttributionForJob } from '../lib/fetchMercuryJobAllocationsWithAttributionForJob'
import type { JobSummaryClockSessionRow, JobSummaryInvoiceAllocationLine, JobSummaryMercuryAllocationRow, JobSummaryReportRow } from '../types/jobSummary'
import type { JobWithDetails } from '../types/jobWithDetails'

/**
 * Job Summary data layer (Jobs.tsx decomposition seam, step 6 — see
 * docs/JOBS_TABS_ARCHITECTURE.md). Owns the full-org ledger snapshot (with the
 * min-HCP filter + its localStorage-backed threshold), the five lazy per-job
 * caches (+ loaded/requested refs + loaders: clock sessions, invoice lines,
 * mercury allocations, reports, report-completion %), the report-% batch RPC
 * effect (its only page-side dep is `activeTab`, so it moved here taking
 * `activeTab` as an input — unlike the expanded-row effects, whose other deps
 * are page UI state), and the reset-on-signout effect. Behavior-preserving
 * extraction: the page destructures the return so every downstream reference
 * keeps its name.
 *
 * Stays in the page: the UI states (`jobSummarySearch` + its `?jobSummaryHcp=`
 * seeding, expanded sets, per-job breakdown search, the quirk-#11
 * `jobSummaryCostDrilldown` ReactNode, `printCostBreakdownJobId`), the
 * `activeTab`-keyed expanded-row lazy-load effects (they call the loaders
 * returned here), the `printJobSummaryCostBreakdown` thunk (reads the caches
 * from the destructure), and the big `jobSummaryData` P&L memo — that memo
 * reads `mercuryCardChargesByJobId` from `useJobsMercuryAllocations`, which
 * itself consumes this hook's `jobSummaryLedgerJobs` +
 * `touchJobSummaryMercuryAllocations`, so the memo is a page-level join over
 * both hooks' outputs (the render-time analog of the v2.825 callback bridge).
 *
 * `touchJobSummaryMercuryAllocations` absorbs the v2.825 bridge closure the
 * page used to build inline for `onJobSummaryMercuryTouched`: invalidate the
 * lazy mercury cache for one job, then force-reload it.
 */
export function useJobSummaryData({
  authUserId,
  activeTab,
}: {
  authUserId: string | undefined
  /** The page's `activeTab` (JobsTab union; only `'job-summary'` is meaningful here) — keys the report-% batch effect. */
  activeTab: string
}) {
  /** Full org job list for Job Summary tab (all statuses, ignores `?customer=`). */
  const [jobSummaryLedgerAllJobs, setJobSummaryLedgerAllJobs] = useState<JobWithDetails[] | null>(null)
  const [jobSummaryMinHcpExclusive, setJobSummaryMinHcpExclusive] = useState(() =>
    readJobSummaryMinHcpExclusiveFromStorage(),
  )
  const jobSummaryLedgerJobs = useMemo(() => {
    if (jobSummaryLedgerAllJobs == null) return null
    return applyMinHcpFilter(jobSummaryLedgerAllJobs, jobSummaryMinHcpExclusive)
  }, [jobSummaryLedgerAllJobs, jobSummaryMinHcpExclusive])
  const [jobSummaryLedgerLoading, setJobSummaryLedgerLoading] = useState(false)
  const [jobSummaryLedgerError, setJobSummaryLedgerError] = useState<string | null>(null)
  const loadJobSummaryLedgerRef = useRef<() => void>(() => {})
  const jobSummaryLedgerSnapshotLoadedRef = useRef(false)

  const loadJobSummaryLedger = useCallback(async () => {
    if (!authUserId) return
    setJobSummaryLedgerLoading(true)
    setJobSummaryLedgerError(null)
    try {
      const result = await fetchJobsLedgerWithDetailsForStages({
        customerFilter: null,
        statusScope: 'all',
        jobSummaryEnrich: true,
        minHcpExclusive: jobSummaryMinHcpExclusive,
      })
      if (!result.ok) {
        setJobSummaryLedgerError(result.error)
        return
      }
      setJobSummaryLedgerAllJobs(result.jobs)
      jobSummaryLedgerSnapshotLoadedRef.current = true
    } catch (e: unknown) {
      setJobSummaryLedgerError(e instanceof Error ? e.message : String(e))
    } finally {
      setJobSummaryLedgerLoading(false)
    }
  }, [authUserId, jobSummaryMinHcpExclusive])
  loadJobSummaryLedgerRef.current = () => {
    void loadJobSummaryLedger()
  }

  const jobSummaryClockSessionsLoadedRef = useRef<Set<string>>(new Set())
  const [jobSummaryClockSessionsByJobId, setJobSummaryClockSessionsByJobId] = useState<Map<string, JobSummaryClockSessionRow[]>>(() => new Map())
  const jobSummaryInvoiceLinesLoadedRef = useRef<Set<string>>(new Set())
  const [jobSummaryInvoiceLinesByJobId, setJobSummaryInvoiceLinesByJobId] = useState<
    Map<string, JobSummaryInvoiceAllocationLine[]>
  >(() => new Map())
  const jobSummaryMercuryAllocationsLoadedRef = useRef<Set<string>>(new Set())
  const [jobSummaryMercuryAllocationsByJobId, setJobSummaryMercuryAllocationsByJobId] = useState<
    Map<string, JobSummaryMercuryAllocationRow[]>
  >(() => new Map())

  /** Clock sessions for the expanded Team Labor person rows (lazy per expanded job; the page's expanded-row effect calls this). */
  const loadJobSummaryClockSessionsForJob = useCallback(async (jobId: string) => {
    if (jobSummaryClockSessionsLoadedRef.current.has(jobId)) return
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select(CLOCK_SESSION_LIST_SELECT)
            .eq('job_ledger_id', jobId)
            .order('clocked_in_at', { ascending: true }),
        'job summary clock sessions',
      )
      const raw = (data ?? []) as JobSummaryClockSessionRow[]
      const filtered = raw.filter((s) => !s.revoked_at)
      setJobSummaryClockSessionsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, filtered)
        return next
      })
    } catch {
      setJobSummaryClockSessionsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, [])
        return next
      })
    } finally {
      jobSummaryClockSessionsLoadedRef.current.add(jobId)
    }
  }, [])

  const loadJobSummaryMercuryAllocationsForJob = useCallback(async (jobId: string, force = false) => {
    if (!force && jobSummaryMercuryAllocationsLoadedRef.current.has(jobId)) return
    if (force) jobSummaryMercuryAllocationsLoadedRef.current.delete(jobId)
    try {
      const rows = await fetchMercuryJobAllocationsWithAttributionForJob(jobId, 'job summary mercury')
      const mapped: JobSummaryMercuryAllocationRow[] = rows.map((r) => ({
        id: r.id,
        mercury_transaction_id: r.mercury_transaction_id,
        amount: r.amount,
        note: r.note,
        attributionDisplayName: r.attributionDisplayName,
        mercury_transactions: r.mercury_transactions
          ? {
              posted_at: r.mercury_transactions.posted_at,
              counterparty_name: r.mercury_transactions.counterparty_name,
              amount: r.mercury_transactions.amount,
              note: r.mercury_transactions.note,
              external_memo: r.mercury_transactions.external_memo,
              raw: r.mercury_transactions.raw,
            }
          : null,
      }))
      setJobSummaryMercuryAllocationsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, mapped)
        return next
      })
    } catch {
      setJobSummaryMercuryAllocationsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, [])
        return next
      })
    } finally {
      jobSummaryMercuryAllocationsLoadedRef.current.add(jobId)
    }
  }, [])

  /**
   * The v2.825 mercury bridge, hook-owned since this seam: invalidate + force-
   * reload the lazy Job Summary mercury cache for one job. The page passes this
   * to `useJobsMercuryAllocations` as `onJobSummaryMercuryTouched`.
   */
  const touchJobSummaryMercuryAllocations = useCallback(
    (jobId: string) => {
      jobSummaryMercuryAllocationsLoadedRef.current.delete(jobId)
      void loadJobSummaryMercuryAllocationsForJob(jobId, true)
    },
    [loadJobSummaryMercuryAllocationsForJob],
  )

  const loadJobSummaryInvoiceLinesForJob = useCallback(async (jobId: string) => {
    if (jobSummaryInvoiceLinesLoadedRef.current.has(jobId)) return
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase.rpc('get_invoice_allocation_lines_for_jobs', { p_job_ids: [jobId] }),
        'job summary invoice lines',
      )
      const rows = (data ?? []) as JobSummaryInvoiceAllocationLine[]
      setJobSummaryInvoiceLinesByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, rows)
        return next
      })
    } catch {
      setJobSummaryInvoiceLinesByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, [])
        return next
      })
    } finally {
      jobSummaryInvoiceLinesLoadedRef.current.add(jobId)
    }
  }, [])

  /** Latest field-report completion % per job (Job Summary "%" column; report wins over pct_complete). */
  const jobSummaryReportPctRequestedRef = useRef<Set<string>>(new Set())
  const [jobSummaryReportPctByJobId, setJobSummaryReportPctByJobId] = useState<Map<string, number>>(
    () => new Map(),
  )

  const jobSummaryReportsLoadedRef = useRef<Set<string>>(new Set())
  const [jobSummaryReportsByJobId, setJobSummaryReportsByJobId] = useState<Map<string, JobSummaryReportRow[]>>(
    () => new Map(),
  )

  /** Field reports for the expanded-row Charges & Value timeline (lazy per expanded job). */
  const loadJobSummaryReportsForJob = useCallback(async (jobId: string) => {
    if (jobSummaryReportsLoadedRef.current.has(jobId)) return
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('reports')
            .select('id, created_at, field_values, users!reports_created_by_user_id_fkey(name)')
            .eq('job_ledger_id', jobId)
            .order('created_at', { ascending: true }),
        'job summary reports',
      )
      const rows = (data ?? []) as unknown as JobSummaryReportRow[]
      setJobSummaryReportsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, rows)
        return next
      })
    } catch {
      setJobSummaryReportsByJobId((prev) => {
        const next = new Map(prev)
        next.set(jobId, [])
        return next
      })
    } finally {
      jobSummaryReportsLoadedRef.current.add(jobId)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'job-summary' || !jobSummaryLedgerJobs) return
    const missing = jobSummaryLedgerJobs
      .map((j) => j.id)
      .filter((id) => !jobSummaryReportPctRequestedRef.current.has(id))
    if (missing.length === 0) return
    for (const id of missing) jobSummaryReportPctRequestedRef.current.add(id)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => await supabase.rpc('list_latest_report_completion_pct', { p_job_ids: missing }),
          'job summary report completion pct',
        )
        const rows = (data ?? []) as Array<{ job_ledger_id: string; pct: number }>
        if (rows.length === 0) return
        setJobSummaryReportPctByJobId((prev) => {
          const next = new Map(prev)
          for (const r of rows) next.set(r.job_ledger_id, r.pct)
          return next
        })
      } catch {
        // Column falls back to jobs_ledger.pct_complete; un-mark so a later visit retries.
        for (const id of missing) jobSummaryReportPctRequestedRef.current.delete(id)
      }
    })()
  }, [activeTab, jobSummaryLedgerJobs])

  useEffect(() => {
    if (authUserId) return
    setJobSummaryLedgerAllJobs(null)
    setJobSummaryLedgerError(null)
    jobSummaryLedgerSnapshotLoadedRef.current = false
  }, [authUserId])

  return {
    jobSummaryLedgerAllJobs,
    jobSummaryMinHcpExclusive,
    setJobSummaryMinHcpExclusive,
    jobSummaryLedgerJobs,
    jobSummaryLedgerLoading,
    jobSummaryLedgerError,
    loadJobSummaryLedger,
    loadJobSummaryLedgerRef,
    jobSummaryLedgerSnapshotLoadedRef,
    jobSummaryClockSessionsByJobId,
    loadJobSummaryClockSessionsForJob,
    jobSummaryInvoiceLinesByJobId,
    loadJobSummaryInvoiceLinesForJob,
    jobSummaryMercuryAllocationsByJobId,
    loadJobSummaryMercuryAllocationsForJob,
    touchJobSummaryMercuryAllocations,
    jobSummaryReportsByJobId,
    loadJobSummaryReportsForJob,
    jobSummaryReportPctByJobId,
  }
}
