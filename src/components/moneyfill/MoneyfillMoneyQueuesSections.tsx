import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  fetchJobFlagQueuesForWeek,
  fetchSupplyInvoiceCoverageForWeek,
  fetchUnappliedDepositsForWeek,
  type JobFlagQueues,
  type SupplyInvoiceCoverageRow,
  type UnappliedDepositRow,
} from '../../lib/moneyfillWeekClose'

/**
 * Moneyfill money queues (v2.1447 — WEEKLY_MONEY_PLAN.md Phase 3, queues
 * 3e/3f/3g/3h): supply-invoice allocation coverage, unapplied deposits, and
 * the two report-readiness flags (no % signal / no job total) computed from
 * the SAME payload RPC + kernel flags as the report itself.
 */

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '1rem 1.25rem',
  marginBottom: '1rem',
}
const th = (right = false): React.CSSProperties => ({
  textAlign: right ? 'right' : 'left',
  fontSize: '0.625rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontWeight: 600,
  padding: '0.2rem 0.5rem',
  borderBottom: '1px solid var(--border)',
})
const td = (right = false): React.CSSProperties => ({
  padding: '0.4rem 0.5rem',
  textAlign: right ? 'right' : 'left',
  fontVariantNumeric: 'tabular-nums',
})
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const allClear = <div style={{ color: '#15803d', fontSize: '0.875rem', fontWeight: 600 }}>✓ All clear for this week</div>
const loadingLine = <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
const outlineBtn: React.CSSProperties = {
  padding: '0.2rem 0.65rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  border: '1px solid var(--border-strong)',
  borderRadius: 5,
  background: 'var(--surface)',
  color: 'var(--text-blue-500)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const primaryBtn: React.CSSProperties = {
  padding: '0.2rem 0.65rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  border: 'none',
  borderRadius: 5,
  background: '#3b82f6',
  color: 'white',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export function MoneyfillSupplyInvoicesSection({ weekMonday }: { weekMonday: string }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<SupplyInvoiceCoverageRow[] | null | 'loading'>('loading')
  useEffect(() => {
    let cancelled = false
    setRows('loading')
    void fetchSupplyInvoiceCoverageForWeek(weekMonday).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [weekMonday])
  const gap = rows !== 'loading' && rows != null ? rows.reduce((s, r) => s + r.gapDollars, 0) : 0
  return (
    <section aria-label="Supply invoices not fully allocated" style={sectionStyle}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Supply invoices not fully allocated</h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Invoices dated this week whose job allocations don’t cover the invoice amount.{' '}
        {rows !== 'loading' && rows != null && rows.length > 0 ? (
          <b style={{ color: 'var(--text-700)' }}>
            {rows.length} invoice{rows.length === 1 ? '' : 's'} · {money(gap)} gap
          </b>
        ) : null}
      </p>
      {rows === 'loading' ? (
        loadingLine
      ) : rows == null ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Couldn’t load supply invoices.</div>
      ) : rows.length === 0 ? (
        allClear
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 620 }}>
            <thead>
              <tr>
                <th style={th()}>Supply house</th>
                <th style={th()}>Invoice</th>
                <th style={th()}>Date</th>
                <th style={th(true)}>Amount</th>
                <th style={th()}>Allocated</th>
                <th style={th(true)}>Gap</th>
                <th style={th(true)} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.invoiceId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td()}>{r.supplyHouseName}</td>
                  <td style={{ ...td(), fontVariantNumeric: 'tabular-nums' }}>{r.invoiceNumber}</td>
                  <td style={{ ...td(), color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(`${r.invoiceDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </td>
                  <td style={{ ...td(true), fontWeight: 650 }}>{money(r.amount)}</td>
                  <td style={td()}>
                    <span style={{ display: 'inline-block', width: 96, height: 7, borderRadius: 4, background: 'var(--bg-subtle)', verticalAlign: 'middle', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.round(r.allocatedPct))}%`, background: '#15803d' }} />
                    </span>{' '}
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{Math.round(r.allocatedPct)}%</span>
                  </td>
                  <td style={{ ...td(true), fontWeight: 700, color: 'var(--text-red-700)' }}>{money(r.gapDollars)}</td>
                  <td style={td(true)}>
                    <button type="button" style={primaryBtn} onClick={() => navigate('/materials?tab=supply-houses')} title="Allocate in Materials → Supply Houses">
                      Allocate to jobs…
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function MoneyfillDepositsSection({ weekMonday, authUserId }: { weekMonday: string; authUserId?: string }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<UnappliedDepositRow[] | null | 'loading'>('loading')
  useEffect(() => {
    let cancelled = false
    setRows('loading')
    void fetchUnappliedDepositsForWeek(weekMonday, authUserId).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [weekMonday, authUserId])
  const dollars = rows !== 'loading' && rows != null ? rows.reduce((s, r) => s + r.amount, 0) : 0
  return (
    <section aria-label="Deposits not applied to jobs" style={sectionStyle}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Deposits not applied to jobs</h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Money in this week not yet allocated to billed work (after the Accounts Receivable sorting exclusions) — until
        it’s applied, the report can’t say which job got paid.{' '}
        {rows !== 'loading' && rows != null && rows.length > 0 ? (
          <b style={{ color: 'var(--text-700)' }}>
            {money(dollars)} · {rows.length} deposit{rows.length === 1 ? '' : 's'}
          </b>
        ) : null}
      </p>
      {rows === 'loading' ? (
        loadingLine
      ) : rows == null ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Couldn’t load Mercury deposits.</div>
      ) : rows.length === 0 ? (
        allClear
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 520 }}>
            <thead>
              <tr>
                <th style={th()}>Posted</th>
                <th style={th()}>Counterparty</th>
                <th style={th(true)}>Amount</th>
                <th style={th(true)} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.txId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...td(), color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {r.postedAt
                      ? new Date(r.postedAt).toLocaleDateString('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                  <td style={td()}>{r.counterparty ?? '—'}</td>
                  <td style={{ ...td(true), fontWeight: 650, color: '#15803d' }}>{money(r.amount)}</td>
                  <td style={td(true)}>
                    <button
                      type="button"
                      style={primaryBtn}
                      onClick={() => navigate('/jobs?tab=stages&openBankPayments=true')}
                      title="Apply this deposit to billed work in Bank Payments"
                    >
                      Apply in Bank Payments
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function MoneyfillJobFlagsSections({ weekMonday }: { weekMonday: string }) {
  const jobDetail = useJobDetailModal()
  const jobForm = useJobFormModal()
  const [queues, setQueues] = useState<JobFlagQueues | null | 'loading'>('loading')
  useEffect(() => {
    let cancelled = false
    setQueues('loading')
    void fetchJobFlagQueuesForWeek(weekMonday).then((q) => {
      if (!cancelled) setQueues(q)
    })
    return () => {
      cancelled = true
    }
  }, [weekMonday])

  const jobCard = (r: JobFlagQueues['noPctSignal'][number], pill: string, extra?: React.ReactNode) => (
    <div
      key={r.jobId}
      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', marginBottom: 8 }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <b>{r.display}</b>
        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-faint)' }}>
          {r.address}
          {r.moneyOut > 0 ? ` · ${money(r.moneyOut)} out this week` : ''}
        </span>
      </div>
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-amber-700)', background: 'var(--bg-subtle)', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{pill}</span>
      <span style={{ display: 'inline-flex', gap: 6 }}>
        <button type="button" style={outlineBtn} onClick={() => jobDetail?.openJobDetail({ jobId: r.jobId })}>
          Job Detail
        </button>
        {extra}
      </span>
    </div>
  )

  return (
    <>
      <section aria-label="Worked jobs with no percent report" style={sectionStyle}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Worked jobs with no % report</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Jobs with money out this week but no % complete movement — earned value is blind on these. Same flags as the
          report.
        </p>
        {queues === 'loading' ? (
          loadingLine
        ) : queues == null ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Couldn’t load the week’s job flags.</div>
        ) : queues.noPctSignal.length === 0 ? (
          allClear
        ) : (
          queues.noPctSignal.map((r) => jobCard(r, 'no % signal'))
        )}
      </section>

      <section aria-label="Active jobs with no job total" style={sectionStyle}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Active jobs with no job total</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Money moved on these this week but the job has no total — the report can’t say if they made or lost money.
        </p>
        {queues === 'loading' ? (
          loadingLine
        ) : queues == null ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Couldn’t load the week’s job flags.</div>
        ) : queues.noJobTotal.length === 0 ? (
          allClear
        ) : (
          queues.noJobTotal.map((r) =>
            jobCard(
              r,
              'no job total',
              <button type="button" style={primaryBtn} onClick={() => jobForm?.openEditJob(r.jobId)}>
                Edit job
              </button>,
            ),
          )
        )}
      </section>
    </>
  )
}
