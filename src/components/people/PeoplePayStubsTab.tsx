import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { formatCurrency } from '../../lib/format'
import { useToastContext } from '../../contexts/ToastContext'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import type { UserRow } from '../../hooks/usePeopleRoster'
import {
  isPayStubFullyPaid,
  lastPayStubPaymentPaidAt,
  localYmdFromDate,
  payStubPaymentDelay,
  remainingPayStubBalance,
  sumPayStubPaymentAmounts,
  type PayStubPaymentRow,
} from '../../lib/payStubPayments'
import {
  stubNetPay,
  sumPayStubAdditionalAmounts,
  sumPayStubDeductionAmounts,
  type PayStubAdditionalLineRow,
  type PayStubDeductionRow,
} from '../../lib/payStubDeductions'
import {
  buildDayRateSplitsForPeriod,
  shouldUseDualRate,
  type DayRateSplit,
  type RateSplitSessionRow,
} from '../../lib/officeJobRateSplit'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../../lib/overheadOfficeJobSettings'
import { isoWeekNumberFromGregorianYmd, ymdAddDays } from '../../utils/dateUtils'
import {
  buildUpcomingPayrollSummary,
  upcomingPayrollFetchStartYmd,
  type UpcomingClockSessionRow,
} from '../../lib/upcomingPayrollSummary'
import { PayStubAdditionalModal } from '../pay/PayStubAdditionalModal'
import { PayStubLessModal } from '../pay/PayStubLessModal'
import { PayStubDeleteIcon } from '../pay/PayStubDeleteIcon'
import { PayStubPaidNoteIcon } from '../pay/PayStubPaidNoteIcon'

/** Compact "7/2" (local month/day, no year) for the ledger's Created / Last Paid cells; full date stays in the title tooltip. */
function shortMonthDay(timestamp: string): string {
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * Pay-stub row shape. Defined here (and imported by the parent `People.tsx`)
 * so the ledger tab and the still-parent-owned pay-stub data layer share one
 * type. Mirrors the `pay_stubs` table columns selected by `loadPayStubs`.
 */
export type PayStubRow = {
  id: string
  person_name: string
  period_start: string
  period_end: string
  hours_total: number
  gross_pay: number
  created_at: string | null
  paid_at: string | null
  paid_by: string | null
  paid_note: string | null
}

/** Pay History overlays: base layer; nested dialogs must be higher. */
const Z_PEOPLE_PAY_MODAL = 1100

/**
 * Pay History Ledger period label: M/D range without year, end month elided when it matches the
 * start (e.g. `6/21–27`, cross-month `6/28–7/4`), plus the ISO week number — anchored at
 * periodStart+4 (midweek) like the Draft Payroll print header — e.g. `6/21–27 (w26)`.
 */
function ledgerPayPeriodShortLabel(periodStartYmd: string, periodEndYmd: string): string {
  const start = new Date(periodStartYmd + 'T12:00:00')
  const end = new Date(periodEndYmd + 'T12:00:00')
  const startLabel = `${start.getMonth() + 1}/${start.getDate()}`
  const endLabel = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    ? `${end.getDate()}`
    : `${end.getMonth() + 1}/${end.getDate()}`
  const weekNum = isoWeekNumberFromGregorianYmd(ymdAddDays(periodStartYmd, 4))
  return `${startLabel}–${endLabel}${weekNum === null ? '' : ` (w${weekNum})`}`
}

export type PeoplePayStubsTabProps = {
  payStubs: PayStubRow[]
  payStubPaymentsByStubId: Record<string, PayStubPaymentRow[]>
  payStubDeductionsByStubId: Record<string, PayStubDeductionRow[]>
  payStubAdditionalByStubId: Record<string, PayStubAdditionalLineRow[]>
  payConfig: Record<string, PayConfigRow>
  users: UserRow[]
  authUser: User | null
  isDev: boolean
  error: string | null
  onError: (msg: string | null) => void
  /** Reload the shared pay-stub data layer (owned by the parent). */
  loadPayStubs: () => Promise<unknown>
  /** Load pay config (parent-owned); called on mount alongside loadPayStubs. */
  loadPayConfig: () => Promise<void>
  /** Open the parent-owned print/preview window for a stub. */
  onPrintStub: (stub: PayStubRow) => void
  /** Ledger Actions → View: open the stub in the in-app viewer modal (with its own Print). */
  onViewStub: (stub: PayStubRow) => void
  /** Open the parent-owned Record-payment (mark-paid) modal. */
  onRecordPayment: (stub: PayStubRow) => void
  markingPayStubId: string | null
  /** Open the parent-owned delete-confirm modal. */
  onRequestDeleteStub: (stub: PayStubRow) => void
  deletingPayStubId: string | null
  /** Open the shared My-Time day editor (parent-owned, shared with Hours). */
  onOpenMyTimeForDay: (args: { dateStr: string; subjectUserId: string; subjectDisplayName: string }) => void
  /** Open the parent-owned Payroll Forecast modal. */
  onOpenForecast: () => void
  forecastDisabled: boolean
  /** Open the parent-owned Draft Payroll modal (seeds the prior-week period). */
  onOpenDraftPayroll: () => void
  draftPayrollDisabled: boolean
}

export default function PeoplePayStubsTab({
  payStubs,
  payStubPaymentsByStubId,
  payStubDeductionsByStubId,
  payStubAdditionalByStubId,
  payConfig,
  users,
  authUser,
  isDev,
  error,
  onError,
  loadPayStubs,
  loadPayConfig,
  onPrintStub,
  onViewStub,
  onRecordPayment,
  markingPayStubId,
  onRequestDeleteStub,
  deletingPayStubId,
  onOpenMyTimeForDay,
  onOpenForecast,
  forecastDisabled,
  onOpenDraftPayroll,
  draftPayrollDisabled,
}: PeoplePayStubsTabProps) {
  const { showToast } = useToastContext()

  const [payStubsLoading, setPayStubsLoading] = useState(false)
  const [payStubLessModalStub, setPayStubLessModalStub] = useState<PayStubRow | null>(null)
  const [payStubAdditionalModalStub, setPayStubAdditionalModalStub] = useState<PayStubRow | null>(null)
  const [payStubNoteDetail, setPayStubNoteDetail] = useState<PayStubRow | null>(null)
  const [deletingPayStubPaymentId, setDeletingPayStubPaymentId] = useState<string | null>(null)
  const [ledgerPersonSearch, setLedgerPersonSearch] = useState('')
  const [payStubCalendarPerson, setPayStubCalendarPerson] = useState<string | null>(null)
  const [payStubCalendarYear, setPayStubCalendarYear] = useState(() => new Date().getFullYear())
  const [payStubCalendarData, setPayStubCalendarData] = useState<{ earnedByDate: Record<string, number>; paidByDate: Record<string, number> } | null>(null)
  const [payStubCalendarLoading, setPayStubCalendarLoading] = useState(false)

  const payStubAdditionalSubjectUserId = useMemo(() => {
    if (!payStubAdditionalModalStub) return null
    const n = payStubAdditionalModalStub.person_name.trim()
    const u = users.find((x) => (x.name ?? '').trim() === n)
    return u?.id ?? null
  }, [payStubAdditionalModalStub, users])
  const payStubAdditionalBaseHourlyWage = useMemo(() => {
    if (!payStubAdditionalModalStub) return 0
    return Number(payConfig[payStubAdditionalModalStub.person_name]?.hourly_wage ?? 0)
  }, [payStubAdditionalModalStub, payConfig])

  const ledgerFilteredPayStubs = useMemo(() => {
    const q = ledgerPersonSearch.trim().toLowerCase()
    if (!q) return payStubs
    return payStubs.filter((s) => s.person_name.toLowerCase().includes(q))
  }, [payStubs, ledgerPersonSearch])

  // Local calendar day for the Payment Delay column's days-outstanding math.
  const todayYmd = localYmdFromDate(new Date())

  // "Upcoming payroll": clock sessions (approved + pending; rejected/revoked excluded) since the
  // earliest week any person could still owe a pay report for. null = not loaded yet.
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingClockSessionRow[] | null>(null)
  const [upcomingModalOpen, setUpcomingModalOpen] = useState(false)

  // Roster mapping + per-person stub inputs for the upcoming summary (payroll is person_name-keyed,
  // clock_sessions is user_id-keyed — same trimmed-name match used elsewhere).
  const upcomingInputs = useMemo(() => {
    const userIdByPersonName: Record<string, string> = {}
    for (const u of users) {
      const n = (u.name ?? '').trim()
      if (n && !userIdByPersonName[n]) userIdByPersonName[n] = u.id
    }
    const personNames = Object.keys(payConfig).filter((n) => userIdByPersonName[n])
    const hourlyWageByPersonName: Record<string, number> = {}
    for (const n of personNames) hourlyWageByPersonName[n] = Number(payConfig[n]?.hourly_wage ?? 0)
    const stubsByPerson: Record<string, Array<{ period_start: string; period_end: string }>> = {}
    const lastStubEndByPerson: Record<string, string> = {}
    for (const s of payStubs) {
      const n = s.person_name.trim()
      ;(stubsByPerson[n] ??= []).push({ period_start: s.period_start, period_end: s.period_end })
      const prev = lastStubEndByPerson[n]
      if (!prev || s.period_end > prev) lastStubEndByPerson[n] = s.period_end
    }
    return { userIdByPersonName, personNames, hourlyWageByPersonName, stubsByPerson, lastStubEndByPerson }
  }, [users, payConfig, payStubs])

  useEffect(() => {
    const { personNames, userIdByPersonName, lastStubEndByPerson } = upcomingInputs
    if (personNames.length === 0) {
      setUpcomingSessions([])
      return
    }
    const fetchStart = upcomingPayrollFetchStartYmd({
      personNames,
      lastStubEndByPerson,
      todayYmd,
    })
    const rosterIds = personNames.map((n) => userIdByPersonName[n]).filter((id): id is string => Boolean(id))
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            await supabase
              .from('clock_sessions')
              .select('user_id, work_date, clocked_in_at, clocked_out_at')
              .in('user_id', rosterIds)
              .gte('work_date', fetchStart)
              .is('rejected_at', null)
              .is('revoked_at', null),
          'load upcoming payroll clock sessions',
        )
        if (!cancelled) setUpcomingSessions((data ?? []) as UpcomingClockSessionRow[])
      } catch {
        // Header stays on the open-balance segment only; the table itself is unaffected.
        if (!cancelled) setUpcomingSessions([])
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- todayYmd is a render-derived day string
  }, [upcomingInputs])

  const upcomingSummary = useMemo(() => {
    if (!upcomingSessions) return null
    const q = ledgerPersonSearch.trim().toLowerCase()
    const personNames = q
      ? upcomingInputs.personNames.filter((n) => n.toLowerCase().includes(q))
      : upcomingInputs.personNames
    return buildUpcomingPayrollSummary({
      personNames,
      userIdByPersonName: upcomingInputs.userIdByPersonName,
      hourlyWageByPersonName: upcomingInputs.hourlyWageByPersonName,
      stubsByPerson: upcomingInputs.stubsByPerson,
      sessions: upcomingSessions,
      todayYmd,
      nowMs: Date.now(),
    })
  }, [upcomingSessions, upcomingInputs, ledgerPersonSearch, todayYmd])

  const ledgerOpenBalanceSummary = useMemo(() => {
    let openCount = 0
    let totalRemaining = 0
    for (const stub of ledgerFilteredPayStubs) {
      const payRows = payStubPaymentsByStubId[stub.id] ?? []
      const paidSum = sumPayStubPaymentAmounts(payRows)
      const lessSum = sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? [])
      const addSumLedger = sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? [])
      const netPayLedger = stubNetPay(stub.gross_pay, lessSum, addSumLedger)
      const rem = remainingPayStubBalance(netPayLedger, paidSum)
      const fully = isPayStubFullyPaid(netPayLedger, paidSum)
      if (!fully) openCount += 1
      totalRemaining += rem
    }
    return {
      openCount,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
    }
  }, [
    ledgerFilteredPayStubs,
    payStubPaymentsByStubId,
    payStubDeductionsByStubId,
    payStubAdditionalByStubId,
  ])

  // On mount (the tab only renders when active + canAccessPay), prime the
  // pay-config + pay-stub data layers. Verbatim from the parent's
  // `activeTab === 'pay_stubs'` load effect, with the tab guard dropped.
  useEffect(() => {
    const t = setTimeout(() => {
      setPayStubsLoading(true)
      Promise.all([loadPayConfig(), loadPayStubs()]).finally(() => setPayStubsLoading(false))
    }, 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (payStubCalendarPerson) {
      loadPayStubCalendarData(payStubCalendarPerson, payStubCalendarYear)
    } else {
      setPayStubCalendarData(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payStubCalendarPerson, payStubCalendarYear])

  function openPayStubNoteDetail(stub: PayStubRow) {
    setPayStubNoteDetail(stub)
  }

  function closePayStubNoteDetail() {
    setPayStubNoteDetail(null)
  }

  async function deletePayStubPayment(paymentId: string) {
    setDeletingPayStubPaymentId(paymentId)
    onError(null)
    try {
      await withSupabaseRetry(
        async () => await supabase.from('pay_stub_payments').delete().eq('id', paymentId),
        'delete pay stub payment',
      )
      await loadPayStubs()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete payment')
    }
    setDeletingPayStubPaymentId(null)
  }

  async function loadPayStubCalendarData(personName: string, year: number) {
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    setPayStubCalendarLoading(true)
    setPayStubCalendarData(null)
    const [hoursRes, paidRes] = await Promise.all([
      supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
      supabase.from('pay_stub_days').select('work_date, paid_amount').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
    ])
    if (hoursRes.error || paidRes.error) {
      setPayStubCalendarLoading(false)
      onError(hoursRes.error?.message ?? paidRes.error?.message ?? 'Failed to load calendar data')
      return
    }
    const cfg = payConfig[personName]
    const wage = cfg?.hourly_wage ?? 0
    const isSalary = cfg?.is_salary ?? false
    const officeWage = cfg?.office_hourly_wage ?? null
    const hoursMap = new Map<string, number>()
    for (const r of (hoursRes.data ?? []) as { work_date: string; hours: number }[]) {
      hoursMap.set(r.work_date, r.hours)
    }
    const paidMap = new Map<string, number>()
    for (const r of (paidRes.data ?? []) as { work_date: string; paid_amount: number }[]) {
      paidMap.set(r.work_date, (paidMap.get(r.work_date) ?? 0) + r.paid_amount)
    }
    // Ordered day keys across the year (en-CA = YYYY-MM-DD, matching work_date).
    const dayKeys: string[] = []
    {
      const d0 = new Date(start + 'T12:00:00')
      const endD0 = new Date(end + 'T12:00:00')
      while (d0 <= endD0) {
        dayKeys.push(d0.toLocaleDateString('en-CA'))
        d0.setDate(d0.getDate() + 1)
      }
    }
    // Dual rate (opt-in, hourly only): split each day's hours by office/field from approved
    // clock sessions so the preview's "earned" matches the generated stub's gross.
    let splitByDate: Map<string, DayRateSplit> | null = null
    if (shouldUseDualRate(cfg) && officeWage != null) {
      const matches = users.filter((u) => (u.name ?? '').trim() === personName.trim())
      const uid = matches.length === 1 ? matches[0]!.id : null
      if (uid) {
        const officeJobId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
        const sessRes = await supabase
          .from('clock_sessions')
          .select('work_date, job_ledger_id, bid_id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at')
          .eq('user_id', uid)
          .gte('work_date', start)
          .lte('work_date', end)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .not('approved_at', 'is', null)
        const sessions = (sessRes.data ?? []) as RateSplitSessionRow[]
        splitByDate = buildDayRateSplitsForPeriod({
          daysInRange: dayKeys,
          hoursByDate: hoursMap,
          sessions,
          officeJobLedgerId: officeJobId,
          officeWage,
          jobWage: wage,
        })
      }
    }
    setPayStubCalendarLoading(false)
    const earnedByDate: Record<string, number> = {}
    const paidByDate: Record<string, number> = {}
    for (const key of dayKeys) {
      if (isSalary) {
        const dow = new Date(key + 'T12:00:00').getDay()
        earnedByDate[key] = (dow >= 1 && dow <= 5 ? 8 : 0) * wage
      } else if (splitByDate) {
        earnedByDate[key] = splitByDate.get(key)?.paidAmount ?? 0
      } else {
        earnedByDate[key] = (hoursMap.get(key) ?? 0) * wage
      }
      paidByDate[key] = paidMap.get(key) ?? 0
    }
    setPayStubCalendarData({ earnedByDate, paidByDate })
  }

  return (
    <>
      <div>
        {payStubsLoading ? (
          <p style={{ color: '#6b7280' }}>Loading…</p>
        ) : (
          <>
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            <section>
              <div style={{ marginBottom: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Ledger</h2>
                    {payStubs.length > 0 && ledgerFilteredPayStubs.length > 0 ? (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }} aria-live="polite">
                        {ledgerOpenBalanceSummary.openCount > 0
                          ? `${ledgerOpenBalanceSummary.openCount} open · $${formatCurrency(ledgerOpenBalanceSummary.totalRemaining)} remaining`
                          : 'All paid'}
                        {upcomingSummary && upcomingSummary.personWeekCount > 0 ? (
                          <>
                            <span style={{ color: '#9ca3af' }}>{' | '}</span>
                            <button
                              type="button"
                              onClick={() => setUpcomingModalOpen(true)}
                              title="Weeks with clocked time (including pending approval) but no pay report yet — estimated hours × wage. Click for the full list."
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                margin: 0,
                                font: 'inherit',
                                color: '#b45309',
                                textDecoration: 'underline dotted',
                                textUnderlineOffset: '2px',
                                cursor: 'pointer',
                              }}
                            >
                              {upcomingSummary.personWeekCount} upcoming: ${formatCurrency(upcomingSummary.estimatedGrossDollars)}
                            </button>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  {/* Right-side action cluster: Forecast (planning tool)
                      sits immediately left of Draft Payroll so the two
                      flows are visually paired. Forecast is dev/admin
                      territory — it doesn't write anything, just lets
                      you plan how to allocate incoming cash across
                      unpaid balances when the well is running dry. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={onOpenForecast}
                      disabled={forecastDisabled}
                      title={
                        forecastDisabled
                          ? 'Nothing to forecast — all pay stubs are fully paid.'
                          : 'Plan how upcoming cash bars will be split across unpaid balances'
                      }
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.9375rem',
                        background: 'white',
                        color: forecastDisabled ? '#9ca3af' : '#374151',
                        border: `1px solid ${forecastDisabled ? '#e5e7eb' : '#d1d5db'}`,
                        borderRadius: 6,
                        cursor: forecastDisabled ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Forecast
                    </button>
                    <button
                      type="button"
                      onClick={onOpenDraftPayroll}
                      disabled={draftPayrollDisabled}
                      title={
                        draftPayrollDisabled
                          ? 'In Hours, open People pay config and check Show in Hours for people to track'
                          : undefined
                      }
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.9375rem',
                        background: draftPayrollDisabled ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: draftPayrollDisabled ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Draft Payroll
                    </button>
                  </div>
                </div>
                <input
                  id="ledger-person-search"
                  type="search"
                  value={ledgerPersonSearch}
                  onChange={(e) => setLedgerPersonSearch(e.target.value)}
                  placeholder="Name…"
                  autoComplete="off"
                  aria-label="Search ledger by person name"
                  aria-describedby="ledger-person-search-hint"
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.35rem 0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                  }}
                />
                <p id="ledger-person-search-hint" style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Search filters the ledger by person name.
                </p>
              </div>
              {payStubs.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
                  No pay reports yet. Use Draft Payroll.
                </p>
              ) : ledgerFilteredPayStubs.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No pay reports match this search.</p>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Person</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Period</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Hours</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Gross Pay</th>
                        <th
                          style={{ padding: '0.5rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}
                          title="Less (deductions and applied offsets) | Additional pay (quantity × rate). Click an amount to edit."
                        >
                          Less | Additional
                        </th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Net Pay</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Paid to date</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Balance</th>
                        {/* width 1% + nowrap = shrink-to-fit; leftover table width flows to the text columns instead */}
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', width: '1%', whiteSpace: 'nowrap' }}>Payment</th>
                        <th
                          style={{ padding: '0.5rem 0.4rem', textAlign: 'left', whiteSpace: 'nowrap' }}
                          title="Created date - date of the most recent payment - days between period end and the last payment (amber = no payment yet; days outstanding so far)."
                        >
                          Created | Paid | Delay
                        </th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerFilteredPayStubs.map((stub) => {
                        const payRows = payStubPaymentsByStubId[stub.id] ?? []
                        const paidSum = sumPayStubPaymentAmounts(payRows)
                        const lessSum = sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? [])
                        const addSumLedger = sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? [])
                        const netPayLedger = stubNetPay(stub.gross_pay, lessSum, addSumLedger)
                        const rem = remainingPayStubBalance(netPayLedger, paidSum)
                        const fully = isPayStubFullyPaid(netPayLedger, paidSum)
                        const partial = paidSum > 0 && !fully
                        const paymentLabel = fully ? 'Paid' : partial ? 'Partial' : 'Unpaid'
                        const paymentColor = fully ? '#059669' : partial ? '#ca8a04' : '#6b7280'
                        // Legacy stubs marked paid before per-payment rows existed only have stub.paid_at.
                        const lastPaidAt = lastPayStubPaymentPaidAt(payRows) ?? stub.paid_at
                        const paymentDelay = payStubPaymentDelay(stub.period_end, lastPaidAt, todayYmd)
                        const showPayDetail =
                          payRows.length > 0 || Boolean(stub.paid_note?.trim()) || Boolean(stub.paid_at)
                        return (
                        <tr key={stub.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => setPayStubCalendarPerson(stub.person_name)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                color: '#2563eb',
                                textDecoration: 'underline',
                                fontSize: 'inherit',
                                fontFamily: 'inherit',
                              }}
                            >
                              {stub.person_name}
                            </button>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{stub.hours_total.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(stub.gross_pay)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {fully ? (
                              <span
                                title="Fully paid — change payments first to edit Less"
                                aria-label={`Less for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}: $${formatCurrency(lessSum)}, not editable, fully paid`}
                              >
                                -{formatCurrency(lessSum)}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPayStubLessModalStub(stub)}
                                title="Edit Less (deductions)"
                                aria-label={`Less for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}: $${formatCurrency(lessSum)}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  textDecoration: 'underline',
                                  fontSize: 'inherit',
                                  fontFamily: 'inherit',
                                }}
                              >
                                -{formatCurrency(lessSum)}
                              </button>
                            )}
                            <span style={{ color: '#9ca3af' }}>{' | '}</span>
                            {fully ? (
                              <span
                                title="Fully paid — change payments first to edit Additional"
                                aria-label={`Additional for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}: $${formatCurrency(addSumLedger)}, not editable, fully paid`}
                              >
                                {formatCurrency(addSumLedger)}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPayStubAdditionalModalStub(stub)}
                                title="Edit Additional pay lines"
                                aria-label={`Additional for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}: $${formatCurrency(addSumLedger)}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  textDecoration: 'underline',
                                  fontSize: 'inherit',
                                  fontFamily: 'inherit',
                                }}
                              >
                                {formatCurrency(addSumLedger)}
                              </button>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(netPayLedger)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(paidSum)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '0.35rem',
                                width: '100%',
                              }}
                            >
                              <span>
                                ${formatCurrency(rem)}
                              </span>
                              <button
                                type="button"
                                title="Copy balance"
                                aria-label={`Copy balance ${formatCurrency(rem)} for ${stub.person_name}, ${ledgerPayPeriodShortLabel(stub.period_start, stub.period_end)}`}
                                onClick={() => {
                                  void (async () => {
                                    const text = formatCurrency(rem)
                                    try {
                                      if (!navigator.clipboard?.writeText) {
                                        showToast('Clipboard not available.', 'warning')
                                        return
                                      }
                                      await navigator.clipboard.writeText(text)
                                      showToast('Balance copied.', 'success')
                                    } catch {
                                      showToast('Could not copy balance.', 'error')
                                    }
                                  })()
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 2,
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  borderRadius: 4,
                                  color: '#6b7280',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#2563eb'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#6b7280'
                                }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 640 640"
                                  width={16}
                                  height={16}
                                  aria-hidden
                                  style={{ display: 'block' }}
                                >
                                  <path
                                    fill="currentColor"
                                    d="M480 400L288 400C279.2 400 272 392.8 272 384L272 128C272 119.2 279.2 112 288 112L421.5 112C425.7 112 429.8 113.7 432.8 116.7L491.3 175.2C494.3 178.2 496 182.3 496 186.5L496 384C496 392.8 488.8 400 480 400zM288 448L480 448C515.3 448 544 419.3 544 384L544 186.5C544 169.5 537.3 153.2 525.3 141.2L466.7 82.7C454.7 70.7 438.5 64 421.5 64L288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L368 496L368 512C368 520.8 360.8 528 352 528L160 528C151.2 528 144 520.8 144 512L144 256C144 247.2 151.2 240 160 240L176 240L176 192L160 192z"
                                  />
                                </svg>
                              </button>
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', width: '1%', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: paymentColor }}>{paymentLabel}</span>
                              {showPayDetail ? (
                                <button
                                  type="button"
                                  onClick={() => openPayStubNoteDetail(stub)}
                                  aria-label="View payment details"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: 0,
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    verticalAlign: 'middle',
                                    color: '#2563eb',
                                  }}
                                >
                                  <PayStubPaidNoteIcon />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => onRecordPayment(stub)}
                                disabled={markingPayStubId === stub.id || fully}
                                title={fully ? 'Fully paid' : 'Record a payment'}
                                style={{ padding: '2px 6px', fontSize: '0.8125rem', background: markingPayStubId === stub.id || fully ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: markingPayStubId === stub.id || fully ? 'not-allowed' : 'pointer' }}
                              >
                                {markingPayStubId === stub.id ? '...' : 'Record payment'}
                              </button>
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.4rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {stub.created_at ? (
                              <span title={`Created ${new Date(stub.created_at).toLocaleDateString()}`}>
                                {shortMonthDay(stub.created_at)}
                              </span>
                            ) : (
                              '—'
                            )}
                            <span style={{ color: '#9ca3af' }}>{' - '}</span>
                            {lastPaidAt ? (
                              <span title={`Last paid ${new Date(lastPaidAt).toLocaleDateString()}`}>
                                {shortMonthDay(lastPaidAt)}
                              </span>
                            ) : (
                              '—'
                            )}
                            <span style={{ color: '#9ca3af' }}>{' - '}</span>
                            {paymentDelay.kind === 'paid' ? (
                              <span title="Days between period end and the last payment.">{paymentDelay.days}d</span>
                            ) : paymentDelay.kind === 'outstanding' ? (
                              <span style={{ color: '#b45309' }} title="No payment yet — days since period end.">
                                {paymentDelay.days}d…
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => onViewStub(stub)}
                              title="View the pay report in a modal"
                              style={{ padding: '2px 6px', fontSize: '0.8125rem', marginRight: '0.35rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => onPrintStub(stub)}
                              style={{ padding: '2px 6px', fontSize: '0.8125rem', marginRight: isDev ? '0.35rem' : 0, background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Print
                            </button>
                            {isDev && (
                              <button
                                type="button"
                                onClick={() => onRequestDeleteStub(stub)}
                                disabled={deletingPayStubId === stub.id}
                                title="Delete pay report"
                                aria-label="Delete pay report"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 2,
                                  marginLeft: '0.35rem',
                                  background: 'none',
                                  border: 'none',
                                  borderRadius: 4,
                                  color: deletingPayStubId === stub.id ? '#9ca3af' : '#dc2626',
                                  cursor: deletingPayStubId === stub.id ? 'not-allowed' : 'pointer',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {deletingPayStubId === stub.id ? (
                                  <span style={{ fontSize: '0.75rem', lineHeight: 1, color: '#9ca3af' }}>…</span>
                                ) : (
                                  <PayStubDeleteIcon color="currentColor" size={16} />
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {upcomingModalOpen && upcomingSummary ? (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUpcomingModalOpen(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: Z_PEOPLE_PAY_MODAL,
            padding: '1rem',
            boxSizing: 'border-box',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upcoming-payroll-modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setUpcomingModalOpen(false)
            }}
            style={{
              background: 'white',
              borderRadius: 8,
              maxWidth: 640,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 id="upcoming-payroll-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
                  Upcoming payroll — not yet reported
                </h2>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                  {upcomingSummary.personWeekCount} person-week{upcomingSummary.personWeekCount === 1 ? '' : 's'} ·{' '}
                  ${formatCurrency(upcomingSummary.estimatedGrossDollars)} estimated. Clocked time (including pending
                  approval) with no pay report covering the week — estimate is hours × wage. Use Draft Payroll to
                  generate these reports.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUpcomingModalOpen(false)}
                title="Close"
                aria-label="Close"
                style={{ padding: '0.35rem 0.65rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '1rem 1.25rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>Person</th>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Period</th>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Hours</th>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Est. Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingSummary.lines.map((l) => (
                    <tr key={`${l.personName}:${l.weekStartYmd}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.45rem 0.65rem' }}>{l.personName}</td>
                      <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>
                        {ledgerPayPeriodShortLabel(l.weekStartYmd, l.weekEndYmd)}
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {l.hours.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(l.estimatedGrossDollars)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
                    <td style={{ padding: '0.5rem 0.65rem' }} colSpan={2}>
                      Total
                    </td>
                    <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {upcomingSummary.lines.reduce((s, l) => s + l.hours, 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      ${formatCurrency(upcomingSummary.estimatedGrossDollars)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {payStubLessModalStub ? (
        <PayStubLessModal
          stub={payStubLessModalStub}
          deductions={payStubDeductionsByStubId[payStubLessModalStub.id] ?? []}
          additionalSum={sumPayStubAdditionalAmounts(payStubAdditionalByStubId[payStubLessModalStub.id] ?? [])}
          payments={payStubPaymentsByStubId[payStubLessModalStub.id] ?? []}
          authUserId={authUser?.id ?? null}
          onClose={() => setPayStubLessModalStub(null)}
          onSaved={async () => {
            await loadPayStubs()
          }}
          showToast={showToast}
        />
      ) : null}

      {payStubAdditionalModalStub ? (
        <PayStubAdditionalModal
          stub={payStubAdditionalModalStub}
          lines={payStubAdditionalByStubId[payStubAdditionalModalStub.id] ?? []}
          deductions={payStubDeductionsByStubId[payStubAdditionalModalStub.id] ?? []}
          payments={payStubPaymentsByStubId[payStubAdditionalModalStub.id] ?? []}
          authUserId={authUser?.id ?? null}
          subjectUserId={payStubAdditionalSubjectUserId}
          baseHourlyWage={payStubAdditionalBaseHourlyWage}
          onOpenMyTimeForDay={({ dateStr, subjectUserId, subjectDisplayName }) => {
            onOpenMyTimeForDay({ dateStr, subjectUserId, subjectDisplayName })
          }}
          onClose={() => setPayStubAdditionalModalStub(null)}
          onSaved={async () => {
            await loadPayStubs()
          }}
          showToast={showToast}
        />
      ) : null}

      {payStubNoteDetail ? (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePayStubNoteDetail()
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z_PEOPLE_PAY_MODAL }}
        >
          <div
            role="dialog"
            aria-labelledby="pay-stub-note-detail-title"
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 520, width: '100%', maxHeight: '85vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pay-stub-note-detail-title" style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>
              Payment details
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {payStubNoteDetail.person_name} · Pay period{' '}
              {new Date(payStubNoteDetail.period_start + 'T12:00:00').toLocaleDateString()} –{' '}
              {new Date(payStubNoteDetail.period_end + 'T12:00:00').toLocaleDateString()}
            </p>
            {(payStubPaymentsByStubId[payStubNoteDetail.id] ?? []).length > 0 ? (
              <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Installments</div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {(payStubPaymentsByStubId[payStubNoteDetail.id] ?? []).map((p) => (
                    <li key={p.id} style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 500 }}>${formatCurrency(p.amount)}</span>
                      {' · '}
                      {new Date(p.paid_at).toLocaleDateString()}
                      {p.memo?.trim() ? ` — ${p.memo.trim()}` : ''}
                      <button
                        type="button"
                        onClick={() => void deletePayStubPayment(p.id)}
                        disabled={deletingPayStubPaymentId === p.id}
                        style={{ marginLeft: '0.5rem', padding: '1px 6px', fontSize: '0.75rem', border: '1px solid #fecaca', background: 'white', color: '#dc2626', borderRadius: 4, cursor: deletingPayStubPaymentId === p.id ? 'not-allowed' : 'pointer' }}
                      >
                        {deletingPayStubPaymentId === p.id ? '…' : 'Delete'}
                      </button>
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                  Total paid: ${formatCurrency(sumPayStubPaymentAmounts(payStubPaymentsByStubId[payStubNoteDetail.id]))} · Balance: $
                  {formatCurrency(
                    remainingPayStubBalance(
                      stubNetPay(
                        payStubNoteDetail.gross_pay,
                        sumPayStubDeductionAmounts(payStubDeductionsByStubId[payStubNoteDetail.id] ?? []),
                        sumPayStubAdditionalAmounts(payStubAdditionalByStubId[payStubNoteDetail.id] ?? []),
                      ),
                      sumPayStubPaymentAmounts(payStubPaymentsByStubId[payStubNoteDetail.id]),
                    ),
                  )}
                </div>
              </div>
            ) : payStubNoteDetail.paid_note?.trim() ? (
              <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Legacy memo</div>
                {payStubNoteDetail.paid_at ? (
                  <div style={{ marginBottom: '0.35rem', color: '#6b7280' }}>
                    Marked paid {new Date(payStubNoteDetail.paid_at).toLocaleDateString()}
                  </div>
                ) : null}
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{payStubNoteDetail.paid_note.trim()}</p>
              </div>
            ) : payStubNoteDetail.paid_at ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Legacy: marked paid {new Date(payStubNoteDetail.paid_at).toLocaleDateString()} (no installment records).
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closePayStubNoteDetail}
                style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payStubCalendarPerson && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}
          onClick={() => setPayStubCalendarPerson(null)}
        >
          <div
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{payStubCalendarPerson} — Annual Pay to Date</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label>
                  <span style={{ marginRight: '0.35rem', fontSize: '0.875rem' }}>Year</span>
                  <select
                    value={payStubCalendarYear}
                    onChange={(e) => setPayStubCalendarYear(parseInt(e.target.value, 10))}
                    style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => setPayStubCalendarPerson(null)} style={{ padding: '0.35rem 0.75rem' }}>
                  Close
                </button>
              </div>
            </div>
            {payStubCalendarLoading ? (
              <p style={{ color: '#6b7280' }}>Loading…</p>
            ) : payStubCalendarData ? (
              <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#22c55e', marginRight: '0.25rem', verticalAlign: 'middle' }} /> Fully paid</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#eab308', marginRight: '0.25rem', verticalAlign: 'middle' }} /> Underpaid</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#f97316', marginRight: '0.25rem', verticalAlign: 'middle' }} /> Overpaid</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#e5e7eb', marginRight: '0.25rem', verticalAlign: 'middle' }} /> No hours</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#e5e7eb', border: '1px solid #e5e7eb', fontSize: '0.625rem' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} style={{ background: '#f9fafb', padding: '0.25rem', textAlign: 'center', fontWeight: 600 }}>
                      {d}
                    </div>
                  ))}
                  {(() => {
                    const jan1 = new Date(payStubCalendarYear, 0, 1)
                    const firstSunday = new Date(jan1)
                    firstSunday.setDate(jan1.getDate() - jan1.getDay())
                    const dec31 = new Date(payStubCalendarYear, 11, 31)
                    const lastSunday = new Date(dec31)
                    lastSunday.setDate(dec31.getDate() + (6 - dec31.getDay()))
                    const cells: Array<{ date: string; earned: number; paid: number } | null> = []
                    const d = new Date(firstSunday)
                    while (d <= lastSunday) {
                      const key = d.toLocaleDateString('en-CA')
                      const inYear = d.getFullYear() === payStubCalendarYear
                      if (inYear && payStubCalendarData) {
                        const earned = payStubCalendarData.earnedByDate[key] ?? 0
                        const paid = payStubCalendarData.paidByDate[key] ?? 0
                        cells.push({ date: key, earned, paid })
                      } else {
                        cells.push(null)
                      }
                      d.setDate(d.getDate() + 1)
                    }
                    return cells.map((cell, idx) => {
                      if (!cell) {
                        return <div key={idx} style={{ background: '#f3f4f6', minHeight: 10 }} />
                      }
                      const { date, earned, paid } = cell
                      const tol = 0.01
                      let bg = '#e5e7eb'
                      let title = `${date}: no hours`
                      if (earned > 0 || paid > 0) {
                        if (paid > earned + tol) {
                          bg = '#f97316'
                          title = `${date}: $${formatCurrency(earned)} earned, $${formatCurrency(paid)} paid (overpaid)`
                        } else if (paid < earned - tol || (paid === 0 && earned > 0)) {
                          bg = '#eab308'
                          title = `${date}: $${formatCurrency(earned)} earned, $${formatCurrency(paid)} paid (underpaid)`
                        } else {
                          bg = '#22c55e'
                          title = `${date}: $${formatCurrency(earned)} earned, $${formatCurrency(paid)} paid`
                        }
                      }
                      return (
                        <div
                          key={idx}
                          style={{ background: bg, minHeight: 10, cursor: 'default' }}
                          title={title}
                        />
                      )
                    })
                  })()}
                </div>
                {payStubCalendarData && (
                  <div style={{ marginTop: '1rem', fontSize: '0.875rem', display: 'flex', gap: '1.5rem' }}>
                    <span>Earned YTD: ${formatCurrency(Object.values(payStubCalendarData.earnedByDate).reduce((s, v) => s + v, 0))}</span>
                    <span>Paid YTD: ${formatCurrency(Object.values(payStubCalendarData.paidByDate).reduce((s, v) => s + v, 0))}</span>
                    <span>
                      Unpaid: $
                      {formatCurrency(
                        Object.entries(payStubCalendarData.earnedByDate).reduce(
                          (s, [k, earned]) => s + Math.max(0, earned - (payStubCalendarData.paidByDate[k] ?? 0)),
                          0
                        )
                      )}
                    </span>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
