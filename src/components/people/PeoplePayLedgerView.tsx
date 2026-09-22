import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { JournalRow } from '../../lib/partnerLedger/partnerLedgerJournal'
import { shortDate } from '../../lib/partnerLedger/partnerLedgerFormat'
import {
  buildAllPersonLedgers,
  buildPeopleLedgerRoster,
  ledgerEquationTerms,
  offsetTypeLabel,
  personKey,
  type LedgerOffset,
  type PersonLedger,
  type RosterGroup,
} from '../../lib/people/personLedger'
import {
  allocateOldestFirst,
  countOpenReports,
  moveOverpaymentPlan,
  moveOverpaymentWords,
  offReportOffsets,
  openReportRows,
  openReportsCaption,
  residueSettlementDeduction,
  settleUp,
  settleUpSentence,
  type OffReportOffset,
  type OpenReportRow,
  type OpenReportState,
} from '../../lib/people/openReports'
import type { UnreportedWeekRow } from '../../lib/unreportedPayrollWeeks'
import type { PayStubPaymentRow } from '../../lib/payStubPayments'
import { sumPayStubAdditionalAmounts, type PayStubAdditionalLineRow, type PayStubDeductionRow } from '../../lib/payStubDeductions'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { AmountSmallCents } from '../AmountSmallCents'
import { PersonOffsetFormModal, type PersonOffsetEditingRow, type PersonOffsetInitialDraft } from '../pay/PersonOffsetFormModal'
import { PayStubLessModal } from '../pay/PayStubLessModal'
import { ledgerPayPeriodShortLabel, type PayStubRow } from './PeoplePayStubsTab'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * People → Payroll → Balances (v2.2168 ledger; v2.3689 open reports first).
 *
 * Two levels: a roster of everyone on payroll ranked by what we owe them /
 * what they owe us (with a caption that says why), and — for the selected
 * person — the open reports first (oldest week on top, paid to date, balance,
 * pay-to-here), the charges and credits that sit off any report, the weeks
 * with hours and no report yet, and one settle-up line that does the real
 * sum. The dated journal with its running balance folds underneath as the
 * statement, grouped by report or in date order. Math lives in
 * src/lib/people/personLedger.ts and src/lib/people/openReports.ts.
 */

export type PeoplePayLedgerViewProps = {
  payStubs: PayStubRow[]
  payStubPaymentsByStubId: Record<string, PayStubPaymentRow[]>
  payStubDeductionsByStubId: Record<string, PayStubDeductionRow[]>
  payStubAdditionalByStubId: Record<string, PayStubAdditionalLineRow[]>
  /** Open the stub in the in-app viewer (labor row drill-in). */
  onViewStub: (stub: PayStubRow) => void
  /** Open the parent-owned Record-payment modal (unpaid / partial labor rows). */
  onRecordPayment: (stub: PayStubRow) => void
  onError: (msg: string | null) => void
  /** Parent-owned pay-stub data layer — the Reports tab loads it on mount; so does this view. */
  loadPayStubs: () => Promise<unknown>
  /** Weeks with hours and no report for one person — the same scan as Draft Payroll's Earlier weeks (v2.3689). */
  loadUnreportedWeeks?: (personName: string) => Promise<UnreportedWeekRow[]>
  /** Generate the report for one unreported week (the strip's Report button). */
  onGenerateReport?: (row: UnreportedWeekRow) => Promise<void>
  /** The signed-in user — stamped on the Less line Mark settled writes and on a moved payment (v2.3691). */
  authUserId?: string | null
  showToast?: (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void
}

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const moneyWhole = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
/** Small-cents money (v2.2252) for numeric display spots; the string `money()` above stays for prose sentences. */
const MoneySC = ({ n }: { n: number }) => <AmountSmallCents value={Math.abs(n)} />
const SignedBalanceSC = ({ n }: { n: number }) =>
  n > 0.005 ? <>+<MoneySC n={n} /></> : n < -0.005 ? <>−<MoneySC n={n} /></> : <MoneySC n={0} />
const balanceColor = (n: number) => (n > 0.005 ? '#16a34a' : n < -0.005 ? 'var(--text-red-600)' : 'var(--text-muted)')
const balanceWords = (name: string, n: number) => (n > 0.005 ? `we owe ${name}` : n < -0.005 ? `${name} owes us` : 'even')
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (ymd: string) => {
  const m = /^(\d{4})-(\d{2})/.exec(ymd)
  return m ? `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : ymd
}

type RowKind = 'labor' | 'payout' | 'charge' | 'credit' | 'deduction' | 'addition'
function rowKind(r: JournalRow): RowKind {
  if (r.offset_id) return r.amount >= 0 ? 'credit' : 'charge'
  return r.kind
}
const KIND_LABEL: Record<RowKind, string> = { labor: 'Labor', payout: 'Paid out', charge: 'Charges', credit: 'Credits', deduction: 'Deductions', addition: 'Additions' }
const KIND_PILL: Record<RowKind, { bg: string; fg: string }> = {
  labor: { bg: 'rgba(37,99,235,0.14)', fg: 'var(--text-link)' },
  payout: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)' },
  charge: { bg: 'rgba(220,38,38,0.12)', fg: 'var(--text-red-600)' },
  credit: { bg: 'rgba(22,163,74,0.14)', fg: '#16a34a' },
  deduction: { bg: 'rgba(245,158,11,0.14)', fg: 'var(--text-amber-700)' },
  addition: { bg: 'rgba(22,163,74,0.14)', fg: '#16a34a' },
}

/** The Payment column's pill — the same words Pay run uses, plus residue and overpaid. */
const STATE_PILL: Record<OpenReportState, { bg: string; fg: string; border: string }> = {
  unpaid: { bg: 'rgba(245,158,11,0.12)', fg: 'var(--text-amber-700)', border: '1px solid rgba(245,158,11,0.4)' },
  partial: { bg: 'rgba(245,158,11,0.12)', fg: 'var(--text-amber-700)', border: '1px solid transparent' },
  residue: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)', border: '1px dashed var(--border-strong)' },
  overpaid: { bg: 'rgba(37,99,235,0.14)', fg: 'var(--text-link)', border: '1px solid transparent' },
}
function stateLabel(r: OpenReportRow): string {
  switch (r.state) {
    case 'unpaid':
      return 'Unpaid'
    case 'partial':
      return `Partial · ${Math.min(99, Math.round((r.paid / r.net) * 100))}%`
    case 'residue':
      return `${money(r.balance)} residue`
    case 'overpaid':
      return `Overpaid ${money(-r.balance)}`
  }
}
const METER_FILL: Record<OpenReportState, string> = { unpaid: 'transparent', partial: '#f59e0b', residue: '#f59e0b', overpaid: 'var(--text-link)' }

const ROW_CAP = 60
const PILL: CSSProperties = { display: 'inline-block', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0.35rem', borderRadius: 4, marginRight: '0.4rem', verticalAlign: '1px' }
const TH: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.3rem 0.4rem', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'left' }
const TD: CSSProperties = { padding: '0.36rem 0.4rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const BTN: CSSProperties = { font: 'inherit', fontSize: '0.72rem', fontWeight: 650, padding: '0.22rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', whiteSpace: 'nowrap' }
const BTN_PRIMARY: CSSProperties = { ...BTN, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: '#fff' }
const BTN_LINK: CSSProperties = { font: 'inherit', fontSize: '0.72rem', fontWeight: 650, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }
const CHIP = (on: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 999, border: `1px solid ${on ? 'var(--text-link)' : 'var(--border)'}`, boxShadow: on ? 'inset 0 0 0 1px var(--text-link)' : 'none', background: on ? 'var(--bg-muted)' : 'transparent', color: on ? 'var(--text-strong)' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' })

function Meter({ r }: { r: OpenReportRow }) {
  const pct = Math.max(0, Math.min(100, Math.round((r.paid / (r.net || 1)) * 100)))
  return (
    <span title={`${money(r.paid)} of ${money(r.net)}`} aria-hidden style={{ position: 'relative', display: 'inline-block', width: 56, height: 7, borderRadius: 4, background: r.state === 'unpaid' ? 'transparent' : 'var(--border)', boxShadow: r.state === 'unpaid' ? 'inset 0 0 0 1px var(--border-strong)' : 'none', overflow: 'hidden', verticalAlign: 'middle' }}>
      <span style={{ position: 'absolute', inset: 0, width: r.state === 'overpaid' ? '100%' : `${pct}%`, background: METER_FILL[r.state] }} />
    </span>
  )
}

function StatePill({ r }: { r: OpenReportRow }) {
  const s = STATE_PILL[r.state]
  return <span style={{ display: 'inline-block', fontSize: '0.66rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap', background: s.bg, color: s.fg, border: s.border }}>{stateLabel(r)}</span>
}

export default function PeoplePayLedgerView({ payStubs, payStubPaymentsByStubId, payStubDeductionsByStubId, payStubAdditionalByStubId, onViewStub, onRecordPayment, onError, loadPayStubs, loadUnreportedWeeks, onGenerateReport, authUserId = null, showToast }: PeoplePayLedgerViewProps) {
  const isMobile = useIsMobile()
  const nowYear = new Date().getFullYear()
  const [searchParams, setSearchParams] = useSearchParams()
  const [offsets, setOffsets] = useState<LedgerOffset[] | null>(null)
  const [stubsLoaded, setStubsLoaded] = useState(false)
  const [rosterFilter, setRosterFilter] = useState<'all' | RosterGroup>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [statementOpen, setStatementOpen] = useState(false)
  const [statementMode, setStatementMode] = useState<'report' | 'date'>('report')
  const [showSettled, setShowSettled] = useState(false)
  const [kindFilter, setKindFilter] = useState<RowKind | 'all'>('all')
  const [showAll, setShowAll] = useState(false)
  const [offsetModal, setOffsetModal] = useState<{ editing: PersonOffsetEditingRow | null; draft: PersonOffsetInitialDraft | null } | null>(null)
  /** Unreported weeks per person key; undefined = not loaded yet. */
  const [unreportedByKey, setUnreportedByKey] = useState<Record<string, UnreportedWeekRow[] | undefined>>({})
  const [generatingKey, setGeneratingKey] = useState<string | null>(null)
  /** The open report the Less modal is open for (Take a charge out of a week…). */
  const [lessStub, setLessStub] = useState<PayStubRow | null>(null)
  /** Which week picker is showing: an offset id, 'settle' for the settle line's button, or none. */
  const [weekPickerFor, setWeekPickerFor] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const confirmDialog = useConfirmDialog()

  const loadOffsets = useCallback(async () => {
    try {
      const data = await withSupabaseRetry(
        async () => supabase.from('person_offsets').select('id, person_name, type, amount, occurred_date, description, pay_stub_id').order('occurred_date', { ascending: true }),
        'load person offsets for the payroll ledger',
      )
      setOffsets((data ?? []) as LedgerOffset[])
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not load offsets')
      setOffsets([])
    }
  }, [onError])
  useEffect(() => {
    void loadOffsets()
  }, [loadOffsets])
  useEffect(() => {
    let alive = true
    void loadPayStubs().finally(() => {
      if (alive) setStubsLoaded(true)
    })
    return () => {
      alive = false
    }
    // mount-only, same as the Reports tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const loading = offsets == null || !stubsLoaded

  const ledgers = useMemo(() => {
    if (!offsets) return []
    const payments = Object.values(payStubPaymentsByStubId).flat()
    const deductions = Object.values(payStubDeductionsByStubId).flat()
    const additional = Object.values(payStubAdditionalByStubId).flat()
    return buildAllPersonLedgers({ stubs: payStubs, payments, deductions, additional, offsets })
  }, [offsets, payStubs, payStubPaymentsByStubId, payStubDeductionsByStubId, payStubAdditionalByStubId])
  const ledgerByKey = useMemo(() => new Map(ledgers.map((l) => [l.key, l])), [ledgers])
  const stubById = useMemo(() => new Map(payStubs.map((s) => [s.id, s])), [payStubs])
  const stubsByKey = useMemo(() => {
    const m = new Map<string, PayStubRow[]>()
    for (const s of payStubs) {
      const k = personKey(s.person_name)
      const arr = m.get(k)
      if (arr) arr.push(s)
      else m.set(k, [s])
    }
    return m
  }, [payStubs])
  /** Open reports + off-report offsets per person — the roster caption and the detail both read it. */
  const openByKey = useMemo(() => {
    const m = new Map<string, { rows: OpenReportRow[]; offs: OffReportOffset[] }>()
    for (const l of ledgers) {
      const rows = openReportRows({ stubs: stubsByKey.get(l.key) ?? [], stubPay: l.stubPay, paymentsByStubId: payStubPaymentsByStubId })
      m.set(l.key, { rows, offs: offReportOffsets([...l.offsetsById.values()]) })
    }
    return m
  }, [ledgers, stubsByKey, payStubPaymentsByStubId])
  const roster = useMemo(() => {
    const r = buildPeopleLedgerRoster(ledgers, moneyWhole)
    for (const row of r.rows) {
      const o = openByKey.get(row.key)
      const l = ledgerByKey.get(row.key)
      if (o && l) row.caption = openReportsCaption({ rows: o.rows, offsets: o.offs, unreportedCount: unreportedByKey[row.key]?.length ?? 0, stubCount: l.counts.stubs, money: moneyWhole })
    }
    return r
  }, [ledgers, openByKey, ledgerByKey, unreportedByKey])

  const selectedKey = searchParams.get('person') ? personKey(searchParams.get('person') ?? '') : null
  const selected: PersonLedger | null = selectedKey ? (ledgerByKey.get(selectedKey) ?? null) : null
  const select = (key: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (key) next.set('person', key)
    else next.delete('person')
    setSearchParams(next, { replace: true })
    setKindFilter('all')
    setShowAll(false)
    setStatementOpen(false)
    setShowSettled(false)
    setExpanded(new Set())
  }

  // The unreported-weeks scan for the selected person — once per person, re-run after a report is
  // generated or when the scan's inputs change (the loader is rebuilt when pay config loads).
  useEffect(() => {
    setUnreportedByKey({})
  }, [loadUnreportedWeeks])
  const selectedName = selected?.name ?? null
  const unreportedLoaded = selectedKey ? unreportedByKey[selectedKey] !== undefined : true
  useEffect(() => {
    if (!selectedKey || !selectedName || !loadUnreportedWeeks || unreportedLoaded) return
    let alive = true
    void loadUnreportedWeeks(selectedName)
      .then((rows) => {
        if (alive) setUnreportedByKey((prev) => ({ ...prev, [selectedKey]: rows }))
      })
      .catch((e: unknown) => {
        if (alive) {
          onError(e instanceof Error ? e.message : 'Could not scan for unreported weeks')
          setUnreportedByKey((prev) => ({ ...prev, [selectedKey]: [] }))
        }
      })
    return () => {
      alive = false
    }
  }, [selectedKey, selectedName, loadUnreportedWeeks, unreportedLoaded, onError])

  const open = selected ? (openByKey.get(selected.key) ?? { rows: [], offs: [] }) : { rows: [], offs: [] }
  const unreported = selectedKey ? (unreportedByKey[selectedKey] ?? []) : []
  const unreportedEstimate = unreported.reduce((s, r) => s + r.estGross, 0)
  const settle = selected ? settleUp({ rows: open.rows, offsets: open.offs, unreportedEstimate, balance: selected.balance }) : null
  const counts = countOpenReports(open.rows)

  // Open the partly paid, residue and overpaid rows by default: the first look shows the payments under their week.
  useEffect(() => {
    if (!selectedKey) return
    setExpanded(new Set(open.rows.filter((r) => r.state !== 'unpaid').map((r) => r.stubId)))
    // only when the person changes — expanding on every data refresh would fight the user's clicks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  const rosterRows = roster.rows.filter((r) => (rosterFilter === 'all' || r.group === rosterFilter) && (!search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase())))

  const toggleExpanded = (stubId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(stubId)) next.delete(stubId)
      else next.add(stubId)
      return next
    })

  const recordOnOldest = () => {
    const first = open.rows.find((r) => r.balance > 0.005)
    const s = first ? stubById.get(first.stubId) : undefined
    if (s) onRecordPayment(s)
  }

  const generateFor = async (row: UnreportedWeekRow) => {
    if (!onGenerateReport || !selectedKey) return
    const key = `${row.personName}:${row.weekStart}`
    setGeneratingKey(key)
    try {
      await onGenerateReport(row)
      setUnreportedByKey((prev) => ({ ...prev, [selectedKey]: undefined })) // re-scan: the week now has a report
    } finally {
      setGeneratingKey(null)
    }
  }

  const toast = (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => (showToast ? showToast(message, variant) : variant === 'error' ? onError(message) : undefined)
  const weekOf = (stubId: string) => {
    const s = stubById.get(stubId)
    return s ? shortDate(s.period_start, nowYear) : stubId
  }

  /** Mark settled: the Less line that closes a residue week (kernel `residueSettlementDeduction`). */
  const markSettled = async (rowsToSettle: OpenReportRow[]) => {
    const lines = rowsToSettle.map((r) => ({ r, d: residueSettlementDeduction(r) })).filter((x): x is { r: OpenReportRow; d: { amount: number; description: string } } => x.d != null)
    if (lines.length === 0) return
    const total = lines.reduce((s, x) => s + x.d.amount, 0)
    const ok = await confirmDialog({
      message: lines.length === 1
        ? `Mark the week of ${weekOf(lines[0]!.r.stubId)} settled? A Less line of ${money(total)} ("${lines[0]!.d.description}") closes it — the report's net then equals what was paid. Remove the line from the report to reopen it.`
        : `Mark ${lines.length} weeks settled? A Less line closes each one (${money(total)} in all, "${lines[0]!.d.description}"). Remove a line from its report to reopen that week.`,
      confirmLabel: 'Mark settled',
    })
    if (!ok) return
    setBusy('settle')
    try {
      await withSupabaseRetry(
        async () => await supabase.from('pay_stub_deductions').insert(lines.map((x) => ({ pay_stub_id: x.r.stubId, amount: x.d.amount, source: 'manual', description: x.d.description, created_by: authUserId }))),
        'mark residue weeks settled',
      )
      toast(lines.length === 1 ? `Week of ${weekOf(lines[0]!.r.stubId)} marked settled.` : `${lines.length} weeks marked settled.`, 'success')
      await loadPayStubs()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not mark the week settled', 'error')
    } finally {
      setBusy(null)
    }
  }

  /** Move extra: trim the overpaid week's newest payments and record the extra on the oldest open week (kernel `moveOverpaymentPlan`). */
  const moveExtra = async (row: OpenReportRow) => {
    const plan = moveOverpaymentPlan(row, open.rows, (r) => shortDate(r.periodStart, nowYear))
    if (!plan) {
      toast('Nothing to move on this week.', 'info')
      return
    }
    const ok = await confirmDialog({ message: moveOverpaymentWords(plan, weekOf, money), confirmLabel: plan.to ? 'Move it' : 'File a credit' })
    if (!ok) return
    setBusy(`move:${row.stubId}`)
    try {
      for (const op of plan.ops) {
        if (op.kind === 'update') await withSupabaseRetry(async () => await supabase.from('pay_stub_payments').update({ amount: op.amount }).eq('id', op.paymentId), 'shorten an overpaid payment')
        else await withSupabaseRetry(async () => await supabase.from('pay_stub_payments').delete().eq('id', op.paymentId), 'remove an overpaid payment')
      }
      const ins = plan.insert
      if (ins) {
        await withSupabaseRetry(async () => await supabase.from('pay_stub_payments').insert({ pay_stub_id: ins.pay_stub_id, amount: ins.amount, paid_at: ins.paid_at, memo: ins.memo, created_by: authUserId }), 'record the moved payment')
        toast(`Moved ${money(plan.amount)} to the week of ${weekOf(plan.to!)}.`, 'success')
        await loadPayStubs()
      } else {
        await loadPayStubs()
        setOffsetModal({ editing: null, draft: { personName: selected?.name ?? '', type: 'employee_credit', amount: plan.amount.toFixed(2), description: `Overpaid on week of ${weekOf(plan.from)}`, occurredDate: todayYmdInAppTz() } })
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not move the overpayment', 'error')
    } finally {
      setBusy(null)
    }
  }

  /** Take a charge out of a week: the Less modal for that report, whose Apply pending offset list holds this person's off-report charges. */
  const openLessFor = (stubId: string) => {
    const s = stubById.get(stubId)
    setWeekPickerFor(null)
    if (s) setLessStub(s)
  }
  const pickableWeeks = open.rows.filter((r) => r.balance > 0.005)
  const weekPicker = (pickerKey: string) =>
    weekPickerFor === pickerKey ? (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>out of the week of</span>
        {pickableWeeks.map((r) => (
          <button key={r.stubId} type="button" onClick={(e) => { e.stopPropagation(); openLessFor(r.stubId) }} style={CHIP(false)}>
            {ledgerPayPeriodShortLabel(r.periodStart, r.periodEnd, false)} · {money(r.balance)} left
          </button>
        ))}
        <button type="button" onClick={(e) => { e.stopPropagation(); setWeekPickerFor(null) }} style={BTN_LINK}>cancel</button>
      </span>
    ) : null

  // ── Statement rows ──
  /** Date order: the journal, newest first, filtered by kind. */
  const dateRows = useMemo(() => {
    if (!selected) return []
    const rows = [...selected.rows].reverse()
    return rows.filter((r) => kindFilter === 'all' || rowKind(r) === kindFilter)
  }, [selected, kindFilter])
  const visibleDateRows = showAll ? dateRows : dateRows.slice(0, ROW_CAP)

  /** Grouped by report: each stub's labor row, then what happened to it (payments, deductions, additions), then the offsets off any report. */
  const groupedRows = useMemo(() => {
    if (!selected) return { groups: [] as { stub: PayStubRow; labor: JournalRow | null; rest: JournalRow[]; open: OpenReportRow | null }[], offRows: [] as JournalRow[] }
    const openById = new Map(open.rows.map((r) => [r.stubId, r]))
    const stubs = [...(stubsByKey.get(selected.key) ?? [])].sort((a, b) => b.period_start.localeCompare(a.period_start))
    const groups = stubs
      .filter((s) => showSettled || openById.has(s.id))
      .map((s) => {
        const mine = selected.rows.filter((r) => r.pay_stub_id === s.id)
        const labor = mine.find((r) => r.kind === 'labor') ?? null
        const rest = mine.filter((r) => r.kind !== 'labor').sort((a, b) => a.date.localeCompare(b.date))
        return { stub: s, labor, rest, open: openById.get(s.id) ?? null }
      })
    const offRows = selected.rows.filter((r) => r.offset_id && !r.pay_stub_id).reverse()
    return { groups, offRows }
  }, [selected, open.rows, stubsByKey, showSettled])

  const pillText = (r: JournalRow): string => {
    const k = rowKind(r)
    if ((k === 'charge' || k === 'credit') && r.offset_id) {
      const o = selected?.offsetsById.get(r.offset_id)
      if (o) return offsetTypeLabel(o.type)
    }
    return KIND_LABEL[k].replace(/s$/, '')
  }
  const rowLabel = (r: JournalRow): { main: string; sub: string | null } => {
    const k = rowKind(r)
    if (k === 'labor' && r.pay_stub_id) {
      const s = stubById.get(r.pay_stub_id)
      return { main: `${(r.hours ?? s?.hours_total ?? 0).toFixed(2)} h`, sub: s ? `week of ${shortDate(s.period_start, nowYear)}` : null }
    }
    if (k === 'payout') return { main: r.detail?.trim() || 'Payment', sub: null }
    return { main: r.label, sub: r.detail }
  }
  const onJournalRowClick = (r: JournalRow) => {
    const k = rowKind(r)
    if (k === 'labor' && r.pay_stub_id) {
      const s = stubById.get(r.pay_stub_id)
      if (s) onViewStub(s)
      return
    }
    if ((k === 'charge' || k === 'credit') && r.offset_id) openOffset(r.offset_id)
  }
  const openOffset = (offsetId: string) => {
    const o = selected?.offsetsById.get(offsetId)
    if (o) setOffsetModal({ editing: { id: o.id, person_name: o.person_name, type: o.type, amount: o.amount, description: o.description, occurred_date: o.occurred_date }, draft: null })
  }
  const openCreate = (type: 'backcharge' | 'employee_credit') => {
    if (!selected) return
    setOffsetModal({ editing: null, draft: { personName: selected.name, type, amount: '', description: '', occurredDate: todayYmdInAppTz() } })
  }

  /** One statement row (either mode). `nested` indents a row under its report; `forWeek` is the date-order chip. */
  const statementRow = (r: JournalRow, key: string, opts: { nested?: boolean; forWeek?: string | null; leftOnReport?: number | null; balanceCol: 'running' | 'left' }) => {
    const k = rowKind(r)
    const { main, sub } = rowLabel(r)
    const clickable = k === 'labor' || k === 'charge' || k === 'credit'
    const st = k === 'labor' && r.pay_stub_id ? open.rows.find((x) => x.stubId === r.pay_stub_id) ?? null : null
    const highlight = st != null
    return (
      <tr key={key} onClick={clickable ? () => onJournalRowClick(r) : undefined} title={clickable ? (k === 'labor' ? 'Open this report' : 'Edit this offset') : undefined} style={{ cursor: clickable ? 'pointer' : 'default', background: highlight ? 'rgba(245,158,11,0.06)' : undefined }}>
        <td style={{ ...TD, whiteSpace: 'nowrap', color: 'var(--text-muted)', paddingLeft: opts.nested ? '1.4rem' : TD.padding, borderBottomStyle: opts.nested ? 'dashed' : 'solid' }}>{shortDate(r.date, nowYear)}</td>
        <td style={{ ...TD, borderBottomStyle: opts.nested ? 'dashed' : 'solid' }}>
          <span style={{ ...PILL, background: KIND_PILL[k].bg, color: KIND_PILL[k].fg }}>{pillText(r)}</span>
          {main}
          {sub ? <span style={{ color: 'var(--text-muted)' }}> · {sub}</span> : null}
          {st ? (
            <span style={{ marginLeft: '0.5rem' }}>
              <StatePill r={st} />
            </span>
          ) : null}
          {opts.forWeek ? <span style={{ display: 'inline-block', fontSize: '0.66rem', color: 'var(--text-link)', background: 'rgba(37,99,235,0.14)', padding: '0 0.45rem', borderRadius: 999, marginLeft: '0.5rem', whiteSpace: 'nowrap' }}>for week of {opts.forWeek}</span> : null}
        </td>
        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap', color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)', borderBottomStyle: opts.nested ? 'dashed' : 'solid' }}>
          {r.amount >= 0 ? '+' : '−'}<MoneySC n={r.amount} />
        </td>
        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottomStyle: opts.nested ? 'dashed' : 'solid' }}>
          {opts.balanceCol === 'running' ? <SignedBalanceSC n={r.balance} /> : opts.leftOnReport == null ? null : opts.leftOnReport > 0.005 ? <b style={{ color: 'var(--text-strong)' }}><MoneySC n={opts.leftOnReport} /></b> : <span style={{ color: 'var(--text-muted)' }}><MoneySC n={0} /></span>}
        </td>
      </tr>
    )
  }

  // ── Panels ──
  const rosterPanel = (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem 0.85rem', alignSelf: 'start', position: isMobile ? undefined : 'sticky', top: isMobile ? undefined : '0.5rem', maxHeight: isMobile ? undefined : 'calc(100vh - 1rem)', overflowY: isMobile ? undefined : 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <b style={{ fontSize: '0.95rem' }}>Balances</b>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{roster.rows.length} people</span>
      </div>
      {/* Two centered lines (owner's ask): one for each direction; the even count lives on its chip below. */}
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.45, textAlign: 'center' }}>
        We owe <b style={{ color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}><MoneySC n={roster.totals.oweAmount} /></b> across {roster.totals.oweCount}
        <br />
        owed to us <b style={{ color: 'var(--text-red-600)', fontVariantNumeric: 'tabular-nums' }}><MoneySC n={roster.totals.owedAmount} /></b> across {roster.totals.owedCount}
      </p>
      {/* One centered line on purpose: the roster column is 300px, and four chips at the old padding/gap wrapped the last one. */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', flexWrap: 'nowrap', marginBottom: '0.55rem' }}>
        {(
          [
            ['all', `All ${roster.rows.length}`],
            ['owe', `We owe ${roster.totals.oweCount}`],
            ['owed', `Owes us ${roster.totals.owedCount}`],
            ['even', `Even ${roster.totals.evenCount}`],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setRosterFilter(v)} aria-pressed={rosterFilter === v} style={{ ...CHIP(rosterFilter === v), padding: '0.15rem 0.4rem' }}>
            {label}
          </button>
        ))}
      </div>
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" aria-label="Search people" style={{ width: '100%', font: 'inherit', fontSize: '0.8rem', padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', marginBottom: '0.4rem' }} />
      {loading ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : rosterRows.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No one matches.</p>
      ) : (
        (['owe', 'owed', 'even'] as RosterGroup[]).map((g) => {
          const rows = rosterRows.filter((r) => r.group === g)
          if (rows.length === 0) return null
          return (
            <Fragment key={g}>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, margin: '0.6rem 0.3rem 0.15rem' }}>
                {g === 'owe' ? 'We owe' : g === 'owed' ? 'Owes us' : 'Even'}
              </div>
              {rows.map((r) => {
                const sel = r.key === selectedKey
                const o = openByKey.get(r.key)
                return (
                  <button key={r.key} type="button" onClick={() => select(r.key)} aria-pressed={sel} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.1rem 0.6rem', width: '100%', textAlign: 'left', font: 'inherit', padding: '0.45rem 0.5rem', borderRadius: 8, border: 'none', borderBottom: sel ? '1px solid transparent' : '1px solid var(--border)', background: sel ? 'var(--bg-muted)' : 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 0 }}>{r.name}</span>
                    <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: '0.85rem', color: balanceColor(r.balance) }}><SignedBalanceSC n={r.balance} /></span>
                    <span title={r.caption} style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{r.caption}</span>
                    <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textAlign: 'right' }}>{r.lastPostingDate ? shortDate(r.lastPostingDate, nowYear) : ''}</span>
                    {o && o.rows.length > 0 ? (
                      <span aria-hidden style={{ gridColumn: '1 / -1', display: 'flex', gap: 2, height: 4, marginTop: 2 }}>
                        {o.rows.map((x) => (
                          <span key={x.stubId} style={{ flex: 1, borderRadius: 2, position: 'relative', overflow: 'hidden', background: x.state === 'unpaid' ? 'transparent' : 'var(--border)', boxShadow: x.state === 'unpaid' ? 'inset 0 0 0 1px var(--border-strong)' : 'none' }}>
                            <span style={{ position: 'absolute', inset: 0, width: x.state === 'overpaid' ? '100%' : `${Math.max(0, Math.min(100, Math.round((x.paid / (x.net || 1)) * 100)))}%`, background: METER_FILL[x.state] }} />
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </Fragment>
          )
        })
      )}
    </div>
  )

  const openReportRow = (r: OpenReportRow) => {
    const s = stubById.get(r.stubId)
    const isOpen = expanded.has(r.stubId)
    const period = ledgerPayPeriodShortLabel(r.periodStart, r.periodEnd)
    const action =
      r.state === 'overpaid' ? (
        <button type="button" disabled={busy != null} onClick={(e) => { e.stopPropagation(); void moveExtra(r) }} style={BTN}>
          {busy === `move:${r.stubId}` ? 'Moving…' : 'Move extra'}
        </button>
      ) : r.state === 'residue' ? (
        <button type="button" disabled={busy != null} onClick={(e) => { e.stopPropagation(); void markSettled([r]) }} style={BTN}>
          Mark settled
        </button>
      ) : s ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onRecordPayment(s) }} style={BTN}>
          Record payment
        </button>
      ) : null
    const payments = (
      <ul style={{ margin: 0, padding: '0 0 0.3rem 1.6rem', listStyle: 'none', fontSize: '0.74rem' }}>
        {r.payments.length === 0 ? <li style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.15rem 0' }}>No payment recorded against this week yet.</li> : null}
        {r.payments.map((p) => (
          <li key={p.id} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) auto', gap: '0.6rem', padding: '0.15rem 0', color: 'var(--text-muted)' }}>
            <span>{shortDate(p.paid_at.slice(0, 10), nowYear)}</span>
            <span style={{ color: 'var(--text)', minWidth: 0, overflowWrap: 'anywhere' }}>{p.memo?.trim() || 'Payment'}</span>
            <span style={{ color: 'var(--text-red-600)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>−<MoneySC n={p.amount} /></span>
          </li>
        ))}
        {r.state === 'overpaid' ? (
          <li style={{ color: 'var(--text-link)', padding: '0.2rem 0' }}>
            Paid {money(-r.balance)} past net. {pickableWeeks.some((x) => x.stubId !== r.stubId) ? `Move extra puts it on the week of ${shortDate(pickableWeeks.find((x) => x.stubId !== r.stubId)!.periodStart, nowYear)}.` : 'Nothing is open to move it to — Move extra files it as a credit.'}
          </li>
        ) : null}
        {r.state === 'residue' ? <li style={{ color: 'var(--text-muted)', padding: '0.2rem 0' }}>{money(r.balance)} short of net, under the residue line — fees or rounding, not debt. Mark settled closes it with a Less line of that amount.</li> : null}
      </ul>
    )
    if (isMobile) {
      return (
        <div key={r.stubId} style={{ borderBottom: '1px solid var(--border)', padding: '0.45rem 0' }}>
          <div role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => toggleExpanded(r.stubId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(r.stubId) } }} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', cursor: 'pointer' }}>
            <span style={{ minWidth: 0 }}>
              <b style={{ fontSize: '0.84rem' }}>{period}</b>
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.hours.toFixed(2)} h · net <MoneySC n={r.net} /> · paid {r.paid > 0.005 ? <MoneySC n={r.paid} /> : '—'}</span>
              <span style={{ display: 'block', marginTop: 2 }}><StatePill r={r} /></span>
            </span>
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ display: 'block', fontWeight: 800, color: r.balance < -0.005 ? 'var(--text-link)' : 'var(--text-strong)' }}>{r.balance < -0.005 ? '+' : ''}<MoneySC n={r.balance} /></span>
              {r.payToHere != null ? <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-muted)' }}>to here <MoneySC n={r.payToHere} /></span> : null}
            </span>
          </div>
          {isOpen ? (
            <div style={{ marginTop: '0.3rem' }}>
              {payments}
              {action ? <div style={{ paddingLeft: '1.6rem' }}>{action}</div> : null}
            </div>
          ) : null}
        </div>
      )
    }
    return (
      <Fragment key={r.stubId}>
        <tr tabIndex={0} aria-expanded={isOpen} onClick={() => toggleExpanded(r.stubId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(r.stubId) } }} style={{ cursor: 'pointer', background: isOpen ? 'var(--bg-muted)' : undefined }}>
          <td style={{ ...TD, whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-strong)', borderBottomColor: isOpen ? 'transparent' : undefined }}>
            <span aria-hidden style={{ display: 'inline-block', width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid var(--text-muted)', marginRight: 8, transform: isOpen ? 'rotate(90deg)' : 'none', verticalAlign: '1px' }} />
            {period}
          </td>
          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottomColor: isOpen ? 'transparent' : undefined }}>{r.hours.toFixed(2)}</td>
          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottomColor: isOpen ? 'transparent' : undefined }}><MoneySC n={r.net} /></td>
          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-muted)', borderBottomColor: isOpen ? 'transparent' : undefined }}>
            {r.paid > 0.005 ? <MoneySC n={r.paid} /> : '—'} <Meter r={r} />
          </td>
          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, whiteSpace: 'nowrap', color: r.balance < -0.005 ? 'var(--text-link)' : r.balance > 0.005 ? 'var(--text-strong)' : 'var(--text-muted)', borderBottomColor: isOpen ? 'transparent' : undefined }}>
            {r.balance < -0.005 ? '+' : ''}<MoneySC n={r.balance} />
          </td>
          <td style={{ ...TD, borderBottomColor: isOpen ? 'transparent' : undefined }}><StatePill r={r} /></td>
          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottomColor: isOpen ? 'transparent' : undefined }}>{r.payToHere != null ? <MoneySC n={r.payToHere} /> : '·'}</td>
          <td style={{ ...TD, textAlign: 'right', borderBottomColor: isOpen ? 'transparent' : undefined }}>{action}</td>
        </tr>
        {isOpen ? (
          <tr>
            <td colSpan={8} style={{ ...TD, background: 'var(--bg-muted)', paddingTop: 0 }}>{payments}</td>
          </tr>
        ) : null}
      </Fragment>
    )
  }

  const detailPanel = selected && settle ? (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.85rem 1rem', minWidth: 0 }}>
      {isMobile ? (
        <button type="button" onClick={() => select(null)} style={{ ...BTN_LINK, fontSize: '0.8rem', marginBottom: '0.4rem' }}>
          ‹ All balances
        </button>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selected.name}</h3>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {selected.counts.stubs} report{selected.counts.stubs === 1 ? '' : 's'}
            {selected.firstPeriodStart ? ` · ${shortDate(selected.firstPeriodStart, nowYear)} → ${shortDate(selected.lastPeriodStart ?? selected.firstPeriodStart, nowYear)}` : ''}
            {' · '}
            {open.offs.length} off any report
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: balanceColor(selected.balance) }}><SignedBalanceSC n={selected.balance} /></div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{balanceWords(selected.name, selected.balance)}</div>
        </div>
      </div>

      {/* The equation: how the balance is built, zero terms dropped. */}
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.6rem', margin: '0.6rem 0 0.8rem', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {ledgerEquationTerms(selected).map((t, i) => (
          <span key={t.label}>
            {i === 0 ? (t.sign === '−' ? '− ' : '') : ` ${t.sign} `}
            {t.label} <b style={{ color: 'var(--text)' }}><MoneySC n={t.amount} /></b>
          </span>
        ))}
        {' = '}
        <b style={{ color: balanceColor(selected.balance) }}><SignedBalanceSC n={selected.balance} /></b>
      </div>

      {/* ── Open reports ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Open reports · {open.rows.length}</h4>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {[counts.unpaid ? `${counts.unpaid} unpaid` : '', counts.partial ? `${counts.partial} partial` : '', counts.residue ? `${counts.residue} residue` : '', counts.overpaid ? `${counts.overpaid} overpaid` : ''].filter(Boolean).join(' · ')}
          {open.rows.length > 0 ? `${counts.unpaid + counts.partial + counts.residue + counts.overpaid ? ' · ' : ''}oldest week of ${shortDate(open.rows[0]!.periodStart, nowYear)}` : ''}
        </span>
      </div>
      {open.rows.length === 0 ? (
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Every report is settled.</p>
      ) : isMobile ? (
        <div>{open.rows.map(openReportRow)}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={TH}>Period (w#)</th>
                <th style={{ ...TH, textAlign: 'right' }}>Hours</th>
                <th style={{ ...TH, textAlign: 'right' }}>Net Pay</th>
                <th style={{ ...TH, textAlign: 'right' }}>Paid to date</th>
                <th style={{ ...TH, textAlign: 'right' }}>Balance</th>
                <th style={TH}>Payment</th>
                <th style={{ ...TH, textAlign: 'right' }} title="What one send must be to clear every open week from the oldest through this one">Pay to here</th>
                <th style={TH} />
              </tr>
            </thead>
            <tbody>{open.rows.map(openReportRow)}</tbody>
          </table>
        </div>
      )}

      {/* ── Hours with no report yet ── */}
      {loadUnreportedWeeks && (!unreportedLoaded || unreported.length > 0) ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: '0.6rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.35rem 0.6rem', background: 'var(--bg-muted)', fontSize: '0.74rem', fontWeight: 700 }}>
            <span>Hours with no report yet{unreportedLoaded ? ` · ${unreported.length}` : ''}</span>
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{unreportedLoaded ? 'estimated at current pay config · the same rows as Draft Payroll’s Earlier weeks' : 'scanning…'}</span>
          </div>
          {unreported.map((u) => {
            const key = `${u.personName}:${u.weekStart}`
            return (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr) auto' : '84px minmax(0, 1fr) auto auto', gap: '0.4rem 0.6rem', alignItems: 'center', padding: '0.35rem 0.6rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', background: 'rgba(245,158,11,0.06)' }}>
                {isMobile ? null : <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ledgerPayPeriodShortLabel(u.weekStart, u.weekEnd, false)}</span>}
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...PILL, background: 'rgba(245,158,11,0.14)', color: 'var(--text-amber-700)' }}>Hours</span>
                  <b>{u.hours.toFixed(2)} h</b> · week of {shortDate(u.weekStart, nowYear)}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 700 }}>est. <MoneySC n={u.estGross} /></span>
                {onGenerateReport ? (
                  <button type="button" disabled={generatingKey != null} onClick={() => void generateFor(u)} style={{ ...BTN, gridColumn: isMobile ? '1 / -1' : undefined, justifySelf: 'end', opacity: generatingKey != null && generatingKey !== key ? 0.6 : 1 }}>
                    {generatingKey === key ? 'Generating…' : 'Report'}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* ── Off any report ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: '0.6rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0.6rem', background: 'var(--bg-muted)', fontSize: '0.74rem', fontWeight: 700, flexWrap: 'wrap' }}>
          <span>
            Off any report · {open.offs.length} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>charges and credits that never sat on a pay report</span>
          </span>
          <span style={{ display: 'flex', gap: '0.35rem' }}>
            <button type="button" onClick={() => openCreate('backcharge')} style={{ ...BTN_LINK, fontSize: '0.74rem' }}>+ Charge</button>
            <button type="button" onClick={() => openCreate('employee_credit')} style={{ ...BTN_LINK, fontSize: '0.74rem' }}>+ Credit</button>
          </span>
        </div>
        {open.offs.map((o) => (
          <div key={o.id} role="button" tabIndex={0} title="Edit this offset" onClick={() => openOffset(o.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOffset(o.id) } }} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr) auto' : '84px minmax(0, 1fr) auto', gap: '0.3rem 0.6rem', alignItems: 'center', padding: '0.35rem 0.6rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', cursor: 'pointer' }}>
            {isMobile ? null : <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{shortDate(o.occurred_date, nowYear)}</span>}
            <span style={{ minWidth: 0 }}>
              <span style={{ ...PILL, background: KIND_PILL[o.kind].bg, color: KIND_PILL[o.kind].fg }}>{offsetTypeLabel(o.type)}</span>
              <span style={{ color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{(o.description ?? '').trim() || offsetTypeLabel(o.type)}</span>
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 700, color: o.kind === 'charge' ? 'var(--text-red-600)' : '#16a34a' }}>
              {o.kind === 'charge' ? '−' : '+'}<MoneySC n={o.amount} />
            </span>
            {o.kind === 'charge' && pickableWeeks.length > 0 ? (
              <span style={{ gridColumn: isMobile ? '1 / -1' : '2 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                {weekPickerFor === o.id ? weekPicker(o.id) : (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setWeekPickerFor(o.id) }} title="Apply this charge as a Less line on an open report" style={BTN_LINK}>
                    Take out of a week…
                  </button>
                )}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* ── Settle up ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto', gap: '0.5rem 1rem', alignItems: 'center', marginTop: '0.7rem', padding: '0.55rem 0.7rem', borderRadius: 8, background: 'var(--bg-muted)', fontSize: '0.8rem', lineHeight: 1.55 }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {settleUpSentence(settle, selected.name, money)}
          {settle.mode === 'send' && settle.owed > 0.005 && (counts.unpaid + counts.partial + counts.residue) > 1 ? (
            <span style={{ display: 'block', fontSize: '0.72rem' }}>
              Oldest first, {money(settle.toSend)} lands as {allocateOldestFirst(settle.toSend, open.rows).splits.length} payment{allocateOldestFirst(settle.toSend, open.rows).splits.length === 1 ? '' : 's'} — read the amount for any shorter send off the Pay to here column.
            </span>
          ) : null}
        </span>
        {settle.mode === 'send' && settle.owed > 0.005 ? (
          <button type="button" onClick={recordOnOldest} style={{ ...BTN_PRIMARY, justifySelf: 'end' }}>
            Record a payment on the oldest week…
          </button>
        ) : settle.mode === 'charges' && pickableWeeks.length > 0 ? (
          weekPickerFor === 'settle' ? (
            <span style={{ justifySelf: 'end' }}>{weekPicker('settle')}</span>
          ) : (
            <button type="button" onClick={() => setWeekPickerFor('settle')} style={{ ...BTN_PRIMARY, justifySelf: 'end' }}>
              Take charges out of the open weeks…
            </button>
          )
        ) : settle.mode === 'residue' ? (
          <button type="button" disabled={busy != null} onClick={() => void markSettled(open.rows.filter((r) => r.state === 'residue'))} style={{ ...BTN_PRIMARY, justifySelf: 'end' }}>
            {settle.residueCount === 1 ? 'Mark it settled' : `Mark ${settle.residueCount} weeks settled`}
          </button>
        ) : null}
      </div>

      {/* ── Statement (folded) ── */}
      <button type="button" onClick={() => setStatementOpen((v) => !v)} aria-expanded={statementOpen} style={{ width: '100%', textAlign: 'left', font: 'inherit', fontSize: '0.76rem', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)', background: 'transparent', borderRadius: 8, padding: '0.45rem 0.6rem', marginTop: '0.9rem', cursor: 'pointer' }}>
        {statementOpen ? '▾ Hide the statement' : '▸ Show as a statement'} — every posting dated, for reconciling against the bank
      </button>
      {statementOpen ? (
        <div style={{ marginTop: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setStatementMode('report')} aria-pressed={statementMode === 'report'} style={CHIP(statementMode === 'report')}>Grouped by report</button>
              <button type="button" onClick={() => setStatementMode('date')} aria-pressed={statementMode === 'date'} style={CHIP(statementMode === 'date')}>Date order</button>
              {statementMode === 'report' ? (
                <button type="button" onClick={() => setShowSettled((v) => !v)} aria-pressed={showSettled} style={CHIP(showSettled)}>
                  {showSettled ? 'Hide' : 'Show'} {selected.counts.stubs - open.rows.length} settled
                </button>
              ) : null}
            </div>
            {statementMode === 'date' ? (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {(['all', 'labor', 'payout', 'charge', 'credit', 'deduction', 'addition'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setKindFilter(k)} aria-pressed={kindFilter === k} style={CHIP(kindFilter === k)}>
                    {k === 'all' ? 'All' : KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={TH}>Date</th>
                  <th style={TH}>Posting</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...TH, textAlign: 'right' }}>{statementMode === 'report' ? 'Left on report' : 'Balance'}</th>
                </tr>
              </thead>
              <tbody>
                {statementMode === 'report' ? (
                  <>
                    {groupedRows.groups.length === 0 && groupedRows.offRows.length === 0 ? (
                      <tr><td colSpan={4} style={{ ...TD, color: 'var(--text-muted)' }}>Nothing open — show the settled reports to see the history.</td></tr>
                    ) : null}
                    {groupedRows.groups.map((g) => (
                      <Fragment key={g.stub.id}>
                        {g.labor ? statementRow({ ...g.labor }, `l-${g.stub.id}`, { balanceCol: 'left', leftOnReport: g.open ? g.open.balance : 0 }) : null}
                        {g.rest.map((r, i) => statementRow(r, `r-${g.stub.id}-${i}`, { nested: true, balanceCol: 'left', leftOnReport: null }))}
                      </Fragment>
                    ))}
                    {groupedRows.offRows.length > 0 ? (
                      <tr>
                        <td colSpan={4} style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '0.45rem 0.4rem 0.1rem', background: 'var(--bg-muted)' }}>Off any report</td>
                      </tr>
                    ) : null}
                    {groupedRows.offRows.map((r, i) => statementRow(r, `o-${i}`, { balanceCol: 'left', leftOnReport: null }))}
                  </>
                ) : (
                  visibleDateRows.map((r, i) => {
                    const prev = visibleDateRows[i - 1]
                    const newMonth = !prev || monthLabel(prev.date) !== monthLabel(r.date)
                    const forStub = r.kind !== 'labor' && r.pay_stub_id ? stubById.get(r.pay_stub_id) : undefined
                    return (
                      <Fragment key={i}>
                        {newMonth ? (
                          <tr>
                            <td colSpan={4} style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '0.45rem 0.4rem 0.1rem', background: 'var(--bg-muted)' }}>{monthLabel(r.date)}</td>
                          </tr>
                        ) : null}
                        {statementRow(r, `d-${i}`, { balanceCol: 'running', forWeek: forStub ? shortDate(forStub.period_start, nowYear) : null })}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {statementMode === 'date' && dateRows.length > ROW_CAP && !showAll ? (
            <button type="button" onClick={() => setShowAll(true)} style={{ ...BTN_LINK, display: 'block', margin: '0.5rem auto 0', fontSize: '0.78rem' }}>
              Show all {dateRows.length} rows
            </button>
          ) : null}
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
            {statementMode === 'report'
              ? 'Newest report first; under each, what happened to it. Charges and credits that never sat on a report close the list. Click a report to open it; click a charge or credit to edit it.'
              : 'Newest first. Everything books on the day it happened — labor on the report’s week end, payouts when paid, charges and credits on their date; each payout names the week it was recorded against.'}
          </p>
        </div>
      ) : null}
    </div>
  ) : (
    <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: '1.2rem', color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'start' }}>
      Pick a person to see their open reports — what is paid on each, what is left, and one line that says how to settle up.
    </div>
  )

  return (
    <section>
      <div style={{ marginBottom: '0.6rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Balances</h2>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '62ch' }}>
          What we owe each person on payroll, and which reports are still waiting — oldest week first, with what is paid on each. <b>+</b> means we owe them, <b>−</b> means they owe us.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px minmax(0, 1fr)', gap: '0.9rem', alignItems: 'start' }}>
        {isMobile && selected ? null : rosterPanel}
        {isMobile && !selected ? null : detailPanel}
      </div>
      {offsetModal ? (
        <PersonOffsetFormModal
          open
          zIndex={1150}
          editingOffset={offsetModal.editing}
          initialCreateDraft={offsetModal.draft}
          personNameOptions={roster.rows.map((r) => r.name)}
          onClose={() => setOffsetModal(null)}
          onSaved={() => {
            setOffsetModal(null)
            void loadOffsets()
          }}
          onError={(m) => onError(m)}
        />
      ) : null}
      {lessStub ? (
        <PayStubLessModal
          stub={lessStub}
          deductions={payStubDeductionsByStubId[lessStub.id] ?? []}
          additionalSum={sumPayStubAdditionalAmounts(payStubAdditionalByStubId[lessStub.id] ?? [])}
          payments={payStubPaymentsByStubId[lessStub.id] ?? []}
          authUserId={authUserId}
          onClose={() => setLessStub(null)}
          onSaved={async () => {
            await Promise.all([loadPayStubs(), loadOffsets()])
          }}
          showToast={toast}
        />
      ) : null}
    </section>
  )
}
