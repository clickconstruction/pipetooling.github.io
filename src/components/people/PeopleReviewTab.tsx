import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { ymdAddDays } from '../../utils/dateUtils'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatJobLedgerNumberLabel, resolveJobLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'
import { useAuth } from '../../hooks/useAuth'
import { displayReportTemplateName } from '../../lib/reportTemplateDisplayName'
import { ChecklistTitleWithLinks } from '../ChecklistTitleWithLinks'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import type { Person, UserRow } from '../../hooks/usePeopleRoster'
import {
  approvedClosedSessionHours,
  buildOverheadDailyLabor,
  buildOverheadWageLookup,
  mergeOverheadDayTableRows,
  overheadBucketForSession,
  type OverheadClockSessionRow,
} from '../../lib/overheadDailyLabor'
import { fetchOverheadOfficePartsByDay } from '../../lib/fetchOverheadOfficePartsByDay'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../../lib/overheadOfficeJobSettings'
import type {
  CrewJobAssignment,
  CrewBidAssignment,
  CrewJobRow,
} from '../../utils/teamLabor'
import {
  TeamSummaryInline,
  type TeamSummaryInlineHandle,
} from './teamSummary/TeamSummaryInline'
import { enrichTeamSummaryRowsForInline } from './teamSummary/formatters'
import type {
  OverheadRateDecomp,
  TeamSummaryBreakdown,
  TeamSummaryRow,
} from './teamSummary/types'
import { derivePersonTeamSummary } from '../../lib/people/derivePersonTeamSummary'
import type {
  TeamLaborItem,
  TeamLedgerRow,
  TeamPeriodLaborRow,
  TeamReviewUnion,
} from '../../lib/people/teamReviewTypes'

export type PeopleReviewTabProps = {
  payConfig: Record<string, PayConfigRow>
  archivedUserNames: Set<string>
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

  // Shared HH:MM(:SS) formatter — a private verbatim copy of the parent's
  // `decimalToHms` (also duplicated in quickfill/HoursSection.tsx). Pure, no
  // closure deps; kept local so the review tab doesn't need it as a prop.
  function decimalToHms(decimal: number): string {
    if (!decimal || decimal <= 0) return ''
    const h = Math.floor(decimal)
    const m = Math.floor((decimal - h) * 60)
    const s = Math.round(((decimal - h) * 60 - m) * 60)
    if (s > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${h}:${String(m).padStart(2, '0')}:00`
  }
  // Review tab state. v2.542 — `last_month` was a misnomer (it's really 30 days
  // rolling back from today, not the previous calendar month) so we renamed the
  // value to `last_30_days` and added a few common period scopes plus a custom
  // range picker. `ReviewPeriod` is local state only (not persisted), so the
  // value rename is safe.
  type ReviewPeriod =
    | 'today'
    | 'yesterday'
    | 'this_week'
    | 'last_week'
    | 'last_two_weeks'
    | 'last_30_days'
    | 'last_90_days'
    | 'this_year'
    | 'custom'
  // -1 = no person expanded. The Team Summary table acts as the picker;
  // clicking a name in it toggles the per-person panel into view (v2.X).
  // Replaces the legacy "← Prev | Person ▾ | Next →" row.
  const [selectedReviewPersonIndex, setSelectedReviewPersonIndex] = useState<number>(-1)
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>('last_30_days')
  // Custom range — only consulted when reviewPeriod === 'custom'. Defaults seed
  // when the user first selects Custom from the dropdown (see UI below).
  const [reviewCustomRangeStart, setReviewCustomRangeStart] = useState<string>('')
  const [reviewCustomRangeEnd, setReviewCustomRangeEnd] = useState<string>('')
  const [reviewLoading, setReviewLoading] = useState(false)
  type ReviewLaborJob = {
    source: 'labor'
    id: string
    job_date: string | null
    address: string
    hoursInfo: string
    hours: number
    job_number: string | null
    job_id: string | null
    job_name: string
    service_type_id: string | null
    laborCost: number
    driveCost: number
    partsCost: number
    totalBill: number
    valueCreated: number
    pctComplete: number | null
    revenueBeforeOverhead: number
    allocatedTotalBill: number
    allocatedRevenueBeforeOverhead: number
    allocatedPartsCost: number
    subLaborCost: number
    totalLaborOnJob: number
    totalDriveCostOnJob: number
    totalJobHours: number
    userTotalHoursOnJob: number
    userTotalContributionToBill: number
    userTotalContributionToRevenue: number
    userTotalLaborOnJob: number
    userTotalDriveCostOnJob: number
  }
  type ReviewCrewJob = {
    source: 'crew'
    job_id: string
    work_date: string
    hcp_number: string
    job_name: string
    job_address: string
    service_type_id: string | null
    hours: number
    laborCost: number
    driveCost: number
    partsCost: number
    totalBill: number
    valueCreated: number
    pctComplete: number | null
    revenueBeforeOverhead: number
    allocatedTotalBill: number
    allocatedRevenueBeforeOverhead: number
    allocatedPartsCost: number
    subLaborCost: number
    totalLaborOnJob: number
    totalDriveCostOnJob: number
    totalJobHours: number
    userTotalHoursOnJob: number
    userTotalContributionToBill: number
    userTotalContributionToRevenue: number
    userTotalLaborOnJob: number
    userTotalDriveCostOnJob: number
  }
  const [reviewLaborJobs, setReviewLaborJobs] = useState<ReviewLaborJob[]>([])
  const [reviewCrewJobs, setReviewCrewJobs] = useState<ReviewCrewJob[]>([])
  const [, setReviewAllocatedRevenue] = useState(0)
  const [reviewAllocatedProfit, setReviewAllocatedProfit] = useState(0)
  const [reviewHours, setReviewHours] = useState<Array<{ work_date: string; hours: number }>>([])
  type ReviewReport = { id: string; template_name: string; job_display_name: string; created_at: string }
  const [reviewReports, setReviewReports] = useState<ReviewReport[]>([])
  type ReviewTask = { id: string; title: string; links?: string[] | null; scheduled_date: string; completed_at: string | null }
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([])
  const [reviewTasksOutstanding, setReviewTasksOutstanding] = useState<ReviewTask[]>([])
  const [reviewJobsWorkedCollapsed, setReviewJobsWorkedCollapsed] = useState(false)
  const [reviewJobExpandedKey, setReviewJobExpandedKey] = useState<string | null>(null)
  type ReviewLaborContributor = {
    personName: string
    hours: number
    laborCost: number
    subLaborCost: number
    crewLaborCost: number
  }
  const [reviewLaborByJobAndPerson, setReviewLaborByJobAndPerson] = useState<Record<string, ReviewLaborContributor[]>>({})
  const [reviewOverheadRates, setReviewOverheadRates] = useState<{
    ratePerHour: number | null
    ratePerRevenueDecimal: number | null
    ratePerLaborDollar: number | null
    loading: boolean
    windowStart: string | null
    windowEnd: string | null
    officeLabor90d: number | null
    bidLabor90d: number | null
    officeParts90d: number | null
    invoices90d: number | null
    fieldHours90d: number | null
    fieldLaborUsd90d: number | null
  }>({
    ratePerHour: null,
    ratePerRevenueDecimal: null,
    ratePerLaborDollar: null,
    loading: false,
    windowStart: null,
    windowEnd: null,
    officeLabor90d: null,
    bidLabor90d: null,
    officeParts90d: null,
    invoices90d: null,
    fieldHours90d: null,
    fieldLaborUsd90d: null,
  })
  // Inline Team Summary (React component) — rows fetched by
  // `openTeamSummaryWindow('inline')` are stored here and the
  // `<TeamSummaryInline>` component renders directly from them (no
  // iframe, no HTML string). The popup path still builds an HTML doc
  // because a `window.open()` target needs a standalone document.
  const [teamSummaryRows, setTeamSummaryRows] = useState<TeamSummaryRow[] | null>(null)
  const [teamSummaryLoading, setTeamSummaryLoading] = useState<boolean>(false)
  const [teamSummaryError, setTeamSummaryError] = useState<string | null>(null)
  const teamSummaryReqIdRef = useRef(0)

  type ReviewLaborBreakdownContext = {
    mode: 'labor' | 'profit'
    jobId: string | null
    jobName: string
    jobAddress: string
    jobNumberLabel: string
    totalLaborOnJob: number
    revenueBeforeOverhead: number
    userPersonName: string
  }
  const [reviewLaborBreakdownContext, setReviewLaborBreakdownContext] = useState<ReviewLaborBreakdownContext | null>(null)
  const [reviewHoursPayCollapsed, setReviewHoursPayCollapsed] = useState(false)
  const [reviewOnlyPaidInFull, setReviewOnlyPaidInFull] = useState(false)

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

  useEffect(() => {
    if (!isDev || !authUser?.id) return
    let cancelled = false
    setReviewOverheadRates((prev) => ({ ...prev, loading: true }))
    void (async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA')
        const start = ymdAddDays(today, -89)
        const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
        let overheadQ = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', start)
          .lte('work_date', today)
        if (officeJobLedgerId) {
          overheadQ = overheadQ.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`)
        } else {
          overheadQ = overheadQ.not('bid_id', 'is', null)
        }
        let fieldQ = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', start)
          .lte('work_date', today)
          .not('job_ledger_id', 'is', null)
        if (officeJobLedgerId) fieldQ = fieldQ.neq('job_ledger_id', officeJobLedgerId)
        const startIsoLow = `${start}T00:00:00-00:00`
        const endIsoHigh = `${ymdAddDays(today, 1)}T00:00:00-00:00`
        const [overheadSessionsRes, fieldSessionsRes, partsRes, invoiceRowsRes] = await Promise.all([
          withSupabaseRetry(async () => overheadQ, 'load review 90d overhead sessions') as Promise<
            OverheadClockSessionRow[] | null
          >,
          withSupabaseRetry(async () => fieldQ, 'load review 90d field sessions') as Promise<
            OverheadClockSessionRow[] | null
          >,
          officeJobLedgerId
            ? fetchOverheadOfficePartsByDay({
                officeJobLedgerId,
                startYmd: start,
                endYmd: today,
              }).then((r) => r.partsUsdByDay)
            : Promise.resolve(new Map<string, number>()),
          withSupabaseRetry(
            async () =>
              supabase
                .from('jobs_ledger_invoices')
                .select('amount, sent_to_customer_at')
                .gte('sent_to_customer_at', startIsoLow)
                .lt('sent_to_customer_at', endIsoHigh),
            'load review 90d invoices',
          ) as Promise<Array<{ amount: number | null; sent_to_customer_at: string | null }> | null>,
        ])
        if (cancelled) return
        const cfgRows = await withSupabaseRetry(
          async () =>
            supabase.from('people_pay_config').select('person_name, hourly_wage, is_salary'),
          'load review 90d pay config',
        )
        if (cancelled) return
        const cfgList = (cfgRows ?? []) as Array<{
          person_name: string
          hourly_wage: number | null
          is_salary: boolean | null
        }>
        const wageMap = buildOverheadWageLookup(
          cfgList.map((r) => ({ person_name: r.person_name, hourly_wage: r.hourly_wage ?? null })),
        )
        const overheadLabor = buildOverheadDailyLabor({
          sessions: (overheadSessionsRes ?? []) as OverheadClockSessionRow[],
          officeJobLedgerId,
          wageByNormalizedName: wageMap,
        })
        const merged = mergeOverheadDayTableRows(overheadLabor.byDay, partsRes, new Map(), new Map(), new Map())
        let overheadTotal = 0
        for (const row of merged) overheadTotal += row.totalUsd
        let officeLabor90d = 0
        let bidLabor90d = 0
        for (const row of overheadLabor.byDay) {
          officeLabor90d += row.officeLaborUsd
          bidLabor90d += row.bidLaborUsd
        }
        let officeParts90d = 0
        for (const v of partsRes.values()) officeParts90d += v
        const fieldSessions = (fieldSessionsRes ?? []) as OverheadClockSessionRow[]
        const wageByName = new Map<string, number>()
        for (const r of cfgList) {
          if (r.hourly_wage != null) wageByName.set(r.person_name.trim().toLowerCase(), Number(r.hourly_wage))
        }
        let fieldHours = 0
        let fieldLaborUsd = 0
        for (const s of fieldSessions) {
          if (s.rejected_at || s.revoked_at) continue
          if (s.approved_at == null) continue
          if (!s.clocked_in_at || !s.clocked_out_at) continue
          const t0 = new Date(s.clocked_in_at).getTime()
          const t1 = new Date(s.clocked_out_at).getTime()
          if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue
          const hrs = (t1 - t0) / 3_600_000
          fieldHours += hrs
          const userName = ((s as unknown as { users?: { name?: string | null } }).users?.name ?? '').trim().toLowerCase()
          const wage = userName ? wageByName.get(userName) ?? 0 : 0
          fieldLaborUsd += hrs * wage
        }
        const invoiceRows = (invoiceRowsRes ?? []) as Array<{
          amount: number | null
          sent_to_customer_at: string | null
        }>
        let revenueTotal = 0
        for (const r of invoiceRows) {
          if (!r.sent_to_customer_at) continue
          revenueTotal += Number(r.amount ?? 0)
        }
        setReviewOverheadRates({
          ratePerHour: fieldHours > 0 ? overheadTotal / fieldHours : null,
          ratePerRevenueDecimal: revenueTotal > 0 ? overheadTotal / revenueTotal : null,
          ratePerLaborDollar: fieldLaborUsd > 0 ? overheadTotal / fieldLaborUsd : null,
          loading: false,
          windowStart: start,
          windowEnd: today,
          officeLabor90d,
          bidLabor90d,
          officeParts90d,
          invoices90d: revenueTotal,
          fieldHours90d: fieldHours,
          fieldLaborUsd90d: fieldLaborUsd,
        })
      } catch {
        if (!cancelled) {
          setReviewOverheadRates({
            ratePerHour: null,
            ratePerRevenueDecimal: null,
            ratePerLaborDollar: null,
            loading: false,
            windowStart: null,
            windowEnd: null,
            officeLabor90d: null,
            bidLabor90d: null,
            officeParts90d: null,
            invoices90d: null,
            fieldHours90d: null,
            fieldLaborUsd90d: null,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDev, authUser?.id])

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
        .filter((n) => !externalOnlyPayConfigNamesLower.has(n.trim().toLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
    [payConfig, archivedUserNames, externalOnlyPayConfigNamesLower]
  )
  // Stale-closure-safe mirror for the inline Team Summary callbacks
  // (handleInlineTogglePerson is created with `useCallback([])`) so it
  // can read the latest roster without a re-create churn.
  const showPeopleForReviewRef = useRef<string[]>([])
  showPeopleForReviewRef.current = showPeopleForReview

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
    const fh = reviewOverheadRates.fieldHours90d
    const partsRate =
      fh != null && fh > 0 ? (reviewOverheadRates.officeParts90d ?? 0) / fh : null
    return enrichTeamSummaryRowsForInline(
      teamSummaryRows,
      partsRate,
      (name) => {
        const cfg = payConfig[name]
        if (!cfg) return 'unknown'
        return cfg.is_salary ? 'salary' : 'hourly'
      },
    )
  }, [teamSummaryRows, reviewOverheadRates.fieldHours90d, reviewOverheadRates.officeParts90d, payConfig])

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
    // Drilldown protection: if a modal is open inside the iframe, defer the
    // rebuild until the user closes it. We mark pending and the message
    // handler will bump `teamSummaryDrainTick` to re-run this effect.
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
    const today = new Date()
    const todayStr = today.toLocaleDateString('en-CA')
    if (reviewPeriod === 'today') return [todayStr, todayStr]
    if (reviewPeriod === 'yesterday') {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      const y = d.toLocaleDateString('en-CA')
      return [y, y]
    }
    if (reviewPeriod === 'custom') {
      // Empty inputs collapse to "today" so the table still has *something*
      // to render rather than throwing on an invalid range. The UI surfaces
      // a hint when both inputs are empty.
      const cs = reviewCustomRangeStart.trim()
      const ce = reviewCustomRangeEnd.trim()
      if (cs && ce) {
        // Swap if the user picked them in the wrong order.
        return cs <= ce ? [cs, ce] : [ce, cs]
      }
      if (cs && !ce) return [cs, cs]
      if (!cs && ce) return [ce, ce]
      return [todayStr, todayStr]
    }
    // Current week's Sunday (start of this week)
    const day = today.getDay()
    const thisWeekSunday = new Date(today)
    thisWeekSunday.setDate(today.getDate() - day)
    if (reviewPeriod === 'this_week') {
      // Sunday of this week through today (running week, mid-week monitoring).
      return [thisWeekSunday.toLocaleDateString('en-CA'), todayStr]
    }
    if (reviewPeriod === 'last_week') {
      const lastWeekSunday = new Date(thisWeekSunday)
      lastWeekSunday.setDate(thisWeekSunday.getDate() - 7)
      const lastWeekSaturday = new Date(lastWeekSunday)
      lastWeekSaturday.setDate(lastWeekSunday.getDate() + 6)
      return [lastWeekSunday.toLocaleDateString('en-CA'), lastWeekSaturday.toLocaleDateString('en-CA')]
    }
    if (reviewPeriod === 'last_30_days') {
      // Rolling 30 days back from today (was previously labeled "Last month";
      // the label was a misnomer — see ReviewPeriod doc above).
      const start = new Date(today)
      start.setDate(today.getDate() - 30)
      return [start.toLocaleDateString('en-CA'), todayStr]
    }
    if (reviewPeriod === 'last_90_days') {
      const start = new Date(today)
      start.setDate(today.getDate() - 90)
      return [start.toLocaleDateString('en-CA'), todayStr]
    }
    if (reviewPeriod === 'this_year') {
      // Calendar year-to-date (Jan 1 → today).
      const start = new Date(today.getFullYear(), 0, 1)
      return [start.toLocaleDateString('en-CA'), todayStr]
    }
    // last_two_weeks (default fallthrough)
    const twoWeeksAgoSunday = new Date(thisWeekSunday)
    twoWeeksAgoSunday.setDate(thisWeekSunday.getDate() - 14)
    const lastWeekSaturday = new Date(thisWeekSunday)
    lastWeekSaturday.setDate(thisWeekSunday.getDate() - 1)
    return [twoWeeksAgoSunday.toLocaleDateString('en-CA'), lastWeekSaturday.toLocaleDateString('en-CA')]
  }

  function stripAddressZipState(addr: string): string {
    return (addr ?? '').replace(/\s*,\s*[A-Z]{2}\s+\d{5}(-\d{4})?\s*$/i, '').trim()
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
    const dayOfWeek = new Date(workDate + 'T12:00:00').getDay()
    const hrs = cfg?.is_salary
      ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
      : (reviewHours.find((h) => h.work_date === workDate)?.hours ?? 0)
    return hrs * wage
  }

  async function loadReviewData(
    personName: string,
    forTeamSummary?: boolean,
    onlyPaidJobs?: boolean
  ): Promise<{ allocatedRevenue: number; allocatedProfit: number; hoursRows: Array<{ work_date: string; hours: number }>; totalHoursPaidJobs?: number } | void> {
    const [start, end] = getReviewDateRange()
    if (!forTeamSummary) {
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
    }

    const userId = users.find((u) => u.name === personName)?.id ?? null

    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const lookbackStart = twoYearsAgo.toLocaleDateString('en-CA')

    const [laborRes, allLaborResForCostAllTime, personLaborResAllTime, crewRes, allCrewResForCostAllTime, hoursRes, reportsRes, tasksRes, outstandingTasksRes, settingsRes, tallyRes, allHoursRes, allHoursResAllTime] = await Promise.all([
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').eq('assigned_to_name', personName).gte('job_date', start).lte('job_date', end),
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles, assigned_to_name').gte('job_date', lookbackStart),
      forTeamSummary ? Promise.resolve({ data: [] }) : supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles').eq('assigned_to_name', personName).gte('job_date', lookbackStart),
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', lookbackStart),
      supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
      forTeamSummary ? Promise.resolve({ data: [] }) : supabase.rpc('list_reports_with_job_info'),
      userId && !forTeamSummary
        ? supabase
            .from('checklist_instances')
            .select('id, checklist_item_id, scheduled_date, completed_at, checklist_items(title, links), checklist_instance_assignees!inner(user_id)')
            .eq('checklist_instance_assignees.user_id', userId)
            .not('completed_at', 'is', null)
            .gte('completed_at', start + 'T00:00:00')
            .lte('completed_at', end + 'T23:59:59')
        : Promise.resolve({ data: [] }),
      userId && !forTeamSummary
        ? supabase
            .from('checklist_instances')
            .select('id, checklist_item_id, scheduled_date, completed_at, checklist_items(title, links), checklist_instance_assignees!inner(user_id)')
            .eq('checklist_instance_assignees.user_id', userId)
            .is('completed_at', null)
            .order('scheduled_date', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
      supabase.rpc('list_tally_parts_with_po'),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart),
    ])

    const laborRows = (laborRes.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null }>
    const allLaborRowsForCostAllTime = (allLaborResForCostAllTime.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null; assigned_to_name: string | null }>
    const personLaborRowsAllTime = (personLaborResAllTime.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null }>
    const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const allCrewRowsForCostAllTime = (allCrewResForCostAllTime.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const hoursRows = (hoursRes.data ?? []) as Array<{ work_date: string; hours: number }>
    const allReports = (reportsRes.data ?? []) as Array<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string }>
    const taskInstances = (tasksRes.data ?? []) as Array<{ id: string; checklist_item_id: string; scheduled_date: string; completed_at: string | null; checklist_items: { title: string; links?: string[] | null } | null }>
    const settingsRows = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
    const tallyParts = (tallyRes.data ?? []) as Array<{ job_id: string; part_id: string | null; price_at_time: number | null; fixture_cost: number | null; quantity: number }>
    const allHoursRows = (allHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const allHoursRowsAllTime = (allHoursResAllTime.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>

    const mileageCost = settingsRows.find((r) => r.key === 'drive_mileage_cost')?.value_num ?? 0.70
    const timePerMile = settingsRows.find((r) => r.key === 'drive_time_per_mile')?.value_num ?? 0.02

    const partsCostByJobId = new Map<string, number>()
    for (const r of tallyParts) {
      const cost = r.part_id == null
        ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
        : Number(r.price_at_time ?? 0) * Number(r.quantity)
      partsCostByJobId.set(r.job_id, (partsCostByJobId.get(r.job_id) ?? 0) + cost)
    }

    const hoursMap: Record<string, number> = {}
    for (const h of allHoursRows) {
      hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
    }
    const hoursMapAllTime: Record<string, number> = {}
    for (const h of allHoursRowsAllTime) {
      hoursMapAllTime[`${h.person_name}:${h.work_date}`] = h.hours
    }

    const allLaborJobIdsForCost = allLaborRowsForCostAllTime.map((r) => r.id)
    const laborItemsRes =
      allLaborJobIdsForCost.length > 0
        ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', allLaborJobIdsForCost)
        : { data: [] }
    const laborItems = (laborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const itemsByJob = new Map<string, typeof laborItems>()
    for (const i of laborItems) {
      const list = itemsByJob.get(i.job_id) ?? []
      list.push(i)
      itemsByJob.set(i.job_id, list)
    }

    const laborCostByHcp = new Map<string, number>()
    const driveCostByHcp = new Map<string, number>()
    for (const r of allLaborRowsForCostAllTime) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const items = itemsByJob.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      laborCostByHcp.set(hcp, (laborCostByHcp.get(hcp) ?? 0) + laborCost)
      if (driveCost > 0) driveCostByHcp.set(hcp, (driveCostByHcp.get(hcp) ?? 0) + driveCost)
    }

    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of crewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewByDatePersonAllTime: Record<string, CrewJobRow> = {}
    for (const r of allCrewRowsForCostAllTime) {
      crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewJobIds = new Set<string>()
    const crewJobsWithLead: Array<{ work_date: string; job_id: string; pct: number }> = []
    for (const r of crewRows) {
      if (r.person_name !== personName) continue
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      for (const a of assignments) {
        crewJobIds.add(a.job_id)
        crewJobsWithLead.push({ work_date: r.work_date, job_id: a.job_id, pct: a.pct })
      }
    }

    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of allCrewRowsForCostAllTime) {
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        const cost = pctHrs * rate
        teamLaborCostByJobId.set(a.job_id, (teamLaborCostByJobId.get(a.job_id) ?? 0) + cost)
      }
    }

    const allJobIds = [...crewJobIds]
    const laborHcps = [...new Set(laborRows.filter((r) => (r.job_number ?? '').trim()).map((r) => (r.job_number ?? '').trim().toLowerCase()))]
    const personLaborHcps = [...new Set(personLaborRowsAllTime.filter((r) => (r.job_number ?? '').trim()).map((r) => (r.job_number ?? '').trim().toLowerCase()))]
    const allLaborHcps = [...new Set([...laborHcps, ...personLaborHcps])]
    const usePaidOnly = onlyPaidJobs ?? reviewOnlyPaidInFull
    const [crewJobsRes, laborJobsRes] = await Promise.all([
      allJobIds.length > 0
        ? usePaidOnly
          ? supabase.rpc('get_jobs_ledger_by_ids_paid_only', { p_job_ids: allJobIds })
          : supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: allJobIds })
        : { data: [] },
      allLaborHcps.length > 0
        ? usePaidOnly
          ? supabase.rpc('get_jobs_ledger_by_hcp_numbers_paid_only', { p_hcp_numbers: allLaborHcps })
          : supabase.rpc('get_jobs_ledger_by_hcp_numbers', { p_hcp_numbers: allLaborHcps })
        : { data: [] },
    ])
    const crewJobsLedger = (crewJobsRes.data ?? []) as Array<{
      id: string
      hcp_number: string
      job_name: string
      job_address: string
      revenue: number | null
      pct_complete: number | null
      service_type_id: string | null
    }>
    const laborJobsLedger = (laborJobsRes.data ?? []) as Array<{
      id: string
      hcp_number: string
      job_name: string
      job_address: string
      revenue: number | null
      pct_complete: number | null
      service_type_id: string | null
    }>
    const jobsById = new Map<string, (typeof crewJobsLedger)[0]>()
    const jobIdByHcp = new Map<string, string>()
    for (const j of crewJobsLedger) {
      jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }
    for (const j of laborJobsLedger) {
      if (!jobsById.has(j.id)) jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }

    const laborByJobAndPerson = new Map<string, Map<string, { hours: number; subLaborCost: number; crewLaborCost: number }>>()
    const upsertContrib = (jobId: string, personName: string, hours: number, subCost: number, crewCost: number) => {
      let perJob = laborByJobAndPerson.get(jobId)
      if (!perJob) {
        perJob = new Map()
        laborByJobAndPerson.set(jobId, perJob)
      }
      const existing = perJob.get(personName) ?? { hours: 0, subLaborCost: 0, crewLaborCost: 0 }
      existing.hours += hours
      existing.subLaborCost += subCost
      existing.crewLaborCost += crewCost
      perJob.set(personName, existing)
    }
    for (const r of allLaborRowsForCostAllTime) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByJob.get(r.id) ?? []
      const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const cost = hrs * rate + driveCost
      const who = (r.assigned_to_name ?? '').trim() || '(Unassigned)'
      upsertContrib(jobId, who, hrs, cost, 0)
    }
    for (const r of allCrewRowsForCostAllTime) {
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        const cost = pctHrs * rate
        upsertContrib(a.job_id, r.person_name, pctHrs, 0, cost)
      }
    }

    const personLaborCostByJobId = new Map<string, number>()
    const personCrewLaborByJobId = new Map<string, number>()
    const personDriveCostByJobId = new Map<string, number>()
    for (const r of personLaborRowsAllTime) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByJob.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      personLaborCostByJobId.set(jobId, (personLaborCostByJobId.get(jobId) ?? 0) + laborCost)
      if (driveCost > 0) personDriveCostByJobId.set(jobId, (personDriveCostByJobId.get(jobId) ?? 0) + driveCost)
    }
    for (const r of allCrewRowsForCostAllTime) {
      if (r.person_name !== personName) continue
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        const cost = pctHrs * rate
        personLaborCostByJobId.set(a.job_id, (personLaborCostByJobId.get(a.job_id) ?? 0) + cost)
        personCrewLaborByJobId.set(a.job_id, (personCrewLaborByJobId.get(a.job_id) ?? 0) + cost)
      }
    }

    const personHoursOnJobAllTime = new Map<string, number>()
    for (const r of personLaborRowsAllTime) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByJob.get(r.id) ?? []
      const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      personHoursOnJobAllTime.set(jobId, (personHoursOnJobAllTime.get(jobId) ?? 0) + hrs)
    }
    for (const r of allCrewRowsForCostAllTime) {
      if (r.person_name !== personName) continue
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        personHoursOnJobAllTime.set(a.job_id, (personHoursOnJobAllTime.get(a.job_id) ?? 0) + pctHrs)
      }
    }

    const jobIds = Array.from(jobsById.keys())
    const [invoiceRes, materialsRes] = await Promise.all([
      jobIds.length > 0 ? supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
      jobIds.length > 0 ? supabase.from('jobs_ledger_materials').select('job_id, amount').in('job_id', jobIds) : Promise.resolve({ data: [] }),
    ])
    const invoiceAmountByJob: Record<string, number> = {}
    for (const row of (invoiceRes.data ?? []) as Array<{ job_id: string; invoice_amount: number | null }>) {
      invoiceAmountByJob[row.job_id] = Number(row.invoice_amount ?? 0)
    }
    const billedMaterialsByJobId = new Map<string, number>()
    for (const row of (materialsRes.data ?? []) as Array<{ job_id: string; amount: number }>) {
      billedMaterialsByJobId.set(row.job_id, (billedMaterialsByJobId.get(row.job_id) ?? 0) + Number(row.amount ?? 0))
    }

    const laborRowsFiltered = usePaidOnly
      ? laborRows.filter((r) => {
          const hcp = (r.job_number ?? '').trim().toLowerCase()
          return hcp && jobIdByHcp.has(hcp)
        })
      : laborRows
    const laborJobs: ReviewLaborJob[] = laborRowsFiltered.map((r) => {
      const items = itemsByJob.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const hoursInfo = items.length > 0 ? `${totalHrs.toFixed(2)} (${items.length} items)` : '—'
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? jobIdByHcp.get(hcp) ?? null : null
      const job = jobId ? jobsById.get(jobId) : null
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      const partsCost = jobId ? (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0) : 0
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const pctComplete = job?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const totalJobLabor = (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) + (jobId ? (teamLaborCostByJobId.get(jobId) ?? 0) : 0)
      const revenueBeforeOverhead = valueCreated - partsCost - totalJobLabor
      return {
        source: 'labor',
        id: r.id,
        job_date: r.job_date,
        address: r.address ?? '',
        hoursInfo,
        hours: totalHrs,
        job_number: r.job_number,
        job_id: jobId,
        job_name: job?.job_name ?? '—',
        service_type_id: job?.service_type_id ?? null,
        laborCost,
        driveCost,
        partsCost,
        totalBill,
        valueCreated,
        pctComplete,
        revenueBeforeOverhead,
        allocatedTotalBill: 0,
        allocatedRevenueBeforeOverhead: 0,
        allocatedPartsCost: 0,
        subLaborCost: Math.max(0, (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) - laborCost),
        totalLaborOnJob: totalJobLabor,
        totalDriveCostOnJob: hcp ? (driveCostByHcp.get(hcp) ?? 0) : 0,
        totalJobHours: 0,
        userTotalHoursOnJob: 0,
        userTotalContributionToBill: 0,
        userTotalContributionToRevenue: 0,
        userTotalLaborOnJob: 0,
        userTotalDriveCostOnJob: jobId ? (personDriveCostByJobId.get(jobId) ?? 0) : 0,
      }
    })

    const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string; revenue: number | null; pct_complete: number | null; service_type_id: string | null }> = {}
    for (const j of crewJobsLedger) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '', revenue: j.revenue, pct_complete: j.pct_complete, service_type_id: j.service_type_id ?? null }
    }
    const crewJobsWithLeadFiltered = usePaidOnly
      ? crewJobsWithLead.filter((c) => jobsById.has(c.job_id))
      : crewJobsWithLead
    const cfg = personName ? payConfig[personName] : undefined
    const crewJobs: ReviewCrewJob[] = crewJobsWithLeadFiltered.map((c) => {
      const j = jobsMap[c.job_id] ?? jobsById.get(c.job_id)
      const day = new Date(c.work_date + 'T12:00:00').getDay()
      const dayHours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMap[`${personName}:${c.work_date}`] ?? 0)
      const hours = dayHours * (c.pct / 100)
      const laborCost = hours * (cfg?.hourly_wage ?? 0)
      const partsCost = (partsCostByJobId.get(c.job_id) ?? 0) + (invoiceAmountByJob[c.job_id] ?? 0) + (billedMaterialsByJobId.get(c.job_id) ?? 0)
      const totalBill = j?.revenue != null ? Number(j.revenue) : 0
      const pctComplete = j?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const hcp = (j?.hcp_number ?? '').trim().toLowerCase()
      const totalJobLabor = (hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0) + (teamLaborCostByJobId.get(c.job_id) ?? 0)
      const revenueBeforeOverhead = valueCreated - partsCost - totalJobLabor
      return {
        source: 'crew',
        job_id: c.job_id,
        work_date: c.work_date,
        hcp_number: j?.hcp_number ?? '—',
        job_name: j?.job_name ?? '—',
        job_address: j?.job_address ?? '—',
        service_type_id: j?.service_type_id ?? null,
        hours,
        laborCost,
        driveCost: 0,
        partsCost,
        totalBill,
        valueCreated,
        pctComplete,
        revenueBeforeOverhead,
        allocatedTotalBill: 0,
        allocatedRevenueBeforeOverhead: 0,
        allocatedPartsCost: 0,
        subLaborCost: hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0,
        totalLaborOnJob: totalJobLabor,
        totalDriveCostOnJob: hcp ? (driveCostByHcp.get(hcp) ?? 0) : 0,
        totalJobHours: 0,
        userTotalHoursOnJob: 0,
        userTotalContributionToBill: 0,
        userTotalContributionToRevenue: 0,
        userTotalLaborOnJob: 0,
        userTotalDriveCostOnJob: personDriveCostByJobId.get(c.job_id) ?? 0,
      }
    })

    const startDate = new Date(start + 'T00:00:00').getTime()
    const endDate = new Date(end + 'T23:59:59').getTime()
    const reports = allReports.filter((r) => r.created_by_name === personName && new Date(r.created_at).getTime() >= startDate && new Date(r.created_at).getTime() <= endDate)

    const tasks: ReviewTask[] = taskInstances.map((t) => ({
      id: t.id,
      title: (t.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled',
      links: (t.checklist_items as { title: string; links?: string[] | null } | null)?.links,
      scheduled_date: t.scheduled_date,
      completed_at: t.completed_at,
    }))

    const outstandingInstances = (outstandingTasksRes.data ?? []) as Array<{
      id: string
      checklist_item_id: string
      scheduled_date: string
      completed_at: string | null
      checklist_items: { title: string; links?: string[] | null } | null
    }>
    const outstandingTasks: ReviewTask[] = outstandingInstances
      .map((t) => ({
        id: t.id,
        title: (t.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled',
        links: (t.checklist_items as { title: string; links?: string[] | null } | null)?.links,
        scheduled_date: t.scheduled_date,
        completed_at: null as string | null,
      }))
      .sort((a, b) => {
        const as = (a.scheduled_date ?? '').trim()
        const bs = (b.scheduled_date ?? '').trim()
        if (!as && !bs) return 0
        if (!as) return 1
        if (!bs) return -1
        return as.localeCompare(bs)
      })

    const hoursOnJobInPeriod = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.job_id) hoursOnJobInPeriod.set(j.job_id, (hoursOnJobInPeriod.get(j.job_id) ?? 0) + j.hours)
    }
    for (const j of crewJobs) {
      hoursOnJobInPeriod.set(j.job_id, (hoursOnJobInPeriod.get(j.job_id) ?? 0) + j.hours)
    }

    const lookbackStart2Y = (() => {
      const d = new Date(start + 'T12:00:00')
      d.setFullYear(d.getFullYear() - 2)
      return d.toLocaleDateString('en-CA')
    })()
    const lookbackEnd = (() => {
      const d = new Date(end + 'T12:00:00')
      d.setFullYear(d.getFullYear() + 1)
      return d.toLocaleDateString('en-CA')
    })()

    const [allLaborRes, allCrewRes, allHoursRes2] = await Promise.all([
      forTeamSummary || !(laborHcps.length > 0 || crewJobIds.size > 0) ? Promise.resolve({ data: [] }) : supabase.from('people_labor_jobs').select('id, job_number, job_date').gte('job_date', lookbackStart2Y).lte('job_date', lookbackEnd),
      forTeamSummary ? Promise.resolve({ data: [] }) : supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd),
      forTeamSummary ? Promise.resolve({ data: [] }) : supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd),
    ])
    const allLaborRows = (allLaborRes.data ?? []) as Array<{ id: string; job_number: string | null; job_date: string | null }>
    const allCrewRows = (allCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const allHoursRows2 = (allHoursRes2.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const hoursMapAll: Record<string, number> = {}
    for (const h of allHoursRows2) {
      hoursMapAll[`${h.person_name}:${h.work_date}`] = h.hours
    }

    const allLaborJobIds = allLaborRows.map((r) => r.id)
    const allLaborItemsRes =
      allLaborJobIds.length > 0
        ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', allLaborJobIds)
        : { data: [] }
    const allLaborItems = (allLaborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const itemsByLaborJobId = new Map<string, typeof allLaborItems>()
    for (const i of allLaborItems) {
      const list = itemsByLaborJobId.get(i.job_id) ?? []
      list.push(i)
      itemsByLaborJobId.set(i.job_id, list)
    }

    const allHcpSet = new Set([
      ...laborHcps,
      ...Array.from(jobsById.values())
        .map((j) => (j.hcp_number ?? '').trim().toLowerCase())
        .filter(Boolean),
    ])
    const totalHoursOnJob = new Map<string, number>()
    const totalHoursOnJobInPeriod = new Map<string, number>()
    const laborHcpSet = new Set(laborHcps)
    for (const r of allLaborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp || !allHcpSet.has(hcp)) continue
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      const items = itemsByLaborJobId.get(r.id) ?? []
      const hrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      totalHoursOnJob.set(jobId, (totalHoursOnJob.get(jobId) ?? 0) + hrs)
      if (r.job_date && r.job_date >= start && r.job_date <= end && laborHcpSet.has(hcp)) {
        totalHoursOnJobInPeriod.set(jobId, (totalHoursOnJobInPeriod.get(jobId) ?? 0) + hrs)
      }
    }
    const allCrewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of allCrewRows) {
      allCrewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const allJobIdsForCrew = [...new Set([...crewJobIds, ...Array.from(jobIdByHcp.values())])]
    const jobIdsSet = new Set(allJobIdsForCrew)
    for (const r of allCrewRows) {
      const row = allCrewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAll[`${r.person_name}:${r.work_date}`] ?? 0)
      for (const a of assignments) {
        if (!jobIdsSet.has(a.job_id)) continue
        const pctHrs = hours * (a.pct / 100)
        totalHoursOnJob.set(a.job_id, (totalHoursOnJob.get(a.job_id) ?? 0) + pctHrs)
        if (r.work_date >= start && r.work_date <= end) {
          totalHoursOnJobInPeriod.set(a.job_id, (totalHoursOnJobInPeriod.get(a.job_id) ?? 0) + pctHrs)
        }
      }
    }

    const allocationJobsMap = new Map<string, { valueCreated: number; revenueBeforeOverhead: number; totalLaborOnJob: number }>()
    const laborJobIdsSeen = new Set<string>()
    for (const r of laborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      const jobId = hcp ? jobIdByHcp.get(hcp) ?? null : null
      if (!jobId || laborJobIdsSeen.has(jobId)) continue
      laborJobIdsSeen.add(jobId)
      const job = jobsById.get(jobId)
      const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const teamLaborCost = teamLaborCostByJobId.get(jobId) ?? 0
      const totalLaborOnJob = subLaborCost + teamLaborCost
      const partsCost = (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0)
      const totalBill = job?.revenue != null ? Number(job.revenue) : 0
      const pctComplete = job?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
      allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob })
    }
    for (const jobId of crewJobIds) {
      if (allocationJobsMap.has(jobId)) continue
      const j = jobsById.get(jobId)
      const hcp = (j?.hcp_number ?? '').trim().toLowerCase()
      const subLaborCost = hcp ? (laborCostByHcp.get(hcp) ?? 0) : 0
      const totalLaborOnJob = subLaborCost + (teamLaborCostByJobId.get(jobId) ?? 0)
      const partsCost = (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0)
      const totalBill = j?.revenue != null ? Number(j.revenue) : 0
      const pctComplete = j?.pct_complete ?? null
      const valueCreated = totalBill * ((pctComplete ?? 100) / 100)
      const revenueBeforeOverhead = valueCreated - partsCost - totalLaborOnJob
      allocationJobsMap.set(jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob })
    }

    const costOnJobInPeriod = new Map<string, number>()
    for (const j of laborJobs) {
      if (j.job_id) costOnJobInPeriod.set(j.job_id, (costOnJobInPeriod.get(j.job_id) ?? 0) + j.laborCost)
    }
    for (const j of crewJobs) {
      costOnJobInPeriod.set(j.job_id, (costOnJobInPeriod.get(j.job_id) ?? 0) + j.laborCost)
    }

    let allocatedRevenue = 0
    let allocatedProfit = 0
    for (const [jobId, { valueCreated, revenueBeforeOverhead, totalLaborOnJob }] of allocationJobsMap) {
      const costInPeriod = costOnJobInPeriod.get(jobId) ?? 0
      const ratio = totalLaborOnJob > 0 ? costInPeriod / totalLaborOnJob : (costInPeriod > 0 ? 1 : 0)
      allocatedRevenue += valueCreated * ratio
      allocatedProfit += revenueBeforeOverhead * ratio
    }

    if (forTeamSummary) {
      return {
        allocatedRevenue,
        allocatedProfit,
        hoursRows: hoursRows.map((r) => ({ work_date: r.work_date, hours: r.hours })),
        ...(usePaidOnly && {
          totalHoursPaidJobs: laborJobs.reduce((s, j) => s + j.hours, 0) + crewJobs.reduce((s, j) => s + j.hours, 0),
        }),
      }
    }

    for (const j of laborJobs) {
      j.totalJobHours = j.job_id ? (totalHoursOnJob.get(j.job_id) ?? 0) : 0
      j.userTotalHoursOnJob = j.job_id ? (personHoursOnJobAllTime.get(j.job_id) ?? 0) : 0
      j.userTotalLaborOnJob = j.job_id ? (personLaborCostByJobId.get(j.job_id) ?? 0) : 0
      const denominator = j.totalLaborOnJob
      const costRatio = denominator > 0 ? j.laborCost / denominator : (j.laborCost > 0 ? 1 : 0)
      const revenueCostRatio = denominator > 0 ? j.userTotalLaborOnJob / denominator : (j.userTotalLaborOnJob > 0 ? 1 : 0)
      j.userTotalContributionToBill = j.valueCreated * revenueCostRatio
      j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
      j.allocatedTotalBill = j.valueCreated * costRatio
      j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
      j.allocatedPartsCost = j.partsCost * costRatio
    }
    for (const j of crewJobs) {
      j.totalJobHours = totalHoursOnJob.get(j.job_id) ?? 0
      j.userTotalHoursOnJob = personHoursOnJobAllTime.get(j.job_id) ?? 0
      j.userTotalLaborOnJob = personLaborCostByJobId.get(j.job_id) ?? 0
      const denominator = j.totalLaborOnJob
      const costRatio = denominator > 0 ? j.laborCost / denominator : (j.laborCost > 0 ? 1 : 0)
      const revenueCostRatio = denominator > 0 ? j.userTotalLaborOnJob / denominator : (j.userTotalLaborOnJob > 0 ? 1 : 0)
      j.userTotalContributionToBill = j.valueCreated * revenueCostRatio
      j.userTotalContributionToRevenue = j.revenueBeforeOverhead * revenueCostRatio
      j.allocatedTotalBill = j.valueCreated * costRatio
      j.allocatedRevenueBeforeOverhead = j.revenueBeforeOverhead * costRatio
      j.allocatedPartsCost = j.partsCost * costRatio
    }

    setReviewLaborJobs(laborJobs)
    setReviewCrewJobs(crewJobs)
    setReviewAllocatedRevenue(allocatedRevenue)
    setReviewAllocatedProfit(allocatedProfit)
    setReviewHours(hoursRows.map((r) => ({ work_date: r.work_date, hours: r.hours })))
    setReviewReports(reports.map((r) => ({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at })))
    setReviewTasks(tasks)
    setReviewTasksOutstanding(outstandingTasks)
    const breakdownByJob: Record<string, ReviewLaborContributor[]> = {}
    for (const [jobId, perJob] of laborByJobAndPerson.entries()) {
      const rows: ReviewLaborContributor[] = []
      for (const [personName, agg] of perJob.entries()) {
        rows.push({
          personName,
          hours: agg.hours,
          laborCost: agg.subLaborCost + agg.crewLaborCost,
          subLaborCost: agg.subLaborCost,
          crewLaborCost: agg.crewLaborCost,
        })
      }
      rows.sort((a, b) => b.laborCost - a.laborCost || b.hours - a.hours || a.personName.localeCompare(b.personName))
      breakdownByJob[jobId] = rows
    }
    setReviewLaborByJobAndPerson(breakdownByJob)
    setReviewLoading(false)
  }

  useEffect(() => {
    if (showPeopleForReview.length === 0) return
    // Default state for the new toggleable Team Summary: nothing selected.
    // The detail panel below the table only renders once the user clicks a
    // name in the iframe (handled in onMessage below).
    if (selectedReviewPersonIndex < 0) return
    // Clamp when the roster shrinks (member removed from pay config) so the
    // index can't dangle past the end. Selecting `-1` is the only way to
    // mean "no selection"; we never silently fall back to person 0 here.
    if (selectedReviewPersonIndex >= showPeopleForReview.length) {
      setSelectedReviewPersonIndex(-1)
      return
    }
    const personName = showPeopleForReview[selectedReviewPersonIndex]
    if (personName) void loadReviewData(personName, false, reviewOnlyPaidInFull)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReviewPersonIndex, reviewPeriod, reviewCustomRangeStart, reviewCustomRangeEnd, reviewOnlyPaidInFull, showPeopleForReview, users])

  /**
   * Tier 3 — shared dataset fetched once for the whole team.
   * Replaces N × `loadReviewData()` round-trips with one set of queries that
   * covers every person in `showPeopleForReview`. Per-person numbers are then
   * derived from this union purely in JS by `derivePersonTeamSummary()`.
   */
  async function loadTeamReviewUnion(
    start: string,
    end: string,
    onlyPaidJobs: boolean,
    payConfigSnapshot: Record<string, PayConfigRow>,
  ): Promise<TeamReviewUnion> {
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const lookbackStart = twoYearsAgo.toLocaleDateString('en-CA')

    const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()

    const overheadSessionsAllTimeFetchPromise = (async () => {
      let q = supabase
        .from('clock_sessions')
        .select(
          'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
        )
        .gte('work_date', lookbackStart)
      if (officeJobLedgerId) {
        q = q.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`)
      } else {
        q = q.not('bid_id', 'is', null)
      }
      const res = await q
      return (res.data ?? []) as unknown as OverheadClockSessionRow[]
    })()

    const [
      periodLaborRes,
      allTimeLaborRes,
      periodCrewRes,
      allTimeCrewRes,
      periodCrewBidsRes,
      periodHoursRes,
      allTimeHoursRes,
      settingsRes,
      tallyRes,
      overheadSessionsAllTime,
    ] = await Promise.all([
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles, assigned_to_name').gte('job_date', start).lte('job_date', end),
      supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles, assigned_to_name').gte('job_date', lookbackStart),
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_crew_jobs').select('work_date, person_name, job_assignments').gte('work_date', lookbackStart),
      // Period-only bid crew rows -- modal display only, no all-time fetch needed.
      supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').gte('work_date', start).lte('work_date', end),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end),
      supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart),
      supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
      supabase.rpc('list_tally_parts_with_po'),
      overheadSessionsAllTimeFetchPromise,
    ])

    // Derive the period buckets (for per-person totals shown in the Team
    // Summary) and the period per-day map (for `derivePersonTeamSummary`'s
    // overhead callouts). The lifetime crew labor cost denominator no longer
    // needs an all-time per-day overhead map under Option E — pct is share of
    // the total day so the multiplicand is `dayHoursRaw`, not `dayHoursRaw -
    // overheadOnDay`. One fetch, period-only views.
    const overheadHoursByPerson: Record<string, { office: number; bid: number }> = {}
    const overheadHoursByPersonByDate: Record<string, number> = {}
    const overheadSessionsByPerson: TeamReviewUnion['overheadSessionsByPerson'] = {}
    for (const s of overheadSessionsAllTime) {
      if (s.rejected_at || s.revoked_at) continue
      if (s.approved_at == null) continue
      const bucket = overheadBucketForSession(officeJobLedgerId, s.job_ledger_id, s.bid_id)
      if (bucket == null) continue
      const hrs = approvedClosedSessionHours(s)
      if (hrs == null || hrs <= 0) continue
      const name = (s.users?.name ?? '').trim()
      if (!name) continue
      const dateKey = `${name}:${s.work_date}`
      if (s.work_date >= start && s.work_date <= end) {
        const cur = overheadHoursByPerson[name] ?? { office: 0, bid: 0 }
        if (bucket === 'office') cur.office += hrs
        else cur.bid += hrs
        overheadHoursByPerson[name] = cur
        overheadHoursByPersonByDate[dateKey] = (overheadHoursByPersonByDate[dateKey] ?? 0) + hrs
        // Skip open sessions for the modal (no clock_out_iso to render); they
        // already contributed null hours and were filtered above.
        if (s.clocked_out_at) {
          const list = overheadSessionsByPerson[name] ?? []
          list.push({
            sessionId: s.id,
            workDate: s.work_date,
            bucket,
            clockedInIso: s.clocked_in_at,
            clockedOutIso: s.clocked_out_at,
            hours: hrs,
            bidId: s.bid_id ?? null,
          })
          overheadSessionsByPerson[name] = list
        }
      }
    }

    const periodLaborRows = (periodLaborRes.data ?? []) as TeamPeriodLaborRow[]
    const allTimeLaborRows = (allTimeLaborRes.data ?? []) as TeamPeriodLaborRow[]
    const periodCrewRows = (periodCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const allTimeCrewRows = (allTimeCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; job_assignments: CrewJobAssignment[] }>
    const periodCrewBidRowsRaw = (periodCrewBidsRes.data ?? []) as Array<{ work_date: string; person_name: string; bid_assignments: CrewBidAssignment[] | null }>
    const periodCrewBidRows = periodCrewBidRowsRaw.map((r) => ({
      work_date: r.work_date,
      person_name: r.person_name,
      bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [],
    }))
    const periodHoursRows = (periodHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const allTimeHoursRows = (allTimeHoursRes.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const settingsRows = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
    const tallyParts = (tallyRes.data ?? []) as Array<{ job_id: string; part_id: string | null; price_at_time: number | null; fixture_cost: number | null; quantity: number }>

    const mileageCost = settingsRows.find((r) => r.key === 'drive_mileage_cost')?.value_num ?? 0.70
    const timePerMile = settingsRows.find((r) => r.key === 'drive_time_per_mile')?.value_num ?? 0.02

    const partsCostByJobId = new Map<string, number>()
    for (const r of tallyParts) {
      const cost = r.part_id == null
        ? Number(r.fixture_cost ?? 0) * Number(r.quantity)
        : Number(r.price_at_time ?? 0) * Number(r.quantity)
      partsCostByJobId.set(r.job_id, (partsCostByJobId.get(r.job_id) ?? 0) + cost)
    }

    const hoursMap: Record<string, number> = {}
    for (const h of periodHoursRows) {
      hoursMap[`${h.person_name}:${h.work_date}`] = h.hours
    }
    const hoursMapAllTime: Record<string, number> = {}
    for (const h of allTimeHoursRows) {
      hoursMapAllTime[`${h.person_name}:${h.work_date}`] = h.hours
    }

    // Items for all-time labor jobs (for laborCostByHcp lifetime calc).
    const allTimeLaborJobIds = allTimeLaborRows.map((r) => r.id)
    const laborItemsRes = allTimeLaborJobIds.length > 0
      ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed').in('job_id', allTimeLaborJobIds)
      : { data: [] }
    const laborItems = (laborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean }>
    const laborItemsByJobId = new Map<string, TeamLaborItem[]>()
    for (const i of laborItems) {
      const list = laborItemsByJobId.get(i.job_id) ?? []
      list.push({ count: i.count, hrs_per_unit: i.hrs_per_unit, is_fixed: i.is_fixed })
      laborItemsByJobId.set(i.job_id, list)
    }

    // Lifetime sub-labor cost per HCP (all assignees).
    const laborCostByHcp = new Map<string, number>()
    for (const r of allTimeLaborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const items = laborItemsByJobId.get(r.id) ?? []
      const totalHrs = items.reduce((s, i) => s + (i.is_fixed ? i.hrs_per_unit : i.count * i.hrs_per_unit), 0)
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      const laborCost = totalHrs * rate + driveCost
      laborCostByHcp.set(hcp, (laborCostByHcp.get(hcp) ?? 0) + laborCost)
    }

    const crewByDatePerson: Record<string, CrewJobRow> = {}
    for (const r of periodCrewRows) {
      crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }
    const crewByDatePersonAllTime: Record<string, CrewJobRow> = {}
    for (const r of allTimeCrewRows) {
      crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`] = {
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
      }
    }

    // Lifetime crew labor cost per job (all crew members).
    // Convention 1 — crew pct is share of the total day (matches the
    // `sync_crew_jobs_from_clock` trigger denominator and `teamLabor.ts` /
    // `payReportAssignmentsBreakdown.ts`). Multiply by `dayHoursRaw` so this
    // lifetime denominator stays on the same convention as the period
    // numerator in `derivePersonTeamSummary` and as the cost figures shown
    // on pay stubs / Person Review.
    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of allTimeCrewRows) {
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = payConfigSnapshot[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const dayHoursRaw = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      const rate = cfg?.hourly_wage ?? 0
      for (const a of assignments) {
        const pctHrs = dayHoursRaw * (a.pct / 100)
        const cost = pctHrs * rate
        teamLaborCostByJobId.set(a.job_id, (teamLaborCostByJobId.get(a.job_id) ?? 0) + cost)
      }
    }

    // Union of HCPs / jobIds across the whole team for the period.
    const unionLaborHcps = [...new Set(periodLaborRows.filter((r) => (r.job_number ?? '').trim()).map((r) => (r.job_number ?? '').trim().toLowerCase()))]
    const unionCrewJobIds = new Set<string>()
    for (const r of periodCrewRows) {
      const row = crewByDatePerson[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      for (const a of assignments) {
        unionCrewJobIds.add(a.job_id)
      }
    }

    const allJobIds = [...unionCrewJobIds]
    // Collect bid IDs across the period crew bid rows so we can resolve display
    // metadata (bid_number, project_name) for the Hours-breakdown modal.
    const unionCrewBidIds = new Set<string>()
    for (const r of periodCrewBidRows) {
      for (const a of r.bid_assignments) {
        if (a.bid_id) unionCrewBidIds.add(a.bid_id)
      }
    }
    const allBidIds = [...unionCrewBidIds]
    const [crewJobsRes, laborJobsRes, crewBidsRes] = await Promise.all([
      allJobIds.length > 0
        ? onlyPaidJobs
          ? supabase.rpc('get_jobs_ledger_by_ids_paid_only', { p_job_ids: allJobIds })
          : supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: allJobIds })
        : { data: [] },
      unionLaborHcps.length > 0
        ? onlyPaidJobs
          ? supabase.rpc('get_jobs_ledger_by_hcp_numbers_paid_only', { p_hcp_numbers: unionLaborHcps })
          : supabase.rpc('get_jobs_ledger_by_hcp_numbers', { p_hcp_numbers: unionLaborHcps })
        : { data: [] },
      allBidIds.length > 0
        ? supabase.rpc('get_bids_by_ids', { p_bid_ids: allBidIds })
        : { data: [] },
    ])
    const crewJobsLedger = (crewJobsRes.data ?? []) as TeamLedgerRow[]
    const laborJobsLedger = (laborJobsRes.data ?? []) as TeamLedgerRow[]
    const jobsById = new Map<string, TeamLedgerRow>()
    const jobIdByHcp = new Map<string, string>()
    for (const j of crewJobsLedger) {
      jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }
    for (const j of laborJobsLedger) {
      if (!jobsById.has(j.id)) jobsById.set(j.id, j)
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp) jobIdByHcp.set(hcp, j.id)
    }
    const bidRows = (crewBidsRes.data ?? []) as Array<{ id: string; bid_number: string | null; project_name: string | null; address: string | null }>
    const bidsById = new Map<string, { bid_number: string; project_name: string; address: string }>()
    for (const b of bidRows) {
      bidsById.set(b.id, {
        bid_number: (b.bid_number ?? '').trim(),
        project_name: (b.project_name ?? '').trim(),
        address: (b.address ?? '').trim(),
      })
    }

    const jobIds = Array.from(jobsById.keys())
    const [invoiceRes, materialsRes] = await Promise.all([
      jobIds.length > 0 ? supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
      jobIds.length > 0 ? supabase.from('jobs_ledger_materials').select('job_id, amount').in('job_id', jobIds) : Promise.resolve({ data: [] }),
    ])
    const invoiceAmountByJob: Record<string, number> = {}
    for (const row of (invoiceRes.data ?? []) as Array<{ job_id: string; invoice_amount: number | null }>) {
      invoiceAmountByJob[row.job_id] = Number(row.invoice_amount ?? 0)
    }
    const billedMaterialsByJobId = new Map<string, number>()
    for (const row of (materialsRes.data ?? []) as Array<{ job_id: string; amount: number }>) {
      billedMaterialsByJobId.set(row.job_id, (billedMaterialsByJobId.get(row.job_id) ?? 0) + Number(row.amount ?? 0))
    }

    return {
      periodLaborRows,
      periodCrewRows,
      periodCrewBidRows,
      periodHoursRows,
      mileageCost,
      timePerMile,
      jobsById,
      bidsById,
      jobIdByHcp,
      laborItemsByJobId,
      laborCostByHcp,
      teamLaborCostByJobId,
      partsCostByJobId,
      invoiceAmountByJob,
      billedMaterialsByJobId,
      hoursMap,
      crewByDatePerson,
      overheadHoursByPerson,
      overheadHoursByPersonByDate,
      overheadSessionsByPerson,
      officeJobLedgerId,
    }
  }

  async function loadTeamSummaryData(): Promise<TeamSummaryRow[]> {
    const [start, end] = getReviewDateRange()
    const days = getDaysInRange(start, end)
    const union = await loadTeamReviewUnion(start, end, reviewOnlyPaidInFull, payConfig)
    return showPeopleForReview.map((personName) =>
      derivePersonTeamSummary(union, personName, payConfig, reviewOnlyPaidInFull, days)
    )
  }

  // Snapshot of the inputs that determine `loadTeamSummaryData`'s output,
  // joined into a single string so the popup path can compare cheaply. We
  // sort the roster + payConfig keys so member order can't drift the key.
  function buildTeamSummaryCacheKey(): string {
    const [start, end] = getReviewDateRange()
    const roster = [...showPeopleForReview].sort().join(',')
    // payConfig sig: name → salary flag + wage. Catches wage-only edits that
    // wouldn't otherwise change `showPeopleForReview` membership.
    const pc = Object.keys(payConfig)
      .sort()
      .map((n) => {
        const cfg = payConfig[n]
        if (!cfg) return `${n}:?`
        return `${n}:${cfg.is_salary ? 's' : 'h'}${cfg.hourly_wage ?? ''}`
      })
      .join('|')
    return [start, end, reviewOnlyPaidInFull ? '1' : '0', roster, pc].join('::')
  }

  function getReviewPeriodLabel(): string {
    const [start, end] = getReviewDateRange()
    const labels: Record<ReviewPeriod, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
      this_week: 'This week (running)',
      last_week: 'Last week',
      last_two_weeks: 'Last two weeks',
      last_30_days: 'Last 30 days',
      last_90_days: 'Last 90 days',
      this_year: 'This year',
      custom: 'Custom range',
    }
    return `${labels[reviewPeriod]} (${start} – ${end})`
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
        showToast('No people in pay config. Add people in People pay config (Hours tab) first.', 'warning')
      }
      return
    }
    let win: Window | null = null
    let reqId = 0
    // v2.542 cache hit (popup only): if the inline iframe already rendered
    // for the exact same inputs, reuse those rows instead of issuing a fresh
    // `loadTeamSummaryData()`. Embedded refreshes always re-fetch since the
    // inline path *is* the cache source.
    const currentCacheKey = buildTeamSummaryCacheKey()
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
    const overheadRate = reviewOverheadRates.ratePerHour
    const overheadRateLoading = reviewOverheadRates.loading
    const overheadDecomp = {
      ratePerHour: reviewOverheadRates.ratePerHour,
      ratePerRevenueDecimal: reviewOverheadRates.ratePerRevenueDecimal,
      ratePerLaborDollar: reviewOverheadRates.ratePerLaborDollar,
      windowStart: reviewOverheadRates.windowStart,
      windowEnd: reviewOverheadRates.windowEnd,
      officeLabor90d: reviewOverheadRates.officeLabor90d,
      bidLabor90d: reviewOverheadRates.bidLabor90d,
      officeParts90d: reviewOverheadRates.officeParts90d,
      invoices90d: reviewOverheadRates.invoices90d,
      fieldHours90d: reviewOverheadRates.fieldHours90d,
      fieldLaborUsd90d: reviewOverheadRates.fieldLaborUsd90d,
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
        // mid-load still results in `cached.cacheKey !== buildTeamSummaryCacheKey()`
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
          // Number/HTML formatting now lives inside the iframe IIFE; the
          // parent only escapes the period label below. See iframe `renderTable()`.
          const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
          type DisplayRow = TeamSummaryRow & {
            profitAfterOverhead: number | null
            profitPerHourAfterOverhead: number | null
          }
          const enriched: DisplayRow[] = rows.map((r) => {
            // Charge overhead on ALL hours (field + office + bid) so the
            // popup's Team Summary column matches the inline path
            // (formatters.ts) and the Profit (after overhead) breakdown
            // modal's bottom-line total. See enrichTeamSummaryRowsForInline.
            const profitAfterOverhead = overheadRate != null ? r.profit - r.totalHours * overheadRate : null
            const profitPerHourAfterOverhead =
              profitAfterOverhead != null && r.totalHours > 0 ? profitAfterOverhead / r.totalHours : null
            return { ...r, profitAfterOverhead, profitPerHourAfterOverhead }
          })
          const sortedRows = [...enriched].sort((a, b) => b.profit - a.profit || a.personName.localeCompare(b.personName))

          // Cell builders, footer totals, and the row/footer HTML are now
          // built inside the iframe IIFE so client-side search + sort can
          // re-render without a parent round-trip. See `renderTable()` in
          // the iframe script below.

          const overheadMetaText = overheadRateLoading
            ? 'Overhead Method A: loading…'
            : overheadRate == null
              ? 'Overhead Method A: unavailable'
              : `Overhead Method A: $${overheadRate.toFixed(2)} per field hour (rolling 90-day rate)`
          const overheadMetaClickable = !overheadRateLoading && overheadRate != null
          const overheadMetaHtml = overheadMetaClickable
            ? `<button type="button" id="overhead-meta-btn" class="meta-sub-btn" title="Click for rate decomposition">${escapeHtml(overheadMetaText)} <span aria-hidden="true">&#9432;</span></button>`
            : escapeHtml(overheadMetaText)

          // Single payload that drives both the table render (sortable + filterable)
          // and the per-cell drilldown modals. `idx` is stable across sort/filter so
          // `breakdowns[idx]` lookups in the modal click router stay valid.
          const breakdownsPayload = sortedRows.map((r, i) => {
            const cfg = payConfig[r.personName]
            const payConfigSource = !cfg ? 'unknown' : (cfg.is_salary ? 'salary' : 'hourly')
            return {
              idx: i,
              name: r.personName,
              hb: r.hoursBreakdown,
              gb: r.grossBreakdown,
              nb: r.netBreakdown,
              pb: r.profitBreakdown,
              totalHours: r.totalHours,
              overheadHours: r.overheadHours,
              officeHours: r.officeHours,
              bidHours: r.bidHours,
              fieldHours: r.fieldHours,
              hourlyWage: r.hourlyWage,
              overheadLaborCost: r.overheadLaborCost,
              overheadSessions: r.overheadSessions,
              gross: r.gross,
              net: r.profit,
              profitAfterOverhead: r.profitAfterOverhead,
              revPerHour: r.revPerHour,
              netPerHour: r.profitPerHour,
              profitPerHourAfterOverhead: r.profitPerHourAfterOverhead,
              payConfigSource,
            }
          })
          const breakdownsJson = JSON.stringify(breakdownsPayload).replace(/</g, '\\u003c')
          const overheadRateJson = overheadRate == null ? 'null' : String(overheadRate)
          const overheadDecompJson = JSON.stringify(overheadDecomp).replace(/</g, '\\u003c')
          // Embedded only: the currently-expanded person name (or null) so the
          // iframe paints the highlighted row on first render without a
          // postMessage round-trip. The popup window has no per-person
          // detail panel so we always send null there.
          const initialSelectedPersonName =
            isEmbedded && selectedReviewPersonIndex >= 0
              ? showPeopleForReview[selectedReviewPersonIndex] ?? null
              : null
          const selectedPersonNameJson = JSON.stringify(initialSelectedPersonName).replace(/</g, '\\u003c')

          const embeddedResizeScript = isEmbedded
            ? `<script>(function(){
              if (window.parent === window) return;
              var lastH = 0;
              function postH(h){ var r = Math.ceil(h); if (r === lastH) return; lastH = r; try { parent.postMessage({ type: 'team-summary-resize', height: r }, '*'); } catch(e) {} }
              function reportHeight(){
                var modal = document.getElementById('modal');
                var open = modal && modal.classList.contains('open');
                var bodyH = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
                if (open) { postH(Math.max(bodyH, modal.offsetHeight + 100)); } else { postH(bodyH); }
              }
              reportHeight();
              if (typeof ResizeObserver === 'function') { try { new ResizeObserver(reportHeight).observe(document.body); } catch(e) {} }
              window.addEventListener('load', reportHeight);
              setTimeout(reportHeight, 100); setTimeout(reportHeight, 500);
              var m = document.getElementById('modal');
              if (m && typeof MutationObserver === 'function') { try { new MutationObserver(reportHeight).observe(m, { attributes: true, attributeFilter: ['class'] }); } catch(e) {} }
            })();</script>`
            : ''
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Team Summary</title><style>
      html, body { background: transparent; }
      body { font-family: sans-serif; margin: ${isEmbedded ? '0' : '1in'}; }
      h1 { margin-bottom: 0.25rem;${isEmbedded ? ' display: none;' : ''} }
      .meta { color: #6b7280; margin-bottom: 0.25rem;${isEmbedded ? ' font-size: 0.85rem;' : ''} }
      .meta-sub { color: #6b7280; margin-bottom: 0.75rem;${isEmbedded ? ' font-size: 0.85rem;' : ' font-size: 0.9rem;'} }
      .meta-sub-btn { background: none; border: 0; padding: 0; color: #2563eb; cursor: pointer; font: inherit; text-decoration: underline dotted; text-underline-offset: 2px; }
      .meta-sub-btn:hover { color: #1d4ed8; }
      .tools { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
      .tools input[type="search"] { padding: 0.35rem 0.6rem; border: 1px solid #d1d5db; border-radius: 4px; font: inherit; min-width: 220px; }
      .tools input[type="search"]:focus { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }
      .tools .reset-sort-btn { padding: 0.3rem 0.6rem; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
      .tools .reset-sort-btn:hover { background: #f9fafb; }
      .tools .reset-sort-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .tools .filter-status { color: #6b7280; font-size: 0.85rem; }
      table { width: auto; border-collapse: collapse; table-layout: auto; }
      th, td { border: 1px solid #e5e7eb; white-space: nowrap; }
      th { padding: 0.5rem 0.75rem; text-align: left; background: #f9fafb; font-weight: 600; vertical-align: bottom; position: relative; }
      th.num { text-align: center; }
      th[data-sort] { cursor: pointer; user-select: none; }
      th[data-sort]:hover { background: #f3f4f6; }
      th[data-sort]:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
      th .sort-indicator { display: inline-block; width: 0.7em; margin-left: 0.25em; color: #9ca3af; font-size: 0.75em; vertical-align: middle; }
      th[aria-sort="ascending"] .sort-indicator,
      th[aria-sort="descending"] .sort-indicator { color: #1f2937; }
      tfoot td { border-top: 2px solid #d1d5db; }
      tbody.empty-state td { padding: 1rem 0.75rem; text-align: center; color: #6b7280; font-style: italic; background: #fafafa; }
      .click-cell:hover { background: #eff6ff; }
      .click-cell:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
      /* Toggleable name cell — picks the person to expand below the table
         (the iframe posts team-summary-select-person and the parent React
         app mounts the per-person panel). Whole row tints when selected so
         the eye sees the active person instantly even on wide tables. */
      .person-name-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: none;
        border: 0;
        padding: 0;
        margin: 0;
        font: inherit;
        color: inherit;
        cursor: pointer;
        text-align: left;
      }
      .person-name-btn .chevron { color: #6b7280; font-size: 0.8em; width: 0.7em; display: inline-block; }
      .person-name-btn:hover .person-name-text { color: #2563eb; }
      .person-name-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; border-radius: 2px; }
      tbody tr.selected-person td { background: #dbeafe; }
      tbody tr.selected-person .person-name-btn .person-name-text { font-weight: 700; color: #1e3a8a; }
      tbody tr.selected-person .person-name-btn .chevron { color: #1e3a8a; }
      .footer-caption { color: #6b7280; font-size: 0.8rem; margin-top: 0.5rem; }
      .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; z-index: 9; }
      .modal-backdrop.open { display: block; }
      .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; padding: 1rem 1.5rem 1.5rem; max-width: 90vw; max-height: 85vh; overflow: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.25); display: none; z-index: 10; min-width: 400px; }
      .modal.open { display: block; }
      .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; gap: 1rem; }
      .modal-header h2 { margin: 0; font-size: 1.1rem; }
      .modal-header-actions { display: flex; align-items: center; gap: 0.5rem; }
      .modal-print { background: #fff; border: 1px solid #d1d5db; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; color: #374151; line-height: 1.2; }
      .modal-print:hover { background: #f9fafb; }
      .modal-print:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
      .modal-close { background: none; border: none; font-size: 1.5rem; line-height: 1; cursor: pointer; color: #6b7280; padding: 0.25rem 0.5rem; border-radius: 4px; }
      .modal-close:hover { background: #f3f4f6; color: #111827; }
      .modal-close:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
      .modal h3 { margin-top: 1.25rem; margin-bottom: 0.5rem; font-size: 0.95rem; color: #374151; }
      .modal table { width: 100%; }
      .modal th, .modal td { padding: 0.35rem 0.6rem; white-space: normal; }
      .modal td.num, .modal th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .modal .caption { color: #6b7280; font-size: 0.85rem; margin-top: 1rem; }
      /* Hours breakdown — hierarchical Day -> (pct) Job # | Job Name layout (v2.543). */
      .modal .hours-day-list { display: block; }
      .modal .hours-day-section { padding: 0.45rem 0; border-bottom: 1px solid #f3f4f6; }
      .modal .hours-day-section:last-child { border-bottom: none; }
      .modal .hours-day-header { color: #1f2937; font-weight: 600; font-size: 0.92rem; }
      /* Match the date's typography exactly so "6.8 hrs" reads the same as
         "Mon 2026-05-04"; only nudge for spacing. */
      .modal .hours-day-header .day-hours { margin-left: 0.5rem; }
      /* Clickable day-header variant: the whole row is a <button> that bridges
         out to the parent app to open DashboardMyTimeDayEditorModal for that
         (person, work_date). Only the date text gets the underline so the
         affordance is obvious without making the whole row visually noisy. */
      .modal button.hours-day-header.day-link {
        display: block;
        width: 100%;
        text-align: left;
        background: none;
        border: 0;
        padding: 0.15rem 0.35rem;
        margin: -0.15rem -0.35rem;
        font: inherit;
        color: inherit;
        cursor: pointer;
        border-radius: 4px;
      }
      .modal button.hours-day-header.day-link .day-link-date {
        color: #2563eb;
        text-decoration: underline dotted;
        text-underline-offset: 3px;
      }
      .modal button.hours-day-header.day-link:hover { background: #eff6ff; }
      .modal button.hours-day-header.day-link:hover .day-link-date { color: #1d4ed8; }
      .modal button.hours-day-header.day-link:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 1px;
      }
      .modal .hours-day-allocs { margin-left: 1.5rem; margin-top: 0.25rem; color: #374151; font-size: 0.9rem; line-height: 1.5; }
      .modal .hours-day-alloc { padding: 0.02rem 0; }
      .modal .hours-day-alloc .alloc-pct { display: inline-block; min-width: 3.4rem; color: #6b7280; font-variant-numeric: tabular-nums; }
      .modal .hours-day-alloc .alloc-jobnum { color: #1f2937; font-variant-numeric: tabular-nums; }
      .modal .hours-day-alloc .alloc-jobname { color: #4b5563; }
      .modal .hours-day-alloc .alloc-address { color: #6b7280; }
      .modal .hours-day-alloc .alloc-counted { color: #6b7280; margin-left: 0.5rem; font-variant-numeric: tabular-nums; }
      .modal .hours-day-noalloc { color: #9ca3af; font-style: italic; font-size: 0.85rem; padding: 0.05rem 0; }
      .modal .hours-day-total { margin-top: 0.85rem; padding-top: 0.5rem; border-top: 2px solid #d1d5db; font-weight: 600; font-size: 0.95rem; color: #1f2937; }
      @media print {
        body { margin: 0.5in; }
        .tools { display: none !important; }
        th[data-sort] { cursor: default; }
        th .sort-indicator { display: none; }
        .click-cell { color: inherit !important; text-decoration: none !important; cursor: default !important; }
        /* Default print: hide all modal chrome (whole-table print). */
        body:not(.printing-modal) .modal-backdrop,
        body:not(.printing-modal) .modal { display: none !important; }
        /* Modal-only print mode: hide everything except the modal body. */
        body.printing-modal h1,
        body.printing-modal .meta,
        body.printing-modal .meta-sub,
        body.printing-modal .tools,
        body.printing-modal > table,
        body.printing-modal .footer-caption,
        body.printing-modal .modal-backdrop,
        body.printing-modal .modal-print,
        body.printing-modal .modal-close { display: none !important; }
        body.printing-modal .modal {
          position: static !important;
          transform: none !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          max-width: 100% !important;
          max-height: none !important;
          min-width: 0 !important;
          display: block !important;
          overflow: visible !important;
        }
      }
    </style></head><body>
      <h1>Team Summary</h1>
      <div class="meta">${escapeHtml(getReviewPeriodLabel())} &middot; ${sortedRows.length} ${sortedRows.length === 1 ? 'person' : 'people'}</div>
      <div class="meta-sub">${overheadMetaHtml}</div>
      <div class="tools" id="tools">
        <input type="search" id="search-input" placeholder="Search by name…" aria-label="Filter people by name">
        <span class="filter-status" id="filter-status" aria-live="polite"></span>
        <button type="button" id="reset-sort" class="reset-sort-btn" title="Sort by Profit (after overhead), descending">Reset sort</button>
      </div>
      <table>
        <thead><tr>
          <th data-sort="name" tabindex="0" role="columnheader" aria-sort="none">Name<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="totalHours" tabindex="0" role="columnheader" aria-sort="none">Hours<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="overheadHours" tabindex="0" role="columnheader" aria-sort="none">Overhead<br>hrs<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="overheadLaborCost" tabindex="0" role="columnheader" aria-sort="none">Overhead<br>labor<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="fieldHours" tabindex="0" role="columnheader" aria-sort="none">Field<br>hrs<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="gross" tabindex="0" role="columnheader" aria-sort="none">Gross<br>Revenue<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="net" tabindex="0" role="columnheader" aria-sort="none">Net<br>Revenue<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="profitAfterOverhead" tabindex="0" role="columnheader" aria-sort="descending">Profit<br>(after overhead)<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="revPerHour" tabindex="0" role="columnheader" aria-sort="none">Gross<br>Revenue/hr<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="netPerHour" tabindex="0" role="columnheader" aria-sort="none">Net<br>Revenue/hr<span class="sort-indicator" aria-hidden="true"></span></th>
          <th class="num" data-sort="profitPerHourAfterOverhead" tabindex="0" role="columnheader" aria-sort="none">Profit/hr<br>(after overhead)<span class="sort-indicator" aria-hidden="true"></span></th>
        </tr></thead>
        <tbody id="tbody"></tbody>
        <tfoot id="tfoot"></tfoot>
      </table>
      <p class="footer-caption" id="footer-caption"></p>
      <div class="modal-backdrop" id="modal-backdrop"></div>
      <div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h2 id="modal-title"></h2>
          <div class="modal-header-actions">
            <button class="modal-print" id="modal-print" type="button" aria-label="Print this breakdown" title="Print only this breakdown">Print</button>
            <button class="modal-close" id="modal-close" type="button" aria-label="Close">&times;</button>
          </div>
        </div>
        <div id="modal-body"></div>
      </div>
      <script>(function(){
        var breakdowns = ${breakdownsJson};
        var overheadRate = ${overheadRateJson};
        var overheadDecomp = ${overheadDecompJson};
        // Currently-expanded person (or null). Set by the parent at render
        // time (initial paint) and mutated locally on toggle clicks; the
        // parent re-affirms it on each iframe srcDoc refresh by re-encoding
        // it into this JSON literal, so an auto-refresh never loses the
        // highlight or accidentally surfaces a stale selection.
        var selectedPersonName = ${selectedPersonNameJson};
        function escH(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
        function fmtH(n){ return (Math.round(n*10)/10).toFixed(1); }
        function fmtPct(n){ return Math.round(n) + '%'; }
        function fmtPct1(n){ return (Math.round(n*10)/10).toFixed(1) + '%'; }
        function fmtMoney(n){ return (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US', { maximumFractionDigits: 0 }); }

        // ---- Cell HTML builders (iframe-side; mirror the pre-v2.541 TS versions) ----
        var CELL_STYLE_BASE = 'padding:0.4rem 0.75rem;border:1px solid #e5e7eb;text-align:center;font-variant-numeric:tabular-nums;';
        var CELL_STYLE_DASH = 'padding:0.4rem 0.75rem;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;';
        var CELL_STYLE_NAME = 'padding:0.4rem 0.75rem;border:1px solid #e5e7eb;';
        function negS(n){ return n < 0 ? 'color:#b91c1c;' : ''; }
        function dashTd(){ return '<td style="' + CELL_STYLE_DASH + '">\u2014</td>'; }
        function plainMoneyTd(n){ return '<td style="' + CELL_STYLE_BASE + negS(n) + '">' + fmtMoney(n) + '</td>'; }
        function plainHoursTd(n){ return '<td style="' + CELL_STYLE_BASE + '">' + fmtH(n) + '</td>'; }
        function moneyOrDashTd(n){ return n == null ? dashTd() : plainMoneyTd(n); }
        // The name cell renders either as plain text (popup mode -- no
        // per-person detail panel exists outside the iframe) or as a toggle
        // button (embedded mode) that asks the parent React app to expand
        // the per-person panel below the Team Summary. We can't compute
        // nameClickable up here because bridgeTarget() hasn't been
        // defined yet during hoisting; we check at render time instead.
        function nameTd(s){
          if (!nameToggleableForRender()) {
            return '<td style="' + CELL_STYLE_NAME + '">' + escH(s) + '</td>';
          }
          var isSel = (selectedPersonName != null && s === selectedPersonName);
          // \u25BE = ▾ (expanded), \u25B8 = ▸ (collapsed). Mirrors the chevron
          // convention used in other collapse/expand toggles in the app.
          var chev = isSel ? '\u25BE' : '\u25B8';
          var title = isSel ? 'Hide breakdown' : 'Show breakdown';
          return '<td style="' + CELL_STYLE_NAME + '">'
            + '<button type="button" class="person-name-btn"'
            + ' data-action="toggle-person" data-person="' + escH(s) + '"'
            + ' aria-pressed="' + (isSel ? 'true' : 'false') + '"'
            + ' title="' + escH(title) + '">'
            + '<span class="chevron" aria-hidden="true">' + chev + '</span>'
            + '<span class="person-name-text">' + escH(s) + '</span>'
            + '</button></td>';
        }
        // Lazily checks the bridge so we don't depend on definition order
        // inside the IIFE. Embedded iframe -> true; popup window -> false
        // (no detail panel lives outside the popup, so a toggle would be a
        // dead button).
        function nameToggleableForRender(){
          // bridgeTarget() is defined later in this IIFE; function
          // declarations are hoisted so this works even when invoked from
          // buildRowHtml() called during initial renderTable().
          var bt = bridgeTarget();
          return !!(bt && bt.kind === 'parent');
        }
        // Clickable + keyboard-focusable cell. type drives modal routing; ariaLabel
        // is the screen-reader description (e.g. "Hours breakdown for Robert: 38.5").
        function clickCellTd(opts){
          var color = opts.colored === false ? '' : 'color:#2563eb;';
          var dec = 'text-decoration:underline dotted;text-underline-offset:2px;';
          return '<td class="click-cell" data-idx="' + opts.idx + '" data-type="' + opts.type
            + '" tabindex="0" role="button" aria-label="' + escH(opts.ariaLabel)
            + '" title="' + escH(opts.title || 'Click for breakdown')
            + '" style="' + CELL_STYLE_BASE + 'cursor:pointer;' + color + dec + (opts.extraStyle || '') + '">'
            + opts.content + '</td>';
        }
        function hoursClickableTd(n, idx, name, isSalary){
          // For salaried people we render "(s)" instead of the assumed
          // 8 hrs/weekday total — see TeamSummaryInline.Row for the
          // matching inline-component logic. The numeric value still
          // flows through r.totalHours, so the footer keeps summing.
          var content = isSalary ? '(s)' : fmtH(n);
          var aria = isSalary
            ? 'Hours breakdown for ' + name + ': salary (' + fmtH(n) + ' hours assumed)'
            : 'Hours breakdown for ' + name + ': ' + fmtH(n) + ' hours';
          var title = isSalary
            ? 'Salaried \u2014 ' + fmtH(n) + ' hrs assumed (8 hrs/weekday). Click for breakdown.'
            : 'Click for breakdown';
          return clickCellTd({ idx: idx, type: 'hours', content: content,
            ariaLabel: aria, title: title });
        }
        function overheadHoursClickableTd(n, idx, name){
          if (n <= 0) return dashTd();
          return clickCellTd({ idx: idx, type: 'overhead_hours', content: fmtH(n),
            ariaLabel: 'Overhead hours breakdown for ' + name + ': ' + fmtH(n) + ' hours',
            title: 'Click for office vs bid breakdown' });
        }
        function overheadLaborClickableTd(n, idx, name){
          if (!(n < 0)) return dashTd();
          return clickCellTd({ idx: idx, type: 'overhead_labor', content: fmtMoney(n),
            ariaLabel: 'Overhead labor breakdown for ' + name + ': ' + fmtMoney(n),
            title: 'Click for overhead-labor breakdown',
            colored: false, extraStyle: negS(n) });
        }
        function fieldHoursClickableTd(n, idx, name){
          if (n <= 0) return dashTd();
          return clickCellTd({ idx: idx, type: 'field_hours', content: fmtH(n),
            ariaLabel: 'Field hours breakdown for ' + name + ': ' + fmtH(n) + ' hours',
            title: 'Click for field-hours breakdown' });
        }
        function grossClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'gross', content: fmtMoney(n),
            ariaLabel: 'Gross revenue breakdown for ' + name + ': ' + fmtMoney(n),
            extraStyle: negS(n) });
        }
        function netClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'net', content: fmtMoney(n),
            ariaLabel: 'Net revenue breakdown for ' + name + ': ' + fmtMoney(n),
            extraStyle: negS(n) });
        }
        function profitClickableTd(n, idx, name){
          if (n == null) return dashTd();
          return clickCellTd({ idx: idx, type: 'profit', content: fmtMoney(n),
            ariaLabel: 'Profit after overhead breakdown for ' + name + ': ' + fmtMoney(n),
            extraStyle: negS(n) });
        }
        function grossPerHrClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'rev_per_hr', content: fmtMoney(n),
            ariaLabel: 'Gross revenue per hour breakdown for ' + name + ': ' + fmtMoney(n) + ' per hour',
            extraStyle: negS(n) });
        }
        function netPerHrClickableTd(n, idx, name){
          return clickCellTd({ idx: idx, type: 'net_per_hr', content: fmtMoney(n),
            ariaLabel: 'Net revenue per hour breakdown for ' + name + ': ' + fmtMoney(n) + ' per hour',
            extraStyle: negS(n) });
        }
        function profitPerHrClickableTd(n, idx, name){
          if (n == null) return dashTd();
          return clickCellTd({ idx: idx, type: 'profit_per_hr', content: fmtMoney(n),
            ariaLabel: 'Profit per hour after overhead breakdown for ' + name + ': ' + fmtMoney(n) + ' per hour',
            extraStyle: negS(n) });
        }
        function buildRowHtml(r){
          var i = r.idx;
          var hasHours = r.totalHours > 0;
          // Light-blue row tint marks the currently-expanded person so the
          // eye finds them even on wide tables. Matches .person-name-btn
          // bold/blue text via the tr.selected-person selector.
          var rowAttrs = (selectedPersonName != null && r.name === selectedPersonName)
            ? ' class="selected-person"'
            : '';
          return '<tr' + rowAttrs + '>'
            + nameTd(r.name)
            + hoursClickableTd(r.totalHours, i, r.name, r.payConfigSource === 'salary')
            + overheadHoursClickableTd(r.overheadHours, i, r.name)
            + overheadLaborClickableTd(r.overheadLaborCost, i, r.name)
            + fieldHoursClickableTd(r.fieldHours, i, r.name)
            + grossClickableTd(r.gross, i, r.name)
            + netClickableTd(r.net, i, r.name)
            + profitClickableTd(r.profitAfterOverhead, i, r.name)
            + (hasHours ? grossPerHrClickableTd(r.revPerHour, i, r.name) : dashTd())
            + (hasHours ? netPerHrClickableTd(r.netPerHour, i, r.name) : dashTd())
            + (hasHours ? profitPerHrClickableTd(r.profitPerHourAfterOverhead, i, r.name) : dashTd())
            + '</tr>';
        }
        function buildFooterHtml(visibleRows){
          var totals = { hours: 0, overheadHours: 0, fieldHours: 0, overheadLaborCost: 0, gross: 0, net: 0, profit: null };
          for (var i = 0; i < visibleRows.length; i++) {
            var r = visibleRows[i];
            totals.hours += r.totalHours;
            totals.overheadHours += r.overheadHours;
            totals.fieldHours += r.fieldHours;
            totals.overheadLaborCost += r.overheadLaborCost;
            totals.gross += r.gross;
            totals.net += r.net;
            if (r.profitAfterOverhead != null) totals.profit = (totals.profit || 0) + r.profitAfterOverhead;
          }
          var n = visibleRows.length;
          var totalN = breakdowns.length;
          var label = (n === totalN)
            ? n + ' ' + (n === 1 ? 'person' : 'people')
            : 'Filtered total \u00b7 ' + n + ' of ' + totalN + ' ' + (totalN === 1 ? 'person' : 'people');
          var teamGrossPerHr = totals.hours > 0 ? totals.gross / totals.hours : 0;
          var teamNetPerHr = totals.hours > 0 ? totals.net / totals.hours : 0;
          var teamProfitPerHr = (totals.profit != null && totals.hours > 0) ? totals.profit / totals.hours : null;
          var html = '<tr style="font-weight:600;background:#f9fafb;">';
          html += '<td style="padding:0.5rem 0.75rem;border:1px solid #e5e7eb;">' + escH(label) + '</td>';
          html += plainHoursTd(totals.hours);
          html += plainHoursTd(totals.overheadHours);
          html += plainMoneyTd(totals.overheadLaborCost);
          html += plainHoursTd(totals.fieldHours);
          html += plainMoneyTd(totals.gross);
          html += plainMoneyTd(totals.net);
          html += moneyOrDashTd(totals.profit);
          html += (totals.hours > 0 ? plainMoneyTd(teamGrossPerHr) : dashTd());
          html += (totals.hours > 0 ? plainMoneyTd(teamNetPerHr) : dashTd());
          html += (totals.hours > 0 ? moneyOrDashTd(teamProfitPerHr) : dashTd());
          html += '</tr>';
          return html;
        }

        // ---- Sort + filter state ----
        // Default sort matches the pre-v2.541 server order: profit (after overhead) desc.
        // null sort values (e.g. r.profitAfterOverhead === null when overheadRate hasn't
        // loaded) sort to the bottom regardless of direction so they don't claim ranks.
        var sortKey = 'profitAfterOverhead';
        var sortDir = 'desc';
        var searchQuery = '';
        function compareRows(a, b){
          var av = a[sortKey];
          var bv = b[sortKey];
          var aN = (av == null);
          var bN = (bv == null);
          if (aN && bN) return a.name.localeCompare(b.name);
          if (aN) return 1;
          if (bN) return -1;
          var d;
          if (sortKey === 'name') {
            d = String(av).localeCompare(String(bv));
          } else {
            d = (av < bv ? -1 : av > bv ? 1 : 0);
          }
          if (d === 0) return a.name.localeCompare(b.name);
          return sortDir === 'asc' ? d : -d;
        }
        function getVisibleRows(){
          var q = searchQuery.trim().toLowerCase();
          var arr = q
            ? breakdowns.filter(function(r){ return r.name.toLowerCase().indexOf(q) >= 0; })
            : breakdowns.slice();
          arr.sort(compareRows);
          return arr;
        }
        function updateSortIndicators(){
          var ths = document.querySelectorAll('th[data-sort]');
          for (var i = 0; i < ths.length; i++) {
            var th = ths[i];
            var key = th.getAttribute('data-sort');
            var span = th.querySelector('.sort-indicator');
            if (key === sortKey) {
              th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
              if (span) span.textContent = sortDir === 'asc' ? '\u25B2' : '\u25BC';
            } else {
              th.setAttribute('aria-sort', 'none');
              if (span) span.textContent = '';
            }
          }
          var resetBtn = document.getElementById('reset-sort');
          if (resetBtn) {
            var atDefault = (sortKey === 'profitAfterOverhead' && sortDir === 'desc');
            resetBtn.disabled = atDefault;
          }
        }
        function updateFilterStatus(visible){
          var status = document.getElementById('filter-status');
          if (!status) return;
          var totalN = breakdowns.length;
          if (!searchQuery.trim()) {
            status.textContent = '';
            return;
          }
          status.textContent = 'Showing ' + visible.length + ' of ' + totalN + (totalN === 1 ? ' person' : ' people');
        }
        function updateFooterCaption(visible){
          var cap = document.getElementById('footer-caption');
          if (!cap) return;
          var notes = [];
          if (searchQuery.trim() && visible.length < breakdowns.length) {
            notes.push('Footer totals reflect only the people shown above.');
          }
          notes.push('Workers archived or external-only contribute to job revenue but are not in this table; their share of those jobs is not summed here.');
          cap.textContent = notes.join(' ');
        }
        function attachClickCellHandlers(){
          var cells = document.querySelectorAll('.click-cell');
          for (var i = 0; i < cells.length; i++) {
            (function(cell){
              cell.addEventListener('click', function(){
                var idx = parseInt(cell.getAttribute('data-idx') || '-1', 10);
                var type = cell.getAttribute('data-type') || '';
                if (idx >= 0) openModal(idx, type);
              });
              cell.addEventListener('keydown', function(e){
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                  e.preventDefault();
                  var idx = parseInt(cell.getAttribute('data-idx') || '-1', 10);
                  var type = cell.getAttribute('data-type') || '';
                  if (idx >= 0) openModal(idx, type);
                }
              });
            })(cells[i]);
          }
        }
        function renderTable(){
          var visible = getVisibleRows();
          var tbody = document.getElementById('tbody');
          var tfoot = document.getElementById('tfoot');
          if (!tbody || !tfoot) return;
          if (visible.length === 0) {
            tbody.className = 'empty-state';
            tbody.innerHTML = '<tr><td colspan="11">No matches' + (searchQuery.trim() ? ' for \u201C' + escH(searchQuery.trim()) + '\u201D' : '') + '.</td></tr>';
          } else {
            tbody.className = '';
            var rowHtml = '';
            for (var i = 0; i < visible.length; i++) rowHtml += buildRowHtml(visible[i]);
            tbody.innerHTML = rowHtml;
          }
          tfoot.innerHTML = buildFooterHtml(visible);
          updateSortIndicators();
          updateFilterStatus(visible);
          updateFooterCaption(visible);
          attachClickCellHandlers();
        }
        // v2.543 — Hours breakdown renders each day as its own block with the
        // crew allocations indented underneath in the format
        //   (percent) Job # | Job Name
        // (vs the older single-row table where allocations were a comma-joined
        // string in a third column). Hierarchy reads better when there are 3+
        // jobs in a day and matches the way operators describe the day verbally.
        function dowShort(dateStr){
          // Local-noon parse to dodge UTC drift, e.g. 2026-05-12T12:00:00.
          if (!dateStr) return '';
          var dt = new Date(dateStr + 'T12:00:00');
          if (isNaN(dt.getTime())) return '';
          return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
        }
        function dayHeaderLabel(dateStr){
          var dow = dowShort(dateStr);
          return (dow ? dow + ' ' : '') + escH(dateStr);
        }
        function buildAllocLineHtml(a, opts){
          var jobName = a.jobName ? escH(a.jobName) : '<span style="color:#9ca3af;">\u2014</span>';
          var html = '<div class="hours-day-alloc">'
            + '<span class="alloc-pct">(' + fmtPct1(a.pct) + ')</span> '
            + '<span class="alloc-jobnum">' + escH(a.hcp) + '</span> | '
            + '<span class="alloc-jobname">' + jobName + '</span>';
          // Render the address only when present so blank addresses on
          // Office / future jobs don't trail with a dangling "- ".
          if (a.address) {
            html += ' <span class="alloc-address">- ' + escH(a.address) + '</span>';
          }
          if (opts && opts.showCounted) {
            html += '<span class="alloc-counted">\u00b7 ' + fmtH(a.hours) + ' hrs counted</span>';
          }
          html += '</div>';
          return html;
        }
        function buildDaySectionHtml(d, opts){
          var html = '<div class="hours-day-section">';
          var headerInner = '<span class="day-link-date">' + dayHeaderLabel(d.date) + '</span>'
            + '<span class="day-hours">\u00b7 ' + fmtH(d.hours) + ' hrs</span>';
          if (opts && opts.showCounted) {
            var counted = d.crewAllocations.reduce(function(s,a){ return s + a.hours; }, 0);
            headerInner += '<span class="day-hours">\u00b7 ' + fmtH(counted) + ' hrs counted</span>';
          }
          // Render the header as a <button> when the parent app is reachable
          // (embedded mode, or popup that still has window.opener). Clicking
          // the button posts a message asking the parent to open
          // DashboardMyTimeDayEditorModal for (personName, d.date).
          var clickable = opts && opts.clickableDay && opts.personName;
          if (clickable) {
            html += '<button type="button" class="hours-day-header day-link"'
              + ' data-action="open-day-editor"'
              + ' data-person="' + escH(opts.personName) + '"'
              + ' data-date="' + escH(d.date) + '"'
              + ' title="Open My Time for this day"'
              + ' aria-label="Open My Time for ' + escH(opts.personName) + ' on ' + escH(d.date) + '">'
              + headerInner
              + '</button>';
          } else {
            html += '<div class="hours-day-header">' + headerInner + '</div>';
          }
          html += '<div class="hours-day-allocs">';
          if (d.crewAllocations.length === 0) {
            html += '<div class="hours-day-noalloc">No crew assignment</div>';
          } else {
            // Sort allocations within the day by descending pct so the
            // biggest job rises to the top of each day's list.
            var allocs = d.crewAllocations.slice().sort(function(a,b){ return b.pct - a.pct; });
            for (var ai = 0; ai < allocs.length; ai++) {
              html += buildAllocLineHtml(allocs[ai], opts);
            }
          }
          html += '</div>';
          html += '</div>';
          return html;
        }
        function buildHoursBody(hb, modalOpts){
          // modalOpts: { personName, clickableDay } — flows from openModal()
          // into buildDaySectionHtml so day headers can render as clickable
          // buttons that bridge to DashboardMyTimeDayEditorModal in the parent.
          var personName = (modalOpts && modalOpts.personName) || '';
          var clickableDay = !!(modalOpts && modalOpts.clickableDay && personName);
          var sectionOpts = function(showCounted){
            return { showCounted: showCounted, clickableDay: clickableDay, personName: personName };
          };
          var srcLabel = hb.source === 'salary' ? 'Salaried (8 hrs/weekday)' : hb.source === 'hourly' ? 'Hourly (from people_hours / clock sessions)' : 'Unknown (no pay config row)';
          var modeLabel = hb.onlyPaidJobs ? 'Only paid jobs (sub labor + crew assignments)' : 'All days in period (clocked / salary)';
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div><strong>Source:</strong> ' + escH(srcLabel) + '</div>';
          html += '<div><strong>Counting mode:</strong> ' + escH(modeLabel) + '</div>';
          html += '</div>';
          // Sort dailyRows by date asc so the day-by-day story reads naturally.
          var sortedDailyRows = hb.dailyRows.slice().sort(function(a,b){ return (a.date || '').localeCompare(b.date || ''); });
          if (hb.onlyPaidJobs) {
            var hasCrew = sortedDailyRows.some(function(d){ return d.crewAllocations.length > 0; });
            if (hasCrew) {
              html += '<h3>Crew jobs (per day)</h3>';
              html += '<div class="hours-day-list">';
              for (var i = 0; i < sortedDailyRows.length; i++) {
                var d = sortedDailyRows[i];
                if (d.crewAllocations.length === 0) continue;
                html += buildDaySectionHtml(d, sectionOpts(true));
              }
              html += '</div>';
              html += '<div class="hours-day-total">Crew subtotal: ' + fmtH(hb.totals.crew) + ' hrs</div>';
            }
            if (hb.subLaborRows.length > 0) {
              html += '<h3>Sub labor jobs</h3>';
              html += '<table><thead><tr><th>Date</th><th>HCP</th><th class="num">Hours</th></tr></thead><tbody>';
              var sub = hb.subLaborRows.slice().sort(function(a,b){ return (a.date || '').localeCompare(b.date || ''); });
              for (var k=0; k<sub.length; k++) {
                var s = sub[k];
                html += '<tr><td>' + escH(s.date) + '</td><td>' + escH(s.hcp) + '</td><td class="num">' + fmtH(s.hours) + '</td></tr>';
              }
              html += '</tbody><tfoot><tr><td colspan="2" style="text-align:right;font-weight:600;">Sub labor subtotal</td><td class="num" style="font-weight:600;">' + fmtH(hb.totals.subLabor) + '</td></tr></tfoot></table>';
            }
            html += '<p class="caption">Total = crew (' + fmtH(hb.totals.crew) + ') + sub labor (' + fmtH(hb.totals.subLabor) + ') = ' + fmtH(hb.totals.totalHours) + ' hrs. Each crew line shows <em>(pct) Job # | Job Name</em>; pct is the share of the day attributed to that job.</p>';
          } else {
            if (sortedDailyRows.length > 0) {
              html += '<div class="hours-day-list">';
              for (var i2 = 0; i2 < sortedDailyRows.length; i2++) {
                html += buildDaySectionHtml(sortedDailyRows[i2], sectionOpts(false));
              }
              html += '</div>';
            } else {
              html += '<p class="caption">No daily hours recorded in this period.</p>';
            }
            if (hb.subLaborRows.length > 0) {
              html += '<h3 style="margin-top:1.5rem;">Sub labor jobs (informational \u2014 not counted in this mode)</h3>';
              html += '<table><thead><tr><th>Date</th><th>HCP</th><th class="num">Hours</th></tr></thead><tbody>';
              var sub2 = hb.subLaborRows.slice().sort(function(a,b){ return (a.date || '').localeCompare(b.date || ''); });
              for (var k2=0; k2<sub2.length; k2++) {
                var s2 = sub2[k2];
                html += '<tr><td>' + escH(s2.date) + '</td><td>' + escH(s2.hcp) + '</td><td class="num">' + fmtH(s2.hours) + '</td></tr>';
              }
              html += '</tbody><tfoot><tr><td colspan="2" style="text-align:right;font-weight:600;">Sub labor subtotal</td><td class="num" style="font-weight:600;">' + fmtH(hb.totals.subLabor) + '</td></tr></tfoot></table>';
            }
            // Always-on discoverability hint for the Review-level toggle, even
            // when this period has no sub-labor rows -- they may exist in
            // other periods and the toggle still affects how Hours is counted.
            html += '<p class="caption">Sub labor hours are not added in this mode \u2014 toggle "Only paid jobs" in Review to count them.</p>';
          }
          return html;
        }
        function buildGrossBody(gb) {
          var html = '';
          if (!gb.jobs || gb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to revenue in this period.</p>';
            html += '<p class="caption">Gross Revenue is each job\\'s <strong>Value Created</strong> (Total Bill &times; % Complete) multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
            return html;
          }
          // Center every column header and cell so the table reads as a
          // centered grid (numbers still tabular-aligned via font-variant).
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num" style="text-align:center;">HCP</th>';
          html += '<th style="text-align:center;">Job</th>';
          html += '<th class="num" style="text-align:center;">Total Bill</th>';
          html += '<th class="num" style="text-align:center;">% Complete</th>';
          html += '<th class="num" style="text-align:center;">Value Created</th>';
          html += '<th class="num" style="text-align:center;">Your cost<br>(period)</th>';
          html += '<th class="num" style="text-align:center;">Total labor<br>(lifetime)</th>';
          html += '<th class="num" style="text-align:center;">Share</th>';
          html += '<th class="num" style="text-align:center;">Allocated</th>';
          html += '</tr></thead><tbody>';
          for (var i = 0; i < gb.jobs.length; i++) {
            var j = gb.jobs[i];
            var pctSuffix = j.pctCompleteSource === 'assumed' ? ' (assumed)' : '';
            html += '<tr>';
            html += '<td class="num" style="text-align:center;">' + escH(j.hcp) + '</td>';
            html += '<td style="text-align:center;">' + escH(j.jobName || '—') + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.totalBill) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtPct(j.pctComplete) + escH(pctSuffix) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.valueCreated) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.costInPeriod) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.totalLaborOnJob) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtPct1(j.ratio * 100) + '</td>';
            html += '<td class="num" style="text-align:center;">' + fmtMoney(j.allocatedRevenue) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td colspan="8" style="text-align:right;font-weight:600;">Total</td><td class="num" style="text-align:center;font-weight:600;">' + fmtMoney(gb.total) + '</td></tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Allocated = Value Created &times; (Your cost &divide; Total labor). Sorted by allocated revenue.</p>';
          html += '<p class="caption">Gross Revenue is each job\\'s <strong>Value Created</strong> (Total Bill &times; % Complete) multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
          return html;
        }
        function buildNetBody(nb) {
          var html = '';
          if (!nb.jobs || nb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            html += '<p class="caption">Net Revenue is each job\\'s <strong>Net Revenue (before overhead)</strong> &mdash; Value Created minus parts and total labor &mdash; multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
            return html;
          }
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Value<br>Created</th>';
          html += '<th class="num">&minus; Parts</th>';
          html += '<th class="num">&minus; Total<br>labor</th>';
          html += '<th class="num">= Net Rev<br>(job)</th>';
          html += '<th class="num">Your cost<br>(period)</th>';
          html += '<th class="num">Share</th>';
          html += '<th class="num">Allocated</th>';
          html += '</tr></thead><tbody>';
          for (var i = 0; i < nb.jobs.length; i++) {
            var j = nb.jobs[i];
            html += '<tr>';
            html += '<td class="num">' + escH(j.hcp) + '</td>';
            html += '<td>' + escH(j.jobName || '—') + '</td>';
            html += '<td class="num">' + fmtMoney(j.valueCreated) + '</td>';
            html += '<td class="num">' + fmtMoney(j.partsCost) + '</td>';
            html += '<td class="num">' + fmtMoney(j.totalLaborOnJob) + '</td>';
            html += '<td class="num"' + (j.revenueBeforeOverhead < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(j.revenueBeforeOverhead) + '</td>';
            html += '<td class="num">' + fmtMoney(j.costInPeriod) + '</td>';
            html += '<td class="num">' + fmtPct1(j.ratio * 100) + '</td>';
            html += '<td class="num"' + (j.allocatedNet < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(j.allocatedNet) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td colspan="8" style="text-align:right;font-weight:600;">Total</td><td class="num"' + (nb.total < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoney(nb.total) + '</td></tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Allocated = Net Rev (job) &times; (Your cost &divide; Total labor). Net Rev (job) = Value Created &minus; Parts &minus; Total labor. Sorted by allocated net.</p>';
          html += '<p class="caption">Net Revenue is each job\\'s <strong>Net Revenue (before overhead)</strong> &mdash; Value Created minus parts and total labor &mdash; multiplied by your <strong>share</strong> on that job (your labor cost in this period &divide; total labor on the job, all-time).</p>';
          return html;
        }
        function buildProfitBody(pb) {
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          if (overheadRate == null) {
            html += '<div style="margin-bottom:0.5rem;color:#b91c1c;">Overhead rate is unavailable. Open the Review tab and let the rate finish loading, then reopen Team Summary.</div>';
            html += '<div style="font-size:1.05rem;"><strong>Net Revenue: ' + fmtMoney(pb.totalNet) + '</strong></div>';
            return html;
          }
          var fieldHrs = (pb.fieldHours != null ? pb.fieldHours : pb.totalHours);
          var overheadHrs = (pb.overheadHours != null ? pb.overheadHours : 0);
          // Overhead is charged on every hour worked in the period (field
          // + office + bid). See enrichTeamSummaryRowsForInline and
          // drilldowns.tsx ProfitBody — same math so the popup column,
          // inline column, and breakdown total all reconcile.
          var fieldOverhead = fieldHrs * overheadRate;
          var overheadHoursOverhead = overheadHrs * overheadRate;
          var totalOverhead = fieldOverhead + overheadHoursOverhead;
          var totalProfit = pb.totalNet - totalOverhead;
          html += '<div style="margin-bottom:0.25rem;"><strong>Overhead rate (Method A):</strong> $' + overheadRate.toFixed(2) + ' per hour</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Net Revenue:</strong> ' + fmtMoney(pb.totalNet) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(pb.totalHours) + ' (field ' + fmtH(fieldHrs) + (overheadHrs > 0.005 ? ' + overhead ' + fmtH(overheadHrs) : '') + ')</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>&minus; Overhead deduction:</strong> ' + fmtH(pb.totalHours) + ' &times; $' + overheadRate.toFixed(2) + ' = ' + fmtMoney(totalOverhead) + '</div>';
          if (overheadHrs > 0.005) {
            html += '<div style="margin-bottom:0.25rem;padding-left:1.5rem;color:#6b7280;">(' + fmtMoney(fieldOverhead) + ' field + ' + fmtMoney(overheadHoursOverhead) + ' overhead hours)</div>';
          }
          html += '<div style="font-size:1.05rem;"><strong>Profit (after overhead): <span' + (totalProfit < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(totalProfit) + '</span></strong></div>';
          html += '</div>';
          var rows = (pb.jobs || []).map(function(j){
            var oh = j.hoursInPeriod * overheadRate;
            var profit = j.allocatedNet - oh;
            return { hcp: j.hcp, jobName: j.jobName, allocatedNet: j.allocatedNet, hoursInPeriod: j.hoursInPeriod, overhead: oh, profit: profit };
          });
          rows.sort(function(a, b){ return b.profit - a.profit; });
          if (rows.length === 0 && overheadHrs < 0.005 && pb.unaccountedHours < 0.01) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            return html;
          }
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Net Rev<br>(allocated)</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '<th class="num">&minus; Overhead<br>(hrs &times; rate)</th>';
          html += '<th class="num">= Profit<br>(after overhead)</th>';
          html += '</tr></thead><tbody>';
          for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num"' + (r.allocatedNet < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(r.allocatedNet) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '<td class="num">' + fmtMoney(r.overhead) + '</td>';
            html += '<td class="num"' + (r.profit < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(r.profit) + '</td>';
            html += '</tr>';
          }
          if (overheadHrs > 0.005) {
            html += '<tr style="background:#f9fafb;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Overhead hours</em></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(overheadHrs) + '</td>';
            html += '<td class="num">' + fmtMoney(overheadHoursOverhead) + '</td>';
            html += '<td class="num" style="color:#b91c1c;">' + fmtMoney(-overheadHoursOverhead) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            var unOh = pb.unaccountedHours * overheadRate;
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that were not tied to a job, but still incur overhead.</div></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '<td class="num">' + fmtMoney(unOh) + '</td>';
            html += '<td class="num" style="color:#b91c1c;">' + fmtMoney(-unOh) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="2" style="text-align:right;font-weight:600;">Total<br>(all hours)</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoney(pb.totalNet) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(pb.totalHours) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoney(totalOverhead) + '</td>';
          html += '<td class="num"' + (totalProfit < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoney(totalProfit) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Per-job overhead = your hours on that job &times; rate. Profit (job) = Allocated Net Rev &minus; Overhead. Job rows sorted by profit. Overhead hours (' + fmtH(overheadHrs) + ') are charged the same rate as field hours but contribute no revenue, so they appear as a single deduction-only row.</p>';
          html += '<p class="caption">Profit (after overhead) = Net Revenue &minus; (<strong>all hours</strong> &times; rate). The rate is the rolling 90-day overhead spend per field hour; we apply it to every hour the person worked (field + office + bid) so the deduction reflects this person\\'s full share of the overhead burden.</p>';
          return html;
        }
        function fmtMoneyPerHr(n) { return fmtMoney(n) + '/hr'; }
        function buildGrossPerHourBody(entry) {
          var gb = entry.gb;
          var pb = entry.pb;
          var totalHours = pb.totalHours;
          var totalGross = gb.total;
          var rate = totalHours > 0 ? totalGross / totalHours : 0;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div style="margin-bottom:0.25rem;"><strong>Gross Revenue:</strong> ' + fmtMoney(totalGross) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(totalHours) + '</div>';
          html += '<div style="font-size:1.05rem;"><strong>Gross Revenue/hr: ' + fmtMoneyPerHr(rate) + '</strong></div>';
          html += '</div>';
          if (!gb.jobs || gb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to revenue in this period.</p>';
            return html;
          }
          var hoursByJob = {};
          for (var i = 0; i < pb.jobs.length; i++) hoursByJob[pb.jobs[i].jobId] = pb.jobs[i].hoursInPeriod;
          var rows = gb.jobs.map(function(j){
            var h = hoursByJob[j.jobId] || 0;
            var perHr = h > 0 ? j.allocatedRevenue / h : null;
            return { hcp: j.hcp, jobName: j.jobName, allocatedRevenue: j.allocatedRevenue, hoursInPeriod: h, perHr: perHr };
          });
          rows.sort(function(a, b){ return (b.perHr == null ? -1 : b.perHr) - (a.perHr == null ? -1 : a.perHr); });
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Allocated<br>Gross Rev</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '<th class="num">$/hr<br>(this job)</th>';
          html += '</tr></thead><tbody>';
          for (var k = 0; k < rows.length; k++) {
            var r = rows[k];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num">' + fmtMoney(r.allocatedRevenue) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '<td class="num">' + (r.perHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.perHr)) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that weren\\'t tied to a job &mdash; they dilute the headline rate but contribute no revenue.</div></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '<td class="num"><span style="color:#9ca3af;">&mdash;</span></td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="2" style="text-align:right;font-weight:600;">Total</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoney(totalGross) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(totalHours) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtMoneyPerHr(rate) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Headline rate = Total Gross Revenue &divide; Total hours (including any unallocated hours). Per-job rate = Allocated Gross &divide; Your hours on that job. Sorted by per-job rate.</p>';
          html += '<p class="caption">Gross Revenue/hr is your <strong>total Gross Revenue</strong> divided by your <strong>total hours</strong> in the period. Per-job rates show how much each job paid per hour you spent on it.</p>';
          return html;
        }
        function buildNetPerHourBody(entry) {
          var nb = entry.nb;
          var pb = entry.pb;
          var totalHours = pb.totalHours;
          var totalNet = nb.total;
          var rate = totalHours > 0 ? totalNet / totalHours : 0;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div style="margin-bottom:0.5rem;">Net Revenue/hr is your <strong>total Net Revenue (before overhead)</strong> divided by your <strong>total hours</strong> in the period. Per-job rates show how much each job kept (after parts and labor) per hour you spent on it.</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Net Revenue:</strong> ' + fmtMoney(totalNet) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(totalHours) + '</div>';
          html += '<div style="font-size:1.05rem;"><strong>Net Revenue/hr: <span' + (rate < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoneyPerHr(rate) + '</span></strong></div>';
          html += '</div>';
          if (!nb.jobs || nb.jobs.length === 0) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            return html;
          }
          var hoursByJob = {};
          for (var i = 0; i < pb.jobs.length; i++) hoursByJob[pb.jobs[i].jobId] = pb.jobs[i].hoursInPeriod;
          var rows = nb.jobs.map(function(j){
            var h = hoursByJob[j.jobId] || 0;
            var perHr = h > 0 ? j.allocatedNet / h : null;
            return { hcp: j.hcp, jobName: j.jobName, allocatedNet: j.allocatedNet, hoursInPeriod: h, perHr: perHr };
          });
          rows.sort(function(a, b){ return (b.perHr == null ? -Infinity : b.perHr) - (a.perHr == null ? -Infinity : a.perHr); });
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Allocated<br>Net Rev</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '<th class="num">$/hr<br>(this job)</th>';
          html += '</tr></thead><tbody>';
          for (var k = 0; k < rows.length; k++) {
            var r = rows[k];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num"' + (r.allocatedNet < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(r.allocatedNet) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '<td class="num"' + (r.perHr != null && r.perHr < 0 ? ' style="color:#b91c1c;"' : '') + '>' + (r.perHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.perHr)) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that weren\\'t tied to a job &mdash; they dilute the headline rate but contribute no net revenue.</div></td>';
            html += '<td class="num">' + fmtMoney(0) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '<td class="num"><span style="color:#9ca3af;">&mdash;</span></td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="2" style="text-align:right;font-weight:600;">Total</td>';
          html += '<td class="num"' + (totalNet < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoney(totalNet) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(totalHours) + '</td>';
          html += '<td class="num"' + (rate < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoneyPerHr(rate) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Headline rate = Total Net Revenue &divide; Total hours (including any unallocated hours). Per-job rate = Allocated Net &divide; Your hours on that job. Sorted by per-job rate.</p>';
          return html;
        }
        function buildProfitPerHourBody(entry) {
          var nb = entry.nb;
          var pb = entry.pb;
          var totalHours = pb.totalHours;
          var fieldHrs = (pb.fieldHours != null ? pb.fieldHours : totalHours);
          var overheadHrs = (pb.overheadHours != null ? pb.overheadHours : 0);
          var totalNet = nb.total;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          if (overheadRate == null) {
            html += '<div style="margin-bottom:0.5rem;color:#b91c1c;">Overhead rate is unavailable. Open the Review tab and let the rate finish loading, then reopen Team Summary.</div>';
            html += '<div><strong>Net Revenue:</strong> ' + fmtMoney(totalNet) + '</div>';
            html += '<div><strong>Total hours:</strong> ' + fmtH(totalHours) + '</div>';
            return html;
          }
          // Charge overhead on all hours (field + office + bid) so the
          // popup Profit/hr drilldown stays in sync with ProfitBody and
          // ProfitPerHourBody in drilldowns.tsx + the parent column math.
          var fieldOverhead = fieldHrs * overheadRate;
          var overheadHoursOverhead = overheadHrs * overheadRate;
          var totalOverhead = fieldOverhead + overheadHoursOverhead;
          var totalProfit = totalNet - totalOverhead;
          var rate = totalHours > 0 ? totalProfit / totalHours : 0;
          html += '<div style="margin-bottom:0.25rem;"><strong>Overhead rate (Method A):</strong> $' + overheadRate.toFixed(2) + ' per hour</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Net Revenue:</strong> ' + fmtMoney(totalNet) + '</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>Total hours:</strong> ' + fmtH(totalHours) + ' (field ' + fmtH(fieldHrs) + (overheadHrs > 0.005 ? ' + overhead ' + fmtH(overheadHrs) : '') + ')</div>';
          html += '<div style="margin-bottom:0.25rem;"><strong>&minus; Overhead deduction:</strong> ' + fmtH(totalHours) + ' &times; $' + overheadRate.toFixed(2) + ' = ' + fmtMoney(totalOverhead) + '</div>';
          if (overheadHrs > 0.005) {
            html += '<div style="margin-bottom:0.25rem;padding-left:1.5rem;color:#6b7280;">(' + fmtMoney(fieldOverhead) + ' field + ' + fmtMoney(overheadHoursOverhead) + ' overhead hours)</div>';
          }
          html += '<div style="margin-bottom:0.25rem;"><strong>Profit (after overhead):</strong> <span' + (totalProfit < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoney(totalProfit) + '</span></div>';
          html += '<div style="font-size:1.05rem;"><strong>Profit/hr (after overhead): <span' + (rate < 0 ? ' style="color:#b91c1c;"' : '') + '>' + fmtMoneyPerHr(rate) + '</span></strong></div>';
          html += '</div>';
          var hoursByJob = {};
          for (var i = 0; i < pb.jobs.length; i++) hoursByJob[pb.jobs[i].jobId] = pb.jobs[i].hoursInPeriod;
          var rows = (nb.jobs || []).map(function(j){
            var h = hoursByJob[j.jobId] || 0;
            var netPerHr = h > 0 ? j.allocatedNet / h : null;
            var profitPerHr = netPerHr == null ? null : netPerHr - overheadRate;
            return { hcp: j.hcp, jobName: j.jobName, allocatedNet: j.allocatedNet, hoursInPeriod: h, netPerHr: netPerHr, profitPerHr: profitPerHr };
          });
          rows.sort(function(a, b){ return (b.profitPerHr == null ? -Infinity : b.profitPerHr) - (a.profitPerHr == null ? -Infinity : a.profitPerHr); });
          if (rows.length === 0 && overheadHrs < 0.005 && pb.unaccountedHours < 0.01) {
            html += '<p class="caption">No jobs contributed to net revenue in this period.</p>';
            return html;
          }
          html += '<table>';
          html += '<thead><tr>';
          html += '<th class="num">HCP</th>';
          html += '<th>Job</th>';
          html += '<th class="num">Net Rev/hr<br>(this job)</th>';
          html += '<th class="num">&minus; Overhead<br>rate</th>';
          html += '<th class="num">= Profit/hr<br>(this job)</th>';
          html += '<th class="num">Your hours<br>(period)</th>';
          html += '</tr></thead><tbody>';
          for (var k = 0; k < rows.length; k++) {
            var r = rows[k];
            html += '<tr>';
            html += '<td class="num">' + escH(r.hcp) + '</td>';
            html += '<td>' + escH(r.jobName || '—') + '</td>';
            html += '<td class="num"' + (r.netPerHr != null && r.netPerHr < 0 ? ' style="color:#b91c1c;"' : '') + '>' + (r.netPerHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.netPerHr)) + '</td>';
            html += '<td class="num">' + (r.hoursInPeriod > 0 ? '$' + overheadRate.toFixed(2) + '/hr' : '<span style="color:#9ca3af;">—</span>') + '</td>';
            html += '<td class="num"' + (r.profitPerHr != null && r.profitPerHr < 0 ? ' style="color:#b91c1c;"' : '') + '>' + (r.profitPerHr == null ? '<span style="color:#9ca3af;">—</span>' : fmtMoneyPerHr(r.profitPerHr)) + '</td>';
            html += '<td class="num">' + fmtH(r.hoursInPeriod) + '</td>';
            html += '</tr>';
          }
          if (overheadHrs > 0.005) {
            html += '<tr style="background:#f9fafb;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Overhead hours</em><div style="color:#6b7280;font-size:0.8rem;">Office + bid time. No revenue, but still charged the overhead rate now that overhead hours are included in the deduction.</div></td>';
            html += '<td class="num">' + fmtMoneyPerHr(0) + '</td>';
            html += '<td class="num">$' + overheadRate.toFixed(2) + '/hr</td>';
            html += '<td class="num" style="color:#b91c1c;">' + fmtMoneyPerHr(-overheadRate) + '</td>';
            html += '<td class="num">' + fmtH(overheadHrs) + '</td>';
            html += '</tr>';
          }
          if (pb.unaccountedHours > 0.01) {
            html += '<tr style="background:#fff7ed;">';
            html += '<td class="num">&mdash;</td>';
            html += '<td><em>Unallocated hours</em><div style="color:#6b7280;font-size:0.8rem;">Hours worked in the period that weren\\'t tied to a job &mdash; they earn no net revenue but still incur overhead.</div></td>';
            html += '<td class="num">' + fmtMoneyPerHr(0) + '</td>';
            html += '<td class="num">$' + overheadRate.toFixed(2) + '/hr</td>';
            html += '<td class="num" style="color:#b91c1c;">' + fmtMoneyPerHr(-overheadRate) + '</td>';
            html += '<td class="num">' + fmtH(pb.unaccountedHours) + '</td>';
            html += '</tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr>';
          html += '<td colspan="4" style="text-align:right;font-weight:600;">Headline rate</td>';
          html += '<td class="num"' + (rate < 0 ? ' style="color:#b91c1c;font-weight:600;"' : ' style="font-weight:600;"') + '>' + fmtMoneyPerHr(rate) + '</td>';
          html += '<td class="num" style="font-weight:600;">' + fmtH(totalHours) + '</td>';
          html += '</tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Per-job: Profit/hr = (Allocated Net &divide; Your hours) &minus; Overhead rate. Headline rate = (Net Revenue &minus; Total overhead) &divide; Total hours, where <strong>total overhead = All hours &times; rate</strong> (every hour the person worked &mdash; field + office + bid &mdash; is charged the rate). Sorted by per-job profit/hr.</p>';
          html += '<p class="caption">Profit/hr (after overhead) divides your <strong>Profit (after overhead)</strong> by your <strong>total hours</strong>. The overhead deduction is <strong>all hours &times; rate</strong> &mdash; office and bid hours are charged the same per-hour overhead as field hours even though they earn no revenue, which is why those rows show a flat &minus;$ rate per hour.</p>';
          return html;
        }
        function buildOverheadSessionsSection(label, sessions, bucketTotalHrs) {
          // sessions: array of pre-formatted OverheadSessionLine entries with
          // a single bucket (office or bid). Renders a hierarchical layout
          // matching the Hours breakdown modal: per-day header + indented
          // per-session lines. (pct) on each session is its share of that
          // day's bucket total. bucketTotalHrs is rendered next to the
          // section label so e.g. "Office \u00b7 17.7 hrs".
          var html = '';
          if (!sessions || sessions.length === 0) return '';
          var headerHtml = escH(label);
          if (typeof bucketTotalHrs === 'number') {
            // Match the section label typography exactly (no muted color /
            // weight / size); just nudge with margin-left for spacing.
            headerHtml += '<span style="margin-left:0.5rem;">\u00b7 ' + fmtH(bucketTotalHrs) + ' hrs</span>';
          }
          html += '<h3 style="text-align:center;">' + headerHtml + '</h3>';
          html += '<div class="hours-day-list">';
          // Group by workDate, preserving the parent-side sort order.
          var byDate = {};
          var datesInOrder = [];
          for (var i = 0; i < sessions.length; i++) {
            var s = sessions[i];
            if (!byDate[s.workDate]) {
              byDate[s.workDate] = [];
              datesInOrder.push(s.workDate);
            }
            byDate[s.workDate].push(s);
          }
          for (var di = 0; di < datesInOrder.length; di++) {
            var dateKey = datesInOrder[di];
            var daySessions = byDate[dateKey];
            var dayTotal = 0;
            for (var si = 0; si < daySessions.length; si++) dayTotal += (daySessions[si].hours || 0);
            html += '<div class="hours-day-section">';
            html += '<div class="hours-day-header">' + dayHeaderLabel(dateKey)
              + '<span class="day-hours">\u00b7 ' + fmtH(dayTotal) + ' hrs</span>'
              + '</div>';
            html += '<div class="hours-day-allocs">';
            for (var sj = 0; sj < daySessions.length; sj++) {
              var ss = daySessions[sj];
              var pct = dayTotal > 0 ? (ss.hours / dayTotal) * 100 : 0;
              html += '<div class="hours-day-alloc">';
              html += '<span class="alloc-pct">(' + fmtPct1(pct) + ')</span> ';
              if (ss.bucket === 'bid') {
                // Match the Hours breakdown convention: B# | Project Name - address.
                var bidName = ss.bidName ? escH(ss.bidName) : '<span style="color:#9ca3af;">\u2014</span>';
                html += '<span class="alloc-jobnum">' + escH(ss.bidHcp || 'B?') + '</span> | ';
                html += '<span class="alloc-jobname">' + bidName + '</span>';
                if (ss.bidAddress) {
                  html += ' <span class="alloc-address">- ' + escH(ss.bidAddress) + '</span>';
                }
              } else {
                // Office sessions: time range + hours act as the "session details".
                if (ss.startTime && ss.endTime) {
                  html += '<span class="alloc-jobname">' + escH(ss.startTime + ' \u2192 ' + ss.endTime) + '</span>';
                } else {
                  html += '<span class="alloc-jobname">Office session</span>';
                }
              }
              html += '<span class="alloc-counted">\u00b7 ' + fmtH(ss.hours) + ' hrs</span>';
              html += '</div>';
            }
            html += '</div>';
            html += '</div>';
          }
          return html;
        }
        function buildOverheadHoursBody(entry) {
          var officeHrs = entry.officeHours || 0;
          var bidHrs = entry.bidHours || 0;
          var totalOverhead = officeHrs + bidHrs;
          var totalWork = (entry.hb && entry.hb.totals && entry.hb.totals.totalHours) || 0;
          var fieldHrs = entry.fieldHours || 0;
          var sessions = entry.overheadSessions || [];
          var officeSessions = [];
          var bidSessions = [];
          for (var oi = 0; oi < sessions.length; oi++) {
            if (sessions[oi].bucket === 'office') officeSessions.push(sessions[oi]);
            else if (sessions[oi].bucket === 'bid') bidSessions.push(sessions[oi]);
          }
          var html = '';
          if (officeSessions.length === 0 && bidSessions.length === 0) {
            html += '<p class="caption">No approved office or bid sessions in this period.</p>';
          } else {
            html += buildOverheadSessionsSection('Office', officeSessions, officeHrs);
            html += buildOverheadSessionsSection('Bids', bidSessions, bidHrs);
          }
          html += '<table>';
          html += '<thead><tr><th>Bucket</th><th class="num">Hours</th><th class="num" style="text-align:left;">Share of total work</th></tr></thead>';
          html += '<tbody>';
          html += '<tr><td>Overhead (office + bid)</td><td class="num">' + fmtH(totalOverhead) + '</td><td class="num" style="text-align:left;">' + (totalWork > 0 ? fmtPct1((totalOverhead / totalWork) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '<tr><td>Field (residual)</td><td class="num">' + fmtH(fieldHrs) + '</td><td class="num" style="text-align:left;">' + (totalWork > 0 ? fmtPct1((fieldHrs / totalWork) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">Total work</td><td class="num" style="font-weight:600;">' + fmtH(totalWork) + '</td><td></td></tr></tfoot>';
          html += '</table>';
          html += '<p class="caption">Field hrs = Total work hrs &minus; Overhead hrs. For salaried people, total work is their weekday salary days (8 hrs/weekday); for hourly, it is people_hours / clock sessions. <strong>Every hour worked is charged the per-hour overhead in the &ldquo;Profit (after overhead)&rdquo; column</strong> &mdash; field, office, and bid hours all incur the same rate.</p>';
          html += '<p class="caption">Overhead hours are approved clock sessions on the configured Office job or on any bid &mdash; the same buckets that feed the rolling 90-day overhead rate.</p>';
          return html;
        }
        function buildOverheadLaborBody(entry) {
          var officeHrs = entry.officeHours || 0;
          var bidHrs = entry.bidHours || 0;
          var fieldHrs = entry.fieldHours || 0;
          var overheadHrs = officeHrs + bidHrs;
          var wage = entry.hourlyWage || 0;
          var overheadLaborCost = entry.overheadLaborCost || 0;
          var src = entry.payConfigSource || 'unknown';
          var srcLabel = src === 'salary' ? 'Salaried (weekday hrs \u00d7 hourly_wage from people_pay_config)' : src === 'hourly' ? 'Hourly (people_hours / clock sessions \u00d7 hourly_wage)' : 'Unknown (no people_pay_config row \u2014 wage treated as $0)';
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div><strong>Source:</strong> ' + escH(srcLabel) + '</div>';
          html += '<div><strong>Hourly wage:</strong> ' + (wage > 0 ? '$' + wage.toFixed(2) + '/hr' : '<span style="color:#9ca3af;">not configured</span>') + '</div>';
          html += '<div style="margin-top:0.5rem;font-size:1.05rem;text-align:center;"><strong>Overhead labor: ' + fmtMoney(overheadLaborCost) + '</strong> (' + fmtH(overheadHrs) + ' overhead hrs \u00d7 $' + (wage || 0).toFixed(2) + '/hr)</div>';
          html += '</div>';
          html += '<table>';
          html += '<thead><tr><th>Bucket</th><th class="num">Hours</th><th class="num">Cost</th><th class="num" style="text-align:left;">Share</th></tr></thead>';
          html += '<tbody>';
          var officeCost = -(officeHrs * wage);
          var bidCost = -(bidHrs * wage);
          var hasCost = overheadLaborCost < 0;
          html += '<tr><td>Office (configured office job)</td><td class="num">' + fmtH(officeHrs) + '</td><td class="num">' + fmtMoney(officeCost) + '</td><td class="num" style="text-align:left;">' + (hasCost ? fmtPct1((officeCost / overheadLaborCost) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '<tr><td>Bid (any bid_id)</td><td class="num">' + fmtH(bidHrs) + '</td><td class="num">' + fmtMoney(bidCost) + '</td><td class="num" style="text-align:left;">' + (hasCost ? fmtPct1((bidCost / overheadLaborCost) * 100) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">Total overhead labor</td><td class="num" style="font-weight:600;">' + fmtH(overheadHrs) + '</td><td class="num" style="font-weight:600;">' + fmtMoney(overheadLaborCost) + '</td><td></td></tr></tfoot>';
          html += '</table>';
          html += '<h3>For context: this person\\'s field labor</h3>';
          html += '<table>';
          html += '<thead><tr><th>Bucket</th><th class="num">Hours</th><th class="num">Cost</th><th>Where it shows up</th></tr></thead>';
          html += '<tbody>';
          html += '<tr><td>Field (everything not Office or Bid)</td><td class="num">' + fmtH(fieldHrs) + '</td><td class="num" style="color:#9ca3af;">' + fmtMoney(-(fieldHrs * wage)) + '</td><td style="color:#6b7280;">Already in <strong>Net Revenue</strong>.</td></tr>';
          html += '</tbody>';
          html += '</table>';
          if (wage <= 0) {
            html += '<p class="caption" style="color:#b45309;">No <code>hourly_wage</code> is set for this person in <code>people_pay_config</code>, so the cost columns above show as $0. Set their wage on the People \u2192 Hours \u2192 Pay config row to make this column meaningful.</p>';
          }
          html += '<p class="caption">Overhead labor is what the company paid this person for hours that are <strong>not</strong> billed to a field job \u2014 the configured Office job and any time clocked into a bid. Field labor is excluded here on purpose: it is already subtracted at the per-job level inside Net Revenue (<code>job net = revenue \u2212 parts \u2212 total labor</code>), so showing it again would visually double-count.</p>';
          html += '<p class="caption">Office and bid hours fund the rolling 90-day overhead pool (office labor + bid labor + office parts), which is then deducted from every person as <code>total hours \u00d7 rate</code> in the &ldquo;Profit (after overhead)&rdquo; column \u2014 every hour worked (field + office + bid) is charged the per-hour overhead. This Overhead labor column simply makes the office + bid wage contribution visible in each person\\'s own row \u2014 it does <strong>not</strong> change Gross, Net, or Profit numbers.</p>';
          return html;
        }
        function buildFieldHoursBody(entry) {
          var hb = entry.hb || { totals: { totalHours: 0 }, source: 'unknown' };
          var pb = entry.pb || { jobs: [], unaccountedHours: 0 };
          var totalWork = (hb.totals && hb.totals.totalHours) || 0;
          var officeHrs = entry.officeHours || 0;
          var bidHrs = entry.bidHours || 0;
          var overheadHrs = officeHrs + bidHrs;
          var fieldHrs = entry.fieldHours || 0;
          var allocatedFieldHrs = 0;
          var jobs = (pb.jobs || []).slice();
          for (var i = 0; i < jobs.length; i++) allocatedFieldHrs += (jobs[i].hoursInPeriod || 0);
          var unaccountedFieldHrs = pb.unaccountedHours || 0;
          var srcLabel = hb.source === 'salary'
            ? 'Salaried (8 hrs/weekday)'
            : hb.source === 'hourly'
              ? 'Hourly (from people_hours / clock sessions)'
              : 'Unknown (no pay config row)';
          var modeLabel = (hb.onlyPaidJobs)
            ? 'Only paid jobs (sub labor + crew assignments on jobs marked paid in full)'
            : 'All days in period (clocked / salary, minus office + bid)';
          var ohRateNote = (typeof overheadRate === 'number' && overheadRate != null)
            ? '$' + overheadRate.toFixed(2) + ' per hour &times; ' + fmtH(fieldHrs + officeHrs + bidHrs) + ' all hours = ' + fmtMoney((fieldHrs + officeHrs + bidHrs) * overheadRate) + ' overhead charged in &ldquo;Profit (after overhead)&rdquo; (field component: ' + fmtH(fieldHrs) + ' &times; $' + overheadRate.toFixed(2) + ' = ' + fmtMoney(fieldHrs * overheadRate) + ')'
            : 'Overhead rate unavailable &mdash; reload Review.';
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div><strong>Source:</strong> ' + escH(srcLabel) + '</div>';
          html += '<div><strong>Counting mode:</strong> ' + escH(modeLabel) + '</div>';
          html += '</div>';
          html += '<table>';
          html += '<thead><tr><th>How field hrs is computed</th><th class="num">Hours</th></tr></thead><tbody>';
          if (hb.onlyPaidJobs) {
            html += '<tr><td>Sub labor + crew hours on paid-in-full jobs</td><td class="num">' + fmtH(totalWork) + '</td></tr>';
            html += '<tr><td><em>Office + bid hours are not in this mode by construction</em></td><td class="num"><span style="color:#9ca3af;">&mdash;</span></td></tr>';
          } else {
            html += '<tr><td>Total work hrs (' + escH(hb.source === 'salary' ? 'salary days' : 'people_hours / clock sessions') + ')</td><td class="num">' + fmtH(totalWork) + '</td></tr>';
            html += '<tr><td>&minus; Office hrs (clock on configured office job)</td><td class="num">' + fmtH(officeHrs) + '</td></tr>';
            html += '<tr><td>&minus; Bid hrs (clock on any bid)</td><td class="num">' + fmtH(bidHrs) + '</td></tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">= Field hrs</td><td class="num" style="font-weight:600;">' + fmtH(fieldHrs) + '</td></tr></tfoot>';
          html += '</table>';
          html += '<h3 style="text-align:center;">Where the field hrs went</h3>';
          if (jobs.length === 0 && unaccountedFieldHrs < 0.01) {
            html += '<p class="caption">No field hours were recorded against any job in this period.</p>';
          } else {
            html += '<table>';
            html += '<thead><tr><th class="num">HCP</th><th>Job</th><th class="num">Your field hrs<br>(period)</th><th class="num" style="text-align:left;">Share of<br>field hrs</th></tr></thead><tbody>';
            var jobsForDisplay = jobs.slice().sort(function(a, b){ return (b.hoursInPeriod || 0) - (a.hoursInPeriod || 0); });
            for (var k = 0; k < jobsForDisplay.length; k++) {
              var j = jobsForDisplay[k];
              if ((j.hoursInPeriod || 0) <= 0.005) continue;
              var share = fieldHrs > 0 ? (j.hoursInPeriod / fieldHrs) * 100 : 0;
              html += '<tr>';
              html += '<td class="num">' + escH(j.hcp) + '</td>';
              html += '<td>' + escH(j.jobName || '\u2014') + '</td>';
              html += '<td class="num">' + fmtH(j.hoursInPeriod) + '</td>';
              html += '<td class="num" style="text-align:left;">' + (fieldHrs > 0 ? fmtPct1(share) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td>';
              html += '</tr>';
            }
            if (unaccountedFieldHrs > 0.005) {
              var unShare = fieldHrs > 0 ? (unaccountedFieldHrs / fieldHrs) * 100 : 0;
              html += '<tr style="background:#fff7ed;">';
              html += '<td class="num">&mdash;</td>';
              html += '<td><em>Unallocated field hrs</em><div style="color:#6b7280;font-size:0.8rem;">Field-type hours not tied to a specific job allocation (e.g. salary day with no crew assignment).</div></td>';
              html += '<td class="num">' + fmtH(unaccountedFieldHrs) + '</td>';
              html += '<td class="num" style="text-align:left;">' + (fieldHrs > 0 ? fmtPct1(unShare) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td>';
              html += '</tr>';
            }
            html += '</tbody>';
            html += '<tfoot><tr><td colspan="2" style="text-align:right;font-weight:600;">Total field hrs</td><td class="num" style="font-weight:600;">' + fmtH(allocatedFieldHrs + unaccountedFieldHrs) + '</td><td></td></tr></tfoot>';
            html += '</table>';
          }
          html += '<p class="caption">Each crew assignment\\'s hours = day total \u00d7 pct. The day total is <code>peopleHours</code> (or 8 hrs on a salary weekday). Office time has its own crew row and is filtered from this field-revenue rollup; its share of the day appears as overhead. ' + ohRateNote + '</p>';
          return html;
        }
        function buildOverheadRateBody() {
          var d = overheadDecomp || {};
          var officeLabor = d.officeLabor90d || 0;
          var bidLabor = d.bidLabor90d || 0;
          var officeParts = d.officeParts90d || 0;
          var fieldHours = d.fieldHours90d || 0;
          var fieldLaborUsd = d.fieldLaborUsd90d || 0;
          var invoices = d.invoices90d || 0;
          var totalOverhead = officeLabor + bidLabor + officeParts;
          var ratePerHour = d.ratePerHour;
          var ratePerLaborDollar = d.ratePerLaborDollar;
          var ratePerRevenueDecimal = d.ratePerRevenueDecimal;
          var html = '';
          html += '<div style="margin-bottom:0.75rem;color:#374151;">';
          html += '<div style="margin-bottom:0.5rem;">Rolling 90-day overhead rate. Method A is <strong>$ per field hour</strong>: it spreads the overhead pool (office labor, bid labor, office parts) over the hours that actually produce billable field work. The Team Summary applies this rate against <code>all hours &times; rate</code> when deducting overhead from each person in the &ldquo;Profit (after overhead)&rdquo; column &mdash; office and bid hours fund the pool but are still charged the per-hour overhead so every hour the person worked reflects its full share of the overhead burden.</div>';
          if (d.windowStart && d.windowEnd) {
            html += '<div style="margin-bottom:0.25rem;"><strong>Window:</strong> ' + escH(d.windowStart) + ' &rarr; ' + escH(d.windowEnd) + '</div>';
          }
          html += '<div style="font-size:1.05rem;"><strong>Rate:</strong> ' + (ratePerHour == null ? '<span style="color:#9ca3af;">unavailable</span>' : '$' + Number(ratePerHour).toFixed(2) + ' per field hour') + '</div>';
          html += '</div>';
          html += '<h3>Numerator &mdash; overhead $ pool (90d)</h3>';
          html += '<table>';
          html += '<thead><tr><th>Component</th><th class="num">$ (90d)</th><th class="num">Share</th></tr></thead><tbody>';
          var components = [
            { label: 'Office labor (approved clock to office job)', value: officeLabor },
            { label: 'Bid labor (approved clock to any bid)', value: bidLabor },
            { label: 'Office parts (Tally on office job)', value: officeParts }
          ];
          for (var i = 0; i < components.length; i++) {
            var c = components[i];
            var share = totalOverhead > 0 ? (c.value / totalOverhead) * 100 : 0;
            html += '<tr><td>' + escH(c.label) + '</td><td class="num">' + fmtMoney(c.value) + '</td><td class="num">' + (totalOverhead > 0 ? fmtPct1(share) : '<span style="color:#9ca3af;">&mdash;</span>') + '</td></tr>';
          }
          html += '</tbody>';
          html += '<tfoot><tr><td style="text-align:right;font-weight:600;">Total overhead</td><td class="num" style="font-weight:600;">' + fmtMoney(totalOverhead) + '</td><td></td></tr></tfoot>';
          html += '</table>';
          html += '<h3>Denominator &mdash; field labor (90d)</h3>';
          html += '<table>';
          html += '<thead><tr><th>Measure</th><th class="num">Value</th></tr></thead><tbody>';
          html += '<tr><td>Field hours (approved clock on non-office, non-bid jobs)</td><td class="num">' + fmtH(fieldHours) + ' hrs</td></tr>';
          html += '<tr><td>Field labor $ (same sessions &times; wage)</td><td class="num">' + fmtMoney(fieldLaborUsd) + '</td></tr>';
          html += '</tbody></table>';
          html += '<h3>Resulting rates</h3>';
          html += '<table>';
          html += '<thead><tr><th>Rate</th><th class="num">Value</th><th>How it is used</th></tr></thead><tbody>';
          html += '<tr><td>Method A &mdash; per field hour</td><td class="num">' + (ratePerHour == null ? '<span style="color:#9ca3af;">&mdash;</span>' : '$' + Number(ratePerHour).toFixed(2) + '/hr') + '</td><td>Used to deduct overhead in the Team Summary: Profit after overhead = Net &minus; <strong>all hours</strong> &times; rate. Every hour the person worked (field + office + bid) is charged the per-hour overhead.</td></tr>';
          html += '<tr><td>Method B &mdash; per field labor $</td><td class="num">' + (ratePerLaborDollar == null ? '<span style="color:#9ca3af;">&mdash;</span>' : '$' + Number(ratePerLaborDollar).toFixed(2) + ' / $1 labor') + '</td><td>Reference only: ratio of overhead pool to field labor dollars.</td></tr>';
          html += '<tr><td>Method C &mdash; per revenue $ (invoices sent)</td><td class="num">' + (ratePerRevenueDecimal == null ? '<span style="color:#9ca3af;">&mdash;</span>' : (Number(ratePerRevenueDecimal) * 100).toFixed(1) + '% of revenue') + '</td><td>Reference only: invoices sent in window = ' + fmtMoney(invoices) + '.</td></tr>';
          html += '</tbody></table>';
          html += '<p class="caption">Method A is the headline rate. Sessions used: approved, not revoked, not rejected, with a clock-out. Wages come from <code>people_pay_config.hourly_wage</code>. Office job is the one configured in People &rarr; Overhead settings.</p>';
          return html;
        }
        // Track which cell opened the modal so we can return focus to it on close
        // (keyboard a11y: never trap focus, never lose the trigger after closing).
        var lastFocusedTrigger = null;
        // Embedded-parent only: used by team-summary-modal-open/close so the
        // popup window doesn't accidentally toggle the embedded iframe's
        // refresh guard via its own opener. Day-editor dispatch goes through
        // postBridge() below, which DOES post to opener in popup mode.
        function postParent(type){
          if (window.parent === window) return;
          try { parent.postMessage({ type: type }, '*'); } catch(e) {}
        }
        // Popup-only build: no live bridge back to the React app exists
        // any more (the inline path renders via <TeamSummaryInline> and
        // talks to the parent directly without postMessage). Returning
        // null here makes nameToggleableForRender()/hasBridge below
        // resolve to false, so the popup renders name cells + Hours-day
        // headers as static text — appropriate for a "Open in new window"
        // surface whose job is print/share, not further interaction.
        function bridgeTarget(){
          return null;
        }
        function postBridge(type, payload){
          var bt = bridgeTarget();
          if (!bt) return null;
          var msg = { type: type };
          if (payload) {
            for (var k in payload) {
              if (Object.prototype.hasOwnProperty.call(payload, k)) msg[k] = payload[k];
            }
          }
          try { bt.win.postMessage(msg, '*'); } catch(e) {}
          return bt;
        }
        // Day-header click bridge (Hours breakdown -> DashboardMyTimeDayEditorModal).
        // Delegated from document so it survives openModal() innerHTML resets;
        // no per-render re-attachment needed.
        function isDayLinkEl(el){
          return !!(el && el.nodeType === 1 && el.getAttribute && el.getAttribute('data-action') === 'open-day-editor');
        }
        // Name-cell toggle bridge (Team Summary row -> per-person detail panel
        // in the parent React app). Optimistically mutates selectedPersonName
        // and re-renders the table so the highlight feels instant; the parent
        // listener updates selectedReviewPersonIndex on its end.
        function isPersonToggleEl(el){
          return !!(el && el.nodeType === 1 && el.getAttribute && el.getAttribute('data-action') === 'toggle-person');
        }
        function dispatchDayEditorFromEl(el){
          var person = el.getAttribute('data-person') || '';
          var dateStr = el.getAttribute('data-date') || '';
          if (!person || !dateStr) return;
          var bt = postBridge('team-summary-open-day-editor', { personName: person, workDate: dateStr });
          if (!bt) return;
          // Popup: bring the original tab forward so the user sees the modal
          // mount on the People page they opened the summary from.
          if (bt.kind === 'opener') {
            try { bt.win.focus(); } catch(e) {}
          }
        }
        function dispatchPersonToggleFromEl(el){
          var person = el.getAttribute('data-person') || '';
          if (!person) return;
          // Toggle off when clicking the already-expanded row; matches the
          // parent's reducer so we and the parent never diverge.
          selectedPersonName = (selectedPersonName === person) ? null : person;
          renderTable();
          postBridge('team-summary-select-person', { personName: person });
        }
        document.addEventListener('click', function(e){
          var t = e.target;
          // Walk up a few levels in case the click landed on an inner <span>.
          for (var i = 0; i < 4 && t; i++) {
            if (isDayLinkEl(t)) { e.preventDefault(); dispatchDayEditorFromEl(t); return; }
            if (isPersonToggleEl(t)) { e.preventDefault(); dispatchPersonToggleFromEl(t); return; }
            t = t.parentNode;
          }
        });
        document.addEventListener('keydown', function(e){
          if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
          var t = document.activeElement;
          if (isDayLinkEl(t)) { e.preventDefault(); dispatchDayEditorFromEl(t); return; }
          if (isPersonToggleEl(t)) { e.preventDefault(); dispatchPersonToggleFromEl(t); return; }
        });
        // Parent -> iframe: re-open the Hours drilldown for a specific person
        // after the editor saves and the Team Summary re-renders with fresh
        // numbers. The parent stashes personName in a ref and posts this
        // message from the iframe's onLoad once the new srcDoc has painted.
        window.addEventListener('message', function(e){
          var d = e.data;
          if (!d || typeof d !== 'object') return;
          if (d.type !== 'team-summary-open-hours-drilldown') return;
          var pn = typeof d.personName === 'string' ? d.personName : '';
          if (!pn) return;
          var idx = -1;
          for (var i = 0; i < breakdowns.length; i++) {
            if (breakdowns[i].name === pn) { idx = i; break; }
          }
          if (idx >= 0) openModal(idx, 'hours');
        });
        // True when this window can reach the parent app to mount the editor
        // (embedded iframe -> parent, popup -> opener). Day headers in the
        // Hours breakdown render as <button> when true, plain <div> otherwise
        // (so a popup whose opener was already closed stays inert).
        var hasBridge = !!bridgeTarget();
        function openModal(idx, type) {
          var entry = breakdowns[idx];
          if (!entry && type !== 'overhead_rate') return;
          var title = '';
          var body = '';
          if (type === 'hours') {
            // v2.547 -- running total moved into the title (e.g. "Hours
            // breakdown -- Abraham . 50.8 hrs"); the redundant Total: N hrs
            // line is dropped from buildHoursBody so the value appears once.
            title = 'Hours breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtH(entry.hb.totals.totalHours) + ' hrs';
            body = buildHoursBody(entry.hb, { personName: entry.name, clickableDay: hasBridge });
          } else if (type === 'overhead_hours') {
            // v2.547 -- running total moved into the title (matches Hours
            // breakdown), and the per-bucket totals move into the Office /
            // Bids section headers (see buildOverheadHoursBody).
            var ohTotalHrs = (entry.officeHours || 0) + (entry.bidHours || 0);
            title = 'Overhead hours breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtH(ohTotalHrs) + ' hrs';
            body = buildOverheadHoursBody(entry);
          } else if (type === 'field_hours') {
            // v2.547 -- field-hrs running total moved into the title to match
            // the Hours / Overhead-hours modals.
            title = 'Field hours breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtH(entry.fieldHours || 0) + ' hrs';
            body = buildFieldHoursBody(entry);
          } else if (type === 'overhead_labor') {
            // Append the hourly_wage to the title so reviewers see the
            // rate driving the cost column without opening the modal.
            // Matches TeamSummaryInline.drilldownTitleFor.
            var olWage = entry.hourlyWage || 0;
            var olWageSuffix = olWage > 0
              ? ' \\u00b7 $' + olWage.toFixed(2) + '/hr'
              : ' \\u00b7 no wage configured';
            title = 'Overhead labor breakdown \\u2014 ' + entry.name + olWageSuffix;
            body = buildOverheadLaborBody(entry);
          } else if (type === 'gross') {
            // v2.547 -- running total moved into the title to match Hours /
            // Overhead-hours / Field-hours modals; redundant Total line removed
            // from buildGrossBody.
            title = 'Gross Revenue breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtMoney((entry.gb && entry.gb.total) || 0);
            body = buildGrossBody(entry.gb);
          } else if (type === 'net') {
            title = 'Net Revenue breakdown \\u2014 ' + entry.name + ' \\u00b7 ' + fmtMoney((entry.nb && entry.nb.total) || 0);
            body = buildNetBody(entry.nb);
          } else if (type === 'profit') {
            title = 'Profit (after overhead) breakdown \\u2014 ' + entry.name;
            body = buildProfitBody(entry.pb);
          } else if (type === 'rev_per_hr') {
            title = 'Gross Revenue/hr breakdown \\u2014 ' + entry.name;
            body = buildGrossPerHourBody(entry);
          } else if (type === 'net_per_hr') {
            title = 'Net Revenue/hr breakdown \\u2014 ' + entry.name;
            body = buildNetPerHourBody(entry);
          } else if (type === 'profit_per_hr') {
            title = 'Profit/hr (after overhead) breakdown \\u2014 ' + entry.name;
            body = buildProfitPerHourBody(entry);
          } else if (type === 'overhead_rate') {
            title = 'Overhead rate decomposition (rolling 90 days)';
            body = buildOverheadRateBody();
          } else {
            return;
          }
          document.getElementById('modal-title').textContent = title;
          document.getElementById('modal-body').innerHTML = body;
          document.getElementById('modal-backdrop').classList.add('open');
          document.getElementById('modal').classList.add('open');
          lastFocusedTrigger = (document.activeElement && typeof document.activeElement.focus === 'function') ? document.activeElement : null;
          var closeBtn = document.getElementById('modal-close');
          if (closeBtn) try { closeBtn.focus(); } catch(e) {}
          postParent('team-summary-modal-open');
        }
        function closeModal() {
          var wasOpen = document.getElementById('modal').classList.contains('open');
          document.getElementById('modal-backdrop').classList.remove('open');
          document.getElementById('modal').classList.remove('open');
          // Defensive cleanup: if user closes the modal while it was in
          // print mode (e.g. they cancelled the print dialog and the
          // browser didn't fire afterprint), strip the body class so the
          // screen view doesn't look broken.
          document.body.classList.remove('printing-modal');
          if (wasOpen) {
            if (lastFocusedTrigger) {
              try { lastFocusedTrigger.focus(); } catch(e) {}
            }
            lastFocusedTrigger = null;
            postParent('team-summary-modal-close');
          }
        }
        // ---- Header sort / search wiring ----
        var ths = document.querySelectorAll('th[data-sort]');
        for (var t = 0; t < ths.length; t++) {
          (function(th){
            function toggleSort(){
              var key = th.getAttribute('data-sort');
              if (!key) return;
              if (key === sortKey) {
                sortDir = (sortDir === 'asc') ? 'desc' : 'asc';
              } else {
                sortKey = key;
                // Sensible default direction by column type: text asc, numbers desc.
                sortDir = (key === 'name') ? 'asc' : 'desc';
              }
              renderTable();
            }
            th.addEventListener('click', toggleSort);
            th.addEventListener('keydown', function(e){
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                toggleSort();
              }
            });
          })(ths[t]);
        }
        var searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.addEventListener('input', function(e){
            searchQuery = e.target.value || '';
            renderTable();
          });
        }
        var resetSortBtn = document.getElementById('reset-sort');
        if (resetSortBtn) {
          resetSortBtn.addEventListener('click', function(){
            sortKey = 'profitAfterOverhead';
            sortDir = 'desc';
            renderTable();
          });
        }
        var overheadMetaBtn = document.getElementById('overhead-meta-btn');
        if (overheadMetaBtn) {
          overheadMetaBtn.addEventListener('click', function(){ openModal(-1, 'overhead_rate'); });
        }
        document.getElementById('modal-backdrop').addEventListener('click', closeModal);
        document.getElementById('modal-close').addEventListener('click', closeModal);
        // Modal-only print: add a body class so @media print rules in <style>
        // hide everything except .modal, then call window.print(). The
        // afterprint event removes the class so the screen view comes back
        // identical to before (works in Chrome / Firefox / Safari; older
        // browsers without afterprint just keep the class until the next
        // closeModal, which clears it via the cleanup below).
        var modalPrintBtn = document.getElementById('modal-print');
        function clearPrintingModalClass(){
          document.body.classList.remove('printing-modal');
        }
        if (modalPrintBtn) {
          modalPrintBtn.addEventListener('click', function(){
            document.body.classList.add('printing-modal');
            function onAfterPrint(){
              clearPrintingModalClass();
              window.removeEventListener('afterprint', onAfterPrint);
            }
            window.addEventListener('afterprint', onAfterPrint);
            try { window.print(); } catch (e) { clearPrintingModalClass(); }
          });
        }
        document.addEventListener('keydown', function(e){ if (e.key === 'Escape') { clearPrintingModalClass(); closeModal(); } });
        // Initial paint.
        renderTable();
      })();</script>
      ${embeddedResizeScript}
    </body></html>`
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
        const reviewPartsRate =
          reviewOverheadRates.fieldHours90d != null && reviewOverheadRates.fieldHours90d > 0
            ? (reviewOverheadRates.officeParts90d ?? 0) / reviewOverheadRates.fieldHours90d
            : null
        const reviewOverheadMetaText = reviewOverheadLoading
          ? 'Overhead (split): loading…'
          : reviewOverheadRate == null || reviewPartsRate == null
            ? 'Overhead (split): unavailable'
            : `Overhead (split): own office/bid labor + $${reviewPartsRate.toFixed(2)}/field-hr office parts (90-day)`
        const reviewOverheadMetaClickable = !reviewOverheadLoading && reviewOverheadRate != null
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
                <h2 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.05rem', color: '#374151' }}>Team Summary</h2>
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
                  style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
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
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: '#374151' }}>
                      From
                      <input
                        type="date"
                        value={reviewCustomRangeStart}
                        onChange={(e) => setReviewCustomRangeStart(e.target.value)}
                        aria-label="Custom range start date"
                        max={reviewCustomRangeEnd || undefined}
                        style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: '#374151' }}>
                      To
                      <input
                        type="date"
                        value={reviewCustomRangeEnd}
                        onChange={(e) => setReviewCustomRangeEnd(e.target.value)}
                        aria-label="Custom range end date"
                        min={reviewCustomRangeStart || undefined}
                        style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                      />
                    </label>
                    {(!reviewCustomRangeStart || !reviewCustomRangeEnd) && (
                      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
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
            </div>
          </div>

          {showPeopleForReview.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              {teamSummaryError ? (
                <p style={{ color: '#b91c1c', padding: '0.75rem 1rem', margin: 0, border: '1px solid #fca5a5', borderRadius: 6, background: '#fef2f2' }}>
                  {teamSummaryError}
                </p>
              ) : teamSummaryRows ? (
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
              ) : (
                <div style={{ padding: '0.5rem 0', color: '#6b7280', fontSize: '0.85rem' }}>
                  {teamSummaryLoading ? 'Loading Team Summary…' : 'Team Summary will appear here.'}
                </div>
              )}
            </div>
          )}

          {showPeopleForReview.length === 0 ? (
            <p style={{ color: '#6b7280', padding: '1rem', margin: 0 }}>No people in pay config. Add people in People pay config (Hours tab) first.</p>
          ) : selectedReviewPersonIndex < 0 ? (
            // No one expanded yet — the Team Summary above acts as the
            // picker. Click a name to expand that person's panel here.
            null
          ) : reviewLoading ? (
            <p style={{ color: '#6b7280', padding: '1rem', margin: 0 }}>Loading…</p>
          ) : (
            <>
              {(() => {
                const personName = showPeopleForReview[selectedReviewPersonIndex]
                const cfg = personName ? payConfig[personName] : undefined
                const [start, end] = getReviewDateRange()
                const days = getDaysInRange(start, end)
                const getHoursForDay = (d: string) => {
                  if (!cfg) return 0
                  const dayOfWeek = new Date(d + 'T12:00:00').getDay()
                  return cfg.is_salary
                    ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
                    : (reviewHours.find((h) => h.work_date === d)?.hours ?? 0)
                }
                // Mirror the Team Summary table's per-person row so this panel
                // headline matches the table exactly (same allocation engine +
                // split overhead model). Falls back to the panel's own
                // allocation only while the table row is still loading.
                const tsRow = personName
                  ? teamSummaryBreakdowns.find((b) => b.name === personName)
                  : undefined
                const panelHours = reviewOnlyPaidInFull
                  ? [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                  : days.reduce((s, d) => s + getHoursForDay(d), 0)
                const totalHours = tsRow ? tsRow.totalHours : panelHours
                const totalRevenue = tsRow
                  ? tsRow.gross
                  : [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                const totalProfit = tsRow ? tsRow.net : reviewAllocatedProfit
                const revPerHour = tsRow ? tsRow.revPerHour : (totalHours > 0 ? totalRevenue / totalHours : 0)
                const profitPerHour = tsRow ? tsRow.netPerHour : (totalHours > 0 ? totalProfit / totalHours : 0)
                const overheadLaborCost = tsRow ? tsRow.overheadLaborCost : 0
                const overheadBurden = tsRow ? tsRow.overheadBurden : null
                const profitAfterOverhead = tsRow ? tsRow.profitAfterOverhead : null
                const profitPerHourAfterOverhead = tsRow ? tsRow.profitPerHourAfterOverhead : null
                return (
                  <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '1rem', display: 'inline-grid', gridTemplateColumns: 'max-content max-content', rowGap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Gross Revenue this period:</span>
                      <span
                        title="Sum across every job worked in this period of: (job Value Created) × (this user's labor cost on the job in this period ÷ the job's lifetime labor cost by everyone). 'Value Created' = job total bill × % progress — the gross revenue the job has earned to date. Allocation is cost-based, the same rule the expanded panel uses for the per-job 'Gross Revenue/hr' line."
                        aria-label="Gross Revenue earned this period, allocated by labor cost share"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{`$${Math.round(totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Net Revenue (before overhead) this period:</span>
                      <span
                        title="Sum across every job worked in this period of: (job Net Revenue before overhead) × (this user's labor cost on the job in this period ÷ the job's lifetime labor cost by everyone). 'Net Revenue (before overhead)' = Value Created − parts − subs − total field labor on the job, before deducting org-wide overhead. Allocation is cost-based, the same rule the expanded panel uses for the per-job 'Net Revenue on Job' line. To see overhead applied, expand any row and look at the Profit section (methods A/B/C)."
                        aria-label="Net Revenue (before overhead) this period, allocated by labor cost share"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{`$${Math.round(totalProfit).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>&minus; Overhead labor (own office/bid wages):</span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong style={{ color: overheadLaborCost < 0 ? '#b91c1c' : undefined }}>{`$${Math.round(overheadLaborCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>&minus; Overhead burden (field-hr share of office parts):</span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong style={{ color: '#b91c1c' }}>{overheadBurden == null ? '—' : `$${Math.round(overheadBurden).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Profit (after overhead) this period:</span>
                      <span
                        title="Profit (after overhead) = Net Revenue (before overhead) − this person's own overhead labor (office + bid wages) − overhead burden (their field-hour share of office parts). Matches the Team Summary table's Profit column for this person."
                        aria-label="Profit this period after deducting split overhead (own labor + parts burden)"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{(() => {
                        if (profitAfterOverhead == null) return reviewOverheadRates.loading ? '…' : '—'
                        return <span style={{ color: profitAfterOverhead < 0 ? '#b91c1c' : undefined }}>{`$${Math.round(profitAfterOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</span>
                      })()}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Gross Revenue/hr:</span>
                      <span
                        title="Gross Revenue this period ÷ this user's hours in the period. Period equivalent of the per-job 'Gross Revenue/hr' line: each job's Value Created is allocated to the user by labor cost share, summed across the period, then averaged per hour worked."
                        aria-label="Gross Revenue per hour, period average"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{totalHours > 0 ? `$${Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Net Revenue/hr (before overhead):</span>
                      <span
                        title="Net Revenue (before overhead) this period ÷ this user's hours in the period. Period equivalent of the per-job 'Net Revenue/hr' line: each job's Net Revenue (before overhead) is allocated to the user by labor cost share, summed across the period, then averaged per hour worked. Does not deduct org-wide overhead."
                        aria-label="Net Revenue per hour before overhead, period average"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{totalHours > 0 ? `$${Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '1rem' }}>
                      <span style={{ color: '#6b7280' }}>Profit/hr (after overhead):</span>
                      <span
                        title="Profit/hr (after overhead) = Profit (after overhead) ÷ total hours. Matches the Team Summary table's Profit/hr column for this person."
                        aria-label="Profit per hour after split overhead, period average"
                        style={{ color: '#6b7280', cursor: 'help', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                      </span>
                    </div>
                    <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{(() => {
                        if (profitPerHourAfterOverhead == null) return reviewOverheadRates.loading ? '…' : '—'
                        return <span style={{ color: profitPerHourAfterOverhead < 0 ? '#b91c1c' : undefined }}>{`$${Math.round(profitPerHourAfterOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</span>
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
                  Jobs Worked ({reviewLaborJobs.length + reviewCrewJobs.length})
                </h3>
                {reviewLaborJobs.length === 0 && reviewCrewJobs.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No jobs in this period.</p>
                ) : (
                  <>
                    {reviewJobsWorkedCollapsed ? (
                      <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb' }}>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Labor / total job labor:</span>
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
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Profit / Net Revenue (before overhead):</span>
                          {(() => {
                            const totalRevenue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                            const revenueBeforeOverheadByJob = new Map<string, number>()
                            for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                              if (j.job_id) revenueBeforeOverheadByJob.set(j.job_id, j.revenueBeforeOverhead)
                            }
                            const totalRevBeforeOverhead = [...revenueBeforeOverheadByJob.values()].reduce((s, v) => s + v, 0)
                            const revenueStr = totalRevenue !== 0 ? `$${Math.round(totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const revBeforeStr = totalRevBeforeOverhead !== 0 ? `$${Math.round(totalRevBeforeOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
                            const text = [revenueStr, revBeforeStr].filter(Boolean).join(' / ') || '—'
                            return <span style={{ fontWeight: 600, color: totalRevenue < 0 ? '#b91c1c' : undefined }}>{text}</span>
                          })()}
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>This Revenue / Value Created:</span>
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
                      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead style={{ background: '#f9fafb' }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>HCP #</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400 }}>Date</div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>Job Name</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400 }}>Job Address</div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="dollars this person earned on this day for this job"
                                  aria-label="dollars this person earned on this day for this job"
                                >
                                  This Labor
                                </div>
                                <div
                                  style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400, cursor: 'help' }}
                                  title="lifetime labor cost on the whole job by everyone, including this person"
                                  aria-label="lifetime labor cost on the whole job by everyone, including this person"
                                >
                                  total job labor
                                </div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="this person's share of profit on this row, allocated by labor share (revenue minus parts and labor, before overhead)"
                                  aria-label="this person's share of profit on this row, allocated by labor share (revenue minus parts and labor, before overhead)"
                                >
                                  This Profit
                                </div>
                                <div
                                  style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400, cursor: 'help' }}
                                  title="lifetime net revenue on the whole job, before overhead (value created minus parts and labor)"
                                  aria-label="lifetime net revenue on the whole job, before overhead (value created minus parts and labor)"
                                >
                                  Net Revenue (before overhead)
                                </div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="your share of the job's earned revenue, allocated by labor cost: this row's labor cost ÷ everyone's labor cost on the job, all time"
                                  aria-label="your share of the job's earned revenue, allocated by labor cost: this row's labor cost ÷ everyone's labor cost on the job, all time"
                                >
                                  This Revenue
                                </div>
                                <div
                                  style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400, cursor: 'help' }}
                                  title="the whole job's value created: total bill × % complete (treated as 100% when the ledger has no value set)"
                                  aria-label="the whole job's value created: total bill times percent complete"
                                >
                                  Value Created
                                </div>
                              </th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>
                                <div
                                  style={{ fontWeight: 600, cursor: 'help' }}
                                  title="Revenue/hr is your share of the job's earned revenue divided by your hours on this row. Profit/hr is your share of the job's profit divided by your hours on this row. Both shares are allocated by labor cost: this row's labor cost ÷ everyone's labor cost on the job."
                                  aria-label="Revenue per hour and profit per hour"
                                >
                                  Revenue/hr
                                </div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280', fontWeight: 400 }}>
                                  Profit/hr
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {reviewLaborJobs.map((j) => {
                              const key = `labor-${j.id}`
                              const expanded = reviewJobExpandedKey === key
                              const revPerHour = j.hours > 0 ? j.allocatedTotalBill / j.hours : null
                              const profitPerHour = j.hours > 0 ? j.allocatedRevenueBeforeOverhead / j.hours : null
                              const revProfitStr = revPerHour != null && profitPerHour != null
                                ? (
                                  <>
                                    <div>$<strong>{Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr revenue</div>
                                    <div style={{ color: profitPerHour < 0 ? '#b91c1c' : undefined }}>$<strong>{Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr profit</div>
                                  </>
                                )
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: '#6b7280', lineHeight: '1.4' }}>{expanded ? '▾' : '▸'}</span>
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{(j.job_number ?? '').trim() ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number) : '—'}</div>
                                          <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{formatDateWithDay(j.job_date)}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{stripAddressZipState(j.address) || '—'}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.job_id && j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (!j.job_id || j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = j.job_number
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number)
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
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
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
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.job_number)
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
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                        if (j.revenueBeforeOverhead === 0) return '—'
                                        const pct = Math.round((j.allocatedRevenueBeforeOverhead / j.revenueBeforeOverhead) * 100)
                                        if (pct === 100) return `${pct}%`
                                        return `${pct}% of ${Math.round(j.revenueBeforeOverhead).toLocaleString('en-US')}`
                                      })()}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontSize: '0.8125rem' }}>{revProfitStr}</div>
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: '#6b7280' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Gross Revenue/hr`}</span>
                                          <span>{(() => {
                                            const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToBill / j.userTotalHoursOnJob : null
                                            return v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue/hr`}</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            {(() => {
                                              const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                              return <span style={{ color: v != null && v < 0 ? '#b91c1c' : undefined }}>{v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                            })()}
                                            <span
                                              title="Both Revenue/hr and Profit/hr are allocated by labor cost: this user's lifetime labor cost on the job ÷ everyone's lifetime labor cost on the job. So a person paid above the blended crew average is credited with a larger share of both the job's revenue and its profit per hour, and someone paid below it gets a smaller share of both. Because both shares use the same allocation rule, the per-user Revenue/hr ÷ Profit/hr ratio for a given job is constant (= valueCreated ÷ profit, the inverse of the job's profit margin)."
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title={(() => {
                                              const r = reviewOverheadRates.ratePerHour
                                              if (r == null) return "Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate ($/hr). Loading or no overhead data yet."
                                              return `Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate. 90-day overhead rate: $${r.toFixed(2)}/hr.`
                                            })()}
                                          >{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Profit/hr`}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null) return '—'
                                            const netRevPerHr = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                            if (netRevPerHr == null) return '—'
                                            const profitPerHr = netRevPerHr - r
                                            return <span style={{ color: profitPerHr < 0 ? '#b91c1c' : undefined }}>{`$${Math.round(profitPerHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</span>
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Gross Revenue</span>
                                          <span style={{ color: '#6b7280' }}>Job Gross Revenue (total bill)</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'Job'
                                            return `${numLabel} Progress`
                                          })()}</span>
                                          <span>{j.pctComplete != null ? `${j.pctComplete}%` : '100% (assumed)'}</span>
                                          <span style={{ color: '#6b7280' }}>Value Created (revenue * progress)</span>
                                          <span>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s % of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.valueCreated > 0 && j.userTotalContributionToBill > 0 ? `${Math.round((j.userTotalContributionToBill / j.valueCreated) * 100)}%` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s share of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Value Created this day`}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Costs</span>
                                          <span style={{ color: '#6b7280' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `Total Labor on ${numLabel}`
                                          })()}</span>
                                          <span>{(() => {
                                            const totalLaborDollars = j.totalLaborOnJob
                                            const laborStr = totalLaborDollars > 0 ? `$${formatCurrency(totalLaborDollars)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Rest of Teams Labor</span>
                                          <span>{(() => {
                                            const teamsLaborDollars = Math.max(0, j.totalLaborOnJob - j.userTotalLaborOnJob)
                                            const laborStr = teamsLaborDollars > 0 ? `$${formatCurrency(teamsLaborDollars)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel}`
                                          })()}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel} this day`
                                          })()}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }} title="Hourly wage only — drive cost (mileage + drive-time pay) is excluded from this rate.">{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Labor Rate`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.hours > 0 ? `$${formatCurrency(Math.max(0, j.laborCost - j.driveCost) / j.hours)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }} title="Average hourly wage of everyone else on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Teammates Avg Labor Rate</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const teammatesLabor = (j.totalLaborOnJob - j.totalDriveCostOnJob) - (j.userTotalLaborOnJob - j.userTotalDriveCostOnJob)
                                            return teammatesHours > 0 ? `$${formatCurrency(Math.max(0, teammatesLabor) / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }} title="Average hourly wage across everyone on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Job Avg Labor Rate</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency(Math.max(0, j.totalLaborOnJob - j.totalDriveCostOnJob) / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Net Revenue</span>
                                          <span style={{ color: '#6b7280' }}>Net Revenue (before overhead)</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue on Job`}</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue this Day`}</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Profit</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            A. Overhead by labor hours
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerHour
                                                const guidance = "Best when overhead scales with TIME in the field — office staff, software seats, insurance, vehicles, PMs, dispatch — costs that exist as long as the crew is on the clock, regardless of who is working or how big the deal is. Two crews of equal size on equal-length jobs absorb equal overhead. Misleading when a job is short on hours but big in revenue or labor dollars (specialist work that bills high per hour, or material/parts-heavy jobs that move a lot of money in little field time) — those jobs look more profitable than they really are because they dodge their share of office burden."
                                                if (r == null) return `Method A — Per labor hour. Rate: 90-day total overhead $ ÷ 90-day team field hours. Loading or no data yet. ${guidance}`
                                                return `Method A — Per labor hour. 90-day rate: $${r.toFixed(2)}/hr. Job overhead = job lifetime field hours × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method A) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null || j.totalJobHours <= 0) return '—'
                                            return `$${formatCurrency(j.totalJobHours * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null || j.totalJobHours <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.totalJobHours * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            B. Overhead by revenue
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerRevenueDecimal
                                                const guidance = "Best when overhead scales with SALES — executive comp, sales & marketing, bonding capacity, %-of-revenue insurance (GL/GR), financing — back-office costs that grow as the company books bigger work. High-revenue jobs absorb proportionally more burden, which keeps the implied gross margin honest: a 25%-margin job carries 25% more overhead than a $10 smaller one. Misleading when a job is high-revenue but low-effort (parts/material passthrough, change orders, fixed-fee design fees) — it gets charged overhead it did not really consume, making genuinely good jobs look thin and making low-margin jobs look terminal."
                                                if (r == null) return `Method B — Per $ revenue. Rate: 90-day total overhead $ ÷ 90-day billed revenue $. Loading or no data yet. ${guidance}`
                                                return `Method B — Per $ revenue. 90-day rate: ${(r * 100).toFixed(1)}% (i.e. $${(r * 100).toFixed(2)} per $100 of revenue). Job overhead = Value Created × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method B) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerRevenueDecimal
                                            if (r == null || j.valueCreated <= 0) return '—'
                                            return `$${formatCurrency(j.valueCreated * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerRevenueDecimal
                                            if (r == null || j.valueCreated <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.valueCreated * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            C. Overhead by direct labor cost
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerLaborDollar
                                                const guidance = "Best when overhead scales with LABOR — supervision, dispatch, PPE, payroll burden (workers comp, FICA match, benefits), training, vehicle wear, jobsite supplies — costs driven by people in the field, not hours on the clock or dollars on the invoice. This is the classic trade-contractor burden rate: higher-paid crews carry more overhead because they consume more back-office support (HR, scheduling, insurance, AR/AP touchpoints). Misleading when a job is mostly parts, materials, or sub passthrough with thin direct labor — that job dodges nearly all overhead even though it consumed PM time, dispatch, AR/AP, and warehouse handling. Distorts further when one job has a wide labor-rate spread (apprentice + senior on the same ticket)."
                                                if (r == null) return `Method C — Per direct labor $. Rate: 90-day total overhead $ ÷ 90-day direct field labor $. Loading or no data yet. ${guidance}`
                                                return `Method C — Per direct labor $. 90-day rate: ${r.toFixed(2)}× direct labor (every $1 of field labor carries $${r.toFixed(2)} of overhead). Job overhead = total job labor × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method C) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerLaborDollar
                                            if (r == null || j.totalLaborOnJob <= 0) return '—'
                                            return `$${formatCurrency(j.totalLaborOnJob * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerLaborDollar
                                            if (r == null || j.totalLaborOnJob <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.totalLaborOnJob * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                            {reviewCrewJobs.map((j) => {
                              const key = `crew-${j.job_id}-${j.work_date}`
                              const expanded = reviewJobExpandedKey === key
                              const revPerHour = j.hours > 0 ? j.allocatedTotalBill / j.hours : null
                              const profitPerHour = j.hours > 0 ? j.allocatedRevenueBeforeOverhead / j.hours : null
                              const revProfitStr = revPerHour != null && profitPerHour != null
                                ? (
                                  <>
                                    <div>$<strong>{Math.round(revPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr revenue</div>
                                    <div style={{ color: profitPerHour < 0 ? '#b91c1c' : undefined }}>$<strong>{Math.round(profitPerHour).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr profit</div>
                                  </>
                                )
                                : '—'
                              return (
                                <Fragment key={key}>
                                  <tr
                                    onClick={() => setReviewJobExpandedKey((k) => (k === key ? null : key))}
                                    style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                                  >
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.75em', color: '#6b7280', lineHeight: '1.4' }}>{expanded ? '▾' : '▸'}</span>
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{(j.hcp_number ?? '').trim() && j.hcp_number !== '—' ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.hcp_number) : '—'}</div>
                                          <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{formatDateWithDay(j.work_date)}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.job_name}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{stripAddressZipState(j.job_address) || '—'}</div>
                                    </td>
                                    <td
                                      style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top', cursor: j.totalLaborOnJob > 0 ? 'pointer' : undefined }}
                                      onClick={(e) => {
                                        if (j.totalLaborOnJob <= 0) return
                                        e.stopPropagation()
                                        const personName = showPeopleForReview[selectedReviewPersonIndex] ?? ''
                                        const numberLabel = (j.hcp_number ?? '').trim() && j.hcp_number !== '—'
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.hcp_number)
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
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
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
                                        const numberLabel = (j.hcp_number ?? '').trim() && j.hcp_number !== '—'
                                          ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), j.hcp_number)
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
                                      <div style={{ fontWeight: 600, color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                        if (j.revenueBeforeOverhead === 0) return '—'
                                        const pct = Math.round((j.allocatedRevenueBeforeOverhead / j.revenueBeforeOverhead) * 100)
                                        if (pct === 100) return `${pct}%`
                                        return `${pct}% of ${Math.round(j.revenueBeforeOverhead).toLocaleString('en-US')}`
                                      })()}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 600 }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</div>
                                      <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</div>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'top' }}>
                                      <div style={{ fontSize: '0.8125rem' }}>{revProfitStr}</div>
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: '#6b7280' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Gross Revenue/hr`}</span>
                                          <span>{(() => {
                                            const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToBill / j.userTotalHoursOnJob : null
                                            return v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue/hr`}</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            {(() => {
                                              const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                              return <span style={{ color: v != null && v < 0 ? '#b91c1c' : undefined }}>{v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                                            })()}
                                            <span
                                              title="Both Revenue/hr and Profit/hr are allocated by labor cost: this user's lifetime labor cost on the job ÷ everyone's lifetime labor cost on the job. So a person paid above the blended crew average is credited with a larger share of both the job's revenue and its profit per hour, and someone paid below it gets a smaller share of both. Because both shares use the same allocation rule, the per-user Revenue/hr ÷ Profit/hr ratio for a given job is constant (= valueCreated ÷ profit, the inverse of the job's profit margin)."
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title={(() => {
                                              const r = reviewOverheadRates.ratePerHour
                                              if (r == null) return "Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate ($/hr). Loading or no overhead data yet."
                                              return `Profit/hr (after overhead, Method A — per labor hour) = Net Revenue/hr − overhead rate. 90-day overhead rate: $${r.toFixed(2)}/hr.`
                                            })()}
                                          >{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Profit/hr`}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null) return '—'
                                            const netRevPerHr = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                            if (netRevPerHr == null) return '—'
                                            const profitPerHr = netRevPerHr - r
                                            return <span style={{ color: profitPerHr < 0 ? '#b91c1c' : undefined }}>{`$${Math.round(profitPerHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}</span>
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Gross Revenue</span>
                                          <span style={{ color: '#6b7280' }}>Job Gross Revenue (total bill)</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'Job'
                                            return `${numLabel} Progress`
                                          })()}</span>
                                          <span>{j.pctComplete != null ? `${j.pctComplete}%` : '100% (assumed)'}</span>
                                          <span style={{ color: '#6b7280' }}>Value Created (revenue * progress)</span>
                                          <span>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s % of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.valueCreated > 0 && j.userTotalContributionToBill > 0 ? `${Math.round((j.userTotalContributionToBill / j.valueCreated) * 100)}%` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s share of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Value Created this day`}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Costs</span>
                                          <span style={{ color: '#6b7280' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `Total Labor on ${numLabel}`
                                          })()}</span>
                                          <span>{(() => {
                                            const totalLaborDollars = j.totalLaborOnJob
                                            const laborStr = totalLaborDollars > 0 ? `$${formatCurrency(totalLaborDollars)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }}>Rest of Teams Labor</span>
                                          <span>{(() => {
                                            const teamsLaborDollars = Math.max(0, j.totalLaborOnJob - j.userTotalLaborOnJob)
                                            const laborStr = teamsLaborDollars > 0 ? `$${formatCurrency(teamsLaborDollars)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel}`
                                          })()}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel} this day`
                                          })()}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }} title="Hourly wage only — drive cost (mileage + drive-time pay) is excluded from this rate.">{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Labor Rate`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.hours > 0 ? `$${formatCurrency(Math.max(0, j.laborCost - j.driveCost) / j.hours)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }} title="Average hourly wage of everyone else on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Teammates Avg Labor Rate</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const teammatesLabor = (j.totalLaborOnJob - j.totalDriveCostOnJob) - (j.userTotalLaborOnJob - j.userTotalDriveCostOnJob)
                                            return teammatesHours > 0 ? `$${formatCurrency(Math.max(0, teammatesLabor) / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: '#6b7280' }} title="Average hourly wage across everyone on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Job Avg Labor Rate</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency(Math.max(0, j.totalLaborOnJob - j.totalDriveCostOnJob) / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: '#6b7280' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: '#6b7280' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Net Revenue</span>
                                          <span style={{ color: '#6b7280' }}>Net Revenue (before overhead)</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue on Job`}</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: '#6b7280', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue this Day`}</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? `$${formatCurrency(j.allocatedRevenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Profit</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            A. Overhead by labor hours
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerHour
                                                const guidance = "Best when overhead scales with TIME in the field — office staff, software seats, insurance, vehicles, PMs, dispatch — costs that exist as long as the crew is on the clock, regardless of who is working or how big the deal is. Two crews of equal size on equal-length jobs absorb equal overhead. Misleading when a job is short on hours but big in revenue or labor dollars (specialist work that bills high per hour, or material/parts-heavy jobs that move a lot of money in little field time) — those jobs look more profitable than they really are because they dodge their share of office burden."
                                                if (r == null) return `Method A — Per labor hour. Rate: 90-day total overhead $ ÷ 90-day team field hours. Loading or no data yet. ${guidance}`
                                                return `Method A — Per labor hour. 90-day rate: $${r.toFixed(2)}/hr. Job overhead = job lifetime field hours × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method A) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null || j.totalJobHours <= 0) return '—'
                                            return `$${formatCurrency(j.totalJobHours * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerHour
                                            if (r == null || j.totalJobHours <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.totalJobHours * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            B. Overhead by revenue
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerRevenueDecimal
                                                const guidance = "Best when overhead scales with SALES — executive comp, sales & marketing, bonding capacity, %-of-revenue insurance (GL/GR), financing — back-office costs that grow as the company books bigger work. High-revenue jobs absorb proportionally more burden, which keeps the implied gross margin honest: a 25%-margin job carries 25% more overhead than a $10 smaller one. Misleading when a job is high-revenue but low-effort (parts/material passthrough, change orders, fixed-fee design fees) — it gets charged overhead it did not really consume, making genuinely good jobs look thin and making low-margin jobs look terminal."
                                                if (r == null) return `Method B — Per $ revenue. Rate: 90-day total overhead $ ÷ 90-day billed revenue $. Loading or no data yet. ${guidance}`
                                                return `Method B — Per $ revenue. 90-day rate: ${(r * 100).toFixed(1)}% (i.e. $${(r * 100).toFixed(2)} per $100 of revenue). Job overhead = Value Created × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method B) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerRevenueDecimal
                                            if (r == null || j.valueCreated <= 0) return '—'
                                            return `$${formatCurrency(j.valueCreated * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerRevenueDecimal
                                            if (r == null || j.valueCreated <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.valueCreated * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            C. Overhead by direct labor cost
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerLaborDollar
                                                const guidance = "Best when overhead scales with LABOR — supervision, dispatch, PPE, payroll burden (workers comp, FICA match, benefits), training, vehicle wear, jobsite supplies — costs driven by people in the field, not hours on the clock or dollars on the invoice. This is the classic trade-contractor burden rate: higher-paid crews carry more overhead because they consume more back-office support (HR, scheduling, insurance, AR/AP touchpoints). Misleading when a job is mostly parts, materials, or sub passthrough with thin direct labor — that job dodges nearly all overhead even though it consumed PM time, dispatch, AR/AP, and warehouse handling. Distorts further when one job has a wide labor-rate spread (apprentice + senior on the same ticket)."
                                                if (r == null) return `Method C — Per direct labor $. Rate: 90-day total overhead $ ÷ 90-day direct field labor $. Loading or no data yet. ${guidance}`
                                                return `Method C — Per direct labor $. 90-day rate: ${r.toFixed(2)}× direct labor (every $1 of field labor carries $${r.toFixed(2)} of overhead). Job overhead = total job labor × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: '#9ca3af', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: '#6b7280' }}
                                            title="Profit (Method C) = Net Revenue (before overhead) − this method's overhead amount."
                                          >Profit</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerLaborDollar
                                            if (r == null || j.totalLaborOnJob <= 0) return '—'
                                            return `$${formatCurrency(j.totalLaborOnJob * r)}`
                                          })()}</span>
                                          <span>{(() => {
                                            if (reviewOverheadRates.loading) return '…'
                                            const r = reviewOverheadRates.ratePerLaborDollar
                                            if (r == null || j.totalLaborOnJob <= 0) return '—'
                                            const profit = j.revenueBeforeOverhead - (j.totalLaborOnJob * r)
                                            return <span style={{ color: profit < 0 ? '#b91c1c' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                          <tfoot style={{ background: '#f9fafb', fontWeight: 600, borderTop: '2px solid #e5e7eb' }}>
                            <tr>
                              <td colSpan={2} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>Totals</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>{(() => {
                                  const totalThisLabor = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.laborCost, 0)
                                  return totalThisLabor > 0 ? `$${Math.round(totalThisLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const totalLaborByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) totalLaborByJob.set(j.job_id, j.totalLaborOnJob)
                                  }
                                  const totalLabor = [...totalLaborByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalLabor > 0 ? `$${Math.round(totalLabor).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                {(() => {
                                  const totalRevenue = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                                  return (
                                    <div style={{ fontWeight: 600, color: totalRevenue >= 0 ? undefined : '#b91c1c' }}>{totalRevenue !== 0 ? `$${Math.round(totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</div>
                                  )
                                })()}
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const revBeforeByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) revBeforeByJob.set(j.job_id, j.revenueBeforeOverhead)
                                  }
                                  const totalRevBeforeOverhead = [...revBeforeByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalRevBeforeOverhead !== 0 ? `$${Math.round(totalRevBeforeOverhead).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                <div style={{ fontWeight: 600 }}>{(() => {
                                  const totalThisBill = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                                  return totalThisBill > 0 ? `$${Math.round(totalThisBill).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                                <div style={{ fontSize: '0.8em', color: '#6b7280' }}>{(() => {
                                  const totalValueByJob = new Map<string, number>()
                                  for (const j of [...reviewLaborJobs, ...reviewCrewJobs]) {
                                    if (j.job_id) totalValueByJob.set(j.job_id, j.valueCreated)
                                  }
                                  const totalValue = [...totalValueByJob.values()].reduce((s, v) => s + v, 0)
                                  return totalValue > 0 ? `$${Math.round(totalValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                })()}</div>
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>
                                {(() => {
                                  const totalRev = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedTotalBill, 0)
                                  const totalProfit = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.allocatedRevenueBeforeOverhead, 0)
                                  const totalHrs = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                                  if (totalHrs <= 0) return '—'
                                  const revHr = totalRev / totalHrs
                                  const profitHr = totalProfit / totalHrs
                                  return (
                                    <>
                                      <div>$<strong>{Math.round(revHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr revenue</div>
                                      <div style={{ color: profitHr < 0 ? '#b91c1c' : undefined }}>$<strong>{Math.round(profitHr).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>/hr profit</div>
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
                    const dayOfWeek = new Date(d + 'T12:00:00').getDay()
                    return cfg.is_salary
                      ? (dayOfWeek >= 1 && dayOfWeek <= 5 ? 8 : 0)
                      : (reviewHours.find((h) => h.work_date === d)?.hours ?? 0)
                  }
                  const totalHours = reviewOnlyPaidInFull
                    ? [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                    : days.reduce((s, d) => s + getHoursForDay(d), 0)
                  const totalPay = personName ? getReviewPeriodPay(personName) : 0
                  if (reviewHoursPayCollapsed) {
                    return (
                      <div style={{ display: 'flex', gap: '2rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb' }}>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Hours:</span>
                          <span style={{ fontWeight: 600 }}>{totalHours > 0 ? decimalToHms(totalHours).replace(/:00$/, '') || '-' : '-'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>Pay:</span>
                          <span style={{ fontWeight: 600 }}>{wage > 0 ? `$${Math.round(totalPay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</span>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Hours</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Pay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {days.map((d) => {
                            const hrs = getHoursForDay(d)
                            const pay = personName && wage > 0 ? getPayForPersonDate(personName, d) : 0
                            return (
                              <tr key={d} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{d}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{hrs > 0 ? decimalToHms(hrs).replace(/:00$/, '') || '-' : '-'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{wage > 0 ? `$${Math.round(pay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot style={{ background: '#f9fafb', fontWeight: 600, borderTop: '2px solid #e5e7eb' }}>
                          <tr>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>Totals</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>{totalHours > 0 ? decimalToHms(totalHours).replace(/:00$/, '') || '-' : '-'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb' }}>{wage > 0 ? `$${Math.round(totalPay).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                })()}
              </section>

              <section style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Reports Filed ({reviewReports.length})</h3>
                {reviewReports.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No reports in this period.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Template</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Job</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Created</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewReports.map((r) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{displayReportTemplateName(r.template_name, authRole)}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{r.job_display_name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(r.created_at).toLocaleString()}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <Link to={`/jobs?report=${r.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>View</Link>
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
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No tasks in this period.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Title</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Scheduled</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTasks.map((t) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
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
                </h3>
                {reviewTasksOutstanding.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No open tasks assigned.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Title</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Scheduled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTasksOutstanding.map((t) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <ChecklistTitleWithLinks title={t.title} links={t.links} />
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {(t.scheduled_date ?? '').trim() ? t.scheduled_date : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
          {reviewLaborBreakdownContext && (() => {
            const ctx = reviewLaborBreakdownContext
            const rows = ctx.jobId ? (reviewLaborByJobAndPerson[ctx.jobId] ?? []) : []
            const sumOfRows = rows.reduce((s, r) => s + r.laborCost, 0)
            const sumHours = rows.reduce((s, r) => s + r.hours, 0)
            const denom = ctx.totalLaborOnJob > 0 ? ctx.totalLaborOnJob : sumOfRows
            const headerLabel = [ctx.jobNumberLabel, ctx.jobName].filter(Boolean).join(' · ') || (ctx.mode === 'profit' ? 'Profit breakdown' : 'Labor breakdown')
            const isProfit = ctx.mode === 'profit'
            const profitNegative = ctx.revenueBeforeOverhead < 0
            return (
              <div
                onClick={() => setReviewLaborBreakdownContext(null)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 480, maxWidth: '92vw', maxHeight: '85vh', overflow: 'auto' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{isProfit ? 'Profit shares by person' : 'Labor contributors'}</h3>
                      <div style={{ fontSize: '0.875rem', color: '#374151', marginTop: '0.25rem' }}>{headerLabel}</div>
                      {ctx.jobAddress ? (
                        <div style={{ fontSize: '0.8em', color: '#6b7280', marginTop: '0.1rem' }}>{stripAddressZipState(ctx.jobAddress) || ctx.jobAddress}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewLaborBreakdownContext(null)}
                      style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: '#6b7280' }}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    {isProfit ? (
                      <>
                        Total profit on this job (revenue before overhead): <strong style={{ color: profitNegative ? '#b91c1c' : '#111827' }}>${Math.round(ctx.revenueBeforeOverhead).toLocaleString('en-US')}</strong>
                        <div style={{ fontSize: '0.95em', color: '#9ca3af', marginTop: '0.15rem' }}>
                          Allocated by each person's share of total labor (${Math.round(denom).toLocaleString('en-US')}{sumHours > 0 ? ` · ${sumHours.toFixed(2)} hrs` : ''}).
                        </div>
                      </>
                    ) : (
                      <>Total labor on this job (everyone, all time): <strong style={{ color: '#111827' }}>${Math.round(denom).toLocaleString('en-US')}</strong>{sumHours > 0 ? ` · ${sumHours.toFixed(2)} hrs` : ''}</>
                    )}
                  </div>
                  {rows.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No labor recorded for this job.</p>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Person</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Hours</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Labor</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Share</th>
                            {isProfit && (
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Profit slice</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => {
                            const isYou = ctx.userPersonName && r.personName === ctx.userPersonName
                            const ratio = denom > 0 ? r.laborCost / denom : 0
                            const pct = Math.round(ratio * 100)
                            const profitSlice = ratio * ctx.revenueBeforeOverhead
                            const sourceLabel = (() => {
                              const parts: string[] = []
                              if (r.subLaborCost > 0) parts.push('sub')
                              if (r.crewLaborCost > 0) parts.push('crew')
                              return parts.join(' + ')
                            })()
                            return (
                              <tr
                                key={r.personName}
                                style={{ borderBottom: '1px solid #e5e7eb', background: isYou ? '#fef3c7' : undefined }}
                              >
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  <div style={{ fontWeight: isYou ? 600 : 400 }}>
                                    {r.personName}
                                    {isYou ? <span style={{ marginLeft: '0.4rem', fontSize: '0.75em', color: '#92400e', fontWeight: 600 }}>(you)</span> : null}
                                  </div>
                                  {sourceLabel ? <div style={{ fontSize: '0.75em', color: '#9ca3af' }}>{sourceLabel}</div> : null}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.hours > 0 ? r.hours.toFixed(2) : '—'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.laborCost > 0 ? `$${formatCurrency(r.laborCost)}` : '—'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#6b7280' }}>{denom > 0 && r.laborCost > 0 ? `${pct}%` : '—'}</td>
                                {isProfit && (
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: isYou ? 600 : 400, color: profitSlice >= 0 ? undefined : '#b91c1c' }}>
                                    {Math.abs(profitSlice) >= 0.5 ? `$${formatCurrency(profitSlice)}` : '—'}
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>Total</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>{sumHours > 0 ? sumHours.toFixed(2) : '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>{sumOfRows > 0 ? `$${formatCurrency(sumOfRows)}` : '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', color: '#6b7280' }}>
                              {denom > 0 ? `${Math.round((sumOfRows / denom) * 100)}%` : '—'}
                            </td>
                            {isProfit && (
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid #e5e7eb', fontWeight: 600, color: ctx.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>
                                {Math.abs(ctx.revenueBeforeOverhead) >= 0.5 ? `$${formatCurrency(denom > 0 ? (sumOfRows / denom) * ctx.revenueBeforeOverhead : 0)}` : '—'}
                              </td>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {Math.abs(sumOfRows - ctx.totalLaborOnJob) > 1 && ctx.totalLaborOnJob > 0 && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.75em', color: '#9ca3af' }}>
                      Per-person rows total ${formatCurrency(sumOfRows)}; the job header showed ${formatCurrency(ctx.totalLaborOnJob)}. The two should match — a small gap usually means a sub-labor card without an assignee or a crew row outside the 2-year lookback window.
                    </p>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )
  })()
}
