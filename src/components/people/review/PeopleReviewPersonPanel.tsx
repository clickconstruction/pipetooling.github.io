import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../../lib/format'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { denverCalendarDayKey } from '../../../utils/dateUtils'
import { useLedgerPrefixMap } from '../../../contexts/LedgerDisplayPrefixContext'
import { effectiveJobLedgerNumber, formatJobLedgerNumberLabel, resolveJobLedgerPrefix } from '../../../lib/ledgerDisplayPrefixes'
import { useAuth } from '../../../hooks/useAuth'
import { displayReportTemplateName } from '../../../lib/reportTemplateDisplayName'
import { ChecklistTitleWithLinks } from '../../ChecklistTitleWithLinks'
import type { PayConfigRow } from '../../../types/peoplePayConfig'
// Canonical time formatter (rounds total seconds) — the local copy floored
// minutes then rounded the remainder, rendering ':60' seconds on ~40% of
// whole-minute values (e.g. 1:20 stored showed as 1:19:60).
import { decimalToHms } from '../../../lib/people/hoursGridTime'
import { computeReviewDateRange, type ReviewPeriod as ReviewPeriodKind } from '../../../lib/people/reviewDateRange'
import type { ReviewOverheadRates } from '../../../lib/people/loadReviewOverheadRates'
import { ReviewJobExpandedDetail } from './ReviewJobExpandedDetail'
import { ReviewLaborBreakdownModal, type ReviewLaborBreakdownContext } from './ReviewLaborBreakdownModal'
import { signedCurrency, stripAddressZipState } from './reviewFormat'
import { loadReviewPersonData } from '../../../lib/people/loadReviewPersonData'
import type { ReviewCrewJob, ReviewLaborContributor, ReviewLaborJob, ReviewReport, ReviewTask } from '../../../lib/people/reviewPersonTypes'
import type { Person, UserRow } from '../../../hooks/usePeopleRoster'
import { fmtH, fmtMoney } from '../teamSummary/formatters'
import type { TeamSummaryBreakdown } from '../teamSummary/types'
import type { PeopleReviewView } from '../../../lib/people/reviewViewStorage'
import { buildReviewJobsRollup, type ReviewRollupRowInput } from '../../../lib/people/reviewJobsRollup'
import { buildReviewTasksRollup } from '../../../lib/people/reviewTasksRollup'

/**
 * People → Review: the per-person panel under the Team Summary (punch list #46 row 8, the Review
 * map's step 8, Stage B; v2.4914). The headline card, Jobs Worked, Hours and Pay, Reports, Tasks and
 * the Labor contributors window, with the panel's own state and its loader, moved verbatim from
 * PeopleReviewTab. The tab keeps the selection: it passes the selected name and whether anyone is
 * selected, and it still clamps a selection the roster shrank past.
 *
 * The panel stays mounted while the roster has anyone in it, so Jobs Worked's and Hours and Pay's
 * collapse, the open job groups and the expanded row survive a switch to another person and back,
 * as they did when the tab held them. It loads when the selection, the period, the paid-only switch,
 * the roster or the users change, the same keys as the tab's effect.
 */
export function PeopleReviewPersonPanel({
  selectedPersonName,
  hasSelection,
  roster,
  payConfig,
  people,
  users,
  period: reviewPeriod,
  customRangeStart: reviewCustomRangeStart,
  customRangeEnd: reviewCustomRangeEnd,
  onlyPaidInFull: reviewOnlyPaidInFull,
  reviewView,
  overheadRates: reviewOverheadRates,
  teamSummaryBreakdowns,
  getDaysInRange,
}: {
  /** The selected person's name; undefined with nobody selected (or a selection the roster shrank past, until the tab clears it). */
  selectedPersonName: string | undefined
  /** Someone is selected (the tab's index is not −1). */
  hasSelection: boolean
  /** The Review roster: a new one reloads the panel, as the tab's effect did. */
  roster: readonly string[]
  payConfig: Record<string, PayConfigRow>
  people: Person[]
  users: UserRow[]
  period: ReviewPeriodKind
  customRangeStart: string
  customRangeEnd: string
  onlyPaidInFull: boolean
  reviewView: PeopleReviewView
  overheadRates: ReviewOverheadRates
  /** The Team Summary's enriched rows: the headline card and the Jobs Worked footer mirror the selected person's. */
  teamSummaryBreakdowns: TeamSummaryBreakdown[]
  getDaysInRange: (start: string, end: string) => string[]
}) {
  const { role: authRole } = useAuth()
  const prefixMap = useLedgerPrefixMap()

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
  const [reviewLaborBreakdownContext, setReviewLaborBreakdownContext] = useState<ReviewLaborBreakdownContext | null>(null)
  const [reviewHoursPayCollapsed, setReviewHoursPayCollapsed] = useState(false)

  function getReviewDateRange(): [string, string] {
    // The tab's own range, from the same three inputs and the company calendar day (v2.2688).
    return computeReviewDateRange(
      reviewPeriod,
      { start: reviewCustomRangeStart, end: reviewCustomRangeEnd },
      denverCalendarDayKey(Date.now()),
    )
  }

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
    if (!selectedPersonName) return
    void loadReviewData(selectedPersonName, reviewOnlyPaidInFull)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersonName, reviewPeriod, reviewCustomRangeStart, reviewCustomRangeEnd, reviewOnlyPaidInFull, roster, users])

  return (
    <>
      {!hasSelection ? (
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
              const p = selectedPersonName
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
            const personName = selectedPersonName
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
                                    const personName = selectedPersonName ?? ''
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
                                    const personName = selectedPersonName ?? ''
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
                                <ReviewJobExpandedDetail job={j} personName={selectedPersonName} prefixMap={prefixMap} overheadRates={reviewOverheadRates} />
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
                                    const personName = selectedPersonName ?? ''
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
                                    const personName = selectedPersonName ?? ''
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
                                <ReviewJobExpandedDetail job={j} personName={selectedPersonName} prefixMap={prefixMap} overheadRates={reviewOverheadRates} />
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
                              const footerPerson = selectedPersonName
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
              const personName = selectedPersonName
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
    </>
  )
}
