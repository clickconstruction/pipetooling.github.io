import { PaySourcePicker } from './PaySourcePicker'
import { AmountPaidField, PaidDateField, PaymentNoteField, RecordPaymentFooter, RecordPaymentHelp, RecordPaymentShell, RecordPaymentSummary } from './RecordPaymentPieces'
import { PersonOffsetFormModal } from './PersonOffsetFormModal'
import { formatCurrency } from '../../lib/format'
import { parsePayStubPaymentAmount, payStubBalance, payStubPaymentExcess } from '../../lib/pay/recordPayStubPayment'
import type { RecordPayStubPaymentApi } from '../../hooks/useRecordPayStubPayment'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

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
        <RecordPaymentShell title="Record payment" zIndex={Z_RECORD_PAYMENT}>
          <RecordPaymentSummary>
            {payStubMarkPaidTarget.person_name} · Gross ${formatCurrency(payStubMarkPaidTarget.gross_pay)}
            {` · Net Pay $${formatCurrency(payStubBalance(payStubMarkPaidTarget, payStubLineMaps).netPay)}`}{' '}
            · Remaining $
            {formatCurrency(payStubBalance(payStubMarkPaidTarget, payStubLineMaps).remaining)}
          </RecordPaymentSummary>
          <AmountPaidField value={payStubMarkPaidAmount} onChange={setPayStubMarkPaidAmount} />
          <RecordPaymentHelp>
            <strong>Confirm</strong> records up to the <strong>remaining balance</strong> shown above from this amount (partial payments allowed). If you paid more than the remainder, use <strong>Record employee credit…</strong> below; it opens <strong>Add offset</strong> on top of this dialog so you can save the excess without leaving this flow.
          </RecordPaymentHelp>
          <PaidDateField value={payStubMarkPaidDate} onChange={setPayStubMarkPaidDate} />
            <PaySourcePicker kind={payStubMarkPaidKind} onKind={setPayStubMarkPaidKind} cashAppId={payStubMarkPaidCashAppId} onCashAppId={setPayStubMarkPaidCashAppId} disabled={markingPayStubId === payStubMarkPaidTarget.id} idPrefix="record-payment" />
            <PaymentNoteField value={payStubMarkPaidNote} onChange={setPayStubMarkPaidNote} placeholder="e.g. check #, Venmo, GL code…" />
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
                      background: markingPayStubId === payStubMarkPaidTarget.id ? DEAD_PRESS_FILL : '#2563eb',
                      color: markingPayStubId === payStubMarkPaidTarget.id ? DEAD_PRESS_TEXT : 'white',
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
            <RecordPaymentFooter onCancel={closePayStubMarkPaidModal} onConfirm={() => void confirmPayStubMarkPaid()} confirmLabel="Confirm" busy={markingPayStubId === payStubMarkPaidTarget.id} />
        </RecordPaymentShell>
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
