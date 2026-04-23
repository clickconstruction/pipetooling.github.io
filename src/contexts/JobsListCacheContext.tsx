import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchJobsLedgerWithDetailsForStages } from '../lib/fetchJobsLedgerWithDetailsForStages'
import type { JobWithDetails } from '../types/jobWithDetails'

const VISIBILITY_REFETCH_MIN_MS = 30_000

export function buildJobsListCacheKey(userId: string, customerFilter: string | null): string {
  const c = customerFilter?.trim() ?? ''
  return `${userId}:${c || 'all'}`
}

type PendingRefetch = { customerFilter: string | null; kind: RefetchKind }

type RefetchKind = 'default' | 'visibility'

type RunFetchJobsFn = (customerFilter: string | null, options?: { kind?: RefetchKind }) => Promise<JobWithDetails[] | undefined>

type JobsListCacheContextValue = {
  jobs: JobWithDetails[]
  setJobs: Dispatch<SetStateAction<JobWithDetails[]>>
  jobsListLoading: boolean
  jobsListRefreshing: boolean
  /** True while lazy paid-status jobs fetch runs (after user expands Paid in Full). */
  paidJobsLoading: boolean
  /** Key for the latest successful non-paid snapshot; null before first success. */
  jobsListDataKey: string | null
  /** When equal to `jobsListDataKey`, paid jobs are merged into `jobs`. */
  paidJobsMergedForKey: string | null
  jobsListError: string | null
  setJobsListError: (v: string | null) => void
  runFetchJobs: RunFetchJobsFn
  /** Fetch `statusScope: 'paid'` once per non-paid snapshot key; no-op if already merged or main fetch in flight. */
  fetchPaidJobsIfNeeded: (customerFilter: string | null) => Promise<void>
}

const JobsListCacheContext = createContext<JobsListCacheContextValue | null>(null)

export function JobsListCacheProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [jobsListLoading, setJobsListLoading] = useState(true)
  const [jobsListRefreshing, setJobsListRefreshing] = useState(false)
  const [jobsListError, setJobsListError] = useState<string | null>(null)
  const [paidJobsLoading, setPaidJobsLoading] = useState(false)
  const [jobsListDataKey, setJobsListDataKey] = useState<string | null>(null)
  const [paidJobsMergedForKey, setPaidJobsMergedForKey] = useState<string | null>(null)

  const loadInFlightRef = useRef(false)
  const pendingRef = useRef<PendingRefetch | null>(null)
  const lastSuccessfulDataKeyRef = useRef<string | null>(null)
  const completedKeysRef = useRef<Set<string>>(new Set())
  const lastUserIdRef = useRef<string | null>(null)
  const lastFetchCompletedAtRef = useRef(0)
  const runFetchJobsRef = useRef<RunFetchJobsFn | null>(null)
  const lastNonPaidKeyRef = useRef<string | null>(null)
  const paidMergedKeyRef = useRef<string | null>(null)
  const paidFetchInFlightRef = useRef(false)

  const fetchPaidJobsIfNeeded = useCallback(async (customerFilter: string | null) => {
    if (!user?.id) return
    if (loadInFlightRef.current) return
    const key = buildJobsListCacheKey(user.id, customerFilter)
    if (lastNonPaidKeyRef.current !== key) return
    if (paidMergedKeyRef.current === key) return
    if (paidFetchInFlightRef.current) return
    paidFetchInFlightRef.current = true
    setPaidJobsLoading(true)
    try {
      const second = await fetchJobsLedgerWithDetailsForStages({
        customerFilter,
        statusScope: 'paid',
      })
      if (second.ok) {
        setJobs((prev) => [...prev, ...second.jobs])
        paidMergedKeyRef.current = key
        setPaidJobsMergedForKey(key)
      } else {
        console.warn('JobsListCache: paid jobs fetch failed (non-paid data kept):', second.error)
      }
    } catch (e) {
      console.warn('JobsListCache: paid jobs fetch failed (non-paid data kept):', e)
    } finally {
      paidFetchInFlightRef.current = false
      setPaidJobsLoading(false)
    }
  }, [user?.id])

  const runFetchJobs = useCallback<RunFetchJobsFn>(
    async (customerFilter: string | null, options?: { kind?: RefetchKind }): Promise<JobWithDetails[] | undefined> => {
      if (!user?.id) {
        setJobs([])
        setJobsListLoading(false)
        setJobsListRefreshing(false)
        setJobsListError(null)
        setJobsListDataKey(null)
        setPaidJobsMergedForKey(null)
        lastNonPaidKeyRef.current = null
        paidMergedKeyRef.current = null
        lastSuccessfulDataKeyRef.current = null
        completedKeysRef.current.clear()
        return undefined
      }

      const key = buildJobsListCacheKey(user.id, customerFilter)
      const kind: RefetchKind = options?.kind ?? 'default'

      if (kind === 'visibility' && Date.now() - lastFetchCompletedAtRef.current < VISIBILITY_REFETCH_MIN_MS) {
        return undefined
      }

      if (loadInFlightRef.current) {
        pendingRef.current = { customerFilter, kind }
        return undefined
      }

      loadInFlightRef.current = true

      const hadDifferentKey =
        lastSuccessfulDataKeyRef.current != null && lastSuccessfulDataKeyRef.current !== key
      if (hadDifferentKey) {
        setJobs([])
        setJobsListError(null)
        setJobsListDataKey(null)
        setPaidJobsMergedForKey(null)
        lastNonPaidKeyRef.current = null
        paidMergedKeyRef.current = null
      }

      const hasLoadedThisKey = completedKeysRef.current.has(key)
      const useBackground = hasLoadedThisKey && !hadDifferentKey
      if (useBackground) {
        setJobsListRefreshing(true)
      } else {
        setJobsListLoading(true)
      }
      setJobsListError(null)

      try {
        const first = await fetchJobsLedgerWithDetailsForStages({
          customerFilter,
          statusScope: 'non_paid',
        })
        if (!first.ok) {
          setJobsListError(first.error)
          if (useBackground) {
            setJobsListRefreshing(false)
          } else {
            setJobsListLoading(false)
          }
          lastFetchCompletedAtRef.current = Date.now()
          return undefined
        }
        paidMergedKeyRef.current = null
        setPaidJobsMergedForKey(null)
        setJobs(first.jobs)
        lastSuccessfulDataKeyRef.current = key
        completedKeysRef.current.add(key)
        lastNonPaidKeyRef.current = key
        setJobsListDataKey(key)
        setJobsListLoading(false)
        setJobsListRefreshing(false)
        lastFetchCompletedAtRef.current = Date.now()

        return first.jobs
      } finally {
        loadInFlightRef.current = false
        if (pendingRef.current) {
          const next = pendingRef.current
          pendingRef.current = null
          void runFetchJobsRef.current?.(next.customerFilter, { kind: next.kind })
        }
      }
    },
    [user?.id],
  )
  runFetchJobsRef.current = runFetchJobs

  // Reset when auth user id changes
  useEffect(() => {
    if (!user?.id) {
      setJobs([])
      setJobsListLoading(true)
      setJobsListRefreshing(false)
      setJobsListError(null)
      setJobsListDataKey(null)
      setPaidJobsMergedForKey(null)
      lastNonPaidKeyRef.current = null
      paidMergedKeyRef.current = null
      lastSuccessfulDataKeyRef.current = null
      completedKeysRef.current.clear()
      lastUserIdRef.current = null
      return
    }
    if (lastUserIdRef.current != null && lastUserIdRef.current !== user.id) {
      setJobs([])
      lastSuccessfulDataKeyRef.current = null
      completedKeysRef.current.clear()
      setJobsListDataKey(null)
      setPaidJobsMergedForKey(null)
      lastNonPaidKeyRef.current = null
      paidMergedKeyRef.current = null
    }
    lastUserIdRef.current = user.id
  }, [user?.id])

  const value: JobsListCacheContextValue = {
    jobs,
    setJobs,
    jobsListLoading,
    jobsListRefreshing,
    paidJobsLoading,
    jobsListDataKey,
    paidJobsMergedForKey,
    jobsListError,
    setJobsListError,
    runFetchJobs,
    fetchPaidJobsIfNeeded,
  }

  return <JobsListCacheContext.Provider value={value}>{children}</JobsListCacheContext.Provider>
}

export function useJobsListCache(): JobsListCacheContextValue {
  const ctx = useContext(JobsListCacheContext)
  if (!ctx) {
    throw new Error('useJobsListCache must be used within JobsListCacheProvider')
  }
  return ctx
}
