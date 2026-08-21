import { formatCurrency } from '../../lib/format'
import { isoWeekNumberFromGregorianYmd, ymdAddDays } from '../../utils/dateUtils'
import {
  isPayStubFullyPaid,
  sumPayStubPaymentAmounts,
  type PayStubPaymentRow,
} from '../../lib/payStubPayments'
import {
  type PayStubAdditionalLineRow,
  type PayStubDeductionRow,
  stubNetPay,
  sumPayStubAdditionalAmounts,
  sumPayStubDeductionAmounts,
} from '../../lib/payStubDeductions'
import type { UnreportedWeekRow } from '../../lib/unreportedPayrollWeeks'
import type { DraftPayrollPayStub } from './DraftPayrollModal'

/**
 * Payroll catch-up (v2.2034): stacked on Draft Payroll, one row per earlier
 * person-week with hours and no report. Report generates the stub for that
 * row's week in place (the row then flips to View / Record payment via the
 * freshly-reloaded stubs instead of vanishing); Open week points the parent
 * modal at that week for the full pre-flight (Review days, pending banner).
 */
export function PayrollCatchUpModal({
  open,
  onClose,
  zIndex,
  rows,
  loading,
  scannedFrom,
  payStubs,
  payStubPaymentsByStubId,
  payStubDeductionsByStubId,
  payStubAdditionalByStubId,
  generatingKey,
  markingPayStubId,
  onGenerateForWeek,
  onViewStub,
  onRecordPayment,
  onOpenWeek,
  onExtendScan,
}: {
  open: boolean
  onClose: () => void
  zIndex: number
  rows: UnreportedWeekRow[]
  loading: boolean
  /** First scanned day — the footer's "scanned back to" stamp. */
  scannedFrom: string | null
  payStubs: DraftPayrollPayStub[]
  payStubPaymentsByStubId: Record<string, PayStubPaymentRow[]>
  payStubDeductionsByStubId: Record<string, PayStubDeductionRow[]>
  payStubAdditionalByStubId: Record<string, PayStubAdditionalLineRow[]>
  /** `${person}:${weekStart}` while that row is generating. */
  generatingKey: string | null
  markingPayStubId: string | null
  onGenerateForWeek: (row: UnreportedWeekRow) => void | Promise<void>
  onViewStub: (stub: DraftPayrollPayStub) => void | Promise<void>
  onRecordPayment: (stub: DraftPayrollPayStub) => void
  onOpenWeek: (weekStart: string, weekEnd: string) => void
  onExtendScan: () => void
}) {
  if (!open) return null

  const dayLabel = (d: string): string =>
    new Date(`${d}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })
  const weekLabel = (r: UnreportedWeekRow): string => `${dayLabel(r.weekStart)} – ${dayLabel(r.weekEnd)}`

  const unreported = rows.filter(
    (r) => !payStubs.some((s) => s.person_name === r.personName && s.period_start <= r.weekEnd && s.period_end >= r.weekStart),
  )
  const estTotal = unreported.reduce((s, r) => s + r.estGross, 0)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payroll-catchup-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.25rem',
          borderRadius: 10,
          maxWidth: 660,
          width: 'calc(100% - 2rem)',
          maxHeight: '82vh',
          overflow: 'auto',
          margin: '1rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.2rem' }}>
          <h3 id="payroll-catchup-title" style={{ margin: 0, fontSize: '1.15rem' }}>Earlier weeks without a report</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 0.7rem' }}>
          {loading
            ? 'Scanning earlier weeks…'
            : unreported.length === 0
              ? 'Nothing unreported in the scanned range.'
              : (
                <>
                  {unreported.length} person-week{unreported.length === 1 ? '' : 's'} · est.{' '}
                  <strong style={{ color: 'var(--text-strong)' }}>${formatCurrency(estTotal)}</strong> unreported
                </>
              )}
          {scannedFrom ? <> · scanned back to {dayLabel(scannedFrom)}</> : null}
        </p>
        {rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontSize: '0.78rem' }}>Person</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontSize: '0.78rem' }}>Week</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontSize: '0.78rem' }}>Hours</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontSize: '0.78rem' }}>Est. Cash Due</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontSize: '0.78rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const key = `${r.personName}:${r.weekStart}`
                  const stub = payStubs.find(
                    (s) => s.person_name === r.personName && s.period_start <= r.weekEnd && s.period_end >= r.weekStart,
                  )
                  const stubFullyPaid = stub
                    ? isPayStubFullyPaid(
                        stubNetPay(
                          stub.gross_pay,
                          sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? []),
                          sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? []),
                        ),
                        sumPayStubPaymentAmounts(payStubPaymentsByStubId[stub.id]),
                      )
                    : false
                  const isGenerating = generatingKey === key
                  const weekNum = isoWeekNumberFromGregorianYmd(ymdAddDays(r.weekStart, 4))
                  return (
                    <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.45rem 0.6rem', verticalAlign: 'middle' }}>
                        {r.personName}{' '}
                        {stub ? (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              padding: '0.08rem 0.4rem',
                              borderRadius: 6,
                              background: 'var(--bg-blue-tint)',
                              color: 'var(--text-blue-800)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            report created
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        {weekLabel(r)}{' '}
                        {weekNum != null ? <small style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>W{weekNum}</small> : null}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>
                        {r.hours.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>
                        ${formatCurrency(stub ? stub.gross_pay : r.estGross)}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', verticalAlign: 'middle' }}>
                        {stub ? (
                          <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => void onViewStub(stub)}
                              style={{ padding: '2px 6px', fontSize: '0.8125rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              View
                            </button>
                            {!stubFullyPaid ? (
                              <button
                                type="button"
                                onClick={() => onRecordPayment(stub)}
                                disabled={markingPayStubId === stub.id}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '0.8125rem',
                                  background: markingPayStubId === stub.id ? '#9ca3af' : '#059669',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: markingPayStubId === stub.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {markingPayStubId === stub.id ? '...' : 'Record payment'}
                              </button>
                            ) : null}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => void onGenerateForWeek(r)}
                              disabled={isGenerating || generatingKey != null}
                              style={{
                                padding: '2px 6px',
                                fontSize: '0.8125rem',
                                background: isGenerating || generatingKey != null ? '#9ca3af' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: isGenerating || generatingKey != null ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isGenerating ? '...' : 'Report'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenWeek(r.weekStart, r.weekEnd)}
                              title="Point Draft Payroll at this week for the full pre-flight"
                              style={{ padding: '2px 4px', fontSize: '0.8125rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline' }}
                            >
                              Open week
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.7rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Estimates use current pay config; the generated report is authoritative.
          </span>
          <button
            type="button"
            onClick={onExtendScan}
            disabled={loading}
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.78rem',
              fontWeight: 500,
              background: 'var(--surface)',
              color: loading ? 'var(--text-faint)' : 'var(--text-700)',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Scanning…' : 'Scan 8 more weeks'}
          </button>
        </div>
      </div>
    </div>
  )
}
