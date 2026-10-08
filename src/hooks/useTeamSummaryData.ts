import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { PayConfigRow } from '../types/peoplePayConfig'
import type { ReviewPeriod } from '../lib/people/reviewDateRange'
import type { ReviewOverheadRates } from '../lib/people/loadReviewOverheadRates'
import type { CategoryTagLookups } from '../lib/banking/categoryTags'
import { buildTeamSummaryCacheKey } from '../lib/people/teamSummaryCacheKey'
import { loadTeamReviewUnion } from '../lib/people/loadTeamReviewUnion'
import { derivePersonTeamSummary } from '../lib/people/derivePersonTeamSummary'
import { buildTeamSummaryHtml } from '../lib/peopleDocuments/buildTeamSummaryHtml'
import type { TeamSummaryInlineHandle } from '../components/people/teamSummary/TeamSummaryInline'
import { enrichTeamSummaryRowsForInline, payConfigSourceFor, splitPartsRate } from '../components/people/teamSummary/formatters'
import type { TeamSummaryRow } from '../components/people/teamSummary/types'
import type { UserRow } from './usePeopleRoster'

export interface UseTeamSummaryDataInput {
  isDev: boolean
  payConfig: Record<string, PayConfigRow>
  users: UserRow[]
  /** The tab's roster: one Team Summary row per name, in this order. */
  showPeopleForReview: string[]
  reviewPeriod: ReviewPeriod
  reviewCustomRangeStart: string
  reviewCustomRangeEnd: string
  reviewOnlyPaidInFull: boolean
  /** Read only by the popup's embedded-only highlight, which never runs (preserved). */
  selectedReviewPersonIndex: number
  reviewOverheadRates: ReviewOverheadRates
  categoryTags: { lookups: CategoryTagLookups }
  /** The tab's period, on the company calendar day. */
  getReviewDateRange: () => [string, string]
  getReviewPeriodLabel: () => string
  getDaysInRange: (start: string, end: string) => string[]
  showToast: (text: string, variant: 'success' | 'error' | 'info' | 'warning') => void
  // The page's Review ↔ Hours bridge (People.tsx owns them; the Hours tab and the day editor read them too).
  teamSummaryInlineRef: MutableRefObject<TeamSummaryInlineHandle | null>
  teamSummaryDataCacheRef: MutableRefObject<{ rows: TeamSummaryRow[]; cacheKey: string } | null>
  teamSummaryModalOpenRef: MutableRefObject<boolean>
  teamSummaryRefreshPendingRef: MutableRefObject<boolean>
  reviewHoursReopenAfterLoadRef: MutableRefObject<string | null>
  teamSummaryDrainTick: number
}

/**
 * The People Review tab's Team Summary rows (region C, the PEOPLE_REVIEW_TAB map's step 9): the
 * rows the table and the ranked view draw, their loading and error, the auto-refresh that reloads
 * them 200 ms after the period, the paid-only switch, the roster, the pay config or the rates
 * change, and `openTeamSummaryWindow` — the inline load, and the Open in new window popup that
 * reuses the inline rows through the page's cache. Moved verbatim from `PeopleReviewTab`; the
 * page's bridge refs and drain tick come in as inputs, so the drilldown deferral is unchanged.
 */
export function useTeamSummaryData({
  isDev,
  payConfig,
  users,
  showPeopleForReview,
  reviewPeriod,
  reviewCustomRangeStart,
  reviewCustomRangeEnd,
  reviewOnlyPaidInFull,
  selectedReviewPersonIndex,
  reviewOverheadRates,
  categoryTags,
  getReviewDateRange,
  getReviewPeriodLabel,
  getDaysInRange,
  showToast,
  teamSummaryInlineRef,
  teamSummaryDataCacheRef,
  teamSummaryModalOpenRef,
  teamSummaryRefreshPendingRef,
  reviewHoursReopenAfterLoadRef,
  teamSummaryDrainTick,
}: UseTeamSummaryDataInput) {
  // Inline Team Summary (React component) — rows fetched by
  // `openTeamSummaryWindow('inline')` are stored here and the
  // `<TeamSummaryInline>` component renders directly from them (no
  // iframe, no HTML string). The popup path still builds an HTML doc
  // because a `window.open()` target needs a standalone document.
  const [teamSummaryRows, setTeamSummaryRows] = useState<TeamSummaryRow[] | null>(null)
  const [teamSummaryLoading, setTeamSummaryLoading] = useState<boolean>(false)
  const [teamSummaryError, setTeamSummaryError] = useState<string | null>(null)
  const teamSummaryReqIdRef = useRef(0)

  // The 90-day rates through a ref: the popup path reads rates inside a
  // `.then()` that resolves seconds after the click — reading through this
  // ref (instead of the click-time closure) picks up a rate that finished
  // loading while the row fetch was in flight, so a popup opened during
  // the rate load no longer renders permanently rate-less.
  const reviewOverheadRatesRef = useRef(reviewOverheadRates)
  reviewOverheadRatesRef.current = reviewOverheadRates

  useEffect(() => {
    if (!isDev) return
    // Any dep change invalidates the popup's cache (rows would be stale).
    // `loadTeamSummaryData().then(...)` below re-populates it on success.
    // While the load is in flight the popup path falls back to a fresh
    // fetch (pre-v2.542 behavior), avoiding stale-cache hits.
    teamSummaryDataCacheRef.current = null
    if (showPeopleForReview.length === 0) {
      teamSummaryReqIdRef.current += 1
      setTeamSummaryRows(null)
      setTeamSummaryError(null)
      setTeamSummaryLoading(false)
      teamSummaryRefreshPendingRef.current = false
      return
    }
    if (Object.keys(payConfig).length === 0) return
    // Custom range with a half-finished pair shouldn't trigger a load — it's
    // pretty common to type one date and not the other for a moment, and we
    // don't want to thrash the network or temporarily collapse to "today".
    if (
      reviewPeriod === 'custom' &&
      (!reviewCustomRangeStart || !reviewCustomRangeEnd)
    ) {
      return
    }
    // Drilldown protection: if a drilldown is open over the Team Summary,
    // defer the rebuild until the user closes it. We mark pending and the
    // page's close handler bumps `teamSummaryDrainTick` to re-run this effect.
    if (teamSummaryModalOpenRef.current) {
      teamSummaryRefreshPendingRef.current = true
      return
    }
    const t = window.setTimeout(() => {
      openTeamSummaryWindow('inline')
    }, 200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDev,
    reviewPeriod,
    reviewCustomRangeStart,
    reviewCustomRangeEnd,
    reviewOnlyPaidInFull,
    payConfig,
    showPeopleForReview,
    reviewOverheadRates.ratePerHour,
    reviewOverheadRates.loading,
    teamSummaryDrainTick,
  ])

  async function loadTeamSummaryData(): Promise<TeamSummaryRow[]> {
    const [start, end] = getReviewDateRange()
    const days = getDaysInRange(start, end)
    const union = await loadTeamReviewUnion(start, end, reviewOnlyPaidInFull, payConfig, categoryTags.lookups, users)
    return showPeopleForReview.map((personName) =>
      derivePersonTeamSummary(union, personName, payConfig, reviewOnlyPaidInFull, days)
    )
  }

  // Snapshot of the inputs that determine `loadTeamSummaryData`'s output,
  // joined into a single string so the popup path can compare cheaply.
  function teamSummaryCacheKey(): string {
    const [start, end] = getReviewDateRange()
    return buildTeamSummaryCacheKey({ start, end, onlyPaidInFull: reviewOnlyPaidInFull, roster: showPeopleForReview, payConfig })
  }

  function openTeamSummaryWindow(target: 'popup' | 'inline' = 'popup') {
    const isEmbedded = target === 'inline'
    if (showPeopleForReview.length === 0) {
      if (isEmbedded) {
        teamSummaryReqIdRef.current += 1
        setTeamSummaryRows(null)
        setTeamSummaryError(null)
        setTeamSummaryLoading(false)
      } else {
        showToast('No people in pay config. Add people in People pay config (Payroll tab) first.', 'warning')
      }
      return
    }
    let win: Window | null = null
    let reqId = 0
    // v2.542 cache hit (popup only): if the inline iframe already rendered
    // for the exact same inputs, reuse those rows instead of issuing a fresh
    // `loadTeamSummaryData()`. Embedded refreshes always re-fetch since the
    // inline path *is* the cache source.
    const currentCacheKey = teamSummaryCacheKey()
    const cached = teamSummaryDataCacheRef.current
    const canReuseCache = !isEmbedded && cached != null && cached.cacheKey === currentCacheKey
    if (isEmbedded) {
      reqId = ++teamSummaryReqIdRef.current
      setTeamSummaryLoading(true)
      setTeamSummaryError(null)
    } else {
      win = window.open('', '_blank')
      if (!win) {
        showToast('Popup blocked. Allow popups to open Team Summary.', 'warning')
        return
      }
      const loadingHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary</title></head><body style="font-family:sans-serif;margin:1in;"><p>Loading Team Summary…</p></body></html>'
      win.document.write(loadingHtml)
      win.document.close()
      win.focus()
      // Skip the "Loading…" toast when we have a cache hit — the popup will
      // resolve synchronously on the next tick and the toast just looks stale.
      if (!canReuseCache) {
        showToast('Loading Team Summary…', 'info')
      }
    }
    const dataPromise = canReuseCache && cached
      ? Promise.resolve(cached.rows)
      : loadTeamSummaryData()
    dataPromise
      .then((rows) => {
        if (isEmbedded && reqId !== teamSummaryReqIdRef.current) return
        // Populate the cache only on the inline path — that's the surface
        // a popup-click would later read from. Stamp it with the cache key
        // we computed *before* the load so a dep-driven cache invalidation
        // mid-load still results in `cached.cacheKey !== teamSummaryCacheKey()`
        // on the next popup click.
        if (isEmbedded) {
          teamSummaryDataCacheRef.current = { rows, cacheKey: currentCacheKey }
          // The inline path renders via `<TeamSummaryInline>` reading from
          // `teamSummaryRows` — no HTML string to build, no iframe to seed.
          // The React component does its own sort/filter/click-cell work.
          setTeamSummaryRows(rows)
          setTeamSummaryLoading(false)
          // Re-open the Hours drilldown if the user just saved a day from
          // it (set by the `hoursMyTimeEditor.onSaved` flow). Defer one
          // microtask so the rows commit + the component re-renders
          // before we ask it to mount the drilldown.
          const pn = reviewHoursReopenAfterLoadRef.current
          if (pn) {
            reviewHoursReopenAfterLoadRef.current = null
            window.setTimeout(() => {
              try {
                teamSummaryInlineRef.current?.openDrilldown(pn, 'hours')
              } catch {
                /* component unmounted before re-open landed — ignore */
              }
            }, 50)
          }
          return
        }
        try {
          // Number/HTML formatting lives inside the popup document builder —
          // see `buildTeamSummaryHtml` (lib/peopleDocuments).
          // Rates read through the ref (not the click-time closure) so a
          // rate load that finished while the rows were fetching still
          // reaches the popup. Same source as the inline memo.
          const rates = reviewOverheadRatesRef.current
          const overheadRate = rates.ratePerHour
          const overheadRateLoading = rates.loading
          const overheadDecomp = {
            ratePerHour: rates.ratePerHour,
            ratePerRevenueDecimal: rates.ratePerRevenueDecimal,
            ratePerLaborDollar: rates.ratePerLaborDollar,
            windowStart: rates.windowStart,
            windowEnd: rates.windowEnd,
            officeLabor90d: rates.officeLabor90d,
            bidLabor90d: rates.bidLabor90d,
            officeParts90d: rates.officeParts90d,
            invoices90d: rates.invoices90d,
            fieldHours90d: rates.fieldHours90d,
            fieldLaborUsd90d: rates.fieldLaborUsd90d,
          }
          // ONE enrichment for both surfaces: the popup rows come from the
          // same `enrichTeamSummaryRowsForInline` (split overhead model —
          // own office/bid wages charged directly + field-hour share of
          // office parts) that feeds `teamSummaryBreakdowns`. The popup
          // used to recompute Profit with the retired all-hours model here,
          // so the two windows disagreed on Profit and on row order.
          const partsRate = splitPartsRate(rates.officeParts90d, rates.fieldHours90d)

          // Single payload that drives both the table render (sortable + filterable)
          // and the per-cell drilldown modals. `idx` is stable across sort/filter so
          // `breakdowns[idx]` lookups in the modal click router stay valid.
          const breakdownsPayload = enrichTeamSummaryRowsForInline(rows, partsRate, payConfigSourceFor(payConfig))
          // Embedded only: the currently-expanded person name (or null) so the
          // iframe paints the highlighted row on first render without a
          // postMessage round-trip. The popup window has no per-person
          // detail panel so we always send null there.
          const initialSelectedPersonName =
            isEmbedded && selectedReviewPersonIndex >= 0
              ? showPeopleForReview[selectedReviewPersonIndex] ?? null
              : null
          const html = buildTeamSummaryHtml({
            isEmbedded,
            periodLabel: getReviewPeriodLabel(),
            breakdowns: breakdownsPayload,
            overheadRate,
            overheadRateLoading,
            overheadDecomp,
            selectedPersonName: initialSelectedPersonName,
          })
          // Popup-only render — the inline path was already handled
          // above (see `if (isEmbedded) { … setTeamSummaryRows(rows); return }`).
          if (win) {
            win.document.open()
            win.document.write(html)
            win.document.close()
            win.focus()
          }
        } catch (writeErr) {
          console.error('Team Summary write error:', writeErr)
          showToast('Failed to display Team Summary. The window may have been closed.', 'error')
        }
      })
      .catch((err) => {
        if (isEmbedded && reqId !== teamSummaryReqIdRef.current) return
        console.error('Team Summary load error:', err)
        const errMsg = err instanceof Error ? err.message : 'Failed to load Team Summary'
        if (isEmbedded) {
          setTeamSummaryError(errMsg)
          setTeamSummaryLoading(false)
        } else if (win) {
          showToast(errMsg, 'error')
          try {
            win.document.open()
            win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary - Error</title></head><body style="font-family:sans-serif;margin:1in;"><h1>Error</h1><p>${String(errMsg).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></body></html>`)
            win.document.close()
          } catch {
            win.close()
          }
        }
      })
  }

  return { teamSummaryRows, teamSummaryLoading, teamSummaryError, openTeamSummaryWindow }
}
