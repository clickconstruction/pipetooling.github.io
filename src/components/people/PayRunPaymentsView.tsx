/**
 * People → Pay → Payroll → **Payments** (v2.3577): one row per payment made, every header a
 * sort. The third pill on the Pay run · Balances toggle. Reads `pay_stub_payments` joined to
 * `pay_stubs` for the window (the per-person query Employment's pay history already makes,
 * without the person filter); the kernel `lib/people/payRunPayments.ts` owns the window, the
 * search, the sorts, the totals and the memo-derived method chip. No writes.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/format'
import { formatWorkDateYmdMonthDayShort, calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { useUserDisplayNames } from '../../hooks/useUserDisplayNames'
import {
  PAY_RUN_PAYMENT_WINDOWS,
  PAYMENT_METHOD_LABELS,
  defaultSortDir,
  derivePaymentMethod,
  filterPayRunPayments,
  paymentWindowStartYmd,
  payRunPaymentTotals,
  payRunPaymentsSummaryLine,
  sortPayRunPayments,
  type PayRunPaymentRow,
  type PayRunPaymentSortKey,
  type PayRunPaymentWindow,
  type SortDir,
} from '../../lib/people/payRunPayments'
import { ledgerPayPeriodShortLabel, type PayStubRow } from './PeoplePayStubsTab'

const PREF_KEY = 'people.payRun.payments.v1'
type Prefs = { window: PayRunPaymentWindow; sortKey: PayRunPaymentSortKey; sortDir: SortDir }
const DEFAULT_PREFS: Prefs = { window: '90d', sortKey: 'paid', sortDir: 'desc' }
function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return DEFAULT_PREFS
    const p = JSON.parse(raw) as Partial<Prefs>
    return {
      window: PAY_RUN_PAYMENT_WINDOWS.some((w) => w.key === p.window) ? (p.window as PayRunPaymentWindow) : DEFAULT_PREFS.window,
      sortKey: (['paid', 'person', 'period', 'amount', 'memo', 'recorded'] as const).includes(p.sortKey as PayRunPaymentSortKey) ? (p.sortKey as PayRunPaymentSortKey) : DEFAULT_PREFS.sortKey,
      sortDir: p.sortDir === 'asc' || p.sortDir === 'desc' ? p.sortDir : DEFAULT_PREFS.sortDir,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

const chip = (on: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.85rem', fontWeight: 600, padding: '0.35rem 0.8rem', border: `1px solid ${on ? 'var(--text-link)' : 'var(--border-strong)'}`, borderRadius: 8, background: on ? 'var(--text-link)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text-700)', cursor: 'pointer' })
const th = (active: boolean, right: boolean): CSSProperties => ({ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, color: active ? 'var(--text-strong)' : 'var(--text-muted)', textAlign: right ? 'right' : 'left', padding: '0.55rem 0.6rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'none', border: 'none', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--border)', cursor: 'pointer', width: '100%' })
const td: CSSProperties = { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: '0.85rem' }
const tag: CSSProperties = { display: 'inline-block', fontSize: '0.66rem', padding: '0.05rem 0.45rem', borderRadius: 999, border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', marginLeft: '0.35rem', verticalAlign: 'middle' }
const muted: CSSProperties = { color: 'var(--text-muted)' }

const COLUMNS: ReadonlyArray<{ key: PayRunPaymentSortKey; label: string; right?: boolean }> = [
  { key: 'paid', label: 'Paid on' },
  { key: 'person', label: 'Person' },
  { key: 'period', label: 'Period (w#)' },
  { key: 'amount', label: 'Amount', right: true },
  { key: 'memo', label: 'Memo' },
  { key: 'recorded', label: 'Recorded' },
]

export default function PayRunPaymentsView({ onViewStub }: { onViewStub: (stub: PayStubRow) => void }) {
  const { showToast } = useToastContext()
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<PayRunPaymentRow[]>([])
  const [stubById, setStubById] = useState<Record<string, PayStubRow>>({})
  const [loading, setLoading] = useState(true)
  const [allCount, setAllCount] = useState<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
    } catch {
      /* per-device convenience only */
    }
  }, [prefs])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const start = paymentWindowStartYmd(prefs.window, todayYmdInAppTz())
        let q = supabase
          .from('pay_stub_payments')
          .select('id, paid_at, amount, memo, created_by, created_at, pay_stubs!inner(id, person_name, period_start, period_end, hours_total, gross_pay, created_at, paid_at, paid_by, paid_note)')
          .order('paid_at', { ascending: false })
        if (start) q = q.gte('paid_at', start)
        const data = await withSupabaseRetry(async () => q, 'pay run payments')
        if (cancelled) return
        const list = ((data ?? []) as unknown as Array<{ id: string; paid_at: string; amount: number; memo: string | null; created_by: string | null; created_at: string | null; pay_stubs: PayStubRow }>)
        const stubs: Record<string, PayStubRow> = {}
        setRows(
          list.map((r) => {
            stubs[r.pay_stubs.id] = r.pay_stubs
            return { id: r.id, paidAt: r.paid_at, amount: Number(r.amount), memo: r.memo, createdBy: r.created_by, createdAt: r.created_at, stub: { id: r.pay_stubs.id, personName: r.pay_stubs.person_name, periodStart: r.pay_stubs.period_start, periodEnd: r.pay_stubs.period_end } }
          }),
        )
        setStubById(stubs)
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Failed to load payments'), 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [prefs.window, showToast])

  // The All chip's count, once, so it can say "All (337)".
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { count } = await supabase.from('pay_stub_payments').select('id', { count: 'exact', head: true })
      if (!cancelled) setAllCount(count ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const names = useUserDisplayNames(useMemo(() => [...new Set(rows.map((r) => r.createdBy).filter(Boolean))], [rows]))
  const visible = useMemo(() => sortPayRunPayments(filterPayRunPayments(rows, query), prefs.sortKey, prefs.sortDir), [rows, query, prefs.sortKey, prefs.sortDir])
  const totals = useMemo(() => payRunPaymentTotals(visible), [visible])
  const shortDate = (ymd: string) => formatWorkDateYmdMonthDayShort(ymd)

  const clickSort = (key: PayRunPaymentSortKey) =>
    setPrefs((p) => (p.sortKey === key ? { ...p, sortDir: p.sortDir === 'asc' ? 'desc' : 'asc' } : { ...p, sortKey: key, sortDir: defaultSortDir(key) }))

  return (
    <div data-testid="pay-run-payments">
      <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.15rem' }}>Payments</h2>
      <p style={{ ...muted, fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{loading ? 'loading…' : payRunPaymentsSummaryLine(totals, prefs.window, (n) => `$${formatCurrency(n)}`, shortDate)}</p>
      <div role="group" aria-label="Window" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }}>
        {PAY_RUN_PAYMENT_WINDOWS.map((w) => (
          <button key={w.key} type="button" aria-pressed={prefs.window === w.key} onClick={() => setPrefs((p) => ({ ...p, window: w.key }))} style={chip(prefs.window === w.key)}>
            {w.key === 'all' && allCount != null ? `All (${allCount})` : w.label}
          </button>
        ))}
      </div>
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or memo…" aria-label="Search payments by name or memo" style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, font: 'inherit', background: 'var(--surface)', color: 'var(--text-base)' }} />
      <p style={{ ...muted, fontSize: '0.78rem', margin: '0.25rem 0 0.75rem' }}>Search filters by person name or memo text (a Cash App transfer id finds its row).</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const active = prefs.sortKey === c.key
                return (
                  <th key={c.key} style={{ padding: 0, textAlign: c.right ? 'right' : 'left' }} aria-sort={active ? (prefs.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => clickSort(c.key)} title={`Sort by ${c.label.toLowerCase()}`} style={th(active, !!c.right)}>
                      {c.label} <span style={{ fontSize: '0.6rem', color: active ? 'var(--text-strong)' : 'var(--text-faint)' }}>{active ? (prefs.sortDir === 'asc' ? '▴' : '▾') : '▸'}</span>
                    </button>
                  </th>
                )
              })}
              <th style={{ ...th(false, false), cursor: 'default' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && visible.length === 0 ? (
              <tr><td colSpan={7} style={{ ...td, ...muted, textAlign: 'center', padding: '1rem' }}>{query.trim() ? 'No payment matches.' : 'No payments in this window.'}</td></tr>
            ) : (
              visible.map((r) => {
                const method = derivePaymentMethod(r.memo)
                const memo = (r.memo ?? '').trim()
                const stub = stubById[r.stub.id]
                return (
                  <tr key={r.id}>
                    <td style={td} title={r.paidAt}>{shortDate(calendarYmdInAppTzFromIso(r.paidAt))}</td>
                    <td style={td}>{r.stub.personName}</td>
                    <td style={td}>{ledgerPayPeriodShortLabel(r.stub.periodStart, r.stub.periodEnd)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>${formatCurrency(r.amount)}</td>
                    <td style={{ ...td, whiteSpace: 'normal', maxWidth: '28ch' }} title={memo || undefined}>
                      {memo ? <span style={{ color: 'var(--text-700)' }}>{memo.length > 40 ? `${memo.slice(0, 39)}…` : memo}</span> : <span style={muted}>—</span>}
                      {method ? <span style={tag}>{PAYMENT_METHOD_LABELS[method]}</span> : null}
                    </td>
                    <td style={td}>
                      {r.createdBy ? names[r.createdBy] ?? '…' : <span style={muted}>—</span>}
                      {r.createdAt ? <span style={muted}> · {shortDate(calendarYmdInAppTzFromIso(r.createdAt))}</span> : null}
                    </td>
                    <td style={td}>
                      {stub ? (
                        <button type="button" onClick={() => onViewStub(stub)} style={{ font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                          Stub
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {visible.length > 0 ? (
            <tfoot>
              <tr>
                <td colSpan={3} style={{ ...td, fontWeight: 600, borderTop: '2px solid var(--border)', borderBottom: 'none' }}>
                  {visible.length === rows.length ? `${visible.length} ${visible.length === 1 ? 'payment' : 'payments'}` : `${visible.length} of ${rows.length} shown`}
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600, borderTop: '2px solid var(--border)', borderBottom: 'none' }}>${formatCurrency(totals.sumUsd)}</td>
                <td colSpan={3} style={{ ...td, borderTop: '2px solid var(--border)', borderBottom: 'none' }} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}
