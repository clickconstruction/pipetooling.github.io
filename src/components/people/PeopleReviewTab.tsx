import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { User } from '@supabase/supabase-js'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { useToastContext } from '../../contexts/ToastContext'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import { isArchivedRosterRef, isPayRosterRow, type ArchivedRoster, type PayRosterIndex } from '../../lib/people/rosterPeople'
import { parseReviewDoor, reviewDoorPersonIndex } from '../../lib/people/reviewDoor'
import { computeReviewDateRange, reviewPeriodLabel, type ReviewPeriod as ReviewPeriodKind } from '../../lib/people/reviewDateRange'
import { buildTeamSummaryCacheKey } from '../../lib/people/teamSummaryCacheKey'
import { loadTeamReviewUnion } from '../../lib/people/loadTeamReviewUnion'
import { useReviewOverheadRates } from '../../hooks/useReviewOverheadRates'
import { PeopleReviewPersonPanel } from './review/PeopleReviewPersonPanel'
import type { Person, UserRow } from '../../hooks/usePeopleRoster'
import { costLineTags } from '../../lib/mercuryTagSplit'
import { useCategoryTags } from '../../lib/banking/categoryTagsData'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../../lib/overheadOfficeJobSettings'
import {
  TeamSummaryInline,
  type TeamSummaryInlineHandle,
} from './teamSummary/TeamSummaryInline'
import { enrichTeamSummaryRowsForInline, payConfigSourceFor, splitPartsRate } from './teamSummary/formatters'
import type {
  OverheadRateDecomp,
  TeamSummaryBreakdown,
  TeamSummaryRow,
} from './teamSummary/types'
import { derivePersonTeamSummary } from '../../lib/people/derivePersonTeamSummary'
import { buildTeamSummaryHtml } from '../../lib/peopleDocuments/buildTeamSummaryHtml'
import {
  buildReviewHygiene,
  buildReviewPersonMath,
  buildReviewRankedBars,
  buildReviewVerdict,
  priorPeriodRange,
  type ReviewRankBy,
} from '../../lib/people/reviewRanked'
import { readReviewViewFromStorage, writeReviewViewToStorage, type PeopleReviewView } from '../../lib/people/reviewViewStorage'
import { loadOfficeLikeChargeRows, summarizeOfficeLikeCharges, type OfficeLikeChargesSummary } from '../../lib/people/reviewOfficeLikeCharges'
import { usePendingHoursApprovalsNudge } from '../../hooks/usePendingHoursApprovalsNudge'
import { PeopleReviewVerdictStrip } from './review/PeopleReviewVerdictStrip'
import { PeopleReviewHygieneStrip } from './review/PeopleReviewHygieneStrip'
import { PeopleReviewRankedList } from './review/PeopleReviewRankedList'
import { PeopleReviewMathDrawer } from './review/PeopleReviewMathDrawer'

export type PeopleReviewTabProps = {
  payConfig: Record<string, PayConfigRow>
  /** Who is archived (`buildArchivedRoster`): a pay row's `person_id` decides before its name (#29 item 3, v2.4910). */
  archived: ArchivedRoster
  /** People spine (v2.3698): the roster view's verdict per pay row on top of the archived names; null = no verdict. */
  payRoster: PayRosterIndex | null
  authUser: User | null
  isDev: boolean
  users: UserRow[]
  people: Person[]
  onOpenDayEditor: (personName: string, workDate: string) => void
  onDrilldownOpenChange: (open: boolean) => void
  teamSummaryInlineRef: MutableRefObject<TeamSummaryInlineHandle | null>
  teamSummaryDataCacheRef: MutableRefObject<{ rows: TeamSummaryRow[]; cacheKey: string } | null>
  teamSummaryModalOpenRef: MutableRefObject<boolean>
  teamSummaryRefreshPendingRef: MutableRefObject<boolean>
  reviewHoursReopenAfterLoadRef: MutableRefObject<string | null>
  teamSummaryDrainTick: number
  getDaysInRange: (start: string, end: string) => string[]
}

export default function PeopleReviewTab({
  payConfig,
  archived,
  payRoster,
  authUser,
  isDev,
  users,
  people,
  onOpenDayEditor,
  onDrilldownOpenChange,
  teamSummaryInlineRef,
  teamSummaryDataCacheRef,
  teamSummaryModalOpenRef,
  teamSummaryRefreshPendingRef,
  reviewHoursReopenAfterLoadRef,
  teamSummaryDrainTick,
  getDaysInRange,
}: PeopleReviewTabProps) {
  const { showToast } = useToastContext()

  // Review tab state. v2.542 — `last_month` was a misnomer (it's really 30 days
  // rolling back from today, not the previous calendar month) so we renamed the
  // value to `last_30_days` and added a few common period scopes plus a custom
  // range picker. `ReviewPeriod` is local state only (not persisted), so the
  // value rename is safe.
  type ReviewPeriod = ReviewPeriodKind
  // -1 = no person expanded. The Team Summary table acts as the picker;
  // clicking a name in it toggles the per-person panel into view (v2.X).
  // Replaces the legacy "← Prev | Person ▾ | Next →" row.
  const [selectedReviewPersonIndex, setSelectedReviewPersonIndex] = useState<number>(-1)
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>('last_30_days')
  // Custom range — only consulted when reviewPeriod === 'custom'. Defaults seed
  // when the user first selects Custom from the dropdown (see UI below).
  const [reviewCustomRangeStart, setReviewCustomRangeStart] = useState<string>('')
  const [reviewCustomRangeEnd, setReviewCustomRangeEnd] = useState<string>('')
  // The Vectors → Review door (v2.3366): `?tab=review&review_person=&review_from=&review_to=` sets the
  // period once and selects the person once the roster is in. Read at mount so a
  // later period change or click is never overridden.
  const reviewDoorRef = useRef<{ person: string; applied: boolean } | null>(
    typeof window === 'undefined' ? null : (() => { const d = parseReviewDoor(window.location.search); return d ? { person: d.person, applied: false } : null })(),
  )
  const [reviewDoorPeriodApplied, setReviewDoorPeriodApplied] = useState(false)
  useEffect(() => {
    if (reviewDoorPeriodApplied) return
    const d = typeof window === 'undefined' ? null : parseReviewDoor(window.location.search)
    setReviewDoorPeriodApplied(true)
    if (!d) return
    setReviewPeriod('custom')
    setReviewCustomRangeStart(d.from)
    setReviewCustomRangeEnd(d.to)
  }, [reviewDoorPeriodApplied])
  // Inline Team Summary (React component) — rows fetched by
  // `openTeamSummaryWindow('inline')` are stored here and the
  // `<TeamSummaryInline>` component renders directly from them (no
  // iframe, no HTML string). The popup path still builds an HTML doc
  // because a `window.open()` target needs a standalone document.
  const [teamSummaryRows, setTeamSummaryRows] = useState<TeamSummaryRow[] | null>(null)
  const [teamSummaryLoading, setTeamSummaryLoading] = useState<boolean>(false)
  const [teamSummaryError, setTeamSummaryError] = useState<string | null>(null)
  const teamSummaryReqIdRef = useRef(0)

  const [reviewOnlyPaidInFull, setReviewOnlyPaidInFull] = useState(false)

  // Ranked view (v2.2678, variant C of the refresh): verdict strip + hygiene
  // strip + ranked profit bars + the per-person math drawer. The table stays
  // one click away; the choice persists per browser.
  const [reviewView, setReviewView] = useState<PeopleReviewView>(() => readReviewViewFromStorage())
  const changeReviewView = useCallback((next: PeopleReviewView) => {
    setReviewView(next)
    writeReviewViewToStorage(next)
  }, [])
  const [reviewRankBy, setReviewRankBy] = useState<ReviewRankBy>('profit')
  const [reviewRankedSearch, setReviewRankedSearch] = useState('')
  // Prior period of the same length, loaded through the same union loader +
  // derive kernel, so the trend pill compares like with like.
  const [teamSummaryPriorRows, setTeamSummaryPriorRows] = useState<TeamSummaryRow[] | null>(null)
  const [teamSummaryPriorLoading, setTeamSummaryPriorLoading] = useState(false)
  const teamSummaryPriorReqIdRef = useRef(0)
  const pendingApprovals = usePendingHoursApprovalsNudge(isDev && reviewView === 'ranked')
  // Bank-category tags (v2.2725): cost-line tags become lines in the drawer and
  // segments on the verdict bar; the union loader files card charges by tag.
  const categoryTags = useCategoryTags(isDev)
  const reviewCostLineTags = useMemo(() => costLineTags(categoryTags.lookups), [categoryTags.lookups])
  const [reviewOfficeLikeCharges, setReviewOfficeLikeCharges] = useState<OfficeLikeChargesSummary | null>(null)
  const reviewOfficeLikeReqIdRef = useRef(0)

  const handleInlineTogglePerson = useCallback(
    (personName: string) => {
      const trimmed = personName.trim()
      if (!trimmed) return
      const idx = showPeopleForReviewRef.current.indexOf(trimmed)
      if (idx < 0) return
      setSelectedReviewPersonIndex((cur) => (cur === idx ? -1 : idx))
    },
    [],
  )

  const reviewOverheadRates = useReviewOverheadRates(isDev, authUser?.id)

  // Names that exist only as `people` rows (External Subs / Helpers / etc.) and
  // do not have a matching internal `users` account. Used to keep External-only
  // entries out of the Review tab person list, which is meant for employees.
  const externalOnlyPayConfigNamesLower = useMemo(() => {
    const out = new Set<string>()
    if (users.length === 0 && people.length === 0) return out
    const userNamesLower = new Set(
      users.map((u) => (u.name ?? '').trim().toLowerCase()).filter(Boolean),
    )
    for (const p of people) {
      const key = (p.name ?? '').trim().toLowerCase()
      if (key && !userNamesLower.has(key)) out.add(key)
    }
    return out
  }, [users, people])

  const showPeopleForReview = useMemo(
    () =>
      [...Object.keys(payConfig)]
        .filter((n) => !isArchivedRosterRef(archived, { name: n, person_id: payConfig[n]?.person_id ?? null }))
        // v2.3698: plus the roster view's verdict — not a twin, not a sample, neither half archived.
        .filter((n) => isPayRosterRow(payRoster, { person_name: n, person_id: payConfig[n]?.person_id ?? null }))
        .filter((n) => !externalOnlyPayConfigNamesLower.has(n.trim().toLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
    [payConfig, archived, payRoster, externalOnlyPayConfigNamesLower]
  )
  useEffect(() => {
    const door = reviewDoorRef.current
    if (!door || door.applied || showPeopleForReview.length === 0) return
    const idx = reviewDoorPersonIndex(showPeopleForReview, door.person)
    door.applied = true
    if (idx >= 0) setSelectedReviewPersonIndex(idx)
  }, [showPeopleForReview])
  // Stale-closure-safe mirror for the inline Team Summary callbacks
  // (handleInlineTogglePerson is created with `useCallback([])`) so it
  // can read the latest roster without a re-create churn.
  const showPeopleForReviewRef = useRef<string[]>([])
  showPeopleForReviewRef.current = showPeopleForReview
  // Same idiom for the 90-day rates: the popup path reads rates inside a
  // `.then()` that resolves seconds after the click — reading through this
  // ref (instead of the click-time closure) picks up a rate that finished
  // loading while the row fetch was in flight, so a popup opened during
  // the rate load no longer renders permanently rate-less.
  const reviewOverheadRatesRef = useRef(reviewOverheadRates)
  reviewOverheadRatesRef.current = reviewOverheadRates

  // Derived view-models passed to `<TeamSummaryInline>`. Kept as memos
  // so the table doesn't reflow on unrelated People state changes.
  const teamSummarySelectedPersonName = useMemo<string | null>(
    () =>
      selectedReviewPersonIndex >= 0
        ? showPeopleForReview[selectedReviewPersonIndex] ?? null
        : null,
    [selectedReviewPersonIndex, showPeopleForReview],
  )
  const teamSummaryOverheadDecomp = useMemo<OverheadRateDecomp>(
    () => ({
      ratePerHour: reviewOverheadRates.ratePerHour,
      ratePerRevenueDecimal: reviewOverheadRates.ratePerRevenueDecimal,
      ratePerLaborDollar: reviewOverheadRates.ratePerLaborDollar,
      windowStart: reviewOverheadRates.windowStart,
      windowEnd: reviewOverheadRates.windowEnd,
      officeLabor90d: reviewOverheadRates.officeLabor90d ?? 0,
      bidLabor90d: reviewOverheadRates.bidLabor90d ?? 0,
      officeParts90d: reviewOverheadRates.officeParts90d ?? 0,
      invoices90d: reviewOverheadRates.invoices90d ?? 0,
      fieldHours90d: reviewOverheadRates.fieldHours90d ?? 0,
      fieldLaborUsd90d: reviewOverheadRates.fieldLaborUsd90d ?? 0,
    }),
    [reviewOverheadRates],
  )
  // Build the breakdowns payload from the loaded rows. Equivalent to
  // the per-rebuild work `openTeamSummaryWindow('inline')` used to do
  // before encoding it into the iframe `srcDoc`.
  const teamSummaryBreakdowns = useMemo<TeamSummaryBreakdown[]>(() => {
    if (!teamSummaryRows) return []
    // Split overhead model: the Overhead Burden column + Profit (after
    // overhead) spread only the NON-labor overhead pool (office parts)
    // across field hours; office/bid labor is charged per-person via
    // `overheadLaborCost`. partsRate = office parts (90d) ÷ field hrs (90d).
    const partsRate = splitPartsRate(reviewOverheadRates.officeParts90d, reviewOverheadRates.fieldHours90d)
    return enrichTeamSummaryRowsForInline(teamSummaryRows, partsRate, payConfigSourceFor(payConfig))
  }, [teamSummaryRows, reviewOverheadRates.fieldHours90d, reviewOverheadRates.officeParts90d, payConfig])

  // ---- ranked view derivations (all from the enriched rows above) ----
  const reviewSplitPartsRate = useMemo(() => {
    return splitPartsRate(reviewOverheadRates.officeParts90d, reviewOverheadRates.fieldHours90d)
  }, [reviewOverheadRates.fieldHours90d, reviewOverheadRates.officeParts90d])
  const teamSummaryPriorBreakdowns = useMemo<TeamSummaryBreakdown[] | null>(() => {
    if (!teamSummaryPriorRows) return null
    return enrichTeamSummaryRowsForInline(teamSummaryPriorRows, reviewSplitPartsRate, payConfigSourceFor(payConfig))
  }, [teamSummaryPriorRows, reviewSplitPartsRate, payConfig])
  const reviewVerdict = useMemo(
    () => buildReviewVerdict(teamSummaryBreakdowns, teamSummaryPriorBreakdowns, reviewCostLineTags),
    [teamSummaryBreakdowns, teamSummaryPriorBreakdowns, reviewCostLineTags],
  )
  const reviewRankedBars = useMemo(
    () => buildReviewRankedBars(teamSummaryBreakdowns, reviewRankBy, reviewRankedSearch),
    [teamSummaryBreakdowns, reviewRankBy, reviewRankedSearch],
  )
  const reviewPersonMath = useMemo(() => {
    const b = teamSummarySelectedPersonName
      ? teamSummaryBreakdowns.find((x) => x.name === teamSummarySelectedPersonName)
      : undefined
    return b ? buildReviewPersonMath(b, { partsRate: reviewSplitPartsRate, costLineTags: reviewCostLineTags }) : null
  }, [teamSummaryBreakdowns, teamSummarySelectedPersonName, reviewSplitPartsRate, reviewCostLineTags])
  const reviewHygieneItems = useMemo(
    () => buildReviewHygiene(teamSummaryBreakdowns, pendingApprovals.approvals, reviewOfficeLikeCharges),
    [teamSummaryBreakdowns, pendingApprovals.approvals, reviewOfficeLikeCharges],
  )

  // Office-type card charges on field jobs for the period (hygiene line,
  // v2.2698). Keyed on the current rows' identity like the prior-period load,
  // ranked view only; fails soft to "no line".
  useEffect(() => {
    if (!isDev || reviewView !== 'ranked' || !teamSummaryRows) {
      reviewOfficeLikeReqIdRef.current += 1
      setReviewOfficeLikeCharges(null)
      return
    }
    const reqId = ++reviewOfficeLikeReqIdRef.current
    const [start, end] = getReviewDateRange()
    void (async () => {
      try {
        const [rows, officeJobLedgerId] = await Promise.all([
          loadOfficeLikeChargeRows({ startYmd: start, endYmd: end }),
          fetchOverheadOfficeJobLedgerIdFromAppSettings(),
        ])
        if (reviewOfficeLikeReqIdRef.current !== reqId) return
        setReviewOfficeLikeCharges(summarizeOfficeLikeCharges(rows, officeJobLedgerId))
      } catch {
        if (reviewOfficeLikeReqIdRef.current === reqId) setReviewOfficeLikeCharges(null)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDev, reviewView, teamSummaryRows])

  // Prior-period rows for the trend pill. Keyed on the CURRENT rows' identity
  // so every successful main load (period change, paid-only toggle, roster
  // or realtime refresh) re-runs the comparison against the window just
  // before it. Untouched: the main load's refresh-deferral choreography.
  useEffect(() => {
    if (!isDev || reviewView !== 'ranked' || !teamSummaryRows || showPeopleForReview.length === 0) {
      teamSummaryPriorReqIdRef.current += 1
      setTeamSummaryPriorRows(null)
      setTeamSummaryPriorLoading(false)
      return
    }
    const reqId = ++teamSummaryPriorReqIdRef.current
    const [start, end] = getReviewDateRange()
    const [priorStart, priorEnd] = priorPeriodRange(start, end)
    const priorDays = getDaysInRange(priorStart, priorEnd)
    setTeamSummaryPriorLoading(true)
    void (async () => {
      try {
        const union = await loadTeamReviewUnion(priorStart, priorEnd, reviewOnlyPaidInFull, payConfig, categoryTags.lookups, users)
        if (teamSummaryPriorReqIdRef.current !== reqId) return
        setTeamSummaryPriorRows(
          showPeopleForReview.map((personName) =>
            derivePersonTeamSummary(union, personName, payConfig, reviewOnlyPaidInFull, priorDays),
          ),
        )
      } catch {
        if (teamSummaryPriorReqIdRef.current === reqId) setTeamSummaryPriorRows(null)
      } finally {
        if (teamSummaryPriorReqIdRef.current === reqId) setTeamSummaryPriorLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDev, reviewView, teamSummaryRows])

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

  function getReviewDateRange(): [string, string] {
    // Anchored on the COMPANY calendar day, not the viewer's browser clock
    // (v2.2688, audit finding 17) — the same anchor the 90-day overhead
    // window uses, so the two never sit a day apart for a remote viewer.
    return computeReviewDateRange(
      reviewPeriod,
      { start: reviewCustomRangeStart, end: reviewCustomRangeEnd },
      denverCalendarDayKey(Date.now()),
    )
  }

  useEffect(() => {
    if (showPeopleForReview.length === 0) return
    // Default state for the new toggleable Team Summary: nothing selected.
    // The detail panel below the table only renders once the user clicks a
    // name in the table (`handleInlineTogglePerson`).
    if (selectedReviewPersonIndex < 0) return
    // Clamp when the roster shrinks (member removed from pay config) so the
    // index can't dangle past the end. Selecting `-1` is the only way to
    // mean "no selection"; we never silently fall back to person 0 here.
    // The panel loads the selected person itself (PeopleReviewPersonPanel).
    if (selectedReviewPersonIndex >= showPeopleForReview.length) setSelectedReviewPersonIndex(-1)
  }, [selectedReviewPersonIndex, showPeopleForReview])

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

  function getReviewPeriodLabel(): string {
    return reviewPeriodLabel(reviewPeriod, getReviewDateRange())
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

  // ---- render (extracted review IIFE; component only mounts when active) ----
  return (() => {
        // Lifted-out Team Summary meta — same data + click handler as
        // the inline render path, but rendered next to the controls
        // column (right column of the top two-column layout) instead
        // of stacked above the table. TeamSummaryInline.showInlineMeta
        // is set to false below so the meta isn't rendered twice.
        const reviewTeamSummaryRowCount = teamSummaryBreakdowns.length
        const reviewTeamSummaryNoun = reviewTeamSummaryRowCount === 1 ? 'person' : 'people'
        const reviewOverheadRate = reviewOverheadRates.ratePerHour
        const reviewOverheadLoading = reviewOverheadRates.loading
        const reviewPartsRate = splitPartsRate(reviewOverheadRates.officeParts90d, reviewOverheadRates.fieldHours90d)
        const reviewOverheadMetaText = reviewOverheadLoading
          ? 'Overhead (split): loading…'
          : reviewOverheadRate == null || reviewPartsRate == null
            ? 'Overhead (split): unavailable'
            : `Overhead (split): own office/bid labor + $${reviewPartsRate.toFixed(2)}/field-hr office parts (90-day)`
        // The rate drilldown lives in the table; in the ranked view the meta line is plain text.
        const reviewOverheadMetaClickable = !reviewOverheadLoading && reviewOverheadRate != null && reviewView === 'table'
        return (
        <div>
          {/* Top section: Team Summary header info on the left (takes
              the flex space), period controls pushed to the right
              edge of the page. Wraps cleanly on narrow viewports.
              Bottom margin kept tight so the toolbar (Search /
              Reset / Print / Open in new window) sits visually
              close to the Overhead Method A meta line. */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '2rem',
              alignItems: 'flex-start',
              marginBottom: '0.5rem',
            }}
          >
            {showPeopleForReview.length > 0 && (
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <h2 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.05rem', color: 'var(--text-700)' }}>Team Summary</h2>
                {/* Reuse the same .team-summary-meta / .team-summary-meta-sub
                    CSS classes the inline render path uses — the stylesheet
                    is injected by TeamSummaryInline (mounted below) so the
                    rules apply once the table mounts. The info-button click
                    bridges back to the table via openOverheadRateDrilldown
                    on the imperative handle. */}
                <div className="team-summary-meta">
                  {getReviewPeriodLabel()} &middot; {reviewTeamSummaryRowCount} {reviewTeamSummaryNoun}
                </div>
                <div className="team-summary-meta-sub">
                  {reviewOverheadMetaClickable ? (
                    <button
                      type="button"
                      className="team-summary-meta-sub-btn"
                      title="Click for rate decomposition"
                      onClick={(e) =>
                        teamSummaryInlineRef.current?.openOverheadRateDrilldown(e.currentTarget)
                      }
                    >
                      {reviewOverheadMetaText} <span aria-hidden="true">&#9432;</span>
                    </button>
                  ) : (
                    reviewOverheadMetaText
                  )}
                </div>
              </div>
            )}

            {/* Period + filter controls pushed to the right edge.
                `marginLeft: auto` keeps them flush right even when
                the Team Summary header column is missing (empty
                roster) and the row would otherwise collapse. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <select
                  value={reviewPeriod}
                  onChange={(e) => {
                    const next = e.target.value as ReviewPeriod
                    // Seed custom range with the current effective range when the
                    // user first switches to Custom — gives them somewhere sensible
                    // to start tweaking instead of empty inputs.
                    if (next === 'custom' && !reviewCustomRangeStart && !reviewCustomRangeEnd) {
                      const [seedStart, seedEnd] = getReviewDateRange()
                      setReviewCustomRangeStart(seedStart)
                      setReviewCustomRangeEnd(seedEnd)
                    }
                    setReviewPeriod(next)
                  }}
                  style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This week (running)</option>
                  <option value="last_week">Last week</option>
                  <option value="last_two_weeks">Last two weeks</option>
                  <option value="last_30_days">Last 30 days</option>
                  <option value="last_90_days">Last 90 days</option>
                  <option value="this_year">This year</option>
                  <option value="custom">Custom range…</option>
                </select>
                {reviewPeriod === 'custom' && (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}
                    role="group"
                    aria-label="Custom date range"
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                      From
                      <input
                        type="date"
                        value={reviewCustomRangeStart}
                        onChange={(e) => setReviewCustomRangeStart(e.target.value)}
                        aria-label="Custom range start date"
                        max={reviewCustomRangeEnd || undefined}
                        style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                      To
                      <input
                        type="date"
                        value={reviewCustomRangeEnd}
                        onChange={(e) => setReviewCustomRangeEnd(e.target.value)}
                        aria-label="Custom range end date"
                        min={reviewCustomRangeStart || undefined}
                        style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                      />
                    </label>
                    {(!reviewCustomRangeStart || !reviewCustomRangeEnd) && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Pick both dates to set the range.
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* Filter checkbox sits on its own row below the period
                  dropdown so it has visual breathing room and reads
                  as a modifier on the selected period rather than an
                  inline option next to it. */}
              <div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={reviewOnlyPaidInFull}
                    onChange={(e) => setReviewOnlyPaidInFull(e.target.checked)}
                  />
                  Only Count Jobs Marked Paid in Full
                </label>
              </div>
              <div
                role="group"
                aria-label="Review view"
                style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', fontSize: '0.8rem' }}
              >
                {(['ranked', 'table'] as const).map((v) => {
                  const on = reviewView === v
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => changeReviewView(v)}
                      style={{
                        font: 'inherit',
                        fontWeight: 600,
                        padding: '0.3rem 0.75rem',
                        border: 0,
                        cursor: 'pointer',
                        background: on ? 'var(--text-link)' : 'var(--surface)',
                        color: on ? 'var(--surface)' : 'var(--text-700)',
                      }}
                    >
                      {v === 'ranked' ? 'Ranked' : 'Table'}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {showPeopleForReview.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              {teamSummaryError ? (
                <p style={{ color: 'var(--text-red-700)', padding: '0.75rem 1rem', margin: 0, border: '1px solid var(--border-red)', borderRadius: 6, background: 'var(--bg-red-tint)' }}>
                  {teamSummaryError}
                </p>
              ) : teamSummaryRows ? (
                reviewView === 'ranked' ? (
                  <>
                    <PeopleReviewVerdictStrip
                      verdict={reviewVerdict}
                      periodLabel={getReviewPeriodLabel()}
                      priorLoading={teamSummaryPriorLoading}
                      ratesLoading={reviewOverheadRates.loading}
                    />
                    <PeopleReviewHygieneStrip items={reviewHygieneItems} />
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                        gap: '1rem',
                        alignItems: 'start',
                      }}
                    >
                      <PeopleReviewRankedList
                        ranked={reviewRankedBars}
                        rankBy={reviewRankBy}
                        onRankByChange={setReviewRankBy}
                        search={reviewRankedSearch}
                        onSearchChange={setReviewRankedSearch}
                        selectedName={teamSummarySelectedPersonName}
                        onTogglePerson={handleInlineTogglePerson}
                        refreshing={teamSummaryLoading}
                      />
                      <PeopleReviewMathDrawer math={reviewPersonMath} />
                    </div>
                  </>
                ) : (
                <TeamSummaryInline
                  handleRef={teamSummaryInlineRef}
                  breakdowns={teamSummaryBreakdowns}
                  overheadRate={reviewOverheadRates.ratePerHour}
                  overheadRateLoading={reviewOverheadRates.loading}
                  overheadDecomp={teamSummaryOverheadDecomp}
                  periodLabel={getReviewPeriodLabel()}
                  selectedPersonName={teamSummarySelectedPersonName}
                  onTogglePerson={handleInlineTogglePerson}
                  onOpenDayEditor={onOpenDayEditor}
                  onDrilldownOpenChange={onDrilldownOpenChange}
                  refreshing={teamSummaryLoading}
                  showInlineMeta={false}
                  onOpenInNewWindow={() => openTeamSummaryWindow('popup')}
                />
                )
              ) : (
                <div style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {teamSummaryLoading ? 'Loading Team Summary…' : 'Team Summary will appear here.'}
                </div>
              )}
            </div>
          )}

          {showPeopleForReview.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '1rem', margin: 0 }}>No people in pay config. Add people in People pay config (Payroll tab) first.</p>
          ) : (
            <PeopleReviewPersonPanel
              selectedPersonName={showPeopleForReview[selectedReviewPersonIndex]}
              hasSelection={selectedReviewPersonIndex >= 0}
              roster={showPeopleForReview}
              payConfig={payConfig}
              people={people}
              users={users}
              period={reviewPeriod}
              customRangeStart={reviewCustomRangeStart}
              customRangeEnd={reviewCustomRangeEnd}
              onlyPaidInFull={reviewOnlyPaidInFull}
              reviewView={reviewView}
              overheadRates={reviewOverheadRates}
              teamSummaryBreakdowns={teamSummaryBreakdowns}
              getDaysInRange={getDaysInRange}
            />
          )}
        </div>
      )
  })()
}
