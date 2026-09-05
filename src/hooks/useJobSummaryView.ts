import { useCallback, useEffect, useMemo, useState } from 'react'
import { denverCalendarDayKey, ymdAddDays } from '../utils/dateUtils'
import { loadJobDayLedger } from '../lib/jobs/loadJobDayLedger'
import { deserializeJobDayLedger, serializeJobDayLedger, type JobDayLedger, type JobDayLedgerSerialized, type JobOverheadMethod } from '../lib/jobs/jobDayLedger'
import {
  JOB_SUMMARY_VIEW_STORAGE_KEY,
  compareJobSummaryTotals,
  enrichJobSummaryRows,
  filterAndSortJobSummaryRows,
  groupJobSummaryRows,
  jobSummaryConcentration,
  jobSummaryCompareWindow,
  jobSummaryHygiene,
  jobSummaryWindowStartYmd,
  readJobSummaryViewPrefs,
  summarizeJobSummaryRows,
  type JobSummaryComparison,
  type JobSummaryConcentration,
  type JobSummaryEnrichedRow,
  type JobSummaryGroup,
  type JobSummaryHygiene,
  type JobSummaryLedgerRowInput,
  type JobSummarySortKey,
  type JobSummaryTotals,
  type JobSummaryViewPrefs,
} from '../lib/jobs/jobSummaryLedgerView'

/**
 * Job Summary view state (v2.2692): per-device prefs (status / window /
 * overhead method / sort), the job day ledger for the window behind a
 * one-hour per-user, per-company-day sessionStorage cache (the Dashboard
 * Overhead card's pattern), and the enriched + filtered + sorted rows with
 * totals. Lives page-side so `JobsJobSummaryTab` stays presentational.
 */
export type JobSummaryViewBundle<R extends JobSummaryLedgerRowInput> = {
  prefs: JobSummaryViewPrefs
  setPrefs: (patch: Partial<JobSummaryViewPrefs>) => void
  /** Click a column header: same key flips direction, a new key starts descending (job # starts ascending). */
  toggleSort: (key: JobSummarySortKey) => void
  startYmd: string
  endYmd: string
  ledger: JobDayLedger | null
  ledgerLoading: boolean
  ledgerError: string | null
  reloadLedger: () => void
  rows: JobSummaryEnrichedRow<R>[]
  totals: JobSummaryTotals
  hygiene: JobSummaryHygiene | null
  /** Compare to (v2.2817): the second window's totals and the deltas; null when the chip is off or the window is "All". */
  compare: JobSummaryCompareBundle | null
  /** Cut by (v2.2820): the visible rows grouped and ranked; empty when the cut is "none". */
  groups: JobSummaryGroup<R>[]
  concentration: JobSummaryConcentration
}

export type JobSummaryCompareBundle = {
  startYmd: string
  endYmd: string
  /** The compare window's visible rows and ledger, for views that rebuild their own series (Months, v2.2821). */
  rows: JobSummaryEnrichedRow[]
  ledger: JobDayLedger | null
  totals: JobSummaryTotals
  comparison: JobSummaryComparison
  /** The compare window's true margin per Cut by group key (v2.2820). */
  trueMarginPctByGroupKey: ReadonlyMap<string, number | null>
  ledgerLoading: boolean
  ledgerError: string | null
}

type CacheEntry = { cachedAtMs: number; ledger: JobDayLedgerSerialized }
const CACHE_TTL_MS = 60 * 60 * 1000

function cacheKey(userId: string, startYmd: string, endYmd: string): string {
  return `jobDayLedger:v4:${userId}:${startYmd}:${endYmd}`
}

/** One window's day ledger behind the sessionStorage cache; `enabled` false keeps it idle and null. */
function useJobDayLedgerWindow(args: { enabled: boolean; userId: string | undefined; startYmd: string; endYmd: string; reloadTick: number }): {
  ledger: JobDayLedger | null
  loading: boolean
  error: string | null
} {
  const { enabled, userId, startYmd, endYmd, reloadTick } = args
  const [ledger, setLedger] = useState<JobDayLedger | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false
    const key = cacheKey(userId, startYmd, endYmd)
    if (reloadTick === 0) {
      try {
        const raw = sessionStorage.getItem(key)
        if (raw) {
          const entry = JSON.parse(raw) as CacheEntry
          if (Date.now() - entry.cachedAtMs < CACHE_TTL_MS) {
            setLedger(deserializeJobDayLedger(entry.ledger))
            setError(null)
            return
          }
        }
      } catch {
        /* storage unavailable or corrupt — live load */
      }
    }
    setLoading(true)
    setError(null)
    void loadJobDayLedger({ startYmd, endYmd, isCancelled: () => cancelled })
      .then((l) => {
        if (cancelled || !l) return
        setLedger(l)
        try {
          const entry: CacheEntry = { cachedAtMs: Date.now(), ledger: serializeJobDayLedger(l) }
          sessionStorage.setItem(key, JSON.stringify(entry))
        } catch {
          /* per-session nicety only */
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, userId, startYmd, endYmd, reloadTick])
  // A ledger for a different window than asked for is stale — hide it rather
  // than charge last window's days to this window's jobs.
  const forWindow = enabled && ledger && ledger.startYmd === startYmd && ledger.endYmd === endYmd ? ledger : null
  return { ledger: forWindow, loading: enabled ? loading : false, error: enabled ? error : null }
}

export function useJobSummaryView<R extends JobSummaryLedgerRowInput & { job: { job_address?: string | null } }>(args: {
  enabled: boolean
  userId: string | undefined
  rows: readonly R[]
  reportPctByJobId: ReadonlyMap<string, number>
  search: string
  /** master_user_id → name, for the "lead tech" cut (v2.2820). */
  userNameById?: ReadonlyMap<string, string | null | undefined>
  /** `?view=` from the URL (v2.2825): a deep link into one view; applied once, then the pref owns it. */
  initialView?: string | null
}): JobSummaryViewBundle<R> {
  const { enabled, userId, rows, reportPctByJobId, search, userNameById, initialView } = args
  const [prefs, setPrefsState] = useState<JobSummaryViewPrefs>(() => {
    try {
      return readJobSummaryViewPrefs(localStorage.getItem(JOB_SUMMARY_VIEW_STORAGE_KEY))
    } catch {
      return readJobSummaryViewPrefs(null)
    }
  })
  const setPrefs = useCallback((patch: Partial<JobSummaryViewPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(JOB_SUMMARY_VIEW_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* per-device nicety only */
      }
      return next
    })
  }, [])
  useEffect(() => {
    const v = readJobSummaryViewPrefs(JSON.stringify({ view: initialView })).view
    if (initialView && v === initialView) setPrefs({ view: v })
  }, [initialView, setPrefs])
  const toggleSort = useCallback(
    (key: JobSummarySortKey) => {
      setPrefsState((prev) => {
        const next: JobSummaryViewPrefs =
          prev.sortKey === key
            ? { ...prev, sortDir: prev.sortDir === 'desc' ? 'asc' : 'desc' }
            : { ...prev, sortKey: key, sortDir: key === 'job' ? 'asc' : 'desc' }
        try {
          localStorage.setItem(JOB_SUMMARY_VIEW_STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* per-device nicety only */
        }
        return next
      })
    },
    [],
  )

  const endYmd = denverCalendarDayKey(Date.now())
  const startYmd = jobSummaryWindowStartYmd(endYmd, prefs.window, ymdAddDays)

  const [reloadTick, setReloadTick] = useState(0)
  const reloadLedger = useCallback(() => setReloadTick((n) => n + 1), [])
  const main = useJobDayLedgerWindow({ enabled, userId, startYmd, endYmd, reloadTick })
  const ledgerForWindow = main.ledger
  const ledgerLoading = main.loading
  const ledgerError = main.error

  // Compare to (v2.2817): a second window, loaded the same way, only while the chip is on.
  const compareWindow = useMemo(() => jobSummaryCompareWindow(startYmd, endYmd, prefs.compareTo, prefs.window, ymdAddDays), [startYmd, endYmd, prefs.compareTo, prefs.window])
  const cmp = useJobDayLedgerWindow({ enabled: enabled && compareWindow != null, userId, startYmd: compareWindow?.startYmd ?? startYmd, endYmd: compareWindow?.endYmd ?? endYmd, reloadTick })

  const method: JobOverheadMethod = prefs.method
  const enriched = useMemo(
    () => enrichJobSummaryRows({ rows, reportPctByJobId, ledger: ledgerForWindow, method }),
    [rows, reportPctByJobId, ledgerForWindow, method],
  )
  const visible = useMemo(
    () => filterAndSortJobSummaryRows({ rows: enriched, prefs, search, startYmd, endYmd }),
    [enriched, prefs, search, startYmd, endYmd],
  )
  const totals = useMemo(() => summarizeJobSummaryRows(visible), [visible])
  const hygiene = useMemo(() => jobSummaryHygiene(ledgerForWindow), [ledgerForWindow])

  const cutCtx = useMemo(() => ({ userNameById }), [userNameById])
  const groups = useMemo(() => groupJobSummaryRows(visible, prefs.cutBy, cutCtx), [visible, prefs.cutBy, cutCtx])
  const concentration = useMemo(() => jobSummaryConcentration(groups), [groups])

  const compare = useMemo<JobSummaryCompareBundle | null>(() => {
    if (!compareWindow) return null
    const enrichedPrior = enrichJobSummaryRows({ rows, reportPctByJobId, ledger: cmp.ledger, method })
    const visiblePrior = filterAndSortJobSummaryRows({ rows: enrichedPrior, prefs, search, startYmd: compareWindow.startYmd, endYmd: compareWindow.endYmd })
    const priorTotals = summarizeJobSummaryRows(visiblePrior)
    const trueMarginPctByGroupKey = new Map(groupJobSummaryRows(visiblePrior, prefs.cutBy, cutCtx).map((g) => [g.key, g.totals.trueMarginPct]))
    return { ...compareWindow, rows: visiblePrior, ledger: cmp.ledger, totals: priorTotals, comparison: compareJobSummaryTotals(totals, priorTotals), trueMarginPctByGroupKey, ledgerLoading: cmp.loading, ledgerError: cmp.error }
  }, [compareWindow, rows, reportPctByJobId, cmp.ledger, cmp.loading, cmp.error, method, prefs, search, totals, cutCtx])

  return { prefs, setPrefs, toggleSort, startYmd, endYmd, ledger: ledgerForWindow, ledgerLoading, ledgerError, reloadLedger, rows: visible, totals, hygiene, compare, groups, concentration }
}
