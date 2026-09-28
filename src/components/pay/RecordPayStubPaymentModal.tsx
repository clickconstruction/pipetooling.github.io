import { PaySourcePicker } from './PaySourcePicker'
import { PersonOffsetFormModal } from './PersonOffsetFormModal'
import { formatCurrency } from '../../lib/format'
import { parsePayStubPaymentAmount, payStubBalance, payStubPaymentExcess } from '../../lib/pay/recordPayStubPayment'
import type { RecordPayStubPaymentApi } from '../../hooks/useRecordPayStubPayment'

/** Above the pay overlays it is opened from (Draft Payroll, Catch-up). */
const Z_RECORD_PAYMENT = 1200
/** Above Record payment: the Add offset form it opens for an employee credit. */
const Z_RECORD_PAYMENT_OFFSET_FORM = 1210

export type RecordPayStubPaymentModalProps = {
  /** `useRecordPayStubPayment`'s value — the page holds it, because its doors and `markingPayStubId` are read page-wide. */
  recordPayment: RecordPayStubPaymentApi
  personNameOptions: string[]
  /** The Add offset form's refusals ("Amount must be a positive number", a failed save). */
  onOffsetError: (message: string) => void
}

/** People → Payroll → Record payment, and the Add offset form behind its "Record employee credit…". */
export function RecordPayStubPaymentModal({ recordPayment, personNameOptions, onOffsetError }: RecordPayStubPaymentModalProps) {
  const {
    payStubLineMaps,
    markingPayStubId,
    payStubMarkPaidTarget,
    payStubMarkPaidDate,
    setPayStubMarkPaidDate,
    payStubMarkPaidAmount,
    setPayStubMarkPaidAmount,
    payStubMarkPaidNote,
    setPayStubMarkPaidNote,
    payStubMarkPaidCashAppId,
    setPayStubMarkPaidCashAppId,
    payStubMarkPaidKind,
    setPayStubMarkPaidKind,
    closePayStubMarkPaidModal,
    openEmployeeCreditFromRecordPayment,
    confirmPayStubMarkPaid,
    offsetFormOpen,
    offsetFormInitialCreateDraft,
    closeOffsetForm,
    onOffsetSaved,
  } = recordPayment

  return (
    <>
      {payStubMarkPaidTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z_RECORD_PAYMENT }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 440, width: '100%' }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>Record payment</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {payStubMarkPaidTarget.person_name} · Gross ${formatCurrency(payStubMarkPaidTarget.gross_pay)}
              {` · Net Pay $${formatCurrency(payStubBalance(payStubMarkPaidTarget, payStubLineMaps).netPay)}`}{' '}
              · Remaining $
              {formatCurrency(payStubBalance(payStubMarkPaidTarget, payStubLineMaps).remaining)}
            </p>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Amount paid</span>
              <input
                type="text"
                inputMode="decimal"
                value={payStubMarkPaidAmount}
                onChange={(e) => setPayStubMarkPaidAmount(e.target.value)}
                placeholder="0.00"
                style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '100%', maxWidth: 200 }}
              />
            </label>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              <strong>Confirm</strong> records up to the <strong>remaining balance</strong> shown above from this amount (partial payments allowed). If you paid more than the remainder, use <strong>Record employee credit…</strong> below; it opens <strong>Add offset</strong> on top of this dialog so you can save the excess without leaving this flow.
            </p>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Paid date (sent)</span>
              <input
                type="date"
                value={payStubMarkPaidDate}
                onChange={(e) => setPayStubMarkPaidDate(e.target.value)}
                style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '100%', maxWidth: 200 }}
              />
            </label>
            <PaySourcePicker kind={payStubMarkPaidKind} onKind={setPayStubMarkPaidKind} cashAppId={payStubMarkPaidCashAppId} onCashAppId={setPayStubMarkPaidCashAppId} disabled={markingPayStubId === payStubMarkPaidTarget.id} idPrefix="record-payment" />
            <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Note (optional)</span>
              <textarea
                value={payStubMarkPaidNote}
                onChange={(e) => setPayStubMarkPaidNote(e.target.value)}
                rows={3}
                placeholder="e.g. check #, Venmo, GL code…"
                style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '100%', fontFamily: 'inherit', fontSize: '0.875rem', resize: 'vertical' }}
              />
            </label>
            {(() => {
              const rem = payStubBalance(payStubMarkPaidTarget, payStubLineMaps).remaining
              const excess = payStubPaymentExcess(payStubMarkPaidAmount, rem)
              if (excess === null) return null
              const parsedPaid = parsePayStubPaymentAmount(payStubMarkPaidAmount)
              return (
                <div
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.75rem',
                    background: 'var(--bg-slate-tint)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}
                >
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-slate-600)', lineHeight: 1.45 }}>
                    You entered <strong>${formatCurrency(parsedPaid)}</strong>, which is more than the remaining balance (<strong>${formatCurrency(rem)}</strong>).{' '}
                    <strong>Confirm</strong> will apply <strong>${formatCurrency(rem)}</strong> to this pay report.{' '}
                    <strong>Excess:</strong> ${formatCurrency(excess)} — use the button below to open <strong>Add offset</strong> (employee credit) on top of this dialog (optional; you can confirm the payment first).
                  </p>
                  <button
                    type="button"
                    onClick={openEmployeeCreditFromRecordPayment}
                    disabled={markingPayStubId === payStubMarkPaidTarget.id}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.875rem',
                      background: markingPayStubId === payStubMarkPaidTarget.id ? '#9ca3af' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: markingPayStubId === payStubMarkPaidTarget.id ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Record employee credit…
                  </button>
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closePayStubMarkPaidModal}
                disabled={markingPayStubId === payStubMarkPaidTarget.id}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: markingPayStubId === payStubMarkPaidTarget.id ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={markingPayStubId === payStubMarkPaidTarget.id}
                onClick={() => void confirmPayStubMarkPaid()}
                style={{
                  padding: '0.5rem 1rem',
                  background: markingPayStubId !== payStubMarkPaidTarget.id ? '#059669' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: markingPayStubId !== payStubMarkPaidTarget.id ? 'pointer' : 'not-allowed',
                }}
              >
                {markingPayStubId === payStubMarkPaidTarget.id ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PersonOffsetFormModal
        open={offsetFormOpen}
        onClose={closeOffsetForm}
        editingOffset={null}
        initialCreateDraft={offsetFormInitialCreateDraft}
        zIndex={Z_RECORD_PAYMENT_OFFSET_FORM}
        personNameOptions={personNameOptions}
        onSaved={onOffsetSaved}
        onError={onOffsetError}
      />
    </>
  )
}
