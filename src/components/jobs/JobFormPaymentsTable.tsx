import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PaymentRow } from '../../lib/jobs/jobFormTypes'
import { formatCurrency, formatPaymentDateForDisplay } from '../../lib/jobs/jobFormMoney'
import {
  canRemovePaymentRowFromForm,
  canUnlinkMercuryPayment,
  mercuryLinkedPaymentRow,
  mercuryUnlinkBlockedByStripeHostedInvoice,
  paymentRowLinkedToInvoice,
  stripeBillInvoiceForPaymentRow,
} from '../../lib/jobs/jobFormPaymentPredicates'
import { abbreviatePaymentReferenceLabel } from '../../lib/abbreviatePaymentReference'
import type { InvoiceWithJobForBillView } from './BilledBillViewModal'

const PAYMENT_MEMO_SUB_ROW_CELL_STYLE: CSSProperties = {
  paddingTop: 0,
  paddingRight: '0.75rem',
  paddingBottom: '0.5rem',
  paddingLeft: '3.5rem',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  wordBreak: 'break-word',
  lineHeight: 1.35,
}

function ReadOnlyPaymentRefCopy({
  refText,
  showToast,
}: {
  refText: string
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}) {
  const { display, full } = useMemo(() => abbreviatePaymentReferenceLabel(refText), [refText])
  const onActivate = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        showToast('Clipboard not available', 'error')
        return
      }
      await navigator.clipboard.writeText(full)
      showToast('Reference copied', 'success')
    } catch {
      showToast('Could not copy reference', 'error')
    }
  }, [full, showToast])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        void onActivate()
      }
    },
    [onActivate],
  )

  return (
    <button
      type="button"
      onClick={() => void onActivate()}
      onKeyDown={onKeyDown}
      title="Copy full reference to clipboard"
      aria-label="Copy full reference to clipboard"
      style={{
        padding: 0,
        border: 'none',
        background: 'none',
        font: 'inherit',
        color: 'var(--text-link)',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
      }}
    >
      {display}
    </button>
  )
}

type JobFormPaymentsTableProps = {
  editing: JobWithDetails | null
  payments: PaymentRow[]
  persistedLedgerPaymentIds: Set<string>
  unlinkingMercuryPaymentId: string | null
  updatePaymentRow: (id: string, updates: Partial<PaymentRow>) => void
  addPaymentRow: () => void
  requestRemovePaymentRow: (row: PaymentRow) => void
  setUnlinkMercuryConfirmRowId: (id: string | null) => void
  setBillViewInvoice: (inv: InvoiceWithJobForBillView) => void
}

/**
 * The ③ "Payments received" table in the Edit-Job billing section — one row per
 * payment (date + amount + memo sub-row), with Stripe- and Mercury-locked rows
 * read-only, an inline add (+) on the last unlocked row, per-row remove/unlink,
 * and the Phase-2b "Applies to" invoice selector on manual rows. Extracted
 * verbatim from JobFormModal; self-sources auth/toast, takes the job + payments +
 * the row mutators and a couple of setters as props.
 */
export function JobFormPaymentsTable({
  editing,
  payments,
  persistedLedgerPaymentIds,
  unlinkingMercuryPaymentId,
  updatePaymentRow,
  addPaymentRow,
  requestRemovePaymentRow,
  setUnlinkMercuryConfirmRowId,
  setBillViewInvoice,
}: JobFormPaymentsTableProps) {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()

  // Consolidated start: blank manual draft rows (the seeded empty row) stay
  // hidden behind a "Record non-Stripe payment received" button until the user
  // asks for one — recorded payments and locked (Stripe/Mercury) rows always show.
  const [manualEntryOpen, setManualEntryOpen] = useState(false)
  useEffect(() => {
    setManualEntryOpen(false)
  }, [editing?.id])
  const isBlankManualRow = useCallback(
    (row: PaymentRow) =>
      !persistedLedgerPaymentIds.has(row.id) &&
      !stripeBillInvoiceForPaymentRow(row, editing) &&
      !mercuryLinkedPaymentRow(row) &&
      !(Number(row.amount) > 0) &&
      !(row.paid_on ?? '').trim() &&
      !(row.note ?? '').trim() &&
      !(row.payment_type ?? '').trim() &&
      !(row.reference_number ?? '').trim() &&
      !row.invoice_id,
    [editing, persistedLedgerPaymentIds],
  )
  const visiblePayments = manualEntryOpen ? payments : payments.filter((r) => !isBlankManualRow(r))
  const openManualEntry = () => {
    if (!payments.some((r) => isBlankManualRow(r))) addPaymentRow()
    setManualEntryOpen(true)
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <h4 style={{ margin: '0 0 0.15rem', fontSize: '0.9375rem' }}>③ Payments received</h4>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>Money collected on the job. Saves automatically.</div>
      {visiblePayments.length > 0 && (
      <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          minWidth: 480,
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          <col style={{ width: '28%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '48%' }} />
        </colgroup>
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr>
            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Date</th>
            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Paid</th>
            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }} aria-hidden />
          </tr>
        </thead>
        <tbody>
          {(() => {
            // Last non–Stripe-locked row hosts the add (+) control. If all rows are Stripe-backed (-1), there is no inline +.
            let lastUnlockedPaymentIdx = -1
            for (let i = visiblePayments.length - 1; i >= 0; i--) {
              const pr = visiblePayments[i]
              if (pr && !stripeBillInvoiceForPaymentRow(pr, editing) && !mercuryLinkedPaymentRow(pr)) {
                lastUnlockedPaymentIdx = i
                break
              }
            }
            return visiblePayments.map((row, idx) => {
            const stripePaymentLocked = Boolean(stripeBillInvoiceForPaymentRow(row, editing))
            const mercuryPaymentLocked = mercuryLinkedPaymentRow(row)
            const payRowCanRemove =
              canRemovePaymentRowFromForm(row, editing) ||
              Boolean(
                editing &&
                  persistedLedgerPaymentIds.has(row.id) &&
                  paymentRowLinkedToInvoice(row) &&
                  !stripeBillInvoiceForPaymentRow(row, editing),
              )
            const paymentReadOnly = stripePaymentLocked || mercuryPaymentLocked
            const noteTrim = (row.note ?? '').trim()
            const ptTrim = (row.payment_type ?? '').trim()
            const refTrim = (row.reference_number ?? '').trim()
            const hasMemoSubRow =
              !paymentReadOnly || noteTrim.length > 0 || ptTrim.length > 0 || refTrim.length > 0
            const rowSep = idx < visiblePayments.length - 1 ? '1px solid #e5e7eb' : 'none'
            const parentCellPad = hasMemoSubRow ? '0.5rem 0.75rem 0.1rem' : '0.5rem 0.75rem'
            const paymentDateCellStyle = {
              paddingTop: '0.5rem',
              paddingBottom: hasMemoSubRow ? '0.1rem' : '0.5rem',
              paddingLeft: '0.75rem',
              paddingRight: '0.125rem',
              verticalAlign: 'top' as const,
              wordBreak: 'break-word' as const,
              overflow: 'hidden' as const,
            }
            const paymentPaidCellStyle = {
              paddingTop: '0.5rem',
              paddingBottom: hasMemoSubRow ? '0.1rem' : '0.5rem',
              paddingLeft: '0.125rem',
              paddingRight: '0.75rem',
              textAlign: 'right' as const,
              verticalAlign: 'top' as const,
              overflow: 'hidden' as const,
            }
            return (
              <Fragment key={row.id}>
                <tr style={{ borderBottom: hasMemoSubRow ? 'none' : rowSep }}>
                  <td style={paymentDateCellStyle}>
                    {stripePaymentLocked ? (
                      <span
                        style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}
                        title="Recorded from the Stripe invoice."
                        aria-label={`Payment date ${formatPaymentDateForDisplay(row.paid_on)}`}
                      >
                        {formatPaymentDateForDisplay(row.paid_on)}
                      </span>
                    ) : mercuryPaymentLocked ? (
                      <span
                        style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}
                        title="Recorded from Bank Payments (Mercury)."
                        aria-label={`Payment date ${formatPaymentDateForDisplay(row.paid_on)}`}
                      >
                        {formatPaymentDateForDisplay(row.paid_on)}
                      </span>
                    ) : (
                      <input
                        id={`edit-job-payment-date-${row.id}`}
                        type="date"
                        value={row.paid_on ?? ''}
                        onChange={(e) => updatePaymentRow(row.id, { paid_on: e.target.value ? e.target.value : null })}
                        aria-label="Payment date"
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '0.375rem 0.5rem',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 6,
                          fontSize: '0.875rem',
                        }}
                      />
                    )}
                  </td>
                  <td style={paymentPaidCellStyle}>
                    {stripePaymentLocked ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.2rem',
                          flexWrap: 'nowrap',
                          minWidth: 0,
                        }}
                      >
                        {(() => {
                          const stripeInv = stripeBillInvoiceForPaymentRow(row, editing)
                          if (!stripeInv) return null
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (!editing) return
                                setBillViewInvoice({ ...stripeInv, job: editing })
                              }}
                              title="View Stripe bill"
                              aria-label="View Stripe bill for this payment"
                              style={{
                                flexShrink: 0,
                                padding: '0.2rem',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                color: 'var(--text-link)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 640 640"
                                width={17}
                                height={17}
                                fill="currentColor"
                                aria-hidden
                              >
                                <path d="M142 66.2C150.5 62.3 160.5 63.7 167.6 69.8L208 104.4L248.4 69.8C257.4 62.1 270.7 62.1 279.6 69.8L320 104.4L360.4 69.8C369.4 62.1 382.6 62.1 391.6 69.8L432 104.4L472.4 69.8C479.5 63.7 489.5 62.3 498 66.2C506.5 70.1 512 78.6 512 88L512 552C512 561.4 506.5 569.9 498 573.8C489.5 577.7 479.5 576.3 472.4 570.2L432 535.6L391.6 570.2C382.6 577.9 369.4 577.9 360.4 570.2L320 535.6L279.6 570.2C270.6 577.9 257.3 577.9 248.4 570.2L208 535.6L167.6 570.2C160.5 576.3 150.5 577.7 142 573.8C133.5 569.9 128 561.4 128 552L128 88C128 78.6 133.5 70.1 142 66.2zM232 200C218.7 200 208 210.7 208 224C208 237.3 218.7 248 232 248L408 248C421.3 248 432 237.3 432 224C432 210.7 421.3 200 408 200L232 200zM208 416C208 429.3 218.7 440 232 440L408 440C421.3 440 432 429.3 432 416C432 402.7 421.3 392 408 392L232 392C218.7 392 208 402.7 208 416zM232 296C218.7 296 208 306.7 208 320C208 333.3 218.7 344 232 344L408 344C421.3 344 432 333.3 432 320C432 306.7 421.3 296 408 296L232 296z" />
                              </svg>
                            </button>
                          )
                        })()}
                        <span
                          style={{
                            color: 'var(--text-strong)',
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title="From the Stripe invoice allocation."
                          aria-label={`Payment amount ${formatCurrency(Number(row.amount))} dollars`}
                        >
                          ${formatCurrency(Number(row.amount))}
                        </span>
                      </div>
                    ) : mercuryPaymentLocked ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.35rem',
                          flexWrap: 'wrap',
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: 'var(--text-blue-700)',
                            background: 'var(--bg-blue-tint)',
                            border: '1px solid var(--border-blue)',
                            borderRadius: 4,
                            padding: '0.1rem 0.35rem',
                            flexShrink: 0,
                          }}
                        >
                          Mercury
                        </span>
                        <span
                          style={{
                            color: 'var(--text-strong)',
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: 0,
                          }}
                          title="Linked to a Mercury bank transaction."
                          aria-label={`Payment amount ${formatCurrency(Number(row.amount))} dollars`}
                        >
                          ${formatCurrency(Number(row.amount))}
                        </span>
                      </div>
                    ) : (
                      <MoneyDecimalAmountInput
                        value={row.amount}
                        onChange={(amount) => updatePaymentRow(row.id, { amount })}
                        commitOnType
                        placeholder="0"
                        aria-label="Payment amount"
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '0.375rem 0.5rem',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 6,
                          fontSize: '0.875rem',
                          textAlign: 'right',
                        }}
                      />
                    )}
                  </td>
                  <td
                    style={{
                      padding: parentCellPad,
                      verticalAlign: 'top',
                      textAlign: 'right',
                    }}
                  >
                    {stripePaymentLocked ? null : mercuryPaymentLocked &&
                      canUnlinkMercuryPayment(authRole) &&
                      !mercuryUnlinkBlockedByStripeHostedInvoice(row, editing) ? (
                      <button
                        type="button"
                        onClick={() => setUnlinkMercuryConfirmRowId(row.id)}
                        disabled={unlinkingMercuryPaymentId === row.id}
                        title="Remove this payment from the job and free the bank deposit in Accounts Receivable"
                        aria-label="Unlink bank deposit and remove this payment line"
                        style={{
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: unlinkingMercuryPaymentId === row.id ? 'var(--text-faint)' : 'var(--text-blue-700)',
                          background: 'var(--bg-blue-tint)',
                          border: '1px solid var(--border-blue)',
                          borderRadius: 6,
                          cursor: unlinkingMercuryPaymentId === row.id ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {unlinkingMercuryPaymentId === row.id ? 'Removing…' : 'Unlink and remove'}
                      </button>
                    ) : mercuryPaymentLocked ? null : idx === lastUnlockedPaymentIdx ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.35rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setManualEntryOpen(true)
                            addPaymentRow()
                          }}
                          title="Add payment line"
                          aria-label="Add payment line"
                          style={{
                            padding: '0.35rem 0.5rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            lineHeight: 1,
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '1.75rem',
                          }}
                        >
                          +
                        </button>
                        {payRowCanRemove ? (
                          <button
                            type="button"
                            onClick={() => requestRemovePaymentRow(row)}
                            title="Remove"
                            aria-label="Remove payment row"
                            style={{
                              padding: '0.35rem',
                              background: 'transparent',
                              color: '#991b1c',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" /></svg>
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestRemovePaymentRow(row)}
                        disabled={!payRowCanRemove}
                        title="Remove"
                        aria-label="Remove payment row"
                        style={{
                          padding: '0.35rem',
                          background: !payRowCanRemove ? 'var(--bg-muted)' : 'transparent',
                          color: !payRowCanRemove ? 'var(--text-faint)' : '#991b1c',
                          border: 'none',
                          borderRadius: 4,
                          cursor: !payRowCanRemove ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" /></svg>
                      </button>
                    )}
                  </td>
                </tr>
                {hasMemoSubRow ? (
                  <tr style={{ borderBottom: rowSep }}>
                    <td colSpan={3} style={PAYMENT_MEMO_SUB_ROW_CELL_STYLE}>
                      {paymentReadOnly ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {(ptTrim || refTrim) ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-700)' }}>
                              {ptTrim ? (
                                <span style={{ marginRight: '0.75rem' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Type: </span>
                                  {ptTrim}
                                </span>
                              ) : null}
                              {refTrim ? (
                                <span>
                                  <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Ref: </span>
                                  <ReadOnlyPaymentRefCopy refText={refTrim} showToast={showToast} />
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Memo: </span>
                            {noteTrim || '—'}
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            width: '100%',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-600)', flexShrink: 0 }}>Type: </span>
                            <input
                              id={`edit-job-payment-type-${row.id}`}
                              type="text"
                              value={row.payment_type ?? ''}
                              onChange={(e) =>
                                updatePaymentRow(row.id, {
                                  payment_type: e.target.value === '' ? null : e.target.value,
                                })
                              }
                              placeholder="Optional"
                              aria-label="Payment type"
                              style={{
                                flex: '1 1 8rem',
                                minWidth: 0,
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                padding: '0.2rem 0.35rem',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                color: 'var(--text-700)',
                                background: 'var(--surface)',
                                lineHeight: 1.35,
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-600)', flexShrink: 0 }}>Ref: </span>
                            <input
                              id={`edit-job-payment-ref-${row.id}`}
                              type="text"
                              value={row.reference_number ?? ''}
                              onChange={(e) =>
                                updatePaymentRow(row.id, {
                                  reference_number: e.target.value === '' ? null : e.target.value,
                                })
                              }
                              placeholder="Optional"
                              aria-label="Payment reference"
                              style={{
                                flex: '1 1 10rem',
                                minWidth: 0,
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                padding: '0.2rem 0.35rem',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                color: 'var(--text-700)',
                                background: 'var(--surface)',
                                lineHeight: 1.35,
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-600)', flexShrink: 0 }}>Memo: </span>
                            <input
                              id={`edit-job-payment-note-${row.id}`}
                              type="text"
                              value={row.note ?? ''}
                              onChange={(e) =>
                                updatePaymentRow(row.id, { note: e.target.value === '' ? null : e.target.value })
                              }
                              placeholder="Optional"
                              aria-label="Payment memo"
                              style={{
                                flex: '1 1 12rem',
                                minWidth: 0,
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                padding: '0.2rem 0.35rem',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                color: 'var(--text-700)',
                                background: 'var(--surface)',
                                lineHeight: 1.35,
                              }}
                            />
                          </div>
                          {(editing?.invoices ?? []).some((i) => i.status === 'billed') ? (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-600)', flexShrink: 0 }}>Applies to: </span>
                              <select
                                id={`edit-job-payment-invoice-${row.id}`}
                                value={row.invoice_id ?? ''}
                                onChange={(e) =>
                                  updatePaymentRow(row.id, { invoice_id: e.target.value === '' ? null : e.target.value })
                                }
                                aria-label="Apply this payment to a specific invoice"
                                title="Attach this payment to a billed invoice so it pays that bill down; leave as Job (unassigned) for a general job payment."
                                style={{
                                  flex: '1 1 12rem',
                                  minWidth: 0,
                                  maxWidth: '100%',
                                  boxSizing: 'border-box',
                                  padding: '0.2rem 0.35rem',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 4,
                                  fontSize: '0.75rem',
                                  color: 'var(--text-700)',
                                  background: 'var(--surface)',
                                  lineHeight: 1.35,
                                }}
                              >
                                <option value="">Job (unassigned)</option>
                                {(editing?.invoices ?? [])
                                  .filter((i) => i.status === 'billed')
                                  .map((inv) => (
                                    <option key={inv.id} value={inv.id}>
                                      {`$${formatCurrency(Number(inv.amount ?? 0))} bill${inv.sent_to_customer_at ? ` · sent ${String(inv.sent_to_customer_at).slice(0, 10)}` : ''}`}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })
          })()}
        </tbody>
      </table>
      </div>
      )}
      {!manualEntryOpen && (
        <button
          type="button"
          onClick={openManualEntry}
          style={{
            marginTop: visiblePayments.length > 0 ? '0.5rem' : 0,
            padding: '0.35rem 0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 500,
            background: 'var(--surface)',
            color: 'var(--text-link)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          + Record non-Stripe payment received
        </button>
      )}
    </div>
  )
}
