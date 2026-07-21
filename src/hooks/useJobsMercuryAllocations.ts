import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { fetchMercuryJobAllocationsWithAttributionForJob } from '../lib/fetchMercuryJobAllocationsWithAttributionForJob'
import { loadMercuryAllocModalDataForTransaction, type MercuryAllocModalData } from '../lib/mercuryAllocModalData'
import { loadUsersOptionsForBankingAttribution } from '../components/jobs/PartsUnattributedMercuryListModal'
import {
  fetchUnattributedMercuryLinesForManyJobs,
  type UnattributedMercuryLineForJob,
} from '../lib/fetchUnattributedMercuryForManyJobs'
import type { MercuryAllocSavedDetail } from '../components/MercuryTransactionAllocationsModal'
import type { SearchableSelectOption } from '../components/SearchableSelect'
import { isSelectableOption } from '../components/SearchableSelect'
import { mercuryQuickAssignUserAttribution } from '../lib/mercuryQuickAssignUserAttribution'
import type { BankingAttributionUser } from '../lib/mercuryCardNicknameUserMatch'
import type { JobWithDetails } from '../types/jobWithDetails'

/**
 * Parts/Job Summary shared Mercury-allocation engine (Jobs.tsx decomposition
 * seam — see docs/JOBS_TABS_ARCHITECTURE.md). Owns the per-job card-charge
 * totals, the parts-tab allocation cache (+ loaded/in-flight refs), the
 * unattributed-list and allocation-modal open states, the two flow refs that
 * route `onPartsAllocSaved` refreshes, and the banking-attribution users
 * options. Behavior-preserving extraction: the page destructures the return so
 * every downstream reference keeps its name.
 *
 * Stays in the page for now: the parts-tab UI states (search, my-jobs filter,
 * expanded rows) and the `activeTab`-keyed effects (close-on-tab-leave,
 * refetch-on-open, auto-load for expanded rows) — those are UI-coupled. Job
 * Summary's lazy mercury cache lives in `useJobSummaryData` (v2.826), bridged
 * via `onJobSummaryMercuryTouched` (its `touchJobSummaryMercuryAllocations`) /
 * `onJobSummaryDrilldownClose` (the page's drilldown state).
 *
 * The all-jobs unattributed scope memos live here (not parent-side) because
 * they read the hook-owned `mercuryCardChargesByJobId`; their parent-side
 * inputs arrive via `unattributedScopeInputs`.
 */
export function useJobsMercuryAllocations({
  jobListForCardCharges,
  canAccessBankingForParts,
  authUserId,
  showToast,
  unattributedScopeInputs,
  onJobSummaryMercuryTouched,
  onJobSummaryDrilldownClose,
}: {
  /** Parent-owned memo (reads `activeTab`/`jobSummaryLedgerJobs`/`jobs`): the job list the card-charges batch effect sums over. */
  jobListForCardCharges: JobWithDetails[]
  canAccessBankingForParts: boolean
  /** Used as the recent-person-picks storage key for quick-assign. */
  authUserId: string | undefined
  showToast: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void
  /** Parent-side state feeding the all-jobs unattributed scope memos. */
  unattributedScopeInputs: {
    jobs: JobWithDetails[]
    showMyJobsOnly: boolean
    myJobIds: Set<string> | null
  }
  /** Job Summary bridge: invalidate + force-reload the lazy Job Summary mercury cache for one job (`useJobSummaryData`'s `touchJobSummaryMercuryAllocations` since v2.826). */
  onJobSummaryMercuryTouched: (jobId: string) => void
  /** Job Summary bridge: close the parent's cost-drilldown modal. */
  onJobSummaryDrilldownClose: () => void
}) {
  const { jobs, showMyJobsOnly, myJobIds } = unattributedScopeInputs

  const [mercuryCardChargesByJobId, setMercuryCardChargesByJobId] = useState<Map<string, number>>(() => new Map())
  const partsTabMercuryLoadedRef = useRef<Set<string>>(new Set())
  const partsTabMercuryInFlightRef = useRef<Set<string>>(new Set())
  const [partsTabMercuryAllocationsByJobId, setPartsTabMercuryAllocationsByJobId] = useState<
    Map<string, Awaited<ReturnType<typeof fetchMercuryJobAllocationsWithAttributionForJob>>>
  >(() => new Map())
  const partsUnattribFlowJobIdRef = useRef<string | null>(null)
  /** When opening Mercury alloc modal from Job Summary drilldown, refresh this job (+ targets) on save. */
  const jobSummaryMercuryEditFlowJobIdRef = useRef<string | null>(null)
  const [partsUnattribListJobId, setPartsUnattribListJobId] = useState<string | null>(null)
  const [partsAllocModalData, setPartsAllocModalData] = useState<MercuryAllocModalData | null>(null)
  const [partsAllocModalOpen, setPartsAllocModalOpen] = useState(false)
  const [bankingAttributionUsersOptions, setBankingAttributionUsersOptions] = useState<SearchableSelectOption[]>([])
  const [allJobsUnattributedOpen, setAllJobsUnattributedOpen] = useState(false)
  const [allJobsUnattributedLoading, setAllJobsUnattributedLoading] = useState(false)
  const [allJobsUnattributedLines, setAllJobsUnattributedLines] = useState<UnattributedMercuryLineForJob[] | null>(null)

  const jobIdsKeyForCardCharges = useMemo(
    () => jobListForCardCharges.map((j) => j.id).sort().join(','),
    [jobListForCardCharges],
  )

  useEffect(() => {
    if (jobListForCardCharges.length === 0) {
      setMercuryCardChargesByJobId(new Map())
      return
    }
    const ids = jobListForCardCharges.map((j) => j.id)
    void withSupabaseRetry(
      async () =>
        supabase.from('mercury_transaction_job_allocations').select('job_id, amount').in('job_id', ids),
      'mercury card charges by job',
    )
      .then((rows) => {
        const m = new Map<string, number>()
        for (const row of rows ?? []) {
          const jid = row.job_id
          m.set(jid, (m.get(jid) ?? 0) + Math.abs(Number(row.amount)))
        }
        setMercuryCardChargesByJobId(m)
      })
      .catch(() => setMercuryCardChargesByJobId(new Map()))
  }, [jobIdsKeyForCardCharges])

  const loadPartsTabMercuryForJob = useCallback(async (jobId: string) => {
    if (partsTabMercuryLoadedRef.current.has(jobId) || partsTabMercuryInFlightRef.current.has(jobId)) {
      return
    }
    partsTabMercuryInFlightRef.current.add(jobId)
    try {
      const rows = await fetchMercuryJobAllocationsWithAttributionForJob(jobId, 'parts tab')
      setPartsTabMercuryAllocationsByJobId((m) => {
        const n = new Map(m)
        n.set(jobId, rows)
        return n
      })
    } catch {
      setPartsTabMercuryAllocationsByJobId((m) => {
        const n = new Map(m)
        n.set(jobId, [])
        return n
      })
    } finally {
      partsTabMercuryInFlightRef.current.delete(jobId)
      partsTabMercuryLoadedRef.current.add(jobId)
    }
  }, [])

  const refreshPartsTabMercuryForJob = useCallback(
    (jobId: string) => {
      partsTabMercuryLoadedRef.current.delete(jobId)
      partsTabMercuryInFlightRef.current.delete(jobId)
      setPartsTabMercuryAllocationsByJobId((m) => {
        const n = new Map(m)
        n.delete(jobId)
        return n
      })
      void loadPartsTabMercuryForJob(jobId)
    },
    [loadPartsTabMercuryForJob],
  )

  const updateMercuryCardTotalForOneJob = useCallback((jobId: string) => {
    void withSupabaseRetry(
      async () =>
        supabase.from('mercury_transaction_job_allocations').select('amount').eq('job_id', jobId),
      'mercury card charges for one job (parts refresh)',
    )
      .then((rows) => {
        const sum = (rows ?? []).reduce((a, r) => a + Math.abs(Number(r.amount)), 0)
        setMercuryCardChargesByJobId((m) => {
          const n = new Map(m)
          n.set(jobId, sum)
          return n
        })
      })
      .catch(() => {})
  }, [])

  const dismissPartsUnattributedList = useCallback(() => {
    setPartsUnattribListJobId(null)
    partsUnattribFlowJobIdRef.current = null
  }, [])

  const closeListOnlyForAssign = useCallback(() => {
    setPartsUnattribListJobId(null)
  }, [])

  const closeAllJobsListForAssign = useCallback(() => {
    setAllJobsUnattributedOpen(false)
  }, [])

  const handleAssignToTransactionFromParts = useCallback(
    async (mercuryTransactionId: string, jobIdForFlow?: string | null) => {
      jobSummaryMercuryEditFlowJobIdRef.current = null
      if (jobIdForFlow) partsUnattribFlowJobIdRef.current = jobIdForFlow
      const data = await loadMercuryAllocModalDataForTransaction(
        mercuryTransactionId,
        'Parts tab: open Mercury allocation',
      )
      setPartsAllocModalData(data)
      setPartsAllocModalOpen(true)
    },
    [],
  )

  const handleJobSummaryMercuryReassignFromDrilldown = useCallback(
    async (mercuryTransactionId: string, sourceJobId: string) => {
      partsUnattribFlowJobIdRef.current = null
      jobSummaryMercuryEditFlowJobIdRef.current = sourceJobId
      onJobSummaryDrilldownClose()
      try {
        const data = await loadMercuryAllocModalDataForTransaction(
          mercuryTransactionId,
          'Job Summary: edit Mercury allocation',
        )
        setPartsAllocModalData(data)
        setPartsAllocModalOpen(true)
      } catch (e) {
        jobSummaryMercuryEditFlowJobIdRef.current = null
        showToast(e instanceof Error ? e.message : 'Could not load allocation', 'error')
      }
    },
    [showToast, onJobSummaryDrilldownClose],
  )

  const closePartsAllocModal = useCallback(() => {
    setPartsAllocModalOpen(false)
    setPartsAllocModalData(null)
    partsUnattribFlowJobIdRef.current = null
    jobSummaryMercuryEditFlowJobIdRef.current = null
  }, [])

  const partsUnattributedJobLabelById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const j of jobs) {
      const h = (j.hcp_number ?? '').trim() || '—'
      const n = (j.job_name ?? '').trim() || '—'
      m[j.id] = `${h} · ${n}`
    }
    return m
  }, [jobs])

  const partsUnattributedScopeJobIds = useMemo(() => {
    const ids: string[] = []
    for (const j of jobs) {
      if ((mercuryCardChargesByJobId.get(j.id) ?? 0) <= 0) continue
      if (showMyJobsOnly && myJobIds && !myJobIds.has(j.id)) continue
      ids.push(j.id)
    }
    return ids
  }, [jobs, mercuryCardChargesByJobId, showMyJobsOnly, myJobIds])

  const refetchAllJobsUnattributedData = useCallback(async () => {
    setAllJobsUnattributedLines(null)
    setAllJobsUnattributedLoading(true)
    if (partsUnattributedScopeJobIds.length === 0) {
      setAllJobsUnattributedLines([])
      setAllJobsUnattributedLoading(false)
      return
    }
    try {
      const lines = await fetchUnattributedMercuryLinesForManyJobs({
        jobIds: partsUnattributedScopeJobIds,
        jobLabelById: partsUnattributedJobLabelById,
        cacheByJobId: partsTabMercuryAllocationsByJobId,
        operationLabel: 'Parts tab: all jobs unattributed',
        concurrency: 5,
      })
      setAllJobsUnattributedLines(lines)
    } catch {
      setAllJobsUnattributedLines([])
    } finally {
      setAllJobsUnattributedLoading(false)
    }
  }, [partsUnattributedScopeJobIds, partsUnattributedJobLabelById, partsTabMercuryAllocationsByJobId])

  const onPartsAllocSaved = useCallback(
    (detail: MercuryAllocSavedDetail) => {
      const jobSummarySourceJobId = jobSummaryMercuryEditFlowJobIdRef.current
      const partsJobId = partsUnattribFlowJobIdRef.current
      jobSummaryMercuryEditFlowJobIdRef.current = null
      partsUnattribFlowJobIdRef.current = null

      setPartsAllocModalOpen(false)
      setPartsAllocModalData(null)
      setPartsUnattribListJobId(null)

      if (jobSummarySourceJobId) {
        onJobSummaryDrilldownClose()
        const touchJobSummaryMercury = (jid: string) => {
          onJobSummaryMercuryTouched(jid)
          updateMercuryCardTotalForOneJob(jid)
        }
        touchJobSummaryMercury(jobSummarySourceJobId)
        const seen = new Set<string>([jobSummarySourceJobId])
        for (const a of detail.allocations) {
          if (!seen.has(a.job_id)) {
            seen.add(a.job_id)
            touchJobSummaryMercury(a.job_id)
          }
        }
      }

      if (partsJobId) {
        refreshPartsTabMercuryForJob(partsJobId)
        updateMercuryCardTotalForOneJob(partsJobId)
      }
      if (allJobsUnattributedOpen) {
        void refetchAllJobsUnattributedData()
      }
    },
    [
      refreshPartsTabMercuryForJob,
      updateMercuryCardTotalForOneJob,
      allJobsUnattributedOpen,
      refetchAllJobsUnattributedData,
      onJobSummaryMercuryTouched,
      onJobSummaryDrilldownClose,
    ],
  )

  const partsUnattribBankingUsersForMatch = useMemo((): BankingAttributionUser[] => {
    return bankingAttributionUsersOptions
      .filter(isSelectableOption)
      .filter((o) => o.value.trim() !== '')
      .map((o) => ({ id: o.value, name: o.label }))
  }, [bankingAttributionUsersOptions])

  const handleQuickAddUserFromParts = useCallback(
    async (mercuryTransactionId: string, user: BankingAttributionUser, jobIdForFlow?: string | null) => {
      const jobId = jobIdForFlow ?? partsUnattribFlowJobIdRef.current
      if (jobIdForFlow) partsUnattribFlowJobIdRef.current = jobIdForFlow
      if (!jobId) return
      await mercuryQuickAssignUserAttribution({
        mercuryTransactionId,
        userId: user.id,
        operationLabel: 'Parts tab: quick assign from card nickname',
        recentPersonPicksStorageKey: authUserId ?? null,
      })
      showToast('Saved allocations.', 'success')
      refreshPartsTabMercuryForJob(jobId)
      updateMercuryCardTotalForOneJob(jobId)
      if (allJobsUnattributedOpen) {
        void refetchAllJobsUnattributedData()
      }
    },
    [
      authUserId,
      showToast,
      refreshPartsTabMercuryForJob,
      updateMercuryCardTotalForOneJob,
      allJobsUnattributedOpen,
      refetchAllJobsUnattributedData,
    ],
  )

  useEffect(() => {
    if (!canAccessBankingForParts) {
      setBankingAttributionUsersOptions([])
      return
    }
    void loadUsersOptionsForBankingAttribution().then(setBankingAttributionUsersOptions)
  }, [canAccessBankingForParts])

  return {
    mercuryCardChargesByJobId,
    partsTabMercuryLoadedRef,
    partsTabMercuryInFlightRef,
    partsTabMercuryAllocationsByJobId,
    partsUnattribFlowJobIdRef,
    partsUnattribListJobId,
    setPartsUnattribListJobId,
    partsAllocModalData,
    partsAllocModalOpen,
    bankingAttributionUsersOptions,
    allJobsUnattributedOpen,
    setAllJobsUnattributedOpen,
    allJobsUnattributedLoading,
    allJobsUnattributedLines,
    loadPartsTabMercuryForJob,
    refreshPartsTabMercuryForJob,
    updateMercuryCardTotalForOneJob,
    dismissPartsUnattributedList,
    closeListOnlyForAssign,
    closeAllJobsListForAssign,
    handleAssignToTransactionFromParts,
    handleJobSummaryMercuryReassignFromDrilldown,
    closePartsAllocModal,
    refetchAllJobsUnattributedData,
    onPartsAllocSaved,
    partsUnattribBankingUsersForMatch,
    handleQuickAddUserFromParts,
  }
}
