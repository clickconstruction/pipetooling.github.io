import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { recordNavClick } from '../lib/navClickTelemetry'
import { denverCalendarDayKey, ymdAddDays } from '../utils/dateUtils'
import { loadJobDayLedger } from '../lib/jobs/loadJobDayLedger'
import type { JobDayLedger, JobOverheadMethod } from '../lib/jobs/jobDayLedger'
import { jobDayLedgerCacheKey, loadJobDayLedgerCached, readCachedJobDayLedger } from '../lib/jobs/jobDayLedgerSessionCache'
import { buildOverheadAllocation, overheadAllocationSettingsEqual, type OverheadAllocation, type OverheadAllocationSettings } from '../lib/jobs/overheadAllocation'
import { useOverheadAllocationSettings } from './useOverheadAllocationSettings'
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
  jobSummaryRowsHiddenByStatus
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
  /** Every enriched row before the Show / window / search filters (v2.2830, the Ahead view's open jobs). */
  allRows: JobSummaryEnrichedRow<R>[]
  totals: JobSummaryTotals
  /** Rows the search finds that the Show chip hides (v2.3178). */
  hiddenByStatus: number
  hygiene: JobSummaryHygiene | null
  /** Compare to (v2.2817): the second window's totals and the deltas; null when the chip is off or the window is "All". */
  compare: JobSummaryCompareBundle | null
  /** Cut by (v2.2820): the visible rows grouped and ranked; empty when the cut is "none". */
  groups: JobSummaryGroup<R>[]
  concentration: JobSummaryConcentration
  /** The overhead allocation in force (v2.3259): the dev's per-device dials when set, else the app default. */
  overhead: JobSummaryOverheadBundle
}

export type JobSummaryOverheadBundle = {
  settings: OverheadAllocationSettings
  appDefault: OverheadAllocationSettings
  /** True while this device explores settings other than the app default. */
  isOverride: boolean
  appDefaultLoaded: boolean
  saving: boolean
  /** Explore on this device only (null = back to the app default). */
  explore: (s: OverheadAllocationSettings | null) => void
  /** Write the app default for everyone (devs; RLS enforces) and stop exploring. */
  saveAppDefault: (s: OverheadAllocationSettings) => Promise<void>
  /** The window's allocation under the settings in force (v2.3260): per-day landings for the Days view. Null until the ledger loads. */
  allocation: OverheadAllocation | null
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
    // The session cache is shared with the job window's Costs tab (v2.3289); a forced reload skips the read.
    if (reloadTick === 0) {
      const hit = readCachedJobDayLedger(jobDayLedgerCacheKey(userId, startYmd, endYmd))
      if (hit) {
        setLedger(hit)
        setError(null)
        return
      }
    }
    setLoading(true)
    setError(null)
    void loadJobDayLedgerCached({ userId, startYmd, endYmd, bypassRead: true, load: () => loadJobDayLedger({ startYmd, endYmd }) })
      .then((l) => {
        if (cancelled || !l) return
        setLedger(l)
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
  /** Viewer role, for the open telemetry row (v2.2852). */
  role?: string | null
  rows: readonly R[]
  reportPctByJobId: ReadonlyMap<string, number>
  search: string
  /** master_user_id → name, for the "lead tech" cut (v2.2820). */
  userNameById?: ReadonlyMap<string, string | null | undefined>
  /** `?view=` from the URL (v2.2825): a deep link into one view; applied once, then the pref owns it. */
  initialView?: string | null
}): JobSummaryViewBundle<R> {
  const { enabled, userId, role, rows, reportPctByJobId, search, userNameById, initialView } = args
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
  // Overhead allocation (v2.3259): the app default for everyone; a dev may explore other settings on this device.
  const overheadApp = useOverheadAllocationSettings(enabled)
  const overheadSettings = prefs.overheadDials ?? overheadApp.appDefault
  const overheadIsOverride = prefs.overheadDials != null && !overheadAllocationSettingsEqual(prefs.overheadDials, overheadApp.appDefault)
  const explore = useCallback((s: OverheadAllocationSettings | null) => setPrefs({ overheadDials: s }), [setPrefs])
  const saveAppDefault = useCallback(
    async (s: OverheadAllocationSettings) => {
      await overheadApp.saveAppDefault(s)
      setPrefs({ overheadDials: null })
    },
    [overheadApp, setPrefs],
  )
  const allocation = useMemo(() => (ledgerForWindow ? buildOverheadAllocation(ledgerForWindow, overheadSettings) : null), [ledgerForWindow, overheadSettings])
  const overhead = useMemo<JobSummaryOverheadBundle>(
    () => ({ settings: overheadSettings, appDefault: overheadApp.appDefault, isOverride: overheadIsOverride, appDefaultLoaded: overheadApp.loaded, saving: overheadApp.saving, explore, saveAppDefault, allocation }),
    [overheadSettings, overheadApp.appDefault, overheadApp.loaded, overheadApp.saving, overheadIsOverride, explore, saveAppDefault, allocation],
  )
  const enriched = useMemo(
    () => enrichJobSummaryRows({ rows, reportPctByJobId, ledger: ledgerForWindow, method, targetMarginPct: prefs.targetTrueMarginPct, settings: overheadSettings }),
    [rows, reportPctByJobId, ledgerForWindow, method, prefs.targetTrueMarginPct, overheadSettings],
  )
  const visible = useMemo(
    () => filterAndSortJobSummaryRows({ rows: enriched, prefs, search, startYmd, endYmd }),
    [enriched, prefs, search, startYmd, endYmd],
  )
  const totals = useMemo(() => summarizeJobSummaryRows(visible), [visible])
  // v2.3178: rows the search finds but the Show chip hides — the empty state names them.
  const hiddenByStatus = useMemo(
    () => jobSummaryRowsHiddenByStatus({ rows: enriched, prefs, search, startYmd, endYmd }),
    [enriched, prefs, search, startYmd, endYmd],
  )
  // Telemetry (v2.2852, journey-map Tier-1 #5): one `job-summary-view` row per open, naming the
  // status filter and whether the view opened on earned or contract revenue — so the next pass
  // on "% done" / earned revenue rides on what people actually open. Fire-and-forget.
  const openRecordedRef = useRef(false)
  useEffect(() => {
    if (!enabled) {
      openRecordedRef.current = false
      return
    }
    if (openRecordedRef.current || rows.length === 0) return
    openRecordedRef.current = true
    recordNavClick(userId, role ?? null, 'job-summary-view', `/jobs?tab=job-summary&status=${prefs.status}&revenue=${totals.earnedRows > 0 ? 'earned' : 'contract'}`)
  }, [enabled, userId, role, rows.length, prefs.status, totals.earnedRows])
  // The jobs this list holds (after the HCP # floor); overhead landed on any other job is reported, not hidden (v2.3266).
  const listedJobIds = useMemo(() => new Set(rows.map((r) => r.job.id)), [rows])
  const hygiene = useMemo(() => jobSummaryHygiene(ledgerForWindow, overheadSettings, listedJobIds), [ledgerForWindow, overheadSettings, listedJobIds])

  const cutCtx = useMemo(() => ({ userNameById }), [userNameById])
  const groups = useMemo(() => groupJobSummaryRows(visible, prefs.cutBy, cutCtx), [visible, prefs.cutBy, cutCtx])
  const concentration = useMemo(() => jobSummaryConcentration(groups), [groups])

  const compare = useMemo<JobSummaryCompareBundle | null>(() => {
    if (!compareWindow) return null
    const enrichedPrior = enrichJobSummaryRows({ rows, reportPctByJobId, ledger: cmp.ledger, method, targetMarginPct: prefs.targetTrueMarginPct, settings: overheadSettings })
    const visiblePrior = filterAndSortJobSummaryRows({ rows: enrichedPrior, prefs, search, startYmd: compareWindow.startYmd, endYmd: compareWindow.endYmd })
    const priorTotals = summarizeJobSummaryRows(visiblePrior)
    const trueMarginPctByGroupKey = new Map(groupJobSummaryRows(visiblePrior, prefs.cutBy, cutCtx).map((g) => [g.key, g.totals.trueMarginPct]))
    return { ...compareWindow, rows: visiblePrior, ledger: cmp.ledger, totals: priorTotals, comparison: compareJobSummaryTotals(totals, priorTotals), trueMarginPctByGroupKey, ledgerLoading: cmp.loading, ledgerError: cmp.error }
  }, [compareWindow, rows, reportPctByJobId, cmp.ledger, cmp.loading, cmp.error, method, prefs, search, totals, cutCtx, overheadSettings])

  return { prefs, setPrefs, toggleSort, startYmd, endYmd, ledger: ledgerForWindow, ledgerLoading, ledgerError, reloadLedger, rows: visible, allRows: enriched, totals, hiddenByStatus, hygiene, compare, groups, concentration, overhead }
}
