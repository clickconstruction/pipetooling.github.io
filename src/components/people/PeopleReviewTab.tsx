import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { formatCurrency } from '../../lib/format'
import { formatErrorMessage } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { effectiveJobLedgerNumber, formatJobLedgerNumberLabel, resolveJobLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'
import { useAuth } from '../../hooks/useAuth'
import { displayReportTemplateName } from '../../lib/reportTemplateDisplayName'
import { ChecklistTitleWithLinks } from '../ChecklistTitleWithLinks'
import type { PayConfigRow } from '../../types/peoplePayConfig'
// Canonical time formatter (rounds total seconds) — the local copy floored
// minutes then rounded the remainder, rendering ':60' seconds on ~40% of
// whole-minute values (e.g. 1:20 stored showed as 1:19:60).
import { decimalToHms } from '../../lib/people/hoursGridTime'
import { isPayRosterRow, type PayRosterIndex } from '../../lib/people/rosterPeople'
import { parseReviewDoor, reviewDoorPersonIndex } from '../../lib/people/reviewDoor'
import { computeReviewDateRange, reviewPeriodLabel, type ReviewPeriod as ReviewPeriodKind } from '../../lib/people/reviewDateRange'
import { buildTeamSummaryCacheKey } from '../../lib/people/teamSummaryCacheKey'
import { loadTeamReviewUnion } from '../../lib/people/loadTeamReviewUnion'
import { useReviewOverheadRates } from '../../hooks/useReviewOverheadRates'
import { ReviewJobExpandedDetail } from './review/ReviewJobExpandedDetail'
import { ReviewLaborBreakdownModal, type ReviewLaborBreakdownContext } from './review/ReviewLaborBreakdownModal'
import { signedCurrency, stripAddressZipState } from './review/reviewFormat'
import { loadReviewPersonData } from '../../lib/people/loadReviewPersonData'
import type { ReviewCrewJob, ReviewLaborContributor, ReviewLaborJob, ReviewReport, ReviewTask } from '../../lib/people/reviewPersonTypes'
import type { Person, UserRow } from '../../hooks/usePeopleRoster'
import { costLineTags } from '../../lib/mercuryTagSplit'
import { useCategoryTags } from '../../lib/banking/categoryTagsData'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../../lib/overheadOfficeJobSettings'
import {
  TeamSummaryInline,
  type TeamSummaryInlineHandle,
} from './teamSummary/TeamSummaryInline'
import { enrichTeamSummaryRowsForInline, fmtH, fmtMoney, payConfigSourceFor, splitPartsRate } from './teamSummary/formatters'
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
import { buildReviewJobsRollup, type ReviewRollupRowInput } from '../../lib/people/reviewJobsRollup'
import { loadOfficeLikeChargeRows, summarizeOfficeLikeCharges, type OfficeLikeChargesSummary } from '../../lib/people/reviewOfficeLikeCharges'
import { buildReviewTasksRollup } from '../../lib/people/reviewTasksRollup'
import { usePendingHoursApprovalsNudge } from '../../hooks/usePendingHoursApprovalsNudge'
import { PeopleReviewVerdictStrip } from './review/PeopleReviewVerdictStrip'
import { PeopleReviewHygieneStrip } from './review/PeopleReviewHygieneStrip'
import { PeopleReviewRankedList } from './review/PeopleReviewRankedList'
import { PeopleReviewMathDrawer } from './review/PeopleReviewMathDrawer'

export type PeopleReviewTabProps = {
  payConfig: Record<string, PayConfigRow>
  archivedUserNames: ReadonlySet<string>
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
  archivedUserNames,
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
  const { role: authRole } = useAuth()
  const prefixMap = useLedgerPrefixMap()

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
  const [reviewLoading, setReviewLoading] = useState(false)
  // Per-person panel failure surface + stale-response guard. The Team Summary
  // path has had `teamSummaryReqIdRef` for this since extraction; the panel
  // loader never did — a fast person switch could resolve out of order and
  // leave person A's jobs under person B's header.
  const [reviewError, setReviewError] = useState<string | null>(null)
  const reviewReqIdRef = useRef(0)
  const [reviewLaborJobs, setReviewLaborJobs] = useState<ReviewLaborJob[]>([])
  const [reviewCrewJobs, setReviewCrewJobs] = useState<ReviewCrewJob[]>([])
  const [, setReviewAllocatedRevenue] = useState(0)
  const [reviewAllocatedProfit, setReviewAllocatedProfit] = useState(0)
  const [reviewHours, setReviewHours] = useState<Array<{ work_date: string; hours: number }>>([])
  const [reviewReports, setReviewReports] = useState<ReviewReport[]>([])
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([])
  const [reviewTasksOutstanding, setReviewTasksOutstanding] = useState<ReviewTask[]>([])
  const [reviewJobsWorkedCollapsed, setReviewJobsWorkedCollapsed] = useState(false)
  const [reviewJobExpandedKey, setReviewJobExpandedKey] = useState<string | null>(null)
  // Jobs Worked is rolled up one line per job (v2.2682); this holds the jobs
  // whose day rows are open. The per-day detail grid keeps its own key above.
  const [reviewJobGroupsOpen, setReviewJobGroupsOpen] = useState<ReadonlySet<string>>(() => new Set())
  const [reviewLaborByJobAndPerson, setReviewLaborByJobAndPerson] = useState<Record<string, ReviewLaborContributor[]>>({})
  // Inline Team Summary (React component) — rows fetched by
  // `openTeamSummaryWindow('inline')` are stored here and the
  // `<TeamSummaryInline>` component renders directly from them (no
  // iframe, no HTML string). The popup path still builds an HTML doc
  // because a `window.open()` target needs a standalone document.
  const [teamSummaryRows, setTeamSummaryRows] = useState<TeamSummaryRow[] | null>(null)
  const [teamSummaryLoading, setTeamSummaryLoading] = useState<boolean>(false)
  const [teamSummaryError, setTeamSummaryError] = useState<string | null>(null)
  const teamSummaryReqIdRef = useRef(0)

  const [reviewLaborBreakdownContext, setReviewLaborBreakdownContext] = useState<ReviewLaborBreakdownContext | null>(null)
  const [reviewHoursPayCollapsed, setReviewHoursPayCollapsed] = useState(false)
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
        .filter((n) => !archivedUserNames.has(n.trim()))
        // v2.3698: plus the roster view's verdict — not a twin, not a sample, neither half archived.
        .filter((n) => isPayRosterRow(payRoster, { person_name: n, person_id: payConfig[n]?.person_id ?? null }))
        .filter((n) => !externalOnlyPayConfigNamesLower.has(n.trim().toLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
    [payConfig, archivedUserNames, payRoster, externalOnlyPayConfigNamesLower]
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

  // ---- person panel rollups (v2.2682) ----
  const reviewJobsRollup = useMemo(() => {
    const inputs: ReviewRollupRowInput[] = []
    for (const j of reviewLaborJobs) {
      const numberLabel = (j.job_number ?? '').trim()
        ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number, j.click_number)
        : '—'
      inputs.push({
        rowKey: `labor-${j.id}`,
        jobKey: j.job_id ?? `hcp:${(j.job_number ?? '').trim().toLowerCase() || j.id}`,
        date: j.job_date,
        numberLabel,
        jobName: j.job_name,
        jobAddress: j.address,
        hours: j.hours,
        laborCost: j.laborCost,
        allocatedTotalBill: j.allocatedTotalBill,
        allocatedRevenueBeforeOverhead: j.allocatedRevenueBeforeOverhead,
        totalLaborOnJob: j.totalLaborOnJob,
        valueCreated: j.valueCreated,
        revenueBeforeOverhead: j.revenueBeforeOverhead,
        totalBill: j.totalBill,
        pctComplete: j.pctComplete,
      })
    }
    for (const j of reviewCrewJobs) {
      const rawHcp = j.hcp_number === '—' ? '' : j.hcp_number
      const numberLabel = effectiveJobLedgerNumber(rawHcp, j.click_number)
        ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawHcp, j.click_number)
        : '—'
      inputs.push({
        rowKey: `crew-${j.job_id}-${j.work_date}`,
        jobKey: j.job_id,
        date: j.work_date,
        numberLabel,
        jobName: j.job_name,
        jobAddress: j.job_address,
        hours: j.hours,
        laborCost: j.laborCost,
        allocatedTotalBill: j.allocatedTotalBill,
        allocatedRevenueBeforeOverhead: j.allocatedRevenueBeforeOverhead,
        totalLaborOnJob: j.totalLaborOnJob,
        valueCreated: j.valueCreated,
        revenueBeforeOverhead: j.revenueBeforeOverhead,
        totalBill: j.totalBill,
        pctComplete: j.pctComplete,
      })
    }
    return buildReviewJobsRollup(inputs)
  }, [reviewLaborJobs, reviewCrewJobs, prefixMap])
  const reviewTasksRollup = useMemo(
    () => buildReviewTasksRollup(reviewTasksOutstanding, denverCalendarDayKey(Date.now())),
    [reviewTasksOutstanding],
  )
  const toggleReviewJobGroup = useCallback((jobKey: string) => {
    setReviewJobGroupsOpen((cur) => {
      const next = new Set(cur)
      if (next.has(jobKey)) next.delete(jobKey)
      else next.add(jobKey)
      return next
    })
  }, [])

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

  function formatDateWithDay(dateStr: string | null): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr + 'T12:00:00')
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const day = dayNames[d.getDay()]
    const month = d.getMonth() + 1
    const dayNum = d.getDate()
    return `${day} ${month}/${dayNum}`
  }

  function formatHrsLabel(hours: number): string {
    if (!Number.isFinite(hours) || hours <= 0) return ''
    const isWhole = Math.abs(hours - Math.round(hours)) < 0.005
    if (isWhole) {
      const n = Math.round(hours)
      return `${n}${n === 1 ? 'hr' : 'hrs'}`
    }
    const rounded = hours.toFixed(2)
    return `${rounded.startsWith('0.') ? rounded.slice(1) : rounded}hrs`
  }

  function getReviewPeriodPay(personName: string): number {
    const [start, end] = getReviewDateRange()
    const days = getDaysInRange(start, end)
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    if (!wage) return 0
    return days.reduce((sum, d) => sum + getPayForPersonDate(personName, d), 0)
  }

  function getPayForPersonDate(personName: string, workDate: string): number {
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    if (!wage) return 0
    const hrs = reviewHours.find((h) => h.work_date === workDate)?.hours ?? 0
    return hrs * wage
  }

  /**
   * Panel-mode entry point: owns the request-id guard (out-of-order responses
   * are dropped), error surfacing (`reviewError`), and the loading flag's
   * `finally` (a rejected query no longer strands the panel on "Loading…").
   */
  async function loadReviewData(personName: string, onlyPaidJobs?: boolean): Promise<void> {
    const reqId = ++reviewReqIdRef.current
    setReviewError(null)
    try {
      await loadReviewDataCore(personName, onlyPaidJobs, reqId)
    } catch (e) {
      if (reviewReqIdRef.current === reqId) setReviewError(formatErrorMessage(e))
    } finally {
      if (reviewReqIdRef.current === reqId) setReviewLoading(false)
    }
  }

  async function loadReviewDataCore(personName: string, onlyPaidJobs: boolean | undefined, reqId: number): Promise<void> {
    const [start, end] = getReviewDateRange()
    setReviewLoading(true)
    setReviewLaborJobs([])
    setReviewCrewJobs([])
    setReviewAllocatedRevenue(0)
    setReviewAllocatedProfit(0)
    setReviewHours([])
    setReviewReports([])
    setReviewTasks([])
    setReviewTasksOutstanding([])
    setReviewLaborByJobAndPerson({})
    setReviewLaborBreakdownContext(null)

    const data = await loadReviewPersonData({
      personName,
      start,
      end,
      onlyPaidJobs: onlyPaidJobs ?? reviewOnlyPaidInFull,
      payConfig,
      people,
      users,
    })

    // Drop stale responses: if a newer load started (person/period switch)
    // while this one was in flight, its writes must not land.
    if (reviewReqIdRef.current !== reqId) return

    setReviewLaborJobs(data.laborJobs)
    setReviewCrewJobs(data.crewJobs)
    setReviewAllocatedRevenue(data.allocatedRevenue)
    setReviewAllocatedProfit(data.allocatedProfit)
    setReviewHours(data.hours)
    setReviewReports(data.reports)
    setReviewTasks(data.tasks)
    setReviewTasksOutstanding(data.outstandingTasks)
    setReviewLaborByJobAndPerson(data.laborByJobAndPerson)
    // reviewLoading is cleared by the wrapper's `finally` (guarded by reqId).
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
    if (selectedReviewPersonIndex >= showPeopleForReview.length) {
      setSelectedReviewPersonIndex(-1)
      return
    }
    const personName = showPeopleForReview[selectedReviewPersonIndex]
    if (personName) void loadReviewData(personName, reviewOnlyPaidInFull)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReviewPersonIndex, reviewPeriod, reviewCustomRangeStart, reviewCustomRangeEnd, reviewOnlyPaidInFull, showPeopleForReview, users])

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
          ) : selectedReviewPersonIndex < 0 ? (
            // No one expanded yet — the Team Summary above acts as the
            // picker. Click a name to expand that person's panel here.
            null
          ) : reviewError ? (
            <div style={{ padding: '1rem' }}>
              <p style={{ color: 'var(--text-red-700)', padding: '0.75rem 1rem', margin: '0 0 0.5rem', border: '1px solid var(--border-red)', borderRadius: 6, background: 'var(--bg-red-tint)', whiteSpace: 'pre-wrap' }}>
                Failed to load review data: {reviewError}
              </p>
              <button
                type="button"
                onClick={() => {
                  const p = showPeopleForReview[selectedReviewPersonIndex]
                  if (p) void loadReviewData(p, reviewOnlyPaidInFull)
                }}
                style={{
                  padding: '0.35rem 0.9rem',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : reviewLoading ? (
            <p style={{ color: 'var(--text-muted)', padding: '1rem', margin: 0 }}>Loading…</p>
          ) : (
            <>
              {(() => {
                const personName = showPeopleForReview[selectedReviewPersonIndex]
                const cfg = personName ? payConfig[personName] : undefined
                const [start, end] = getReviewDateRange()
                const days = getDaysInRange(start, end)
                const getHoursForDay = (d: string) => {
                  if (!cfg) return 0
                  return reviewHours.find((h) => h.work_date === d)?.hours ?? 0
                }
                // Mirror the Team Summary table's per-person row so this panel
                // headline matches the table exactly (same allocation engine +
                // split overhead model). Falls back to the panel's own
                // allocation only while the table row is still loading.
                const tsRow = personName
                  ? teamSummaryBreakdowns.find((b) => b.name === personName)
                  : undefined
                // One hour basis regardless of the paid-only toggle (v2.2688).
                const panelHours = days.reduce((s, d) => s + getHoursForDay(d), 0)
                const totalHours = tsRow ? tsRow.totalHours : panelHours
                const totalRevenue = tsRow
                  ? tsRow.gross
                  : [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                const totalProfit = tsRow ? tsRow.net : reviewAllocatedProfit
                const revPerHour = tsRow ? tsRow.revPerHour : (totalHours > 0 ? totalRevenue / totalHours : 0)
                const profitPerHour = tsRow ? tsRow.netPerHour : (totalHours > 0 ? totalProfit / totalHours : 0)
                // null (renders like its siblings) while the Team Summary row loads —
                // a hard $0 was indistinguishable from a real zero.
                const overheadLaborCost = tsRow ? tsRow.overheadLaborCost : null
                const overheadBurden = tsRow ? tsRow.overheadBurden : null
                const profitAfterOverhead = tsRow ? tsRow.profitAfterOverhead : null
                const profitPerHourAfterOverhead = tsRow ? tsRow.profitPerHourAfterOverhead : null
                // The ranked view's math drawer replaces this headline card.
                if (reviewView === 'ranked') return null
                return (
                  <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '1rem', display: 'inline-grid', gridTemplateColumns: 'max-content max-content', rowGap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Gross Revenue this period:</span>
                      <span
                        title="Sum across every job worked in this period of: (job Value Created) × (this user's labor cost on the job in this period ÷ the job's lifetime labor cost by everyone). 'Value Created' = job total bill × % progress — the gross revenue the job has earned to date. Allocation is cost-based, the same rule the expanded panel uses for the per-job 'Gross Revenue/hr' line."
                        aria-label="Gross Revenue earned this period, allocated by labor cost share"
                        style={{ color: 'var(--text-muted)', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-strong)', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{fmtMoney(totalRevenue)}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Net Revenue (before overhead) this period:</span>
                      <span
                        title="Sum across every job worked in this period of: (job Net Revenue before overhead) × (this user's labor cost on the job in this period ÷ the job's lifetime labor cost by everyone). 'Net Revenue (before overhead)' = Value Created − parts − subs − total field labor on the job, before deducting org-wide overhead. Allocation is cost-based, the same rule the expanded panel uses for the per-job 'Net Revenue on Job' line. To see overhead applied, expand any row and look at the Profit section (methods A/B/C)."
                        aria-label="Net Revenue (before overhead) this period, allocated by labor cost share"
                        style={{ color: 'var(--text-muted)', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-strong)', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong style={{ color: totalProfit < 0 ? 'var(--text-red-700)' : undefined }}>{fmtMoney(totalProfit)}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>&minus; Overhead labor (own office/bid wages):</span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-strong)', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong style={{ color: overheadLaborCost != null && overheadLaborCost < 0 ? 'var(--text-red-700)' : undefined }}>{overheadLaborCost == null ? (reviewOverheadRates.loading ? '…' : '—') : fmtMoney(overheadLaborCost)}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>&minus; Overhead burden (field-hr share of office parts):</span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-strong)', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong style={{ color: 'var(--text-red-700)' }}>{overheadBurden == null ? (reviewOverheadRates.loading ? '…' : '—') : fmtMoney(overheadBurden)}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Profit (after overhead) this period:</span>
                      <span
                        title="Profit (after overhead) = Net Revenue (before overhead) − this person's own overhead labor (office + bid wages) − overhead burden (their field-hour share of office parts). Matches the Team Summary table's Profit column for this person."
                        aria-label="Profit this period after deducting split overhead (own labor + parts burden)"
                        style={{ color: 'var(--text-muted)', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-strong)', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{(() => {
                        if (profitAfterOverhead == null) return reviewOverheadRates.loading ? '…' : '—'
                        return <span style={{ color: profitAfterOverhead < 0 ? 'var(--text-red-700)' : undefined }}>{fmtMoney(profitAfterOverhead)}</span>
                      })()}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Gross Revenue/hr:</span>
                      <span
                        title="Gross Revenue this period ÷ this user's hours in the period. Period equivalent of the per-job 'Gross Revenue/hr' line: each job's Value Created is allocated to the user by labor cost share, summed across the period, then averaged per hour worked."
                        aria-label="Gross Revenue per hour, period average"
                        style={{ color: 'var(--text-muted)', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-strong)', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{totalHours > 0 ? fmtMoney(revPerHour) : '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Net Revenue/hr (before overhead):</span>
                      <span
                        title="Net Revenue (before overhead) this period ÷ this user's hours in the period. Period equivalent of the per-job 'Net Revenue/hr' line: each job's Net Revenue (before overhead) is allocated to the user by labor cost share, summed across the period, then averaged per hour worked. Does not deduct org-wide overhead."
                        aria-label="Net Revenue per hour before overhead, period average"
                        style={{ color: 'var(--text-muted)', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-strong)', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong style={{ color: profitPerHour < 0 ? 'var(--text-red-700)' : undefined }}>{totalHours > 0 ? fmtMoney(profitPerHour) : '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Profit/hr (after overhead):</span>
                      <span
                        title="Profit/hr (after overhead) = Profit (after overhead) ÷ total hours. Matches the Team Summary table's Profit/hr column for this person."
                        aria-label="Profit per hour after split overhead, period average"
                        style={{ color: 'var(--text-muted)', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-strong)', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{(() => {
                        if (profitPerHourAfterOverhead == null) return reviewOverheadRates.loading ? '…' : '—'
                        return <span style={{ color: profitPerHourAfterOverhead < 0 ? 'var(--text-red-700)' : undefined }}>{fmtMoney(profitPerHourAfterOverhead)}</span>
                      })()}</strong>
                    </div>
                  </div>
                )
              })()}
              <section style={{ marginBottom: '1.5rem' }}>
                <h3
                  role="button"
                  tabIndex={0}
                  onClick={() => setReviewJobsWorkedCollapsed((c) => !c)}
                  onKeyDown={(e) => e.key === 'Enter' && setReviewJobsWorkedCollapsed((c) => !c)}
                  style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', userSelect: 'none' }}
                >
                  <span style={{ transform: reviewJobsWorkedCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                  Jobs Worked ({reviewJobsRollup.jobs.length})
                  <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    · {reviewJobsRollup.dayRows} day {reviewJobsRollup.dayRows === 1 ? 'row' : 'rows'}
                    {reviewJobsRollup.zeroHourRows > 0 ? ` · ${reviewJobsRollup.zeroHourRows} with 0 h` : ''}
                  </span>
                </h3>
                {reviewLaborJobs.length === 0 && reviewCrewJobs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No jobs in this period.</p>
                ) : (
                  <>
                    {reviewJobsWorkedCollapsed ? (
                      <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle)' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>This Labor / total job labor:</span>
                          <span style={{ fontWeight: 600 }}>{(() => {
                            const totalThisLabor = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.laborCost, 0)
                            const totalLaborByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) {
                                totalLaborByJob.set(j.job_id, j.totalLaborOnJob)
                              }
                            }
                            const totalLabor = [...totalLaborByJob.values()].reduce((s, v) => s + v, 0)
                            const thisStr = totalThisLabor > 0 ? `$${Math.round(totalThisLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const totalStr = totalLabor > 0 ? `$${Math.round(totalLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            return [thisStr, totalStr].filter(Boolean).join(' / ') || '—'
                          })()}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>This Profit / Net Revenue (before overhead):</span>
                          {(() => {
                            const totalRevenue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                            const revenueBeforeOverheadByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) revenueBeforeOverheadByJob.set(j.job_id, j.revenueBeforeOverhead)
                            }
                            const totalRevBeforeOverhead = [...revenueBeforeOverheadByJob.values()].reduce((s, v) => s + v, 0)
                            const revenueStr = totalRevenue !== 0 ? fmtMoney(totalRevenue) : null
                            const revBeforeStr = totalRevBeforeOverhead !== 0 ? fmtMoney(totalRevBeforeOverhead) : null
                            const text = [revenueStr, revBeforeStr].filter(Boolean).join(' / ') || '—'
                            return <span style={{ fontWeight: 600, color: totalRevenue < 0 ? 'var(--text-red-700)' : undefined }}>{text}</span>
                          })()}
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>This Revenue / Value Created:</span>
                          {(() => {
                            const totalThisValue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                            const totalValueByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) totalValueByJob.set(j.job_id, j.valueCreated)
                            }
                            const totalValue = [...totalValueByJob.values()].reduce((s, v) => s + v, 0)
                            const thisStr = totalThisValue > 0 ? `$${Math.round(totalThisValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const totalStr = totalValue > 0 ? `$${Math.round(totalValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const text = [thisStr, totalStr].filter(Boolean).join(' / ') || '—'
                            return <span style={{ fontWeight: 600 }}>{text}</span>
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead style={{ background: 'var(--bg-subtle)' }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 600 }}>Job #</div>
                                <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', fontWeight: 400 }}>Date</div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 600 }}>Job Name</div>
                                <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', fontWeight: 400 }}>Job Address</div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="dollars this person earned on this day for this job"
                                  aria-label="dollars this person earned on this day for this job"
                                >
                                  This Labor
                                </div>
                                <div
                                  style={{ fontSize: '0.8em', color: 'var(--text-muted)', fontWeight: 400, cursor: 'help' }}
                                  title="lifetime labor cost on the whole job by everyone, including this person"
                                  aria-label="lifetime labor cost on the whole job by everyone, including this person"
                                >
                                  total job labor
                                </div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="this person's share of profit on this row, allocated by labor share (revenue minus parts and labor, before overhead)"
                                  aria-label="this person's share of profit on this row, allocated by labor share (revenue minus parts and labor, before overhead)"
                                >
                                  This Profit
                                </div>
                                <div
                                  style={{ fontSize: '0.8em', color: 'var(--text-muted)', fontWeight: 400, cursor: 'help' }}
                                  title="lifetime net revenue on the whole job, before overhead (value created minus parts and labor)"
                                  aria-label="lifetime net revenue on the whole job, before overhead (value created minus parts and labor)"
                                >
                                  Net Revenue (before overhead)
                                </div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="your share of the job's earned revenue, allocated by labor cost: this row's labor cost ÷ everyone's labor cost on the job, all time"
                                  aria-label="your share of the job's earned revenue, allocated by labor cost: this row's labor cost ÷ everyone's labor cost on the job, all time"
                                >
                                  This Revenue
                                </div>
                                <div
                                  style={{ fontSize: '0.8em', color: 'var(--text-muted)', fontWeight: 400, cursor: 'help' }}
                                  title="the whole job's value created: total bill × % complete (treated as 100% when the ledger has no value set)"
                                  aria-label="the whole job's value created: total bill times percent complete"
                                >
                                  Value Created
                                </div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="Revenue/hr is your share of the job's earned revenue divided by your hours on this row. Profit/hr is your share of the job's profit divided by your hours on this row. Both shares are allocated by labor cost: this row's labor cost ÷ everyone's labor cost on the job."
                                  aria-label="Revenue per hour and profit per hour"
                                >
                                  Revenue/hr
                                </div>
                                <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', fontWeight: 400 }}>
                                  Profit/hr
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                            // Day rows keep their original renderers (and the
                            // per-day detail grid); they are now listed under
                            // one header row per job (v2.2682).
                            const renderLaborRow = (j: ReviewLaborJob) => {
                              const key = `labor-${j.id}`
                              const expanded = reviewJobExpandedKey === key
                              const revPerHour = j.hours > 0 ? j.allocatedTotalBill / j.hours : null
                              const profitPerHour = j.hours > 0 ? j.allocatedRevenueBeforeOverhead / j.hours : null
                              const revProfitStr = revPerHour != null && profitPerHour != null
                                ? (
                                  <>
                                    <div><strong>{fmtMoney(revPerHour)}</strong>/hr revenue</div>
                                    <div style={{ color: profitPerHour < 0 ? 'var(--text-red-700)' : undefined }}><strong>{fmtMoney(profitPerHour)}</strong>/hr profit</div>
                                  </>
                                )
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: 'var(--text-muted)', lineHeight: '1.4' }}>{expanded ? '▾' : '▸'}</span>
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{(j.job_number ?? '').trim() ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number, j.click_number) : '—'}</div>
                                          <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{formatDateWithDay(j.job_date)}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{stripAddressZipState(j.address) || '—'}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.job_id && j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (!j.job_id || j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = j.job_number
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number, j.click_number)
                                          : ''
                                        setReviewLaborBreakdownContext({
                                          mode: 'labor',
                                          jobId: j.job_id,
                                          jobName: j.job_name,
                                          jobAddress: j.address,
                                          jobNumberLabel: numberLabel,
                                          totalLaborOnJob: j.totalLaborOnJob,
                                          revenueBeforeOverhead: j.revenueBeforeOverhead,
                                          userPersonName: personName,
                                        })
                                      }}
                                      title={j.job_id && j.totalLaborOnJob > 0 ? 'See everyone who contributed labor to this job' : undefined}
                                    >
                                      <div style={{ fontWeight: 600 }}>{(() => {
                                        if (j.laborCost <= 0) return '—'
                                        const dollars = `$${Math.round(j.laborCost).toLocaleString('en-US')}`
                                        const hrs = formatHrsLabel(j.hours)
                                        return hrs ? `${dollars} / ${hrs}` : dollars
                                      })()}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{(() => {
                                        if (j.totalLaborOnJob === 0) return '—'
                                        const pct = Math.round((j.laborCost / j.totalLaborOnJob) * 100)
                                        return `${pct}% of $${Math.round(j.totalLaborOnJob).toLocaleString('en-US')}`
                                      })()}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.job_id && j.revenueBeforeOverhead !== 0 && j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (!j.job_id || j.revenueBeforeOverhead === 0 || j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = j.job_number
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number, j.click_number)
                                          : ''
                                        setReviewLaborBreakdownContext({
                                          mode: 'profit',
                                          jobId: j.job_id,
                                          jobName: j.job_name,
                                          jobAddress: j.address,
                                          jobNumberLabel: numberLabel,
                                          totalLaborOnJob: j.totalLaborOnJob,
                                          revenueBeforeOverhead: j.revenueBeforeOverhead,
                                          userPersonName: personName,
                                        })
                                      }}
                                      title={j.job_id && j.revenueBeforeOverhead !== 0 && j.totalLaborOnJob > 0 ? "See everyone's profit share on this job" : undefined}
                                    >
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? signedCurrency(j.allocatedRevenueBeforeOverhead) : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{(() => {
                                        if (j.revenueBeforeOverhead === 0) return '—'
                                        const pct = Math.round((j.allocatedRevenueBeforeOverhead / j.revenueBeforeOverhead) * 100)
                                        if (pct === 100) return `${pct}%`
                                        return `${pct}% of ${fmtMoney(j.revenueBeforeOverhead)}`
                                      })()}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontSize: '0.8125rem' }}>{revProfitStr}</div>
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <ReviewJobExpandedDetail job={j} personName={showPeopleForReview[selectedReviewPersonIndex]} prefixMap={prefixMap} overheadRates={reviewOverheadRates} />
                                  )}
                                </Fragment>
                              )
                            }
                            const renderCrewRow = (j: ReviewCrewJob) => {
                              const key = `crew-${j.job_id}-${j.work_date}`
                              const expanded = reviewJobExpandedKey === key
                              const revPerHour = j.hours > 0 ? j.allocatedTotalBill / j.hours : null
                              const profitPerHour = j.hours > 0 ? j.allocatedRevenueBeforeOverhead / j.hours : null
                              const revProfitStr = revPerHour != null && profitPerHour != null
                                ? (
                                  <>
                                    <div><strong>{fmtMoney(revPerHour)}</strong>/hr revenue</div>
                                    <div style={{ color: profitPerHour < 0 ? 'var(--text-red-700)' : undefined }}><strong>{fmtMoney(profitPerHour)}</strong>/hr profit</div>
                                  </>
                                )
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: 'var(--text-muted)', lineHeight: '1.4' }}>{expanded ? '▾' : '▸'}</span>
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{effectiveJobLedgerNumber(j.hcp_number === '—' ? '' : j.hcp_number, j.click_number) ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.hcp_number === '—' ? '' : j.hcp_number, j.click_number) : '—'}</div>
                                          <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{formatDateWithDay(j.work_date)}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{stripAddressZipState(j.job_address) || '—'}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = effectiveJobLedgerNumber(j.hcp_number === '—' ? '' : j.hcp_number, j.click_number)
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.hcp_number === '—' ? '' : j.hcp_number, j.click_number)
                                          : ''
                                        setReviewLaborBreakdownContext({
                                          mode: 'labor',
                                          jobId: j.job_id,
                                          jobName: j.job_name,
                                          jobAddress: j.job_address,
                                          jobNumberLabel: numberLabel,
                                          totalLaborOnJob: j.totalLaborOnJob,
                                          revenueBeforeOverhead: j.revenueBeforeOverhead,
                                          userPersonName: personName,
                                        })
                                      }}
                                      title={j.totalLaborOnJob > 0 ? 'See everyone who contributed labor to this job' : undefined}
                                    >
                                      <div style={{ fontWeight: 600 }}>{(() => {
                                        if (j.laborCost <= 0) return '—'
                                        const dollars = `$${Math.round(j.laborCost).toLocaleString('en-US')}`
                                        const hrs = formatHrsLabel(j.hours)
                                        return hrs ? `${dollars} / ${hrs}` : dollars
                                      })()}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{(() => {
                                        if (j.totalLaborOnJob === 0) return '—'
                                        const pct = Math.round((j.laborCost / j.totalLaborOnJob) * 100)
                                        return `${pct}% of $${Math.round(j.totalLaborOnJob).toLocaleString('en-US')}`
                                      })()}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.revenueBeforeOverhead !== 0 && j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (j.revenueBeforeOverhead === 0 || j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = effectiveJobLedgerNumber(j.hcp_number === '—' ? '' : j.hcp_number, j.click_number)
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.hcp_number === '—' ? '' : j.hcp_number, j.click_number)
                                          : ''
                                        setReviewLaborBreakdownContext({
                                          mode: 'profit',
                                          jobId: j.job_id,
                                          jobName: j.job_name,
                                          jobAddress: j.job_address,
                                          jobNumberLabel: numberLabel,
                                          totalLaborOnJob: j.totalLaborOnJob,
                                          revenueBeforeOverhead: j.revenueBeforeOverhead,
                                          userPersonName: personName,
                                        })
                                      }}
                                      title={j.revenueBeforeOverhead !== 0 && j.totalLaborOnJob > 0 ? "See everyone's profit share on this job" : undefined}
                                    >
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? signedCurrency(j.allocatedRevenueBeforeOverhead) : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{(() => {
                                        if (j.revenueBeforeOverhead === 0) return '—'
                                        const pct = Math.round((j.allocatedRevenueBeforeOverhead / j.revenueBeforeOverhead) * 100)
                                        if (pct === 100) return `${pct}%`
                                        return `${pct}% of ${fmtMoney(j.revenueBeforeOverhead)}`
                                      })()}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontSize: '0.8125rem' }}>{revProfitStr}</div>
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <ReviewJobExpandedDetail job={j} personName={showPeopleForReview[selectedReviewPersonIndex]} prefixMap={prefixMap} overheadRates={reviewOverheadRates} />
                                  )}
                                </Fragment>
                              )
                            }
                            const laborByKey = new Map<string, ReviewLaborJob>(reviewLaborJobs.map((j) => [`labor-${j.id}`, j]))
                            const crewByKey = new Map<string, ReviewCrewJob>(reviewCrewJobs.map((j) => [`crew-${j.job_id}-${j.work_date}`, j]))
                            const chipStyle: React.CSSProperties = {
                              display: 'inline-block',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '0 6px',
                              borderRadius: 999,
                              border: '1px solid var(--border-amber)',
                              background: 'var(--bg-amber-tint)',
                              color: 'var(--text-amber-900)',
                              marginLeft: 6,
                              verticalAlign: 'middle',
                            }
                            return reviewJobsRollup.jobs.map((g) => {
                              const open = reviewJobGroupsOpen.has(g.jobKey)
                              const num = { fontVariantNumeric: 'tabular-nums' } as const
                              return (
                                <Fragment key={`group-${g.jobKey}`}>
                                  <tr
                                    onClick={() => toggleReviewJobGroup(g.jobKey)}
                                    aria-expanded={open}
                                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: open ? 'var(--bg-subtle)' : undefined }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: 'var(--text-muted)', lineHeight: '1.4' }}>{open ? '▾' : '▸'}</span>
                                        <div>
                                          <div style={{ fontWeight: 700 }}>{g.numberLabel}</div>
                                          <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
                                            {g.dayRows} {g.dayRows === 1 ? 'day' : 'days'}
                                            {g.zeroHourRows > 0 ? ` · ${g.zeroHourRows} with 0 h` : ''}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>
                                        {g.jobName || '—'}
                                        {g.flags.noBill && <span style={chipStyle} title="This job has no bill amount, so labor on it lands as pure loss.">no bill</span>}
                                        {g.flags.assumedPct && <span style={chipStyle} title="No % complete on the ledger — treated as 100% done.">% assumed</span>}
                                      </div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{g.jobAddress || ''}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', ...num }}>
                                      <div style={{ fontWeight: 600 }}>{g.laborCost > 0 ? `${fmtMoney(g.laborCost)} / ${g.hours.toFixed(2)}hrs` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
                                        {g.share != null ? `${Math.round(g.share * 100)}% of ${fmtMoney(g.totalLaborOnJob)}` : g.totalLaborOnJob > 0 ? fmtMoney(g.totalLaborOnJob) : '—'}
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', ...num }}>
                                      <div style={{ fontWeight: 600, color: g.allocatedRevenueBeforeOverhead < 0 ? 'var(--text-red-700)' : undefined }}>
                                        {g.allocatedRevenueBeforeOverhead !== 0 ? fmtMoney(g.allocatedRevenueBeforeOverhead) : '—'}
                                      </div>
                                      <div style={{ fontSize: '0.8em', color: g.revenueBeforeOverhead < 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                                        {g.revenueBeforeOverhead !== 0 ? fmtMoney(g.revenueBeforeOverhead) : '—'}
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', ...num }}>
                                      <div style={{ fontWeight: 600 }}>{g.allocatedTotalBill > 0 ? fmtMoney(g.allocatedTotalBill) : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{g.valueCreated > 0 ? fmtMoney(g.valueCreated) : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', ...num }}>
                                      {g.revPerHour != null && g.profitPerHour != null ? (
                                        <>
                                          <div><strong>{fmtMoney(g.revPerHour)}</strong>/hr revenue</div>
                                          <div style={{ color: g.profitPerHour < 0 ? 'var(--text-red-700)' : undefined }}><strong>{fmtMoney(g.profitPerHour)}</strong>/hr profit</div>
                                        </>
                                      ) : '—'}
                                    </td>
                                  </tr>
                                  {open &&
                                    g.rowKeys.map((k) => {
                                      const l = laborByKey.get(k)
                                      if (l) return renderLaborRow(l)
                                      const c = crewByKey.get(k)
                                      return c ? renderCrewRow(c) : null
                                    })}
                                </Fragment>
                              )
                            })
                            })()}
                          </tbody>
                          <tfoot style={{ background: 'var(--bg-subtle)', fontWeight: 600, borderTop: '2px solid var(--border)' }}>
                            <tr>
                              <td colSpan={2} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)' }}>Totals</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)' }}>
                                <div style={{ fontWeight: 600 }}>{(() => {
                                  const totalThisLabor = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.laborCost, 0)
                                  return totalThisLabor > 0 ? `$${Math.round(totalThisLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                                <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{(() => {
                                  const totalLaborByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) totalLaborByJob.set(j.job_id, j.totalLaborOnJob)
                                  }
                                  const totalLabor = [...totalLaborByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalLabor > 0 ? `$${Math.round(totalLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)' }}>
                                {(() => {
                                  const totalRevenue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                                  return (
                                    <div style={{ fontWeight: 600, color: totalRevenue >= 0 ? undefined : '#b91c1c' }}>{totalRevenue !== 0 ? `$${Math.round(totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</div>
                                  )
                                })()}
                                <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{(() => {
                                  const revBeforeByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) revBeforeByJob.set(j.job_id, j.revenueBeforeOverhead)
                                  }
                                  const totalRevBeforeOverhead = [...revBeforeByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalRevBeforeOverhead !== 0 ? `$${Math.round(totalRevBeforeOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)' }}>
                                <div style={{ fontWeight: 600 }}>{(() => {
                                  const totalThisBill = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                                  return totalThisBill > 0 ? `$${Math.round(totalThisBill).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                                <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{(() => {
                                  const totalValueByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) totalValueByJob.set(j.job_id, j.valueCreated)
                                  }
                                  const totalValue = [...totalValueByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalValue > 0 ? `$${Math.round(totalValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)' }}>
                                {(() => {
                                  const totalRev = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                                  const totalProfit = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                                  const jobHrs = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                                  // One denominator, the same one the headline and the Team
                                  // Summary use (v2.2688): the person's hours in the period.
                                  // The hours-on-jobs figure stays, labelled, so the two
                                  // never read as one number.
                                  const footerPerson = showPeopleForReview[selectedReviewPersonIndex]
                                  const footerRow = footerPerson ? teamSummaryBreakdowns.find((b) => b.name === footerPerson) : undefined
                                  const periodHrs = footerRow?.totalHours ?? 0
                                  if (periodHrs <= 0 && jobHrs <= 0) return '—'
                                  const basisHrs = periodHrs > 0 ? periodHrs : jobHrs
                                  const revHr = totalRev / basisHrs
                                  const profitHr = totalProfit / basisHrs
                                  return (
                                    <>
                                      <div><strong>{fmtMoney(revHr)}</strong>/hr revenue</div>
                                      <div style={{ color: profitHr < 0 ? 'var(--text-red-700)' : undefined }}><strong>{fmtMoney(profitHr)}</strong>/hr profit</div>
                                      <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', fontWeight: 400, whiteSpace: 'nowrap' }} title="Same denominator as the headline and the Team Summary: this person's hours in the period (salaried: 8 h per weekday assumed). The second line divides by only the hours that landed on jobs.">
                                        ÷ {fmtH(basisHrs)} h in period{periodHrs > 0 ? '' : ' (on jobs)'}
                                      </div>
                                      {periodHrs > 0 && jobHrs > 0 && Math.abs(jobHrs - periodHrs) >= 0.05 && (
                                        <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                                          on {fmtH(jobHrs)} job h: {fmtMoney(totalRev / jobHrs)} / {fmtMoney(totalProfit / jobHrs)}
                                        </div>
                                      )}
                                    </>
                                  )
                                })()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3
                  role="button"
                  tabIndex={0}
                  onClick={() => setReviewHoursPayCollapsed((c) => !c)}
                  onKeyDown={(e) => e.key === 'Enter' && setReviewHoursPayCollapsed((c) => !c)}
                  style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', userSelect: 'none' }}
                >
                  <span style={{ transform: reviewHoursPayCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                  Hours and Pay
                </h3>
                {(() => {
                  const personName = showPeopleForReview[selectedReviewPersonIndex]
                  const cfg = personName ? payConfig[personName] : undefined
                  const wage = cfg?.hourly_wage ?? 0
                  const [start, end] = getReviewDateRange()
                  const days = getDaysInRange(start, end)
                  const getHoursForDay = (d: string) => {
                    if (!cfg) return 0
                    return reviewHours.find((h) => h.work_date === d)?.hours ?? 0
                  }
                  // The Hours total ALWAYS sums the per-day rows rendered
                  // below (clocked/salary basis) — under "Only paid in full"
                  // it used to switch to a paid-job-hours basis while the
                  // rows and Pay stayed on all days, so the tfoot
                  // contradicted its own column. Paid-job hours render as a
                  // separate labeled figure instead.
                  const totalHours = days.reduce((s, d) => s + getHoursForDay(d), 0)
                  const paidJobHours = reviewOnlyPaidInFull
                    ? [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                    : null
                  const totalPay = personName ? getReviewPeriodPay(personName) : 0
                  if (reviewHoursPayCollapsed) {
                    return (
                      <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle)' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>Hours:</span>
                          <span style={{ fontWeight: 600 }}>{totalHours > 0 ? decimalToHms(totalHours).replace(/:00$/, '') || '-' : '-'}</span>
                        </div>
                        {paidJobHours != null && (
                          <div>
                            <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>On paid jobs:</span>
                            <span style={{ fontWeight: 600 }}>{paidJobHours > 0 ? decimalToHms(paidJobHours).replace(/:00$/, '') || '-' : '-'}</span>
                          </div>
                        )}
                        <div>
                          <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>Pay:</span>
                          <span style={{ fontWeight: 600 }}>{wage > 0 ? `$${Math.round(totalPay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: 'var(--bg-subtle)' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Hours</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Pay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {days.map((d) => {
                            const hrs = getHoursForDay(d)
                            const pay = personName && wage > 0 ? getPayForPersonDate(personName, d) : 0
                            return (
                              <tr key={d} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{d}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{hrs > 0 ? decimalToHms(hrs).replace(/:00$/, '') || '-' : '-'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{wage > 0 ? `$${Math.round(pay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot style={{ background: 'var(--bg-subtle)', fontWeight: 600, borderTop: '2px solid var(--border)' }}>
                          <tr>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)' }}>Totals</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)' }}>{totalHours > 0 ? decimalToHms(totalHours).replace(/:00$/, '') || '-' : '-'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)' }}>{wage > 0 ? `$${Math.round(totalPay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                          </tr>
                          {paidJobHours != null && (
                            <tr style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                              <td style={{ padding: '0.25rem 0.75rem', textAlign: 'right' }}>On paid jobs</td>
                              <td style={{ padding: '0.25rem 0.75rem', textAlign: 'right' }}>{paidJobHours > 0 ? decimalToHms(paidJobHours).replace(/:00$/, '') || '-' : '-'}</td>
                              <td style={{ padding: '0.25rem 0.75rem', textAlign: 'right' }}>—</td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                  )
                })()}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Reports Filed ({reviewReports.length})</h3>
                {reviewReports.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No reports in this period.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: 'var(--bg-subtle)' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Template</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Created</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewReports.map((r) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{displayReportTemplateName(r.template_name, authRole)}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{r.job_display_name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(r.created_at).toLocaleString()}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <Link to={`/jobs?report=${r.id}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>View</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Tasks Completed ({reviewTasks.length})</h3>
                {reviewTasks.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No tasks in this period.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: 'var(--bg-subtle)' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Title</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Scheduled</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTasks.map((t) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}><ChecklistTitleWithLinks title={t.title} links={t.links} /></td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{t.scheduled_date}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{t.completed_at ? new Date(t.completed_at).toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>
                  Tasks outstanding ({reviewTasksOutstanding.length})
                  {reviewTasksRollup.lines.length < reviewTasksOutstanding.length && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                      {' '}· {reviewTasksRollup.lines.length} {reviewTasksRollup.lines.length === 1 ? 'line' : 'lines'}, recurring items collapsed
                    </span>
                  )}
                </h3>
                {reviewTasksOutstanding.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No open tasks assigned.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: 'var(--bg-subtle)' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Title</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Scheduled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTasksRollup.lines.map((line) =>
                          line.kind === 'single' ? (
                            <tr key={line.task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <ChecklistTitleWithLinks title={line.task.title} links={line.task.links} />
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                {(line.task.scheduled_date ?? '').trim() ? line.task.scheduled_date : '—'}
                              </td>
                            </tr>
                          ) : (
                            <tr key={`recurring-${line.groupKey}`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <span aria-hidden="true" style={{ color: 'var(--text-muted)', marginRight: 6 }}>↻</span>
                                <ChecklistTitleWithLinks title={line.title} links={line.links} />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
                                  {' '}· {line.cadence} · {line.count} open
                                  {line.missed > 0 && (
                                    <>
                                      {' '}· <span style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>{line.missed} missed</span>
                                      {line.firstMissed ? ` since ${line.firstMissed}` : ''}
                                    </>
                                  )}
                                  {line.upcoming > 0 ? ` · ${line.upcoming} upcoming` : ''}
                                </span>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                                {line.nextDue ? `next ${line.nextDue}` : line.lastMissed ? `last ${line.lastMissed}` : '—'}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
          {reviewLaborBreakdownContext && (
            <ReviewLaborBreakdownModal
              ctx={reviewLaborBreakdownContext}
              rows={reviewLaborBreakdownContext.jobId ? (reviewLaborByJobAndPerson[reviewLaborBreakdownContext.jobId] ?? []) : []}
              onClose={() => setReviewLaborBreakdownContext(null)}
            />
          )}
        </div>
      )
  })()
}
