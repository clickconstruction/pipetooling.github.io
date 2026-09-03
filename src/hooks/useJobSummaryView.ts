import { useCallback, useEffect, useMemo, useState } from 'react'
import { denverCalendarDayKey, ymdAddDays } from '../utils/dateUtils'
import { loadJobDayLedger } from '../lib/jobs/loadJobDayLedger'
import { deserializeJobDayLedger, serializeJobDayLedger, type JobDayLedger, type JobDayLedgerSerialized, type JobOverheadMethod } from '../lib/jobs/jobDayLedger'
import {
  JOB_SUMMARY_VIEW_STORAGE_KEY,
  enrichJobSummaryRows,
  filterAndSortJobSummaryRows,
  jobSummaryHygiene,
  jobSummaryWindowStartYmd,
  readJobSummaryViewPrefs,
  summarizeJobSummaryRows,
  type JobSummaryEnrichedRow,
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
}

type CacheEntry = { cachedAtMs: number; ledger: JobDayLedgerSerialized }
const CACHE_TTL_MS = 60 * 60 * 1000

function cacheKey(userId: string, startYmd: string, endYmd: string): string {
  return `jobDayLedger:v2:${userId}:${startYmd}:${endYmd}`
}

export function useJobSummaryView<R extends JobSummaryLedgerRowInput & { job: { job_address?: string | null } }>(args: {
  enabled: boolean
  userId: string | undefined
  rows: readonly R[]
  reportPctByJobId: ReadonlyMap<string, number>
  search: string
}): JobSummaryViewBundle<R> {
  const { enabled, userId, rows, reportPctByJobId, search } = args
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

  const [ledger, setLedger] = useState<JobDayLedger | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const reloadLedger = useCallback(() => setReloadTick((n) => n + 1), [])

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
            setLedgerError(null)
            return
          }
        }
      } catch {
        /* storage unavailable or corrupt — live load */
      }
    }
    setLedgerLoading(true)
    setLedgerError(null)
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
        if (!cancelled) setLedgerError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLedgerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, userId, startYmd, endYmd, reloadTick])

  // A ledger for a different window than the current prefs is stale — hide it
  // rather than charge last window's days to this window's jobs.
  const ledgerForWindow = ledger && ledger.startYmd === startYmd && ledger.endYmd === endYmd ? ledger : null

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

  return { prefs, setPrefs, toggleSort, startYmd, endYmd, ledger: ledgerForWindow, ledgerLoading, ledgerError, reloadLedger, rows: visible, totals, hygiene }
}
