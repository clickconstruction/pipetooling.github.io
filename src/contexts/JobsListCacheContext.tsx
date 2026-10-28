import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchJobsLedgerStagesPrimary, fetchJobsLedgerWithDetailsForStages, fetchStagesEnrichment, primaryRowToJobWithDetails } from '../lib/fetchJobsLedgerWithDetailsForStages'
import { fetchStagesHeaderStats } from '../lib/jobs/fetchStagesHeaderStats'
import { withoutZzTestJobs, zzTestJobIds } from '../lib/jobs/zzTestJobVisibility'
import { useZzTestJobsHidden } from '../lib/jobs/zzTestJobSwitch'
import { mergeScopedRows, NON_PAID_SCOPES, type JobsBoardScope } from '../lib/jobs/boardScopes'
import { applyStagesEnrichment, patchJobsById } from '../lib/jobs/stagesEnrichment'
import { boardIsFreshForTab } from '../lib/jobs/boardRefetchTtl'
import { useKeptRead } from '../hooks/useKeptRead'
import { buildKeptReadKey } from '../lib/keptRead'
import type { StagesHeaderStats } from '../lib/jobs/stagesHeaderStats'
import type { StageRow } from '../lib/jobsStagesBoard'
import type { JobWithDetails } from '../types/jobWithDetails'

const VISIBILITY_REFETCH_MIN_MS = 30_000
/** The kept read's page name (#183 PR 2, v2.6031): the key is the user, this, and the customer filter. */
const KEPT_READ_PAGE = 'pipeline'
/** Never kept: hundreds of rows the board loads lazily anyway (v2.3610). */
const notPaidScope = (s: JobsBoardScope) => s !== 'paid'
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
   * v2.3610 (Pipeline load speed PR 4): when the rows on screen are the board this device kept
   * from an earlier visit, the epoch ms they were read; null once the live board lands (or when
   * nothing was kept). The Stages tab mutes money and holds row buttons while it is set
   * (`data-kept-read`). Since v2.6031 the kept read comes through `useKeptRead` (#183 PR 2), the
   * one hook every page that keeps its last read uses.
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
  /**
   * The ZZ test jobs the cache holds, shown or not (punch list #61, v2.5120). Only a dev ever sees
   * them, so only a dev's Pipeline reads it: the chip that says how many are hidden.
   */
  zzTestJobCount: number
}

const JobsListCacheContext = createContext<JobsListCacheContextValue | null>(null)

export function JobsListCacheProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth()
  /**
   * Punch list #61 (v2.5116): ZZ test jobs are hidden from every role but dev, and from a dev too
   * unless their switch shows them (v2.5120, `zzTestJobSwitch.ts`). State keeps every row the reads
   * return; the rule runs where the cache hands rows out (`jobs` below and runFetchJobs' result), so
   * the remembered board, each scope merge, the full fetch and the enrichment patch all pass it, a
   * dev whose role lands late still gets the rows, and a flip of the switch needs no read.
   */
  const hideZz = useZzTestJobsHidden(role)
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [jobsListLoading, setJobsListLoading] = useState(true)
  const [jobsListEnriching, setJobsListEnriching] = useState(false)
  const [jobsListRefreshing, setJobsListRefreshing] = useState(false)
  const [jobsListError, setJobsListError] = useState<string | null>(null)
  /** The customer filter of the load in flight or landed last (undefined before the first), for the kept read's key. */
  const [loadFilter, setLoadFilter] = useState<string | null | undefined>(undefined)
  /** The scopes the load in flight wants, for the kept read: one that does not cover them is not shown. */
  const [wantedScopes, setWantedScopes] = useState<readonly JobsBoardScope[]>(NON_PAID_SCOPES)
  const [scopeLoading, setScopeLoading] = useState<ReadonlySet<JobsBoardScope>>(() => new Set())
  const [jobsListDataKey, setJobsListDataKey] = useState<string | null>(null)
  const [mergedScopes, setMergedScopes] = useState<ReadonlySet<JobsBoardScope>>(() => new Set())
  /**
   * The kept read (#183 PR 2, v2.6031): the remembered board of v2.3610 through the one hook every
   * page that keeps its last read uses. While a load for a filter this session has not landed
   * runs, the hook hands back the rows this device kept for it with their `readAt`, and the values
   * handed out below read as the board always did: the kept rows, loading off, refreshing on, the
   * kept scopes merged, `jobsListSnapshotAt` set. Only the handed-out values change — the refs that
   * gate scope fetches and the tab TTL stay untouched, so nothing treats the kept rows as a
   * completed load. Once every read landed (the enrichment too, so a half board is never kept) the
   * hook writes the rows back; a failed live read leaves the kept rows up, as before. The paid
   * scope and its rows are never kept.
   */
  const keptKey = user?.id && loadFilter !== undefined ? buildKeptReadKey(user.id, KEPT_READ_PAGE, loadFilter) : null
  const rowsToKeep = useMemo(() => jobs.filter((j) => (j.status ?? 'working') !== 'paid'), [jobs])
  const wantedKeptScopes = useMemo(() => wantedScopes.filter(notPaidScope), [wantedScopes])
  const coveredKeptScopes = useMemo(() => [...mergedScopes].filter(notPaidScope), [mergedScopes])
  const kept = useKeptRead<JobWithDetails>(keptKey, rowsToKeep, {
    loading: jobsListLoading || jobsListRefreshing || jobsListEnriching,
    scopes: wantedKeptScopes,
    covers: coveredKeptScopes,
    failed: jobsListError != null,
    rowIsValid: (row) => typeof (row as { id?: unknown } | null)?.id === 'string',
  })
  const jobsListSnapshotAt = kept.readAt
  const showingKept = jobsListSnapshotAt != null && kept.rows != null
  const boardJobs = showingKept ? (kept.rows as JobWithDetails[]) : jobs
  const visibleJobs = useMemo(() => (hideZz ? withoutZzTestJobs(boardJobs) : boardJobs), [boardJobs, hideZz])
  const zzTestJobCount = useMemo(() => zzTestJobIds(boardJobs).size, [boardJobs])
  const keptScopes = useMemo<ReadonlySet<JobsBoardScope>>(
    () => (showingKept && kept.scopes ? new Set(kept.scopes as JobsBoardScope[]) : mergedScopes),
    [showingKept, kept.scopes, mergedScopes],
  )
  const [headerStats, setHeaderStats] = useState<StagesHeaderStats | null>(null)
  const [leanBilledRows, setLeanBilledRows] = useState<StageRow[] | null>(null)
  const headerStatsInFlightRef = useRef(false)
  /** The customer filter of the last stats read, so a flip of the dev's ZZ switch can read them again. */
  const lastStatsFilterRef = useRef<string | null | undefined>(undefined)
  /** The ZZ choice now, read when a stats read lands: one begun under the other choice is dropped and read again. */
  const hideZzRef = useRef(hideZz)
  hideZzRef.current = hideZz
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
      // The kept read's key and wants (v2.6031): a filter not landed this session paints what this device kept.
      setLoadFilter(customerFilter)
      setWantedScopes(scopes)
      if (hasLoadedThisKey && !hadDifferentKey) setJobsListRefreshing(true)
      else setJobsListLoading(true)
      setJobsListError(null)
      // v2.3600: the board paints from the primary rows; the enrichment lands after the
      // flags clear, so the first paint no longer waits for the four passes.
      let painted: JobWithDetails[] | null = null
      try {
        const results = await Promise.all(
          scopes.map((scope) => fetchJobsLedgerStagesPrimary({ customerFilter, statusScope: scope })),
        )
        const firstError = results.find((r) => !r.ok)
        if (firstError && !firstError.ok) {
          setJobsListError(firstError.error)
          return
        }
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
      // The kept read is written when the enrichment lands (`useKeptRead`'s loading edge), so the
      // stored rows carry materials, fixtures, schedule date and estimate banner (v2.3610).
      if (painted && painted.length > 0) await enrichPaintedRows(painted, key)
    },
    [user?.id, enrichPaintedRows],
  )

  const refreshHeaderStats = useCallback(
    async (customerFilter: string | null, options?: { force?: boolean }): Promise<void> => {
      if (!user?.id) return
      lastStatsFilterRef.current = customerFilter
      if (headerStatsInFlightRef.current) return
      // Fresh-enough guard (v2.1917): the load/visibility piggyback callers
      // refire after every board fetch; stats only need to move when data
      // moved, so within the TTL only forced (post-mutation) refreshes run.
      const key = `${user.id}|${customerFilter ?? ''}|${hideZz ? 'no-zz' : 'zz'}`
      const last = headerStatsLastFetchRef.current
      if (!options?.force && last != null && last.key === key && Date.now() - last.at < HEADER_STATS_TTL_MS) {
        return
      }
      headerStatsInFlightRef.current = true
      // A flip of the dev's ZZ switch while this read is out (review on #5241): its answer is the old
      // choice's, so it is dropped and read again under the new one.
      let flippedMeanwhile = false
      try {
        const res = await fetchStagesHeaderStats(customerFilter, undefined, { excludeZzTestJobs: hideZz })
        flippedMeanwhile = hideZzRef.current !== hideZz
        if (res.ok && !flippedMeanwhile) {
          headerStatsLastFetchRef.current = { key, at: Date.now() }
          setHeaderStats(res.stats)
          setLeanBilledRows(res.leanBilledRows)
        }
      } finally {
        headerStatsInFlightRef.current = false
        if (flippedMeanwhile) void refreshHeaderStatsRef.current?.(customerFilter)
      }
    },
    [user?.id, hideZz],
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
      setLoadFilter(customerFilter)
      setWantedScopes(NON_PAID_SCOPES)
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
        mergedScopesRef.current = new Set(NON_PAID_SCOPES)
        setMergedScopes(new Set(mergedScopesRef.current))
        setJobs(first.jobs)
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

        return hideZz ? withoutZzTestJobs(first.jobs) : first.jobs
      } finally {
        loadInFlightRef.current = false
        if (pendingRef.current) {
          const next = pendingRef.current
          pendingRef.current = null
          void runFetchJobsRef.current?.(next.customerFilter, { kind: next.kind })
        }
      }
    },
    [user?.id, hideZz],
  )
  runFetchJobsRef.current = runFetchJobs
  refreshHeaderStatsRef.current = refreshHeaderStats
  runFetchScopesRef.current = runFetchScopes

  // A dev's flip of the ZZ switch (v2.5120): the rows follow on their own; the strip's stats are read
  // again under the new key (it carries the choice, so the freshness guard lets it through).
  const zzSwitchSeenRef = useRef(hideZz)
  useEffect(() => {
    if (zzSwitchSeenRef.current === hideZz) return
    zzSwitchSeenRef.current = hideZz
    if (lastStatsFilterRef.current === undefined) return
    void refreshHeaderStatsRef.current?.(lastStatsFilterRef.current)
  }, [hideZz])

  // Reset when auth user id changes (the kept reads are cleared by AuthProvider, v2.6031)
  useEffect(() => {
    if (!user?.id) {
      setJobs([])
      setJobsListLoading(true)
      setJobsListRefreshing(false)
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
    jobs: visibleJobs,
    setJobs,
    // While the kept rows show (v2.3610 / v2.6031): loading off, refreshing on until the live read settles.
    jobsListLoading: showingKept ? false : jobsListLoading,
    jobsListEnriching,
    jobsListRefreshing: showingKept ? jobsListLoading || jobsListRefreshing : jobsListRefreshing,
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
    mergedScopes: keptScopes,
    scopeLoading,
    fetchScopeIfNeeded,
    runFetchScopes,
    refreshMergedScopes,
    zzTestJobCount,
  }

  return <JobsListCacheContext.Provider value={value}>{children}</JobsListCacheContext.Provider>
}

/** The cache when a provider is above, else null: for a hook a surface mounts both inside the app and in a window without the provider (v2.5758). */
export function useOptionalJobsListCache(): JobsListCacheContextValue | null {
  return useContext(JobsListCacheContext)
}

export function useJobsListCache(): JobsListCacheContextValue {
  const ctx = useContext(JobsListCacheContext)
  if (!ctx) {
    throw new Error('useJobsListCache must be used within JobsListCacheProvider')
  }
  return ctx
}
