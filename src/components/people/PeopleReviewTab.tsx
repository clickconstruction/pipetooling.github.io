import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { DatabaseError, formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../lib/supabasePaging'
import { denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'
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
import { laborJobMatchesPerson } from '../../lib/people/laborJobPersonMatch'
import { laborJobSubCost } from '../../lib/jobs/subLaborCost'
import type { Person, UserRow } from '../../hooks/usePeopleRoster'
import {
  approvedClosedSessionHours,
  buildOtherJobsLaborByDay,
  buildOverheadDailyLabor,
  buildOverheadWageLookup,
  buildOverheadWageLookupByPersonId,
  mergeOverheadDayTableRows,
  overheadBucketForSession,
  type OverheadClockSessionRow,
} from '../../lib/overheadDailyLabor'
import { bucketInvoiceRevenueByAppTzDay } from '../../lib/overheadAvgDailyCost'
import { computeOverheadRateMethods } from '../../lib/overheadRateMethods'
import { loadOfficePartsUsdByDayExcludingInternalTransfer } from '../../lib/overheadPartsBucketLoader'
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
import { enrichTeamSummaryRowsForInline, fmtMoney } from './teamSummary/formatters'
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
import { buildReviewTasksRollup } from '../../lib/people/reviewTasksRollup'
import { usePendingHoursApprovalsNudge } from '../../hooks/usePendingHoursApprovalsNudge'
import { PeopleReviewVerdictStrip } from './review/PeopleReviewVerdictStrip'
import { PeopleReviewHygieneStrip } from './review/PeopleReviewHygieneStrip'
import { PeopleReviewRankedList } from './review/PeopleReviewRankedList'
import { PeopleReviewMathDrawer } from './review/PeopleReviewMathDrawer'
import type {
  TeamLaborItem,
  TeamLedgerRow,
  TeamPeriodLaborRow,
  TeamReviewUnion,
} from '../../lib/people/teamReviewTypes'

/**
 * Throws on the first failed result in a wave of Supabase queries. Both big
 * Review loaders (`loadReviewData`, `loadTeamReviewUnion`) used to unwrap
 * every result as `(res.data ?? [])`, so a failed query silently became an
 * empty array — $0 parts, $0 labor, inflated allocation ratios — with no
 * error surface. Stub waves (`Promise.resolve({ data: [] })`) have no
 * `error` key, which this tolerates.
 */
function throwIfQueryError(
  results: Array<{ data?: unknown; error?: { message: string; code?: string; details?: string } | null }>,
  label: string,
): void {
  for (const r of results) {
    if (r.error) throw new DatabaseError(`Failed to ${label}: ${r.error.message}`, r.error.code, r.error.details)
  }
}

/**
 * Pages a query with {@link fetchAllRows} and wraps the rows back into a
 * `{ data }` result so existing wave destructuring / `.data` reads are
 * unchanged. Company-wide and multi-year fetches in this file cross
 * PostgREST's silent `max_rows` (1000) cap (people_hours ≈ one row per
 * person per day); un-paged they return an arbitrary subset with no error.
 * `makePage` must build a FRESH query per call with a stable `.order()`.
 * Person-scoped single-period queries stay single-shot.
 */
function paged<T>(
  makePage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string; details?: string } | null }>,
  label: string,
): Promise<{ data: T[]; error: null }> {
  return fetchAllRows<T>(makePage, label).then((rows) => ({ data: rows, error: null }))
}

/**
 * Sign-aware cents-precision money: -$244.16 instead of $-244.16 (fmtMoney's
 * sign idiom, formatCurrency's decimals). For the Jobs Worked cells that can
 * legitimately go negative.
 */
function signedCurrency(n: number): string {
  return `${n < 0 ? '-$' : '$'}${formatCurrency(Math.abs(n))}`
}

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
  // Per-person panel failure surface + stale-response guard. The Team Summary
  // path has had `teamSummaryReqIdRef` for this since extraction; the panel
  // loader never did — a fast person switch could resolve out of order and
  // leave person A's jobs under person B's header.
  const [reviewError, setReviewError] = useState<string | null>(null)
  const reviewReqIdRef = useRef(0)
  type ReviewLaborJob = {
    source: 'labor'
    id: string
    job_date: string | null
    address: string
    hoursInfo: string
    hours: number
    job_number: string | null
    click_number: string | null
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
    click_number: string
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
  type ReviewTask = { id: string; title: string; links?: string[] | null; scheduled_date: string; completed_at: string | null; checklist_item_id?: string | null }
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([])
  const [reviewTasksOutstanding, setReviewTasksOutstanding] = useState<ReviewTask[]>([])
  const [reviewJobsWorkedCollapsed, setReviewJobsWorkedCollapsed] = useState(false)
  const [reviewJobExpandedKey, setReviewJobExpandedKey] = useState<string | null>(null)
  // Jobs Worked is rolled up one line per job (v2.2682); this holds the jobs
  // whose day rows are open. The per-day detail grid keeps its own key above.
  const [reviewJobGroupsOpen, setReviewJobGroupsOpen] = useState<ReadonlySet<string>>(() => new Set())
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
        // Anchor the whole 90-day window on the COMPANY calendar day
        // (America/Chicago), not the viewer's browser-local date — a viewer
        // in another timezone near midnight used to see the entire
        // session/parts/revenue window shifted by a day.
        const today = denverCalendarDayKey(Date.now())
        const start = ymdAddDays(today, -89)
        const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
        // Paged fetches (fetchAllRows): these are company-wide 90-day scans
        // that silently truncate at PostgREST max_rows (1000) if un-ranged —
        // a truncated field-hours denominator inflates every Method A/B/C
        // rate. Fresh builder per page; `.order('id')` keeps pages stable.
        const sessionSelect =
          'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)'
        const makeOverheadQ = () => {
          let q = supabase.from('clock_sessions').select(sessionSelect).gte('work_date', start).lte('work_date', today)
          if (officeJobLedgerId) {
            q = q.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`)
          } else {
            q = q.not('bid_id', 'is', null)
          }
          return q.order('id')
        }
        const makeFieldQ = () => {
          let q = supabase
            .from('clock_sessions')
            .select(sessionSelect)
            .gte('work_date', start)
            .lte('work_date', today)
            .not('job_ledger_id', 'is', null)
          if (officeJobLedgerId) q = q.neq('job_ledger_id', officeJobLedgerId)
          return q.order('id')
        }
        // Fetch a day wide on both sides, then re-bucket each invoice into
        // its Chicago calendar day (bucketInvoiceRevenueByAppTzDay — the same
        // tested kernel the Overhead tab's KPI effect uses) — the old
        // UTC-bounded window pulled in the previous evening's invoices and
        // dropped everything sent after ~6pm on the last day.
        const startIsoLow = `${ymdAddDays(start, -1)}T00:00:00-00:00`
        const endIsoHigh = `${ymdAddDays(today, 2)}T00:00:00-00:00`
        const [overheadSessionsRes, fieldSessionsRes, partsRes, invoiceRowsRes, personLinkRows] = await Promise.all([
          fetchAllRows(
            async (f, t) => ({
              data: (await withSupabaseRetry(async () => makeOverheadQ().range(f, t), 'load review 90d overhead sessions')) as unknown as OverheadClockSessionRow[] | null,
              error: null,
            }),
            'load review 90d overhead sessions',
          ),
          fetchAllRows(
            async (f, t) => ({
              data: (await withSupabaseRetry(async () => makeFieldQ().range(f, t), 'load review 90d field sessions')) as unknown as OverheadClockSessionRow[] | null,
              error: null,
            }),
            'load review 90d field sessions',
          ),
          // Shared loader (same one the Overhead tab's 90-day KPI effect
          // uses): office parts by day with Internal Transfers EXCLUDED —
          // they're money moving between the org's own accounts, not an
          // expense. The raw fetch here used to count them, so the Review
          // tab's pool, rates, and split-model partsRate over-charged
          // whenever a transfer hit the office job in the window.
          officeJobLedgerId
            ? loadOfficePartsUsdByDayExcludingInternalTransfer({
                officeJobLedgerId,
                startYmd: start,
                endYmd: today,
              }).then((r) => r.partsUsdByDay)
            : Promise.resolve(new Map<string, number>()),
          fetchAllRows(
            async (f, t) => ({
              data: (await withSupabaseRetry(
                async () =>
                  supabase
                    .from('jobs_ledger_invoices')
                    .select('amount, sent_to_customer_at')
                    .gte('sent_to_customer_at', startIsoLow)
                    .lt('sent_to_customer_at', endIsoHigh)
                    // Stripe TEST-mode invoices are not revenue — keep them
                    // out of the Method B denominator. NULL stripe_mode =
                    // non-Stripe (HCP/physical) or pre-v2.1114 legacy rows,
                    // both real revenue, so a bare .neq() would wrongly drop
                    // them under SQL <> NULL semantics.
                    .or('stripe_mode.is.null,stripe_mode.neq.test')
                    .order('id')
                    .range(f, t),
                'load review 90d invoices',
              )) as Array<{ amount: number | null; sent_to_customer_at: string | null }> | null,
              error: null,
            }),
            'load review 90d invoices',
          ),
          // users.id → people.id link rows for the person-id-first wage join
          // (C1): a rename between users.name and pay-config person_name no
          // longer zeroes that person's labor $ in the pool / Method C.
          fetchAllRows(
            async (f, t) => ({
              data: (await withSupabaseRetry(
                async () =>
                  supabase
                    .from('people')
                    .select('id, account_user_id')
                    .not('account_user_id', 'is', null)
                    .is('archived_at', null)
                    .order('id')
                    .range(f, t),
                'load review 90d person links',
              )) as Array<{ id: string; account_user_id: string | null }> | null,
              error: null,
            }),
            'load review 90d person links',
          ),
        ])
        if (cancelled) return
        const cfgRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('people_pay_config')
              .select('person_name, person_id, hourly_wage, office_hourly_wage, is_salary'),
          'load review 90d pay config',
        )
        if (cancelled) return
        const cfgList = (cfgRows ?? []) as Array<{
          person_name: string
          person_id: string | null
          hourly_wage: number | null
          office_hourly_wage: number | null
          is_salary: boolean | null
        }>
        // Dual-rate fields included so office/bid overhead $ uses the office
        // rate — same pricing as the Overhead tab and payroll.
        const cfgInputs = cfgList.map((r) => ({
          person_name: r.person_name,
          person_id: r.person_id ?? null,
          hourly_wage: r.hourly_wage ?? null,
          office_hourly_wage: r.office_hourly_wage ?? null,
          is_salary: r.is_salary,
        }))
        const wageMap = buildOverheadWageLookup(cfgInputs)
        const wageByPersonId = buildOverheadWageLookupByPersonId(cfgInputs)
        const personIdByUserId = new Map<string, string>()
        for (const p of personLinkRows) {
          if (p.account_user_id) personIdByUserId.set(p.account_user_id, p.id)
        }
        const overheadLabor = buildOverheadDailyLabor({
          sessions: (overheadSessionsRes ?? []) as OverheadClockSessionRow[],
          officeJobLedgerId,
          wageByNormalizedName: wageMap,
          wageByPersonId,
          personIdByUserId,
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
        // Field hours + field labor $ via the shared kernel (same math the
        // Overhead tab's three-lenses strip uses): approved, closed sessions
        // on non-office jobs-ledger work; hours always count, labor $ prices
        // at the person's FIELD wage (id-first join, name fallback) and $0
        // when no wage is configured — identical to the old inline loop.
        const fieldLabor = buildOtherJobsLaborByDay({
          sessions: (fieldSessionsRes ?? []) as OverheadClockSessionRow[],
          officeJobLedgerId,
          wageByNormalizedName: wageMap,
          wageByPersonId,
          personIdByUserId,
        })
        let fieldHours = 0
        for (const v of fieldLabor.laborHoursByDay.values()) fieldHours += v
        let fieldLaborUsd = 0
        for (const v of fieldLabor.laborUsdByDay.values()) fieldLaborUsd += v
        const invoiceRows = (invoiceRowsRes ?? []) as Array<{
          amount: number | null
          sent_to_customer_at: string | null
        }>
        // Shared bucketing kernel (same call as the Overhead tab's KPI
        // effect) instead of an inline re-implementation — the kernel's unit
        // tests pin the inclusive [start, today] Chicago-day window.
        const revenueByDay = bucketInvoiceRevenueByAppTzDay(invoiceRows, start, today)
        let revenueTotal = 0
        for (const v of revenueByDay.values()) revenueTotal += v
        // Shared three-lenses kernel — the SAME code that renders the
        // Overhead tab's rate strip, so the two surfaces cannot drift.
        const rates = computeOverheadRateMethods({
          overheadPoolUsd: overheadTotal,
          fieldHours,
          invoicedRevenueUsd: revenueTotal,
          fieldLaborUsd,
        })
        setReviewOverheadRates({
          ratePerHour: rates.methodA,
          ratePerRevenueDecimal: rates.methodB,
          ratePerLaborDollar: rates.methodC,
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

  // ---- ranked view derivations (all from the enriched rows above) ----
  const reviewSplitPartsRate = useMemo(() => {
    const fh = reviewOverheadRates.fieldHours90d
    return fh != null && fh > 0 ? (reviewOverheadRates.officeParts90d ?? 0) / fh : null
  }, [reviewOverheadRates.fieldHours90d, reviewOverheadRates.officeParts90d])
  const teamSummaryPriorBreakdowns = useMemo<TeamSummaryBreakdown[] | null>(() => {
    if (!teamSummaryPriorRows) return null
    return enrichTeamSummaryRowsForInline(teamSummaryPriorRows, reviewSplitPartsRate, (name) => {
      const cfg = payConfig[name]
      if (!cfg) return 'unknown'
      return cfg.is_salary ? 'salary' : 'hourly'
    })
  }, [teamSummaryPriorRows, reviewSplitPartsRate, payConfig])
  const reviewVerdict = useMemo(
    () => buildReviewVerdict(teamSummaryBreakdowns, teamSummaryPriorBreakdowns),
    [teamSummaryBreakdowns, teamSummaryPriorBreakdowns],
  )
  const reviewRankedBars = useMemo(
    () => buildReviewRankedBars(teamSummaryBreakdowns, reviewRankBy, reviewRankedSearch),
    [teamSummaryBreakdowns, reviewRankBy, reviewRankedSearch],
  )
  const reviewPersonMath = useMemo(() => {
    const b = teamSummarySelectedPersonName
      ? teamSummaryBreakdowns.find((x) => x.name === teamSummarySelectedPersonName)
      : undefined
    return b ? buildReviewPersonMath(b, { partsRate: reviewSplitPartsRate }) : null
  }, [teamSummaryBreakdowns, teamSummarySelectedPersonName, reviewSplitPartsRate])
  const reviewHygieneItems = useMemo(
    () => buildReviewHygiene(teamSummaryBreakdowns, pendingApprovals.approvals),
    [teamSummaryBreakdowns, pendingApprovals.approvals],
  )

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
        const union = await loadTeamReviewUnion(priorStart, priorEnd, reviewOnlyPaidInFull, payConfig)
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
      // the label was a misnomer — see ReviewPeriod doc above). −29 because
      // the range is inclusive of today: [today−29, today] = 30 days (−30
      // used to yield a 31-day window, ~1.1% off vs the true 90-day rate).
      const start = new Date(today)
      start.setDate(today.getDate() - 29)
      return [start.toLocaleDateString('en-CA'), todayStr]
    }
    if (reviewPeriod === 'last_90_days') {
      // −89 for the same inclusive-range reason as last_30_days.
      const start = new Date(today)
      start.setDate(today.getDate() - 89)
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

  /**
   * Panel-mode entry point: owns the request-id guard (out-of-order responses
   * are dropped), error surfacing (`reviewError`), and the loading flag's
   * `finally` (a rejected query no longer strands the panel on "Loading…").
   * The legacy `forTeamSummary` path passes straight through — its caller
   * handles its own errors and it touches no panel state.
   */
  async function loadReviewData(
    personName: string,
    forTeamSummary?: boolean,
    onlyPaidJobs?: boolean
  ): Promise<{ allocatedRevenue: number; allocatedProfit: number; hoursRows: Array<{ work_date: string; hours: number }>; totalHoursPaidJobs?: number } | void> {
    if (forTeamSummary) return loadReviewDataCore(personName, forTeamSummary, onlyPaidJobs)
    const reqId = ++reviewReqIdRef.current
    setReviewError(null)
    try {
      return await loadReviewDataCore(personName, false, onlyPaidJobs, reqId)
    } catch (e) {
      if (reviewReqIdRef.current === reqId) setReviewError(formatErrorMessage(e))
    } finally {
      if (reviewReqIdRef.current === reqId) setReviewLoading(false)
    }
  }

  async function loadReviewDataCore(
    personName: string,
    forTeamSummary?: boolean,
    onlyPaidJobs?: boolean,
    reqId?: number
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

    // Trimmed comparison: payConfig keys carry whitespace variance and a
    // trailing space here used to silently blank Tasks/Reports for the person.
    const personNameTrimmed = personName.trim()
    const userId = users.find((u) => (u.name ?? '').trim() === personNameTrimmed)?.id ?? null
    // people.id for the junction-first sub-sheet read below (identity plan
    // C1-7); pay config carries person_id post-Phase-B as a second source.
    const personId =
      people.find((p) => (p.name ?? '').trim() === personNameTrimmed)?.id ??
      (payConfig[personName] ?? payConfig[personNameTrimmed])?.person_id ??
      null

    // Same exclusion as derivePersonTeamSummary: the configured Office job is
    // overhead, not field revenue — without it the panel lists "Office" as a
    // Jobs Worked row with a large negative allocation the Team Summary row
    // above deliberately does not have.
    const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()

    // Id-first pay-config resolution (matches utils/teamLabor.ts): crew rows
    // carry person_id post-Phase-B, so a renamed pay-config row still finds
    // its wage/salary flag instead of silently dropping to $0 / hourly.
    const payConfigById: Record<string, PayConfigRow> = {}
    for (const row of Object.values(payConfig)) {
      if (row.person_id) payConfigById[row.person_id] = row
    }

    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    // Anchored to the selected period like loadTeamReviewUnion — see the
    // comment there. Old custom ranges used to fall entirely outside the
    // lookback and rendered '—' hours with 100%-of-job allocations.
    const twoYearsAgoYmd = twoYearsAgo.toLocaleDateString('en-CA')
    const lookbackStart = start < twoYearsAgoYmd ? start : twoYearsAgoYmd

    const [assigneesRes, allLaborResForCostAllTime, crewRes, allCrewResForCostAllTime, hoursRes, reportsRes, tasksRes, outstandingTasksRes, settingsRes, tallyRes, allHoursRes, allHoursResAllTime] = await Promise.all([
      // Junction-first sub-sheet attribution (identity plan C1-7): the old
      // `.eq('assigned_to_name', personName)` reads silently returned zero
      // rows for any sheet with 2+ assignees — the column is a ' | '-delimited
      // multi-name string. The person's rows are derived below from the
      // company-wide lookback fetch (a superset of both old windows) via
      // laborJobMatchesPerson (junction row first, split-name fallback).
      personId
        ? paged((f, t) => supabase.from('people_labor_job_assignees').select('labor_job_id').eq('person_id', personId).order('labor_job_id').range(f, t), 'load review labor job assignees')
        : Promise.resolve({ data: [] }),
      paged((f, t) => supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles, assigned_to_name').gte('job_date', lookbackStart).order('id').range(f, t), 'load review lifetime labor jobs'),
      paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load review period crew days'),
      paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', lookbackStart).order('work_date').order('person_name').range(f, t), 'load review lifetime crew days'),
      supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
      // list_reports_with_job_info has a deterministic ORDER BY (created_at), so .range() pages are stable.
      forTeamSummary ? Promise.resolve({ data: [] }) : paged((f, t) => supabase.rpc('list_reports_with_job_info').range(f, t), 'load review reports'),
      userId && !forTeamSummary
        ? supabase
            .from('checklist_instances')
            .select('id, checklist_item_id, scheduled_date, completed_at, checklist_items(title, links), checklist_instance_assignees!inner(user_id)')
            .eq('checklist_instance_assignees.user_id', userId)
            .not('completed_at', 'is', null)
            // Local-midnight instants, matching the Reports window below —
            // the previous zoneless strings resolved as UTC, shifting the
            // Tasks window ~6h against the Reports list rendered beside it.
            .gte('completed_at', new Date(start + 'T00:00:00').toISOString())
            .lt('completed_at', new Date(new Date(end + 'T00:00:00').getTime() + 86_400_000).toISOString())
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
      // list_tally_parts_with_po orders by created_at, so .range() pages are stable.
      paged((f, t) => supabase.rpc('list_tally_parts_with_po').range(f, t), 'load review tally parts'),
      paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load review period hours'),
      paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart).order('work_date').order('person_name').range(f, t), 'load review lifetime hours'),
    ])

    throwIfQueryError(
      [assigneesRes, allLaborResForCostAllTime, crewRes, allCrewResForCostAllTime, hoursRes, reportsRes, tasksRes, outstandingTasksRes, settingsRes, tallyRes, allHoursRes, allHoursResAllTime],
      'load review data',
    )
    const allLaborRowsForCostAllTime = (allLaborResForCostAllTime.data ?? []) as Array<{ id: string; job_date: string | null; address: string; job_number: string | null; labor_rate: number | null; distance_miles: number | null; assigned_to_name: string | null }>
    const junctionJobIds: ReadonlySet<string> = new Set(
      ((assigneesRes.data ?? []) as Array<{ labor_job_id: string }>).map((r) => r.labor_job_id),
    )
    // Derived person attributions (see the wave comment above). YMD strings
    // compare lexicographically === chronologically; null job_date rows are
    // excluded from the period window exactly as the old `.gte`/`.lte` did.
    const laborRows = allLaborRowsForCostAllTime.filter(
      (r) => laborJobMatchesPerson(r, junctionJobIds, personName) && r.job_date != null && r.job_date >= start && r.job_date <= end,
    )
    const personLaborRowsAllTime = forTeamSummary
      ? ([] as typeof allLaborRowsForCostAllTime)
      : allLaborRowsForCostAllTime.filter((r) => laborJobMatchesPerson(r, junctionJobIds, personName))
    const crewRows = (crewRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
    const allCrewRowsForCostAllTime = (allCrewResForCostAllTime.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
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

    // Chunked + paged: the id list here is every labor job company-wide in
    // the lookback (unbounded .in() lists eventually 414, and one chunk can
    // still return >1000 child rows).
    const allLaborJobIdsForCost = allLaborRowsForCostAllTime.map((r) => r.id)
    const laborItems = (await fetchAllRowsChunkedIn(
      allLaborJobIdsForCost,
      (chunk, f, t) => supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(f, t),
      'load review labor items',
    )) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null }>
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
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      // Jobs-page costing (v2.2686): line rate overrides + direct $ lines + drive.
      const laborCost = laborJobSubCost({ labor_rate: r.labor_rate, items, distance_miles: r.distance_miles }, mileageCost, timePerMile)
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
        // Skip the configured office job — overhead, not crew revenue
        // (mirrors derivePersonTeamSummary).
        if (officeJobLedgerId && a.job_id === officeJobLedgerId) continue
        crewJobIds.add(a.job_id)
        crewJobsWithLead.push({ work_date: r.work_date, job_id: a.job_id, pct: a.pct })
      }
    }

    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of allCrewRowsForCostAllTime) {
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = (r.person_id ? payConfigById[r.person_id] : undefined) ?? payConfig[r.person_name]
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
    // Both ledger RPCs have a deterministic ORDER BY, so .range() pages are stable.
    const [crewJobsRes, laborJobsRes] = await Promise.all([
      allJobIds.length > 0
        ? paged(
            (f, t) =>
              (usePaidOnly
                ? supabase.rpc('get_jobs_ledger_by_ids_paid_only', { p_job_ids: allJobIds })
                : supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: allJobIds })
              ).range(f, t),
            'load review crew ledger jobs',
          )
        : { data: [] },
      allLaborHcps.length > 0
        ? paged(
            (f, t) =>
              (usePaidOnly
                ? supabase.rpc('get_jobs_ledger_by_hcp_numbers_paid_only', { p_hcp_numbers: allLaborHcps })
                : supabase.rpc('get_jobs_ledger_by_hcp_numbers', { p_hcp_numbers: allLaborHcps })
              ).range(f, t),
            'load review labor ledger jobs',
          )
        : { data: [] },
    ])
    throwIfQueryError([crewJobsRes, laborJobsRes], 'load review ledger jobs')
    const crewJobsLedger = (crewJobsRes.data ?? []) as Array<{
      id: string
      hcp_number: string
      click_number?: string
      job_name: string
      job_address: string
      revenue: number | null
      pct_complete: number | null
      service_type_id: string | null
    }>
    const laborJobsLedger = (laborJobsRes.data ?? []) as Array<{
      id: string
      hcp_number: string
      click_number?: string
      job_name: string
      job_address: string
      revenue: number | null
      pct_complete: number | null
      service_type_id: string | null
    }>
    const jobsById = new Map<string, (typeof crewJobsLedger)[0]>()
    const jobIdByHcp = new Map<string, string>()
    // Click-only jobs: get_jobs_ledger_by_hcp_numbers deliberately resolves a
    // job whose hcp is empty when its click_number matches (migration
    // 20260619140000) — mapping only hcp_number here used to throw those rows
    // away, rendering the job as "—"/$0. Guarded sets so the first (crew)
    // resolution of a duplicate number wins consistently.
    const mapLedgerNumbers = (j: { id: string; hcp_number?: string | null; click_number?: string | null }) => {
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp && !jobIdByHcp.has(hcp)) jobIdByHcp.set(hcp, j.id)
      const click = (j.click_number ?? '').trim().toLowerCase()
      if (click && !jobIdByHcp.has(click)) jobIdByHcp.set(click, j.id)
    }
    for (const j of crewJobsLedger) {
      jobsById.set(j.id, j)
      mapLedgerNumbers(j)
    }
    for (const j of laborJobsLedger) {
      if (!jobsById.has(j.id)) jobsById.set(j.id, j)
      mapLedgerNumbers(j)
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
      const cfg = (r.person_id ? payConfigById[r.person_id] : undefined) ?? payConfig[r.person_name]
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
    // Person's own lifetime sub-labor per hcp — subtracted from laborCostByHcp
    // so "Subs:" consistently means sub-labor by OTHERS on the job (the labor
    // and crew rows used to disagree: per-row vs whole-book subtraction).
    const personSubLaborCostByHcp = new Map<string, number>()
    for (const r of personLaborRowsAllTime) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const items = itemsByJob.get(r.id) ?? []
      const rate = r.labor_rate ?? 0
      const miles = Number(r.distance_miles) || 0
      const driveCost = miles > 0 && rate > 0 ? miles * mileageCost + miles * timePerMile * rate : miles > 0 ? miles * mileageCost : 0
      // Jobs-page costing (v2.2686): line rate overrides + direct $ lines + drive.
      const laborCost = laborJobSubCost({ labor_rate: r.labor_rate, items, distance_miles: r.distance_miles }, mileageCost, timePerMile)
      personSubLaborCostByHcp.set(hcp, (personSubLaborCostByHcp.get(hcp) ?? 0) + laborCost)
      const jobId = jobIdByHcp.get(hcp)
      if (!jobId) continue
      personLaborCostByJobId.set(jobId, (personLaborCostByJobId.get(jobId) ?? 0) + laborCost)
      if (driveCost > 0) personDriveCostByJobId.set(jobId, (personDriveCostByJobId.get(jobId) ?? 0) + driveCost)
    }
    for (const r of allCrewRowsForCostAllTime) {
      if (r.person_name !== personName) continue
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = (r.person_id ? payConfigById[r.person_id] : undefined) ?? payConfig[r.person_name]
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
      const cfg = (r.person_id ? payConfigById[r.person_id] : undefined) ?? payConfig[r.person_name]
      const day = new Date(r.work_date + 'T12:00:00').getDay()
      const hours = cfg?.is_salary ? (day >= 1 && day <= 5 ? 8 : 0) : (hoursMapAllTime[`${r.person_name}:${r.work_date}`] ?? 0)
      for (const a of assignments) {
        const pctHrs = hours * (a.pct / 100)
        personHoursOnJobAllTime.set(a.job_id, (personHoursOnJobAllTime.get(a.job_id) ?? 0) + pctHrs)
      }
    }

    const jobIds = Array.from(jobsById.keys())
    // get_invoice_amounts_for_jobs aggregates one row per job (bounded by the
    // period's job count, no ORDER BY) so it stays single-shot; materials is
    // chunked+paged.
    const [invoiceRes, materialsRes, cardChargeRows] = await Promise.all([
      jobIds.length > 0 ? supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
      fetchAllRowsChunkedIn(
        jobIds,
        (chunk, f, t) => supabase.from('jobs_ledger_materials').select('job_id, amount').in('job_id', chunk).order('id').range(f, t),
        'load review billed materials',
      ).then((rows) => ({ data: rows, error: null })),
      // Mercury debit-card purchases allocated to jobs — the canonical parts
      // composition (Jobs page / Job Summary) is tally + supply invoices +
      // billed materials + card charges; this loader used to omit the card
      // bucket, overstating profit on card-heavy jobs.
      fetchAllRowsChunkedIn(
        jobIds,
        (chunk, f, t) => supabase.from('mercury_transaction_job_allocations').select('job_id, amount').in('job_id', chunk).order('id').range(f, t),
        'load review card charges',
      ),
    ])
    throwIfQueryError([invoiceRes, materialsRes], 'load review job invoices/materials')
    const invoiceAmountByJob: Record<string, number> = {}
    for (const row of (invoiceRes.data ?? []) as Array<{ job_id: string; invoice_amount: number | null }>) {
      invoiceAmountByJob[row.job_id] = Number(row.invoice_amount ?? 0)
    }
    const billedMaterialsByJobId = new Map<string, number>()
    for (const row of (materialsRes.data ?? []) as Array<{ job_id: string; amount: number }>) {
      billedMaterialsByJobId.set(row.job_id, (billedMaterialsByJobId.get(row.job_id) ?? 0) + Number(row.amount ?? 0))
    }
    const cardChargesByJobId = new Map<string, number>()
    for (const row of cardChargeRows as Array<{ job_id: string; amount: number }>) {
      cardChargesByJobId.set(row.job_id, (cardChargesByJobId.get(row.job_id) ?? 0) + Math.abs(Number(row.amount)))
    }

    const laborRowsOfficeFiltered = officeJobLedgerId
      ? laborRows.filter((r) => {
          // Mirror derivePersonTeamSummary: sub-labor rows pointing at the
          // configured office job are overhead, not field revenue.
          const hcp = (r.job_number ?? '').trim().toLowerCase()
          if (!hcp) return true
          return jobIdByHcp.get(hcp) !== officeJobLedgerId
        })
      : laborRows
    const laborRowsFiltered = usePaidOnly
      ? laborRowsOfficeFiltered.filter((r) => {
          const hcp = (r.job_number ?? '').trim().toLowerCase()
          return hcp && jobIdByHcp.has(hcp)
        })
      : laborRowsOfficeFiltered
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
      // Jobs-page costing (v2.2686): line rate overrides + direct $ lines + drive.
      const laborCost = laborJobSubCost({ labor_rate: r.labor_rate, items, distance_miles: r.distance_miles }, mileageCost, timePerMile)
      const partsCost = jobId ? (partsCostByJobId.get(jobId) ?? 0) + (invoiceAmountByJob[jobId] ?? 0) + (billedMaterialsByJobId.get(jobId) ?? 0) + (cardChargesByJobId.get(jobId) ?? 0) : 0
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
        click_number: job?.click_number ?? null,
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
        subLaborCost: hcp ? Math.max(0, (laborCostByHcp.get(hcp) ?? 0) - (personSubLaborCostByHcp.get(hcp) ?? 0)) : 0,
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

    const jobsMap: Record<string, { hcp_number: string; click_number: string; job_name: string; job_address: string; revenue: number | null; pct_complete: number | null; service_type_id: string | null }> = {}
    for (const j of crewJobsLedger) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', click_number: j.click_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '', revenue: j.revenue, pct_complete: j.pct_complete, service_type_id: j.service_type_id ?? null }
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
      const partsCost = (partsCostByJobId.get(c.job_id) ?? 0) + (invoiceAmountByJob[c.job_id] ?? 0) + (billedMaterialsByJobId.get(c.job_id) ?? 0) + (cardChargesByJobId.get(c.job_id) ?? 0)
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
        hcp_number: effectiveJobLedgerNumber(j?.hcp_number, j?.click_number) || '—',
        click_number: j?.click_number ?? '',
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
        subLaborCost: hcp ? Math.max(0, (laborCostByHcp.get(hcp) ?? 0) - (personSubLaborCostByHcp.get(hcp) ?? 0)) : 0,
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
    const reports = allReports.filter((r) => (r.created_by_name ?? '').trim() === personNameTrimmed && new Date(r.created_at).getTime() >= startDate && new Date(r.created_at).getTime() <= endDate)

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
        checklist_item_id: t.checklist_item_id,
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
      forTeamSummary || !(laborHcps.length > 0 || crewJobIds.size > 0) ? Promise.resolve({ data: [] }) : paged((f, t) => supabase.from('people_labor_jobs').select('id, job_number, job_date').gte('job_date', lookbackStart2Y).lte('job_date', lookbackEnd).order('id').range(f, t), 'load review windowed labor jobs'),
      forTeamSummary ? Promise.resolve({ data: [] }) : paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd).order('work_date').order('person_name').range(f, t), 'load review windowed crew days'),
      forTeamSummary ? Promise.resolve({ data: [] }) : paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart2Y).lte('work_date', lookbackEnd).order('work_date').order('person_name').range(f, t), 'load review windowed hours'),
    ])
    throwIfQueryError([allLaborRes, allCrewRes, allHoursRes2], 'load review lifetime hours')
    const allLaborRows = (allLaborRes.data ?? []) as Array<{ id: string; job_number: string | null; job_date: string | null }>
    const allCrewRows = (allCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
    const allHoursRows2 = (allHoursRes2.data ?? []) as Array<{ person_name: string; work_date: string; hours: number }>
    const hoursMapAll: Record<string, number> = {}
    for (const h of allHoursRows2) {
      hoursMapAll[`${h.person_name}:${h.work_date}`] = h.hours
    }

    const allLaborJobIds = allLaborRows.map((r) => r.id)
    const allLaborItems = (await fetchAllRowsChunkedIn(
      allLaborJobIds,
      (chunk, f, t) => supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(f, t),
      'load review lifetime labor items',
    )) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null }>
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
      const cfg = (r.person_id ? payConfigById[r.person_id] : undefined) ?? payConfig[r.person_name]
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

    // Drop stale responses: if a newer load started (person/period switch)
    // while this one was in flight, its writes must not land.
    if (reqId !== undefined && reviewReqIdRef.current !== reqId) return

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
    // reviewLoading is cleared by the wrapper's `finally` (guarded by reqId).
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
    // Anchored to the SELECTED PERIOD, not just today: with a pure today−2y
    // lookback, any period starting more than 2 years back had zero lifetime
    // hours/cost rows, so the allocation-ratio fallback credited each person
    // 100% of every job. YYYY-MM-DD compares lexicographically.
    const twoYearsAgoYmd = twoYearsAgo.toLocaleDateString('en-CA')
    const lookbackStart = start < twoYearsAgoYmd ? start : twoYearsAgoYmd

    const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()

    // Id-first pay-config resolution — see the identical index in
    // loadReviewDataCore.
    const payConfigSnapshotById: Record<string, PayConfigRow> = {}
    for (const row of Object.values(payConfigSnapshot)) {
      if (row.person_id) payConfigSnapshotById[row.person_id] = row
    }

    const overheadSessionsAllTimeFetchPromise = (async () => {
      // Period-bounded (was an unbounded 2-year fetch): the consumer below
      // discards everything outside [start, end], so the wider window only
      // bought silent max_rows truncation — which zeroed office hours for
      // whichever people fell past the 1000-row cap. Paged for the same
      // reason.
      const makeQ = () => {
        let q = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', start)
          .lte('work_date', end)
        if (officeJobLedgerId) {
          q = q.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`)
        } else {
          q = q.not('bid_id', 'is', null)
        }
        return q.order('id')
      }
      const rows = await fetchAllRows(
        (f, t) => makeQ().range(f, t),
        'load team summary overhead sessions',
      )
      return rows as unknown as OverheadClockSessionRow[]
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
      paged((f, t) => supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles, assigned_to_name').gte('job_date', start).lte('job_date', end).order('id').range(f, t), 'load team summary period labor jobs'),
      paged((f, t) => supabase.from('people_labor_jobs').select('id, job_date, address, job_number, labor_rate, distance_miles, assigned_to_name').gte('job_date', lookbackStart).order('id').range(f, t), 'load team summary lifetime labor jobs'),
      paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load team summary period crew days'),
      paged((f, t) => supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', lookbackStart).order('work_date').order('person_name').range(f, t), 'load team summary lifetime crew days'),
      // Period-only bid crew rows -- modal display only, no all-time fetch needed.
      paged((f, t) => supabase.from('people_crew_bids').select('work_date, person_name, bid_assignments').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load team summary period crew bids'),
      paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', start).lte('work_date', end).order('work_date').order('person_name').range(f, t), 'load team summary period hours'),
      paged((f, t) => supabase.from('people_hours').select('person_name, work_date, hours').gte('work_date', lookbackStart).order('work_date').order('person_name').range(f, t), 'load team summary lifetime hours'),
      supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
      // list_tally_parts_with_po orders by created_at, so .range() pages are stable.
      paged((f, t) => supabase.rpc('list_tally_parts_with_po').range(f, t), 'load team summary tally parts'),
      overheadSessionsAllTimeFetchPromise,
    ])
    throwIfQueryError(
      [periodLaborRes, allTimeLaborRes, periodCrewRes, allTimeCrewRes, periodCrewBidsRes, periodHoursRes, allTimeHoursRes, settingsRes, tallyRes],
      'load team summary data',
    )

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
    const periodCrewRows = (periodCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
    const allTimeCrewRows = (allTimeCrewRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: CrewJobAssignment[] }>
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
    const laborItemsRes = {
      data: await fetchAllRowsChunkedIn(
        allTimeLaborJobIds,
        (chunk, f, t) => supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(f, t),
        'load team summary labor items',
      ),
    }
    const laborItems = (laborItemsRes.data ?? []) as Array<{ job_id: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null }>
    const laborItemsByJobId = new Map<string, TeamLaborItem[]>()
    for (const i of laborItems) {
      const list = laborItemsByJobId.get(i.job_id) ?? []
      list.push({ count: i.count, hrs_per_unit: i.hrs_per_unit, is_fixed: i.is_fixed, labor_rate: i.labor_rate, direct_labor_amount: i.direct_labor_amount })
      laborItemsByJobId.set(i.job_id, list)
    }

    // Lifetime sub-labor cost per HCP (all assignees).
    const laborCostByHcp = new Map<string, number>()
    for (const r of allTimeLaborRows) {
      const hcp = (r.job_number ?? '').trim().toLowerCase()
      if (!hcp) continue
      const items = laborItemsByJobId.get(r.id) ?? []
      // Jobs-page costing (v2.2686): line rate overrides + direct $ lines + drive.
      const laborCost = laborJobSubCost({ labor_rate: r.labor_rate, items, distance_miles: r.distance_miles }, mileageCost, timePerMile)
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
    // on pay reports / Person Review.
    const teamLaborCostByJobId = new Map<string, number>()
    for (const r of allTimeCrewRows) {
      const row = crewByDatePersonAllTime[`${r.work_date}:${r.person_name}`]
      const assignments = row?.job_assignments ?? []
      const cfg = (r.person_id ? payConfigSnapshotById[r.person_id] : undefined) ?? payConfigSnapshot[r.person_name]
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
    // The ledger RPCs have a deterministic ORDER BY, so .range() pages are stable.
    const [crewJobsRes, laborJobsRes, crewBidsRes] = await Promise.all([
      allJobIds.length > 0
        ? paged(
            (f, t) =>
              (onlyPaidJobs
                ? supabase.rpc('get_jobs_ledger_by_ids_paid_only', { p_job_ids: allJobIds })
                : supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: allJobIds })
              ).range(f, t),
            'load team summary crew ledger jobs',
          )
        : { data: [] },
      unionLaborHcps.length > 0
        ? paged(
            (f, t) =>
              (onlyPaidJobs
                ? supabase.rpc('get_jobs_ledger_by_hcp_numbers_paid_only', { p_hcp_numbers: unionLaborHcps })
                : supabase.rpc('get_jobs_ledger_by_hcp_numbers', { p_hcp_numbers: unionLaborHcps })
              ).range(f, t),
            'load team summary labor ledger jobs',
          )
        : { data: [] },
      allBidIds.length > 0
        ? paged((f, t) => supabase.rpc('get_bids_by_ids', { p_bid_ids: allBidIds }).range(f, t), 'load team summary bids')
        : { data: [] },
    ])
    throwIfQueryError([crewJobsRes, laborJobsRes, crewBidsRes], 'load team summary ledger jobs')
    const crewJobsLedger = (crewJobsRes.data ?? []) as TeamLedgerRow[]
    const laborJobsLedger = (laborJobsRes.data ?? []) as TeamLedgerRow[]
    const jobsById = new Map<string, TeamLedgerRow>()
    const jobIdByHcp = new Map<string, string>()
    // Click-only jobs resolved + duplicate numbers guarded — see the
    // identical mapLedgerNumbers in loadReviewDataCore.
    const mapUnionLedgerNumbers = (j: TeamLedgerRow) => {
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      if (hcp && !jobIdByHcp.has(hcp)) jobIdByHcp.set(hcp, j.id)
      const click = (j.click_number ?? '').trim().toLowerCase()
      if (click && !jobIdByHcp.has(click)) jobIdByHcp.set(click, j.id)
    }
    for (const j of crewJobsLedger) {
      jobsById.set(j.id, j)
      mapUnionLedgerNumbers(j)
    }
    for (const j of laborJobsLedger) {
      if (!jobsById.has(j.id)) jobsById.set(j.id, j)
      mapUnionLedgerNumbers(j)
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
    // get_invoice_amounts_for_jobs aggregates one row per job (bounded, no
    // ORDER BY) so it stays single-shot; materials is chunked+paged.
    const [invoiceRes, materialsRes, cardChargeRows] = await Promise.all([
      jobIds.length > 0 ? supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
      fetchAllRowsChunkedIn(
        jobIds,
        (chunk, f, t) => supabase.from('jobs_ledger_materials').select('job_id, amount').in('job_id', chunk).order('id').range(f, t),
        'load team summary billed materials',
      ).then((rows) => ({ data: rows, error: null })),
      // Mercury card charges — canonical parts composition, see loadReviewDataCore.
      fetchAllRowsChunkedIn(
        jobIds,
        (chunk, f, t) => supabase.from('mercury_transaction_job_allocations').select('job_id, amount').in('job_id', chunk).order('id').range(f, t),
        'load team summary card charges',
      ),
    ])
    throwIfQueryError([invoiceRes, materialsRes], 'load team summary job invoices/materials')
    const invoiceAmountByJob: Record<string, number> = {}
    for (const row of (invoiceRes.data ?? []) as Array<{ job_id: string; invoice_amount: number | null }>) {
      invoiceAmountByJob[row.job_id] = Number(row.invoice_amount ?? 0)
    }
    const billedMaterialsByJobId = new Map<string, number>()
    for (const row of (materialsRes.data ?? []) as Array<{ job_id: string; amount: number }>) {
      billedMaterialsByJobId.set(row.job_id, (billedMaterialsByJobId.get(row.job_id) ?? 0) + Number(row.amount ?? 0))
    }
    const cardChargesByJobId = new Map<string, number>()
    for (const row of cardChargeRows as Array<{ job_id: string; amount: number }>) {
      cardChargesByJobId.set(row.job_id, (cardChargesByJobId.get(row.job_id) ?? 0) + Math.abs(Number(row.amount)))
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
      cardChargesByJobId,
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
          const fh = rates.fieldHours90d
          const partsRate = fh != null && fh > 0 ? (rates.officeParts90d ?? 0) / fh : null

          // Single payload that drives both the table render (sortable + filterable)
          // and the per-cell drilldown modals. `idx` is stable across sort/filter so
          // `breakdowns[idx]` lookups in the modal click router stay valid.
          const breakdownsPayload = enrichTeamSummaryRowsForInline(rows, partsRate, (name) => {
            const cfg = payConfig[name]
            if (!cfg) return 'unknown'
            return cfg.is_salary ? 'salary' : 'hourly'
          })
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
        const reviewPartsRate =
          reviewOverheadRates.fieldHours90d != null && reviewOverheadRates.fieldHours90d > 0
            ? (reviewOverheadRates.officeParts90d ?? 0) / reviewOverheadRates.fieldHours90d
            : null
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
                  if (p) void loadReviewData(p, false, reviewOnlyPaidInFull)
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
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: 'var(--text-muted)' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Gross Revenue/hr`}</span>
                                          <span>{(() => {
                                            const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToBill / j.userTotalHoursOnJob : null
                                            return v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue/hr`}</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            {(() => {
                                              const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                              return <span style={{ color: v != null && v < 0 ? 'var(--text-red-700)' : undefined }}>{v != null ? fmtMoney(v) : '—'}</span>
                                            })()}
                                            <span
                                              title="Both Revenue/hr and Profit/hr are allocated by labor cost: this user's lifetime labor cost on the job ÷ everyone's lifetime labor cost on the job. So a person paid above the blended crew average is credited with a larger share of both the job's revenue and its profit per hour, and someone paid below it gets a smaller share of both. Because both shares use the same allocation rule, the per-user Revenue/hr ÷ Profit/hr ratio for a given job is constant (= valueCreated ÷ profit, the inverse of the job's profit margin)."
                                              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: 'var(--text-muted)' }}
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
                                            return <span style={{ color: profitPerHr < 0 ? 'var(--text-red-700)' : undefined }}>{fmtMoney(profitPerHr)}</span>
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Gross Revenue</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Job Gross Revenue (total bill)</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
                                              : 'Job'
                                            return `${numLabel} Progress`
                                          })()}</span>
                                          <span>{j.pctComplete != null ? `${j.pctComplete}%` : '100% (assumed)'}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Value Created (revenue * progress)</span>
                                          <span>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s % of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.valueCreated > 0 && j.userTotalContributionToBill > 0 ? `${Math.round((j.userTotalContributionToBill / j.valueCreated) * 100)}%` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s share of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Value Created this day`}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Costs</span>
                                          <span style={{ color: 'var(--text-muted)' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
                                              : 'this job'
                                            return `Total Labor on ${numLabel}`
                                          })()}</span>
                                          <span>{(() => {
                                            const totalLaborDollars = j.totalLaborOnJob
                                            const laborStr = totalLaborDollars > 0 ? `$${formatCurrency(totalLaborDollars)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Rest of Teams Labor</span>
                                          <span>{(() => {
                                            const teamsLaborDollars = Math.max(0, j.totalLaborOnJob - j.userTotalLaborOnJob)
                                            const laborStr = teamsLaborDollars > 0 ? `$${formatCurrency(teamsLaborDollars)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel}`
                                          })()}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel} this day`
                                          })()}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }} title="Hourly wage only — drive cost (mileage + drive-time pay) is excluded from this rate.">{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Labor Rate`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.hours > 0 ? `$${formatCurrency(Math.max(0, j.laborCost - j.driveCost) / j.hours)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)' }} title="Average hourly wage of everyone else on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Teammates Avg Labor Rate</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const teammatesLabor = (j.totalLaborOnJob - j.totalDriveCostOnJob) - (j.userTotalLaborOnJob - j.userTotalDriveCostOnJob)
                                            return teammatesHours > 0 ? `$${formatCurrency(Math.max(0, teammatesLabor) / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)' }} title="Average hourly wage across everyone on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Job Avg Labor Rate</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency(Math.max(0, j.totalLaborOnJob - j.totalDriveCostOnJob) / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: 'var(--text-muted)' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Net Revenue</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Net Revenue (before overhead)</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue on Job`}</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue this Day`}</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? signedCurrency(j.allocatedRevenueBeforeOverhead) : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Profit</span>
                                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            A. Overhead by labor hours
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerHour
                                                const guidance = "Best when overhead scales with TIME in the field — office staff, software seats, insurance, vehicles, PMs, dispatch — costs that exist as long as the crew is on the clock, regardless of who is working or how big the deal is. Two crews of equal size on equal-length jobs absorb equal overhead. Misleading when a job is short on hours but big in revenue or labor dollars (specialist work that bills high per hour, or material/parts-heavy jobs that move a lot of money in little field time) — those jobs look more profitable than they really are because they dodge their share of office burden."
                                                if (r == null) return `Method A — Per labor hour. Rate: 90-day total overhead $ ÷ 90-day team field hours. Loading or no data yet. ${guidance}`
                                                return `Method A — Per labor hour. 90-day rate: $${r.toFixed(2)}/hr. Job overhead = job lifetime field hours × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: 'var(--text-muted)' }}
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
                                            return <span style={{ color: profit < 0 ? 'var(--text-red-700)' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            B. Overhead by revenue
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerRevenueDecimal
                                                const guidance = "Best when overhead scales with SALES — executive comp, sales & marketing, bonding capacity, %-of-revenue insurance (GL/GR), financing — back-office costs that grow as the company books bigger work. High-revenue jobs absorb proportionally more burden, which keeps the implied gross margin honest: a 25%-margin job carries 25% more overhead than a $10 smaller one. Misleading when a job is high-revenue but low-effort (parts/material passthrough, change orders, fixed-fee design fees) — it gets charged overhead it did not really consume, making genuinely good jobs look thin and making low-margin jobs look terminal."
                                                if (r == null) return `Method B — Per $ revenue. Rate: 90-day total overhead $ ÷ 90-day billed revenue $. Loading or no data yet. ${guidance}`
                                                return `Method B — Per $ revenue. 90-day rate: ${(r * 100).toFixed(1)}% (i.e. $${(r * 100).toFixed(2)} per $100 of revenue). Job overhead = Value Created × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: 'var(--text-muted)' }}
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
                                            return <span style={{ color: profit < 0 ? 'var(--text-red-700)' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            C. Overhead by direct labor cost
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerLaborDollar
                                                const guidance = "Best when overhead scales with LABOR — supervision, dispatch, PPE, payroll burden (workers comp, FICA match, benefits), training, vehicle wear, jobsite supplies — costs driven by people in the field, not hours on the clock or dollars on the invoice. This is the classic trade-contractor burden rate: higher-paid crews carry more overhead because they consume more back-office support (HR, scheduling, insurance, AR/AP touchpoints). Misleading when a job is mostly parts, materials, or sub passthrough with thin direct labor — that job dodges nearly all overhead even though it consumed PM time, dispatch, AR/AP, and warehouse handling. Distorts further when one job has a wide labor-rate spread (apprentice + senior on the same ticket)."
                                                if (r == null) return `Method C — Per direct labor $. Rate: 90-day total overhead $ ÷ 90-day direct field labor $. Loading or no data yet. ${guidance}`
                                                return `Method C — Per direct labor $. 90-day rate: ${r.toFixed(2)}× direct labor (every $1 of field labor carries $${r.toFixed(2)} of overhead). Job overhead = total job labor × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: 'var(--text-muted)' }}
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
                                            return <span style={{ color: profit < 0 ? 'var(--text-red-700)' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                        </div>
                                      </td>
                                    </tr>
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
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td colSpan={6} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem 2rem', maxWidth: 600 }}>
                                          <span style={{ color: 'var(--text-muted)' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Gross Revenue/hr`}</span>
                                          <span>{(() => {
                                            const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToBill / j.userTotalHoursOnJob : null
                                            return v != null ? `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue/hr`}</span>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            {(() => {
                                              const v = j.userTotalHoursOnJob > 0 ? j.userTotalContributionToRevenue / j.userTotalHoursOnJob : null
                                              return <span style={{ color: v != null && v < 0 ? 'var(--text-red-700)' : undefined }}>{v != null ? fmtMoney(v) : '—'}</span>
                                            })()}
                                            <span
                                              title="Both Revenue/hr and Profit/hr are allocated by labor cost: this user's lifetime labor cost on the job ÷ everyone's lifetime labor cost on the job. So a person paid above the blended crew average is credited with a larger share of both the job's revenue and its profit per hour, and someone paid below it gets a smaller share of both. Because both shares use the same allocation rule, the per-user Revenue/hr ÷ Profit/hr ratio for a given job is constant (= valueCreated ÷ profit, the inverse of the job's profit margin)."
                                              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: 'var(--text-muted)' }}
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
                                            return <span style={{ color: profitPerHr < 0 ? 'var(--text-red-700)' : undefined }}>{fmtMoney(profitPerHr)}</span>
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Gross Revenue</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Job Gross Revenue (total bill)</span>
                                          <span>{j.totalBill > 0 ? `$${formatCurrency(j.totalBill)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
                                              : 'Job'
                                            return `${numLabel} Progress`
                                          })()}</span>
                                          <span>{j.pctComplete != null ? `${j.pctComplete}%` : '100% (assumed)'}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Value Created (revenue * progress)</span>
                                          <span>{j.valueCreated > 0 ? `$${formatCurrency(j.valueCreated)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s % of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.valueCreated > 0 && j.userTotalContributionToBill > 0 ? `${Math.round((j.userTotalContributionToBill / j.valueCreated) * 100)}%` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s share of Value Created`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.userTotalContributionToBill > 0 ? `$${formatCurrency(j.userTotalContributionToBill)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Value Created this day`}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{j.allocatedTotalBill > 0 ? `$${formatCurrency(j.allocatedTotalBill)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Costs</span>
                                          <span style={{ color: 'var(--text-muted)' }}>{(() => {
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
                                              : 'this job'
                                            return `Total Labor on ${numLabel}`
                                          })()}</span>
                                          <span>{(() => {
                                            const totalLaborDollars = j.totalLaborOnJob
                                            const laborStr = totalLaborDollars > 0 ? `$${formatCurrency(totalLaborDollars)}` : null
                                            const hoursStr = j.totalJobHours > 0 ? `${j.totalJobHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Rest of Teams Labor</span>
                                          <span>{(() => {
                                            const teamsLaborDollars = Math.max(0, j.totalLaborOnJob - j.userTotalLaborOnJob)
                                            const laborStr = teamsLaborDollars > 0 ? `$${formatCurrency(teamsLaborDollars)}` : null
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const hoursStr = teammatesHours > 0 ? `${teammatesHours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel}`
                                          })()}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.userTotalLaborOnJob > 0 ? `$${formatCurrency(j.userTotalLaborOnJob)}` : null
                                            const hoursStr = j.userTotalHoursOnJob > 0 ? `${j.userTotalHoursOnJob.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{(() => {
                                            const name = showPeopleForReview[selectedReviewPersonIndex] ?? 'User'
                                            const numFields = j as { job_number?: string | null; hcp_number?: string | null; click_number?: string | null }
                                            const rawNum = (numFields.job_number ?? numFields.hcp_number ?? '').trim()
                                            const numLabel = rawNum && rawNum !== '—'
                                              ? formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixMap), rawNum, numFields.click_number ?? null)
                                              : 'this job'
                                            return `${name}'s labor on ${numLabel} this day`
                                          })()}</span>
                                          <span style={{ textDecoration: 'underline', paddingLeft: '1rem' }}>{(() => {
                                            const laborStr = j.laborCost > 0 ? `$${formatCurrency(j.laborCost)}` : null
                                            const hoursStr = j.hours > 0 ? `${j.hours.toFixed(2)}hrs` : null
                                            return [laborStr, hoursStr].filter(Boolean).join(' | ') || '—'
                                          })()}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }} title="Hourly wage only — drive cost (mileage + drive-time pay) is excluded from this rate.">{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Labor Rate`}</span>
                                          <span style={{ paddingLeft: '1rem' }}>{j.hours > 0 ? `$${formatCurrency(Math.max(0, j.laborCost - j.driveCost) / j.hours)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)' }} title="Average hourly wage of everyone else on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Teammates Avg Labor Rate</span>
                                          <span>{(() => {
                                            const teammatesHours = j.totalJobHours - j.userTotalHoursOnJob
                                            const teammatesLabor = (j.totalLaborOnJob - j.totalDriveCostOnJob) - (j.userTotalLaborOnJob - j.userTotalDriveCostOnJob)
                                            return teammatesHours > 0 ? `$${formatCurrency(Math.max(0, teammatesLabor) / teammatesHours)}` : '—'
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)' }} title="Average hourly wage across everyone on this job (lifetime). Drive cost is excluded so the rate reflects pay rate, not pay rate plus drive amortization.">Job Avg Labor Rate</span>
                                          <span>{j.totalJobHours > 0 ? `$${formatCurrency(Math.max(0, j.totalLaborOnJob - j.totalDriveCostOnJob) / j.totalJobHours)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ color: 'var(--text-muted)' }}>Parts:</span>
                                          <span>{j.partsCost > 0 ? `$${formatCurrency(j.partsCost)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Subs:</span>
                                          <span>{j.subLaborCost > 0 ? `$${formatCurrency(j.subLaborCost)}` : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Net Revenue</span>
                                          <span style={{ color: 'var(--text-muted)' }}>Net Revenue (before overhead)</span>
                                          <span style={{ color: j.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>{j.revenueBeforeOverhead !== 0 ? `$${formatCurrency(j.revenueBeforeOverhead)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue on Job`}</span>
                                          <span style={{ color: j.userTotalContributionToRevenue >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.userTotalContributionToRevenue !== 0 ? `$${formatCurrency(j.userTotalContributionToRevenue)}` : '—'}</span>
                                          <span style={{ color: 'var(--text-muted)', paddingLeft: '1rem' }}>{`${showPeopleForReview[selectedReviewPersonIndex] ?? 'User'}'s Net Revenue this Day`}</span>
                                          <span style={{ textDecoration: 'underline', color: j.allocatedRevenueBeforeOverhead >= 0 ? undefined : '#b91c1c', paddingLeft: '1rem' }}>{j.allocatedRevenueBeforeOverhead !== 0 ? signedCurrency(j.allocatedRevenueBeforeOverhead) : '—'}</span>
                                          <span style={{ gridColumn: '1 / -1', height: '0.5rem', display: 'block' }} />
                                          <span style={{ gridColumn: '1 / -1', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>Profit</span>
                                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            A. Overhead by labor hours
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerHour
                                                const guidance = "Best when overhead scales with TIME in the field — office staff, software seats, insurance, vehicles, PMs, dispatch — costs that exist as long as the crew is on the clock, regardless of who is working or how big the deal is. Two crews of equal size on equal-length jobs absorb equal overhead. Misleading when a job is short on hours but big in revenue or labor dollars (specialist work that bills high per hour, or material/parts-heavy jobs that move a lot of money in little field time) — those jobs look more profitable than they really are because they dodge their share of office burden."
                                                if (r == null) return `Method A — Per labor hour. Rate: 90-day total overhead $ ÷ 90-day team field hours. Loading or no data yet. ${guidance}`
                                                return `Method A — Per labor hour. 90-day rate: $${r.toFixed(2)}/hr. Job overhead = job lifetime field hours × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: 'var(--text-muted)' }}
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
                                            return <span style={{ color: profit < 0 ? 'var(--text-red-700)' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            B. Overhead by revenue
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerRevenueDecimal
                                                const guidance = "Best when overhead scales with SALES — executive comp, sales & marketing, bonding capacity, %-of-revenue insurance (GL/GR), financing — back-office costs that grow as the company books bigger work. High-revenue jobs absorb proportionally more burden, which keeps the implied gross margin honest: a 25%-margin job carries 25% more overhead than a $10 smaller one. Misleading when a job is high-revenue but low-effort (parts/material passthrough, change orders, fixed-fee design fees) — it gets charged overhead it did not really consume, making genuinely good jobs look thin and making low-margin jobs look terminal."
                                                if (r == null) return `Method B — Per $ revenue. Rate: 90-day total overhead $ ÷ 90-day billed revenue $. Loading or no data yet. ${guidance}`
                                                return `Method B — Per $ revenue. 90-day rate: ${(r * 100).toFixed(1)}% (i.e. $${(r * 100).toFixed(2)} per $100 of revenue). Job overhead = Value Created × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: 'var(--text-muted)' }}
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
                                            return <span style={{ color: profit < 0 ? 'var(--text-red-700)' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                            C. Overhead by direct labor cost
                                            <span
                                              title={(() => {
                                                const r = reviewOverheadRates.ratePerLaborDollar
                                                const guidance = "Best when overhead scales with LABOR — supervision, dispatch, PPE, payroll burden (workers comp, FICA match, benefits), training, vehicle wear, jobsite supplies — costs driven by people in the field, not hours on the clock or dollars on the invoice. This is the classic trade-contractor burden rate: higher-paid crews carry more overhead because they consume more back-office support (HR, scheduling, insurance, AR/AP touchpoints). Misleading when a job is mostly parts, materials, or sub passthrough with thin direct labor — that job dodges nearly all overhead even though it consumed PM time, dispatch, AR/AP, and warehouse handling. Distorts further when one job has a wide labor-rate spread (apprentice + senior on the same ticket)."
                                                if (r == null) return `Method C — Per direct labor $. Rate: 90-day total overhead $ ÷ 90-day direct field labor $. Loading or no data yet. ${guidance}`
                                                return `Method C — Per direct labor $. 90-day rate: ${r.toFixed(2)}× direct labor (every $1 of field labor carries $${r.toFixed(2)} of overhead). Job overhead = total job labor × rate. ${guidance}`
                                              })()}
                                              style={{ cursor: 'help', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 14, height: 14 }}><path fill="currentColor" d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z"/></svg>
                                            </span>
                                          </span>
                                          <span
                                            style={{ color: 'var(--text-muted)' }}
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
                                            return <span style={{ color: profit < 0 ? 'var(--text-red-700)' : undefined }}>{`$${formatCurrency(profit)}`}</span>
                                          })()}</span>
                                        </div>
                                      </td>
                                    </tr>
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
                                  const totalHrs = [...reviewLaborJobs, ...reviewCrewJobs].reduce((s, j) => s + j.hours, 0)
                                  if (totalHrs <= 0) return '—'
                                  const revHr = totalRev / totalHrs
                                  const profitHr = totalProfit / totalHrs
                                  return (
                                    <>
                                      <div><strong>{fmtMoney(revHr)}</strong>/hr revenue</div>
                                      <div style={{ color: profitHr < 0 ? 'var(--text-red-700)' : undefined }}><strong>{fmtMoney(profitHr)}</strong>/hr profit</div>
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
                  style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 480, maxWidth: '92vw', maxHeight: '85vh', overflow: 'auto' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{isProfit ? 'Profit shares by person' : 'Labor contributors'}</h3>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', marginTop: '0.25rem' }}>{headerLabel}</div>
                      {ctx.jobAddress ? (
                        <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{stripAddressZipState(ctx.jobAddress) || ctx.jobAddress}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewLaborBreakdownContext(null)}
                      style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: 'var(--text-muted)' }}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {isProfit ? (
                      <>
                        Total profit on this job (revenue before overhead): <strong style={{ color: profitNegative ? 'var(--text-red-700)' : 'var(--text-strong)' }}>${Math.round(ctx.revenueBeforeOverhead).toLocaleString('en-US')}</strong>
                        <div style={{ fontSize: '0.95em', color: 'var(--text-faint)', marginTop: '0.15rem' }}>
                          Allocated by each person's share of total labor (${Math.round(denom).toLocaleString('en-US')}{sumHours > 0 ? ` · ${sumHours.toFixed(2)} hrs` : ''}).
                        </div>
                      </>
                    ) : (
                      <>Total labor on this job (everyone, all time): <strong style={{ color: 'var(--text-strong)' }}>${Math.round(denom).toLocaleString('en-US')}</strong>{sumHours > 0 ? ` · ${sumHours.toFixed(2)} hrs` : ''}</>
                    )}
                  </div>
                  {rows.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No labor recorded for this job.</p>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: 'var(--bg-subtle)' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Person</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Hours</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Labor</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Share</th>
                            {isProfit && (
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Profit slice</th>
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
                                style={{ borderBottom: '1px solid var(--border)', background: isYou ? 'var(--bg-amber-100)' : undefined }}
                              >
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  <div style={{ fontWeight: isYou ? 600 : 400 }}>
                                    {r.personName}
                                    {isYou ? <span style={{ marginLeft: '0.4rem', fontSize: '0.75em', color: 'var(--text-amber-800)', fontWeight: 600 }}>(you)</span> : null}
                                  </div>
                                  {sourceLabel ? <div style={{ fontSize: '0.75em', color: 'var(--text-faint)' }}>{sourceLabel}</div> : null}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.hours > 0 ? r.hours.toFixed(2) : '—'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.laborCost > 0 ? `$${formatCurrency(r.laborCost)}` : '—'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{denom > 0 && r.laborCost > 0 ? `${pct}%` : '—'}</td>
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
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', fontWeight: 600 }}>Total</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', fontWeight: 600 }}>{sumHours > 0 ? sumHours.toFixed(2) : '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', fontWeight: 600 }}>{sumOfRows > 0 ? `$${formatCurrency(sumOfRows)}` : '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                              {denom > 0 ? `${Math.round((sumOfRows / denom) * 100)}%` : '—'}
                            </td>
                            {isProfit && (
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', fontWeight: 600, color: ctx.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>
                                {Math.abs(ctx.revenueBeforeOverhead) >= 0.5 ? `$${formatCurrency(denom > 0 ? (sumOfRows / denom) * ctx.revenueBeforeOverhead : 0)}` : '—'}
                              </td>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {Math.abs(sumOfRows - ctx.totalLaborOnJob) > 1 && ctx.totalLaborOnJob > 0 && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.75em', color: 'var(--text-faint)' }}>
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
