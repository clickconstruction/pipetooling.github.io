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
  jobsListError: string | null
  setJobsListError: (v: string | null) => void
  runFetchJobs: RunFetchJobsFn
}

const JobsListCacheContext = createContext<JobsListCacheContextValue | null>(null)

export function JobsListCacheProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [jobsListLoading, setJobsListLoading] = useState(true)
  const [jobsListRefreshing, setJobsListRefreshing] = useState(false)
  const [jobsListError, setJobsListError] = useState<string | null>(null)

  const loadInFlightRef = useRef(false)
  const pendingRef = useRef<PendingRefetch | null>(null)
  const lastSuccessfulDataKeyRef = useRef<string | null>(null)
  const completedKeysRef = useRef<Set<string>>(new Set())
  const lastUserIdRef = useRef<string | null>(null)
  const lastFetchCompletedAtRef = useRef(0)
  const runFetchJobsRef = useRef<RunFetchJobsFn | null>(null)

  const runFetchJobs = useCallback<RunFetchJobsFn>(
    async (customerFilter: string | null, options?: { kind?: RefetchKind }): Promise<JobWithDetails[] | undefined> => {
      if (!user?.id) {
        setJobs([])
        setJobsListLoading(false)
        setJobsListRefreshing(false)
        setJobsListError(null)
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
        const result = await fetchJobsLedgerWithDetailsForStages({ customerFilter })
        if (!result.ok) {
          setJobsListError(result.error)
          if (useBackground) {
            setJobsListRefreshing(false)
          } else {
            setJobsListLoading(false)
          }
          lastFetchCompletedAtRef.current = Date.now()
          return undefined
        }
        setJobs(result.jobs)
        lastSuccessfulDataKeyRef.current = key
        completedKeysRef.current.add(key)
        setJobsListLoading(false)
        setJobsListRefreshing(false)
        lastFetchCompletedAtRef.current = Date.now()
        return result.jobs
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
      lastSuccessfulDataKeyRef.current = null
      completedKeysRef.current.clear()
      lastUserIdRef.current = null
      return
    }
    if (lastUserIdRef.current != null && lastUserIdRef.current !== user.id) {
      setJobs([])
      lastSuccessfulDataKeyRef.current = null
      completedKeysRef.current.clear()
    }
    lastUserIdRef.current = user.id
  }, [user?.id])

  const value: JobsListCacheContextValue = {
    jobs,
    setJobs,
    jobsListLoading,
    jobsListRefreshing,
    jobsListError,
    setJobsListError,
    runFetchJobs,
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
