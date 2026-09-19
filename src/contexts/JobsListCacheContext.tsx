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
import { fetchJobsLedgerStagesPrimary, fetchJobsLedgerWithDetailsForStages, fetchStagesEnrichment, primaryRowToJobWithDetails } from '../lib/fetchJobsLedgerWithDetailsForStages'
import { fetchStagesHeaderStats } from '../lib/jobs/fetchStagesHeaderStats'
import { mergeScopedRows, NON_PAID_SCOPES, type JobsBoardScope } from '../lib/jobs/boardScopes'
import { applyStagesEnrichment, patchJobsById } from '../lib/jobs/stagesEnrichment'
import { boardIsFreshForTab } from '../lib/jobs/boardRefetchTtl'
import { boardSnapshotIsUsable, buildBoardSnapshot } from '../lib/jobs/boardSnapshot'
import { clearBoardSnapshots, readBoardSnapshot, writeBoardSnapshot } from '../lib/jobs/boardSnapshotStore'
import type { StagesHeaderStats } from '../lib/jobs/stagesHeaderStats'
import type { StageRow } from '../lib/jobsStagesBoard'
import type { JobWithDetails } from '../types/jobWithDetails'

const VISIBILITY_REFETCH_MIN_MS = 30_000
/** Header stats stay fresh-enough this long; only forced (post-mutation) refreshes bypass it (v2.1917). */
const HEADER_STATS_TTL_MS = 60_000

export function buildJobsListCacheKey(userId: string, customerFilter: string | null): string {
  const c = customerFilter?.trim() ?? ''
  return `${userId}:${c || 'all'}`
}

type PendingRefetch = { customerFilter: string | null; kind: RefetchKind }

/** `tab` (v2.3603): a tab switch — skipped while the same board is fresh (`boardIsFreshForTab`). */
type RefetchKind = 'default' | 'visibility' | 'tab'

type RunFetchJobsFn = (customerFilter: string | null, options?: { kind?: RefetchKind }) => Promise<JobWithDetails[] | undefined>

type JobsListCacheContextValue = {
  jobs: JobWithDetails[]
  setJobs: Dispatch<SetStateAction<JobWithDetails[]>>
  jobsListLoading: boolean
  jobsListRefreshing: boolean
  /**
   * v2.3600 (Pipeline load speed PR 2): true from the moment the board's rows are on screen
   * until their enrichment (materials, fixtures, schedule date, estimate banner) has landed.
   * Readers of those four fields treat "not yet" as empty; nothing waits on this flag.
   */
  jobsListEnriching: boolean
  /**
   * v2.3610 (Pipeline load speed PR 4): when the rows on screen are the board this device
   * remembered from an earlier visit, the epoch ms they were current; null once the live board
   * lands (or when nothing was remembered). The Stages tab mutes money and holds row buttons
   * while it is set.
   */
  jobsListSnapshotAt: number | null
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
  /**
   * Lean section-header stats (v2.1821, scoped-load plan PR 1): refreshed
   * beside every main load so collapsed sections can show live counts/totals
   * without their rows (plan PR 3). Null until the first stats fetch lands;
   * stats failures never touch the board (best-effort layer).
   */
  headerStats: StagesHeaderStats | null
  /**
   * Lean billed StageRows from the same stats fetch (v2.2025): feed the
   * Pipeline chase-queue card before the billed scope's full rows load.
   * Lean rows carry ids/amounts/dates but no names.
   */
  leanBilledRows: StageRow[] | null
  refreshHeaderStats: (customerFilter: string | null, options?: { force?: boolean }) => Promise<void>
  /**
   * Scope-aware cache (v2.1823, plan PR 2): which sections' rows the shared
   * `jobs` array currently holds, per-scope loading, and the generalized
   * fetch-on-demand `fetchPaidJobsIfNeeded` grew out of. A full board load
   * marks every non-paid scope merged, so behavior is unchanged until PR 3
   * starts loading subsets.
   */
  mergedScopes: ReadonlySet<JobsBoardScope>
  scopeLoading: ReadonlySet<JobsBoardScope>
  fetchScopeIfNeeded: (scope: JobsBoardScope, customerFilter: string | null) => Promise<void>
  /**
   * Scoped initial load (v2.1824, plan PR 3): fetch ONLY the given scopes —
   * the Stages board passes its open sections' scopes so a fresh visit costs
   * ~one section instead of the whole company. Marks exactly those scopes
   * merged; header stats refresh alongside. Other tabs keep `runFetchJobs`.
   */
  runFetchScopes: (
    scopes: readonly JobsBoardScope[],
    customerFilter: string | null,
    options?: { preservePaid?: boolean; kind?: RefetchKind },
  ) => Promise<void>
  /**
   * Scoped refresh (v2.1827, plan PR 5): refetch only the currently-merged
   * non-paid scopes (falling back to a full load when everything is merged
   * anyway, or nothing is). Merged paid rows are preserved as-is — paid
   * changes rarely, and refetching 667 embedded rows after every mutation was
   * the pre-train pathology. The Stages mutation/visibility refreshes use
   * this; other tabs keep runFetchJobs.
   */
  refreshMergedScopes: (customerFilter: string | null, options?: { kind?: 'default' | 'visibility' }) => Promise<void>
}

const JobsListCacheContext = createContext<JobsListCacheContextValue | null>(null)

export function JobsListCacheProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [jobsListLoading, setJobsListLoading] = useState(true)
  const [jobsListEnriching, setJobsListEnriching] = useState(false)
  const [jobsListRefreshing, setJobsListRefreshing] = useState(false)
  const [jobsListSnapshotAt, setJobsListSnapshotAt] = useState<number | null>(null)
  const [jobsListError, setJobsListError] = useState<string | null>(null)
  const [scopeLoading, setScopeLoading] = useState<ReadonlySet<JobsBoardScope>>(() => new Set())
  const [jobsListDataKey, setJobsListDataKey] = useState<string | null>(null)
  const [mergedScopes, setMergedScopes] = useState<ReadonlySet<JobsBoardScope>>(() => new Set())
  const [headerStats, setHeaderStats] = useState<StagesHeaderStats | null>(null)
  const [leanBilledRows, setLeanBilledRows] = useState<StageRow[] | null>(null)
  const headerStatsInFlightRef = useRef(false)
  const headerStatsLastFetchRef = useRef<{ key: string; at: number } | null>(null)

  const loadInFlightRef = useRef(false)
  const pendingRef = useRef<PendingRefetch | null>(null)
  const lastSuccessfulDataKeyRef = useRef<string | null>(null)
  const completedKeysRef = useRef<Set<string>>(new Set())
  const lastUserIdRef = useRef<string | null>(null)
  const lastFetchCompletedAtRef = useRef(0)
  const runFetchJobsRef = useRef<RunFetchJobsFn | null>(null)
  const refreshHeaderStatsRef = useRef<((customerFilter: string | null) => Promise<void>) | null>(null)
  const runFetchScopesRef = useRef<
    ((scopes: readonly JobsBoardScope[], customerFilter: string | null, options?: { preservePaid?: boolean; kind?: RefetchKind }) => Promise<void>) | null
  >(null)
  const lastNonPaidKeyRef = useRef<string | null>(null)
  const mergedScopesRef = useRef<Set<JobsBoardScope>>(new Set())
  const scopeFetchInFlightRef = useRef<Set<JobsBoardScope>>(new Set())

  const enrichGenRef = useRef(0)
  /**
   * v2.3600: the four enriched fields for rows already on screen, laid over the cache by id
   * once the passes land. A newer board (a different key) makes an older enrichment moot; the
   * patch is skipped rather than applied to rows it never saw.
   */
  const enrichPaintedRows = useCallback(async (painted: JobWithDetails[], key: string): Promise<JobWithDetails[] | null> => {
    const gen = ++enrichGenRef.current
    setJobsListEnriching(true)
    try {
      const enrichment = await fetchStagesEnrichment(painted.map((j) => j.id))
      if (lastSuccessfulDataKeyRef.current !== key) return null
      const enriched = applyStagesEnrichment(painted, enrichment)
      setJobs((prev) => patchJobsById(prev, enriched))
      return enriched
    } catch (e) {
      console.warn('JobsListCache: enrichment failed (rows stay as painted):', e)
      return painted
    } finally {
      if (enrichGenRef.current === gen) setJobsListEnriching(false)
    }
  }, [])

  /**
   * v2.3610: on a cold load, paint the board this device remembered while the live fetch runs.
   * Resolves in the background; `liveLanded()` says the fetch got there first, in which case
   * the snapshot is ignored. Only the state is set — the refs that gate scope fetches and the
   * tab TTL stay untouched, so nothing treats the remembered rows as a completed load.
   */
  const paintRememberedBoard = useCallback(
    (key: string, wantedScopes: readonly JobsBoardScope[], liveLanded: () => boolean) => {
      void readBoardSnapshot(key).then((snapshot) => {
        if (liveLanded()) return
        if (!boardSnapshotIsUsable({ snapshot, key, wantedScopes, now: Date.now() })) return
        if (!snapshot) return
        setJobs(snapshot.jobs)
        setMergedScopes(new Set(snapshot.scopes))
        setJobsListSnapshotAt(snapshot.savedAt)
        setJobsListLoading(false)
        setJobsListRefreshing(true)
      })
    },
    [],
  )

  const fetchScopeIfNeeded = useCallback(
    async (scope: JobsBoardScope, customerFilter: string | null) => {
      if (!user?.id) return
      if (loadInFlightRef.current) return
      const key = buildJobsListCacheKey(user.id, customerFilter)
      // Scopes anchor to the latest completed board snapshot key, exactly as
      // the paid lazy-merge always did.
      if (lastNonPaidKeyRef.current !== key) return
      if (mergedScopesRef.current.has(scope)) return
      if (scopeFetchInFlightRef.current.has(scope)) return
      scopeFetchInFlightRef.current.add(scope)
      setScopeLoading(new Set(scopeFetchInFlightRef.current))
      let painted: JobWithDetails[] | null = null
      try {
        const second = await fetchJobsLedgerStagesPrimary({ customerFilter, statusScope: scope })
        if (second.ok) {
          const rows = second.rows.map(primaryRowToJobWithDetails)
          painted = rows
          setJobs((prev) => mergeScopedRows(prev, rows, scope))
          mergedScopesRef.current.add(scope)
          setMergedScopes(new Set(mergedScopesRef.current))
        } else {
          console.warn(`JobsListCache: ${scope} scope fetch failed (existing data kept):`, second.error)
        }
      } catch (e) {
        console.warn(`JobsListCache: ${scope} scope fetch failed (existing data kept):`, e)
      } finally {
        scopeFetchInFlightRef.current.delete(scope)
        setScopeLoading(new Set(scopeFetchInFlightRef.current))
      }
      if (painted && painted.length > 0) await enrichPaintedRows(painted, key)
    },
    [user?.id, enrichPaintedRows],
  )

  const fetchPaidJobsIfNeeded = useCallback(
    async (customerFilter: string | null) => fetchScopeIfNeeded('paid', customerFilter),
    [fetchScopeIfNeeded],
  )

  const refreshMergedScopes = useCallback(
    async (customerFilter: string | null, options?: { kind?: 'default' | 'visibility' }): Promise<void> => {
      if (
        options?.kind === 'visibility' &&
        Date.now() - lastFetchCompletedAtRef.current < VISIBILITY_REFETCH_MIN_MS
      ) {
        return
      }
      const merged = mergedScopesRef.current
      const nonPaidMerged = NON_PAID_SCOPES.filter((sc) => merged.has(sc))
      // Nothing merged yet (first load still pending) or everything merged →
      // the classic full path is both correct and simpler.
      if (nonPaidMerged.length === 0 || nonPaidMerged.length === NON_PAID_SCOPES.length) {
        await runFetchJobsRef.current?.(customerFilter)
        return
      }
      await runFetchScopesRef.current?.(nonPaidMerged, customerFilter, { preservePaid: true })
    },
    [],
  )

  const runFetchScopes = useCallback(
    async (
      scopes: readonly JobsBoardScope[],
      customerFilter: string | null,
      options?: { preservePaid?: boolean; kind?: RefetchKind },
    ): Promise<void> => {
      if (!user?.id) return
      if (loadInFlightRef.current) return
      const key = buildJobsListCacheKey(user.id, customerFilter)
      // v2.3603: a tab switch back to a fresh board is free.
      if (
        options?.kind === 'tab' &&
        boardIsFreshForTab({
          key,
          completedKeys: completedKeysRef.current,
          currentKey: lastSuccessfulDataKeyRef.current,
          lastCompletedAt: lastFetchCompletedAtRef.current,
          now: Date.now(),
          mergedScopes: mergedScopesRef.current,
          wantedScopes: scopes,
        })
      ) {
        return
      }
      loadInFlightRef.current = true
      const hadDifferentKey =
        lastSuccessfulDataKeyRef.current != null && lastSuccessfulDataKeyRef.current !== key
      if (hadDifferentKey) {
        setJobs([])
        setJobsListError(null)
        setJobsListDataKey(null)
        setMergedScopes(new Set())
        lastNonPaidKeyRef.current = null
        mergedScopesRef.current = new Set()
      }
      const hasLoadedThisKey = completedKeysRef.current.has(key)
      let liveLanded = false
      if (hasLoadedThisKey && !hadDifferentKey) setJobsListRefreshing(true)
      else {
        setJobsListLoading(true)
        paintRememberedBoard(key, scopes, () => liveLanded)
      }
      setJobsListError(null)
      // v2.3600: the board paints from the primary rows; the enrichment lands after the
      // flags clear, so the first paint no longer waits for the four passes.
      let painted: JobWithDetails[] | null = null
      try {
        const results = await Promise.all(
          scopes.map((scope) => fetchJobsLedgerStagesPrimary({ customerFilter, statusScope: scope })),
        )
        liveLanded = true
        const firstError = results.find((r) => !r.ok)
        if (firstError && !firstError.ok) {
          setJobsListError(firstError.error)
          return
        }
        setJobsListSnapshotAt(null)
        const seen = new Set<string>()
        const rows: JobWithDetails[] = []
        for (const r of results) {
          if (!r.ok) continue
          for (const raw of r.rows) {
            if (!seen.has(raw.id)) {
              seen.add(raw.id)
              rows.push(primaryRowToJobWithDetails(raw))
            }
          }
        }
        painted = rows
        const keepPaid = options?.preservePaid === true && mergedScopesRef.current.has('paid')
        if (keepPaid) {
          setJobs((prev) => [
            ...rows,
            ...prev.filter((p) => (p.status ?? 'working') === 'paid' && !seen.has(p.id)),
          ])
        } else {
          setJobs(rows)
        }
        mergedScopesRef.current = new Set(keepPaid ? [...scopes, 'paid'] : scopes)
        setMergedScopes(new Set(mergedScopesRef.current))
        lastSuccessfulDataKeyRef.current = key
        completedKeysRef.current.add(key)
        lastNonPaidKeyRef.current = key
        setJobsListDataKey(key)
        void refreshHeaderStatsRef.current?.(customerFilter)
      } finally {
        setJobsListLoading(false)
        setJobsListRefreshing(false)
        lastFetchCompletedAtRef.current = Date.now()
        loadInFlightRef.current = false
        const pending = pendingRef.current
        if (pending) {
          pendingRef.current = null
          void runFetchJobsRef.current?.(pending.customerFilter, { kind: pending.kind })
        }
      }
      // Once, across every scope — one set of chunked passes for the whole board, not one per section.
      if (!painted) return
      const finalRows = painted.length > 0 ? await enrichPaintedRows(painted, key) : painted
      // v2.3610: remember the board for the next cold load (a newer key means this one is moot).
      if (finalRows && lastSuccessfulDataKeyRef.current === key) {
        void writeBoardSnapshot(buildBoardSnapshot({ key, scopes, jobs: finalRows, now: Date.now() }))
      }
    },
    [user?.id, enrichPaintedRows, paintRememberedBoard],
  )

  const refreshHeaderStats = useCallback(
    async (customerFilter: string | null, options?: { force?: boolean }): Promise<void> => {
      if (!user?.id) return
      if (headerStatsInFlightRef.current) return
      // Fresh-enough guard (v2.1917): the load/visibility piggyback callers
      // refire after every board fetch; stats only need to move when data
      // moved, so within the TTL only forced (post-mutation) refreshes run.
      const key = `${user.id}|${customerFilter ?? ''}`
      const last = headerStatsLastFetchRef.current
      if (!options?.force && last != null && last.key === key && Date.now() - last.at < HEADER_STATS_TTL_MS) {
        return
      }
      headerStatsInFlightRef.current = true
      try {
        const res = await fetchStagesHeaderStats(customerFilter)
        if (res.ok) {
          headerStatsLastFetchRef.current = { key, at: Date.now() }
          setHeaderStats(res.stats)
          setLeanBilledRows(res.leanBilledRows)
        }
      } finally {
        headerStatsInFlightRef.current = false
      }
    },
    [user?.id],
  )

  const runFetchJobs = useCallback<RunFetchJobsFn>(
    async (customerFilter: string | null, options?: { kind?: RefetchKind }): Promise<JobWithDetails[] | undefined> => {
      if (!user?.id) {
        setJobs([])
        setJobsListLoading(false)
        setJobsListRefreshing(false)
        setJobsListError(null)
        setJobsListDataKey(null)
        setMergedScopes(new Set())
        lastNonPaidKeyRef.current = null
        mergedScopesRef.current = new Set()
        lastSuccessfulDataKeyRef.current = null
        completedKeysRef.current.clear()
        return undefined
      }

      const key = buildJobsListCacheKey(user.id, customerFilter)
      const kind: RefetchKind = options?.kind ?? 'default'

      if (kind === 'visibility' && Date.now() - lastFetchCompletedAtRef.current < VISIBILITY_REFETCH_MIN_MS) {
        return undefined
      }
      // v2.3603: a tab switch back to a fresh full board (every non-paid scope merged) is free.
      if (
        kind === 'tab' &&
        boardIsFreshForTab({
          key,
          completedKeys: completedKeysRef.current,
          currentKey: lastSuccessfulDataKeyRef.current,
          lastCompletedAt: lastFetchCompletedAtRef.current,
          now: Date.now(),
          mergedScopes: mergedScopesRef.current,
          wantedScopes: NON_PAID_SCOPES,
        })
      ) {
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
        setMergedScopes(new Set())
        lastNonPaidKeyRef.current = null
        mergedScopesRef.current = new Set()
      }

      const hasLoadedThisKey = completedKeysRef.current.has(key)
      const useBackground = hasLoadedThisKey && !hadDifferentKey
      let liveLanded = false
      if (useBackground) {
        setJobsListRefreshing(true)
      } else {
        setJobsListLoading(true)
        paintRememberedBoard(key, NON_PAID_SCOPES, () => liveLanded)
      }
      setJobsListError(null)

      try {
        const first = await fetchJobsLedgerWithDetailsForStages({
          customerFilter,
          statusScope: 'non_paid',
        })
        liveLanded = true
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
        setJobsListSnapshotAt(null)
        mergedScopesRef.current = new Set(NON_PAID_SCOPES)
        setMergedScopes(new Set(mergedScopesRef.current))
        setJobs(first.jobs)
        void writeBoardSnapshot(buildBoardSnapshot({ key, scopes: NON_PAID_SCOPES, jobs: first.jobs, now: Date.now() }))
        lastSuccessfulDataKeyRef.current = key
        completedKeysRef.current.add(key)
        lastNonPaidKeyRef.current = key
        setJobsListDataKey(key)
        setJobsListLoading(false)
        setJobsListRefreshing(false)
        lastFetchCompletedAtRef.current = Date.now()
        // Best-effort, deliberately not awaited — headers refresh in the
        // background of every successful board load.
        void refreshHeaderStatsRef.current?.(customerFilter)

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
    [user?.id, paintRememberedBoard],
  )
  runFetchJobsRef.current = runFetchJobs
  refreshHeaderStatsRef.current = refreshHeaderStats
  runFetchScopesRef.current = runFetchScopes

  // Reset when auth user id changes
  useEffect(() => {
    if (!user?.id) {
      setJobs([])
      setJobsListLoading(true)
      setJobsListRefreshing(false)
      setJobsListSnapshotAt(null)
      void clearBoardSnapshots()
      setJobsListError(null)
      setJobsListDataKey(null)
      setMergedScopes(new Set())
      lastNonPaidKeyRef.current = null
      mergedScopesRef.current = new Set()
      lastSuccessfulDataKeyRef.current = null
      completedKeysRef.current.clear()
      lastUserIdRef.current = null
      return
    }
    if (lastUserIdRef.current != null && lastUserIdRef.current !== user.id) {
      setJobs([])
      setJobsListSnapshotAt(null)
      void clearBoardSnapshots()
      lastSuccessfulDataKeyRef.current = null
      completedKeysRef.current.clear()
      setJobsListDataKey(null)
      setMergedScopes(new Set())
      lastNonPaidKeyRef.current = null
      mergedScopesRef.current = new Set()
    }
    lastUserIdRef.current = user.id
  }, [user?.id])

  const value: JobsListCacheContextValue = {
    jobs,
    setJobs,
    jobsListLoading,
    jobsListEnriching,
    jobsListRefreshing,
    jobsListSnapshotAt,
    // Compat derivations (pre-v2.1823 consumers): paid is just one scope now.
    paidJobsLoading: scopeLoading.has('paid'),
    jobsListDataKey,
    paidJobsMergedForKey: mergedScopes.has('paid') ? jobsListDataKey : null,
    jobsListError,
    setJobsListError,
    runFetchJobs,
    fetchPaidJobsIfNeeded,
    headerStats,
    leanBilledRows,
    refreshHeaderStats,
    mergedScopes,
    scopeLoading,
    fetchScopeIfNeeded,
    runFetchScopes,
    refreshMergedScopes,
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
