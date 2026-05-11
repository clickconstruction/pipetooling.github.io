import { useEffect, useState } from 'react'
import { formatCurrency } from '../../lib/format'
import {
  isPayStubFullyPaid,
  remainingPayStubBalance,
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
import { PayStubDeleteIcon } from './PayStubDeleteIcon'
import { isoWeekNumberFromGregorianYmd, ymdAddDays } from '../../utils/dateUtils'

/** Matches People Pay History `PayStubRow` so callbacks can pass stubs through to `viewPayStub` / `openPayStubMarkPaidModal`. */
export type DraftPayrollPayStub = {
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

export type RunPayrollReviewDayItem = { workDate: string; issue: 'not_correct' | 'missing_job' }

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    days.push(d.toLocaleDateString('en-CA'))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildDraftPayrollPrintHtml(opts: {
  periodStart: string
  periodEnd: string
  people: string[]
  days: string[]
  paidCount: number
  rosterCount: number
  totalAmount: number
  leftUnpaid: number
  getEffectiveHours: (person: string, date: string) => number
  getCostForPersonDate: (person: string, date: string) => number
}): string {
  const rowsHtml = opts.people
    .map((person) => {
      const hours = opts.days.reduce((s, d) => s + opts.getEffectiveHours(person, d), 0)
      const estGross = opts.days.reduce((s, d) => s + opts.getCostForPersonDate(person, d), 0)
      return `<tr><td>${escapeHtml(person)}</td><td class="num">${hours.toFixed(2)}</td><td class="num">$${formatCurrency(estGross)}</td></tr>`
    })
    .join('')
  const weekNum = isoWeekNumberFromGregorianYmd(ymdAddDays(opts.periodStart, 4))
  const periodPlain =
    weekNum === null
      ? `${opts.periodStart} – ${opts.periodEnd}`
      : `${opts.periodStart} – ${opts.periodEnd} (Week ${weekNum})`
  const titleEscaped = escapeHtml(periodPlain)
  const generated = escapeHtml(new Date().toLocaleString())
  const summaryLine = `${opts.paidCount} of ${opts.rosterCount} paid · Total: $${formatCurrency(opts.totalAmount)} | Left: $${formatCurrency(opts.leftUnpaid)}`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Draft Payroll ${titleEscaped}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 1.25rem; color: #111827; }
    h1 { font-size: 1.25rem; margin: 0 0 0.35rem; }
    .period { color: #4b5563; margin: 0 0 1rem; font-size: 0.95rem; }
    .summary { color: #6b7280; margin: 0 0 1rem; font-size: 0.875rem; text-align: left; }
    table { border-collapse: collapse; width: 100%; max-width: 560px; }
    th, td { border: 1px solid #e5e7eb; padding: 0.45rem 0.65rem; text-align: left; font-size: 0.9rem; }
    th { background: #f9fafb; font-weight: 600; }
    th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .footer { margin-top: 1.25rem; font-size: 0.8rem; color: #6b7280; }
  </style>
</head>
<body>
  <h1>Draft Payroll</h1>
  <p class="period">Period ${titleEscaped}</p>
  <p class="summary">${summaryLine}</p>
  <table>
    <thead><tr><th>Person</th><th class="num">Hours</th><th class="num">Cash Due</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p class="footer">Generated ${generated}</p>
</body>
</html>`
}

export type DraftPayrollModalProps = {
  open: boolean
  onClose: () => void
  zIndex: number
  periodStart: string
  periodEnd: string
  onChangePeriodStart: (v: string) => void
  onChangePeriodEnd: (v: string) => void
  onShiftWeek: (delta: number) => void
  bulkGenerating: boolean
  pendingLoading: boolean
  pendingError: string | null
  pendingCount: number | null
  canAccessHours: boolean
  onOpenHoursForPeriod: (start: string, end: string) => void
  peopleNames: string[]
  payStubs: DraftPayrollPayStub[]
  payStubPaymentsByStubId: Record<string, PayStubPaymentRow[]>
  payStubDeductionsByStubId: Record<string, PayStubDeductionRow[]>
  payStubAdditionalByStubId: Record<string, PayStubAdditionalLineRow[]>
  getCostForPersonDate: (person: string, date: string) => number
  getEffectiveHours: (person: string, date: string) => number
  getRunPayrollReviewDayItems: (personName: string, periodDays: string[]) => RunPayrollReviewDayItem[]
  onBulkGenerateRemaining: () => void | Promise<void>
  onGenerateReport: (person: string) => void | Promise<void>
  onViewStub: (stub: DraftPayrollPayStub) => void | Promise<void>
  onRecordPayment: (stub: DraftPayrollPayStub) => void
  canDeletePayReports: boolean
  onRequestDeleteStub: (stub: DraftPayrollPayStub) => void
  deletingPayStubId: string | null
  markingPayStubId: string | null
  generatingPayStubPerson: string | null
  showToast: (message: string, variant: 'success' | 'error' | 'warning' | 'info') => void
  onNavigateToHoursForReviewDate: (workDate: string, personName: string) => void
  onOpenHoursBreakdown: (personName: string) => void
}

export function DraftPayrollModal({
  open,
  onClose,
  zIndex,
  periodStart: start,
  periodEnd: end,
  onChangePeriodStart,
  onChangePeriodEnd,
  onShiftWeek,
  bulkGenerating,
  pendingLoading,
  pendingError,
  pendingCount,
  canAccessHours,
  onOpenHoursForPeriod,
  peopleNames,
  payStubs,
  payStubPaymentsByStubId,
  payStubDeductionsByStubId,
  payStubAdditionalByStubId,
  getCostForPersonDate,
  getEffectiveHours,
  getRunPayrollReviewDayItems,
  onBulkGenerateRemaining,
  onGenerateReport,
  onViewStub,
  onRecordPayment,
  canDeletePayReports,
  onRequestDeleteStub,
  deletingPayStubId,
  markingPayStubId,
  generatingPayStubPerson,
  showToast,
  onNavigateToHoursForReviewDate,
  onOpenHoursBreakdown,
}: DraftPayrollModalProps) {
  const [reviewDaysDetail, setReviewDaysDetail] = useState<{
    personName: string
    items: RunPayrollReviewDayItem[]
  } | null>(null)
  const [showZeroHours, setShowZeroHours] = useState(false)

  useEffect(() => {
    if (!open) setReviewDaysDetail(null)
  }, [open])

  useEffect(() => {
    if (!open) setShowZeroHours(false)
  }, [open])

  useEffect(() => {
    if (!open || !reviewDaysDetail) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setReviewDaysDetail(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, reviewDaysDetail])

  if (!open) return null

  const days = getDaysInRange(start, end)
  const paidCount = peopleNames.filter((person) => {
    const stub = payStubs.find((s) => s.person_name === person && s.period_start <= end && s.period_end >= start)
    if (!stub) return false
    const paidSum = sumPayStubPaymentAmounts(payStubPaymentsByStubId[stub.id])
    const net = stubNetPay(
      stub.gross_pay,
      sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? []),
      sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? []),
    )
    return isPayStubFullyPaid(net, paidSum)
  }).length
  const totalAmount = peopleNames.reduce((sum, person) => {
    const stub = payStubs.find((s) => s.person_name === person && s.period_start <= end && s.period_end >= start)
    if (stub) return sum + stub.gross_pay
    return sum + days.reduce((s, d) => s + getCostForPersonDate(person, d), 0)
  }, 0)
  const leftUnpaid = peopleNames.reduce((sum, person) => {
    const stub = payStubs.find((s) => s.person_name === person && s.period_start <= end && s.period_end >= start)
    const estGross = days.reduce((s, d) => s + getCostForPersonDate(person, d), 0)
    if (stub) {
      const paidSum = sumPayStubPaymentAmounts(payStubPaymentsByStubId[stub.id])
      const net = stubNetPay(
        stub.gross_pay,
        sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? []),
        sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? []),
      )
      if (isPayStubFullyPaid(net, paidSum)) return sum
      return sum + remainingPayStubBalance(net, paidSum)
    }
    if (estGross > 0) return sum + estGross
    return sum
  }, 0)
  const bulkMissingCount = peopleNames.filter((person) => {
    const stub = payStubs.find((s) => s.person_name === person && s.period_start <= end && s.period_end >= start)
    const estGross = days.reduce((s, d) => s + getCostForPersonDate(person, d), 0)
    return estGross > 0 && !stub
  }).length

  const filteredPeople =
    showZeroHours
      ? peopleNames
      : peopleNames.filter((person) => days.reduce((s, d) => s + getEffectiveHours(person, d), 0) > 0)

  const printDisabled =
    peopleNames.length === 0 || start > end || bulkGenerating || filteredPeople.length === 0
  const printDisabledTitle =
    !printDisabled
      ? 'Open a printable summary in a new tab'
      : peopleNames.length > 0 && filteredPeople.length === 0
        ? 'Enable Show 0 hours or pick a period with hours.'
        : start > end
          ? 'Invalid date range.'
          : bulkGenerating
            ? 'Wait for generation to finish.'
            : undefined

  function openDraftPayrollPrintTab() {
    if (filteredPeople.length === 0) return
    const win = window.open('', '_blank')
    if (!win) {
      showToast('Popup blocked — allow popups to open the print view.', 'warning')
      return
    }
    win.document.write(
      buildDraftPayrollPrintHtml({
        periodStart: start,
        periodEnd: end,
        people: filteredPeople,
        days,
        paidCount,
        rosterCount: peopleNames.length,
        totalAmount,
        leftUnpaid,
        getEffectiveHours,
        getCostForPersonDate,
      }),
    )
    win.document.close()
  }

  const reviewZ = zIndex + 1

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex,
        }}
      >
        <div
          style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: 8,
            maxWidth: 600,
            maxHeight: '85vh',
            overflow: 'auto',
          }}
        >
          <div style={{ marginBottom: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Draft Payroll</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.8125rem',
                    color: '#374151',
                    cursor: 'pointer',
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showZeroHours}
                    onChange={(e) => setShowZeroHours(e.target.checked)}
                    disabled={bulkGenerating}
                    aria-label="Show people with zero hours"
                  />
                  Show 0 hours
                </label>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '0.25rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    lineHeight: 1,
                    color: '#6b7280',
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8125rem', margin: 0 }}>
                <span>Start</span>
                <input
                  type="date"
                  className="generate-pay-reports-date-input"
                  value={start}
                  onChange={(e) => onChangePeriodStart(e.target.value)}
                  disabled={bulkGenerating}
                  style={{
                    padding: '2px 2px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: '0.8125rem',
                    lineHeight: 1.3,
                    boxSizing: 'border-box',
                    opacity: bulkGenerating ? 0.6 : 1,
                  }}
                />
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8125rem', margin: 0 }}>
                <span>End</span>
                <input
                  type="date"
                  className="generate-pay-reports-date-input"
                  value={end}
                  onChange={(e) => onChangePeriodEnd(e.target.value)}
                  disabled={bulkGenerating}
                  style={{
                    padding: '2px 2px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: '0.8125rem',
                    lineHeight: 1.3,
                    boxSizing: 'border-box',
                    opacity: bulkGenerating ? 0.6 : 1,
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => onShiftWeek(-1)}
                disabled={bulkGenerating}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.8125rem',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  borderRadius: 4,
                  cursor: bulkGenerating ? 'not-allowed' : 'pointer',
                  lineHeight: 1.3,
                  opacity: bulkGenerating ? 0.5 : 1,
                }}
              >
                Last week
              </button>
              <button
                type="button"
                onClick={() => onShiftWeek(1)}
                disabled={bulkGenerating}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.8125rem',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  borderRadius: 4,
                  cursor: bulkGenerating ? 'not-allowed' : 'pointer',
                  lineHeight: 1.3,
                  opacity: bulkGenerating ? 0.5 : 1,
                }}
              >
                Next week
              </button>
            </div>
          </div>
          {pendingLoading ? (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 0.75rem', textAlign: 'center' }}>Checking pending approvals…</p>
          ) : null}
          {pendingError ? (
            <p style={{ fontSize: '0.8125rem', color: '#b91c1c', margin: '0 0 0.75rem', textAlign: 'center' }}>{pendingError}</p>
          ) : null}
          {!pendingLoading && pendingCount != null && pendingCount > 0 ? (
            <div
              role="status"
              style={{
                marginBottom: '0.75rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 6,
                border: '1px solid #f59e0b',
                background: '#fef3c7',
                color: '#92400e',
                fontSize: '0.8125rem',
                lineHeight: 1.4,
              }}
            >
              <strong>{pendingCount}</strong> clock session{pendingCount === 1 ? '' : 's'} in this period still need approval (Hours → Pending sessions).
              {canAccessHours ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => onOpenHoursForPeriod(start, end)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8125rem',
                      background: '#b45309',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Open Hours tab
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {peopleNames.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              No people with Show in Hours selected. In Hours, open People pay config and check Show in Hours for people to track.
            </p>
          ) : (
            <>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', textAlign: 'center' }}>
                {paidCount} of {peopleNames.length} paid · Total: ${formatCurrency(totalAmount)} | Left: ${formatCurrency(leftUnpaid)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => void onBulkGenerateRemaining()}
                  disabled={bulkGenerating || bulkMissingCount === 0 || start > end}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    background: bulkGenerating || bulkMissingCount === 0 || start > end ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: bulkGenerating || bulkMissingCount === 0 || start > end ? 'not-allowed' : 'pointer',
                  }}
                >
                  {bulkGenerating ? 'Generating…' : 'Generate Remaining'}
                </button>
                <button
                  type="button"
                  onClick={() => openDraftPayrollPrintTab()}
                  disabled={printDisabled}
                  title={printDisabledTitle}
                  aria-label={printDisabledTitle ?? 'Print draft payroll summary in a new tab'}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    background: printDisabled ? '#f3f4f6' : 'white',
                    color: printDisabled ? '#9ca3af' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: printDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  Print
                </button>
                <span style={{ fontSize: '0.8125rem', color: '#6b7280', textAlign: 'center' }}>
                  {bulkMissingCount === 0 ? 'No one needs a report for this period.' : `${bulkMissingCount} with hours and no report yet`}
                </span>
              </div>
              <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', width: 36 }}>Paid</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Person</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Hours</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Cash Due</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPeople.length === 0 && peopleNames.length > 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
                          Everyone has 0 hours for this period. Enable <strong>Show 0 hours</strong> to list them.
                        </td>
                      </tr>
                    ) : null}
                    {filteredPeople.map((person) => {
                      const stub = payStubs.find((s) => s.person_name === person && s.period_start <= end && s.period_end >= start)
                      const hours = days.reduce((s, d) => s + getEffectiveHours(person, d), 0)
                      const estGross = days.reduce((s, d) => s + getCostForPersonDate(person, d), 0)
                      const reviewItems = getRunPayrollReviewDayItems(person, days)
                      const paidSum = stub ? sumPayStubPaymentAmounts(payStubPaymentsByStubId[stub.id]) : 0
                      const stubNet = stub
                        ? stubNetPay(
                            stub.gross_pay,
                            sumPayStubDeductionAmounts(payStubDeductionsByStubId[stub.id] ?? []),
                            sumPayStubAdditionalAmounts(payStubAdditionalByStubId[stub.id] ?? []),
                          )
                        : 0
                      const stubFullyPaid = stub ? isPayStubFullyPaid(stubNet, paidSum) : false
                      const stubPartial = stub ? paidSum > 0 && !stubFullyPaid : false
                      const status = stub
                        ? stubFullyPaid
                          ? 'Paid'
                          : stubPartial
                            ? 'Partial'
                            : 'Report only'
                        : estGross > 0
                          ? reviewItems.length > 0
                            ? 'Review'
                            : 'Ready'
                          : 'No hours'
                      const isGenerating = generatingPayStubPerson === person
                      return (
                        <tr key={person} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {stub && !stubFullyPaid ? (
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => onRecordPayment(stub)}
                                disabled={markingPayStubId === stub.id}
                                title="Record payment"
                              />
                            ) : stub && stubFullyPaid ? (
                              <span style={{ color: '#059669', fontSize: '0.875rem' }} title="Fully paid">
                                {'\u2713'}
                              </span>
                            ) : (
                              <span style={{ color: '#d1d5db' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{person}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {!stub && estGross > 0 && reviewItems.length > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setReviewDaysDetail({ personName: person, items: reviewItems })
                                }}
                                title="Show dates needing attention for this period (Correct checkbox or job assignment)"
                                style={{
                                  padding: 0,
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: '#ea580c',
                                  textDecoration: 'underline',
                                }}
                              >
                                Review
                              </button>
                            ) : (
                              <span
                                style={{
                                  fontSize: '0.8125rem',
                                  color:
                                    status === 'Paid'
                                      ? '#059669'
                                      : status === 'Partial'
                                        ? '#ca8a04'
                                        : status === 'Review'
                                          ? '#ea580c'
                                          : status === 'No hours' || status === 'Report only'
                                            ? '#6b7280'
                                            : undefined,
                                }}
                              >
                                {status}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                            {hours > 0 ? (
                              <button
                                type="button"
                                onClick={() => onOpenHoursBreakdown(person)}
                                title="Day and job breakdown"
                                aria-label={`Day and job breakdown for ${person}: ${hours.toFixed(2)} hours`}
                                style={{
                                  padding: 0,
                                  margin: 0,
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  color: '#2563eb',
                                  textDecoration: 'underline',
                                  fontSize: 'inherit',
                                  fontVariantNumeric: 'tabular-nums',
                                  fontFamily: 'inherit',
                                }}
                              >
                                {hours.toFixed(2)}
                              </button>
                            ) : (
                              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{hours.toFixed(2)}</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(estGross)}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {stub ? (
                              <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => void onViewStub(stub)}
                                  style={{
                                    padding: '2px 6px',
                                    fontSize: '0.8125rem',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  View
                                </button>
                                {canDeletePayReports ? (
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
                                ) : null}
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
                              <button
                                type="button"
                                onClick={() => void onGenerateReport(person)}
                                disabled={isGenerating || estGross <= 0 || bulkGenerating}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '0.8125rem',
                                  background: isGenerating || estGross <= 0 || bulkGenerating ? '#9ca3af' : '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: isGenerating || estGross <= 0 || bulkGenerating ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {isGenerating ? '...' : 'Report'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {reviewDaysDetail ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="run-payroll-review-days-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: reviewZ,
          }}
          onClick={() => setReviewDaysDetail(null)}
        >
          <div
            style={{
              background: 'white',
              padding: '1.25rem',
              borderRadius: 8,
              maxWidth: 420,
              maxHeight: '80vh',
              overflow: 'auto',
              margin: '1rem',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="run-payroll-review-days-title" style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>
              Days needing attention
            </h3>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#4b5563' }}>
              <strong>{reviewDaysDetail.personName}</strong>: on the <strong>Hours</strong> tab, mark or clear the <strong>Correct</strong> row for dates below, or assign work in{' '}
              <strong>Crew Jobs / Bids</strong> when hours have no job. Then return here.
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#111827', listStyle: 'disc' }}>
              {reviewDaysDetail.items.map((item) => (
                <li key={`${item.workDate}-${item.issue}`} style={{ marginBottom: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!canAccessHours) {
                        showToast('You do not have access to the Hours tab.', 'warning')
                        return
                      }
                      const personName = reviewDaysDetail.personName
                      setReviewDaysDetail(null)
                      onNavigateToHoursForReviewDate(item.workDate, personName)
                    }}
                    style={{
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#2563eb',
                      textDecoration: 'underline',
                      font: 'inherit',
                      fontSize: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    {new Date(item.workDate + 'T12:00:00').toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </button>
                  <span style={{ marginLeft: '0.35rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                    {item.issue === 'not_correct' ? '— Not marked Correct' : '— No job assigned'}
                  </span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setReviewDaysDetail(null)}
                style={{
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.875rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
