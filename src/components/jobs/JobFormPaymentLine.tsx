import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick'
import { FinishedDateInput } from '../FinishedDateInput'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsLedgerInvoiceRow, PaymentRow } from '../../lib/jobs/jobFormTypes'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import {
  billSentYmd,
  paymentLineWords,
  paymentSource,
  sourceWords,
  type MercuryDepositFacts,
} from '../../lib/jobs/billsAndPayments'
import {
  canRemovePaymentRowFromForm,
  canUnlinkMercuryPayment,
  jobsLedgerInvoiceIsStripeLinked,
  mercuryUnlinkBlockedByStripeHostedInvoice,
  paymentRowLinkedToInvoice,
  stripeBillInvoiceForPaymentRow,
  stripeHoldsPaymentReason,
  unlinkLeavesStripeBillUntouched,
} from '../../lib/jobs/jobFormPaymentPredicates'
import { CHECK_DID_NOT_CLEAR_LABEL, CHECK_DID_NOT_CLEAR_TITLE, paymentRowOffersCheckDidNotClear } from '../../lib/jobs/stripeOobSendBack'
import { paymentMoveBlock, paymentMoveBlockText } from '../../lib/jobs/jobPaymentMove'
import { autoApplyInvoiceId } from '../../lib/jobs/paymentInvoiceLinking'
import type { InvoiceWithJobForBillView } from './BilledBillViewModal'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/** The host's doors a payment line opens — the same seven the ③ table always had. */
export type PaymentLineActions = {
  updatePaymentRow: (id: string, updates: Partial<PaymentRow>) => void
  requestRemovePaymentRow: (row: PaymentRow) => void
  requestMovePaymentRow: (row: PaymentRow) => void
  setUnlinkMercuryConfirmRowId: (id: string | null) => void
  setBillViewInvoice: (inv: InvoiceWithJobForBillView) => void
  requestUndoPartPayment?: (row: PaymentRow) => void
  requestCheckDidNotClear?: (row: PaymentRow) => void
}

export type JobFormPaymentLineProps = {
  row: PaymentRow
  /** The bill the line sits under; null in ③ (money on no bill). */
  bill: JobsLedgerInvoiceRow | null
  /** When the payment is split across bills, the part counted toward this one. */
  sliceAmount?: number | null
  partial?: boolean
  job: JobWithDetails | null
  bankFacts: Record<string, MercuryDepositFacts>
  /** The row is saved (persisted ids only change on refetch, never mid-typing). */
  persisted: boolean
  unlinking: boolean
  actions: PaymentLineActions
  /** ③ only: what hangs under the line — the bill chips, the Stripe hand-off. */
  children?: ReactNode
}

const MENU_PANEL: CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '100%',
  marginTop: 4,
  zIndex: 20,
  minWidth: 260,
  maxWidth: 'min(320px, 86vw)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 10px 30px rgba(17, 24, 39, 0.16)',
  padding: 4,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

function menuItem(opts: { danger?: boolean; disabled?: boolean; on?: boolean } = {}): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    width: '100%',
    textAlign: 'left',
    padding: '0.4rem 0.55rem',
    border: 'none',
    background: opts.on ? 'var(--bg-subtle)' : 'transparent',
    borderRadius: 4,
    cursor: opts.disabled ? 'not-allowed' : 'pointer',
    opacity: opts.disabled ? 0.55 : 1,
    fontSize: '0.8125rem',
    font: 'inherit',
    color: opts.danger ? 'var(--text-red-600)' : 'var(--text-base)',
  }
}

const MENU_SUB: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }

/**
 * One payment, one line (v2.4288): the amount, when it came and where from, the
 * days after the bill went out, and a ⋯ menu holding the rare doors (the check
 * date, Move to job…, Unlink and remove, Undo part payment, Check didn't clear…,
 * the Stripe bill). A hand-typed row edits its boxes in a fold under the line
 * ("Edit details"); a draft row opens that fold at once. Drawn under the bill
 * it pays in the Invoices block, and in ③ for money on no bill.
 */
export function JobFormPaymentLine({ row, bill, sliceAmount, partial, job, bankFacts, persisted, unlinking, actions, children }: JobFormPaymentLineProps) {
  const { role: authRole } = useAuth()
  const bank = row.mercury_transaction_id ? bankFacts[row.mercury_transaction_id] ?? null : null
  const source = paymentSource(row, job, bank)
  const words = paymentLineWords({
    slice: { payment: row, amount: sliceAmount ?? (Number(row.amount) || 0), partial: Boolean(partial) },
    source,
    billSentYmd: bill ? billSentYmd(bill) : null,
    bank,
  })
  const readOnly = source.kind !== 'hand'
  const stripeInv = stripeBillInvoiceForPaymentRow(row, job)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState<boolean>(!readOnly && !persisted)
  const menuRef = useRef<HTMLSpanElement | null>(null)
  useCloseOnOutsideClick(menuRef, menuOpen, () => setMenuOpen(false))
  const todayYmd = todayYmdInAppTz()

  const amount = Number(row.amount) || 0
  const amountText = `$${formatCurrency(amount)}`
  const linkable = (job?.invoices ?? []).filter((i) => i.status === 'billed' && !jobsLedgerInvoiceIsStripeLinked(i))
  const moveBlock = paymentMoveBlock(row, job, persisted)
  const moveShown = moveBlock !== 'unsaved' && moveBlock !== 'stripe'
  const moveDisabled = moveBlock === 'sent-bill'
  const moveBill = moveDisabled && row.invoice_id ? (job?.invoices ?? []).find((i) => i.id === row.invoice_id) ?? null : null
  const canRemove = canRemovePaymentRowFromForm(row, job) || Boolean(job && persisted && paymentRowLinkedToInvoice(row) && !stripeInv)
  const unlinkShown = source.kind === 'bank' && canUnlinkMercuryPayment(authRole) && !mercuryUnlinkBlockedByStripeHostedInvoice(row, job)
  const undoShown = Boolean(stripeInv && row.stripe_credit_note_id && actions.requestUndoPartPayment && stripeInv.status === 'billed')
  const checkDidNotClearShown = Boolean(
    stripeInv && actions.requestCheckDidNotClear && paymentRowOffersCheckDidNotClear({ holdsReason: stripeHoldsPaymentReason(row, job), invoiceStatus: stripeInv.status }),
  )
  const canPinHere = Boolean(bill && words.countedHere && !jobsLedgerInvoiceIsStripeLinked(bill) && bill.status === 'billed')
  const closeMenu = () => setMenuOpen(false)
  const futureReceived = Boolean(row.paid_on && row.paid_on > todayYmd)

  const sub: ReactNode[] = []
  if (words.daysTone === 'before-bill') sub.push(<span key="before" className="warn">Received {words.daysText?.replace(' before the bill', '')} before the bill went out. Check the date.</span>)
  if (words.checkDated) sub.push(<span key="dated">{words.checkDated}</span>)
  if (words.detail) sub.push(<span key="detail">{words.detail}</span>)
  if (futureReceived) sub.push(<span key="future" className="warn">The received date is in the future.</span>)

  return (
    <div className="jobPaymentLine" data-testid="payment-line" data-payment-id={row.id} data-source={source.kind}>
      <div className="jobPaymentLineMain">
        <span className="amt" aria-label={`Payment amount ${formatCurrency(amount)} dollars`}>
          {partial && sliceAmount != null ? `$${formatCurrency(sliceAmount)} of ${amountText}` : amountText}
        </span>
        <span className="words">
          {words.dateText} · {sourceWords(source, bank)}
          {words.daysText && words.daysTone === 'ok' ? <span className="mut"> · {words.daysText}</span> : null}
        </span>
        {words.returned ? (
          <span className="jobPaymentChip red" data-testid={`edit-job-payment-bank-returned-${row.id}`} title="Mercury reports this deposit failed — the check did not clear. Unlink and remove takes the payment off the job and marks the deposit returned in Accounts Receivable.">
            {words.returned}
          </span>
        ) : null}
        {bill && words.countedHere ? (
          <span className="jobPaymentChip amber" title="This payment is on the job with no bill picked. The oldest open bill counts it for now.">
            no bill picked
          </span>
        ) : null}
        {canPinHere ? (
          <button type="button" className="jobPaymentLinePin" onClick={() => actions.updatePaymentRow(row.id, { invoice_id: bill!.id })} title="Apply this payment to this bill for good">
            Pin it to this bill
          </button>
        ) : null}
        {words.returned && unlinkShown ? (
          <button
            type="button"
            className="jobPaymentLineUnlink"
            disabled={unlinking}
            onClick={() => actions.setUnlinkMercuryConfirmRowId(row.id)}
            aria-label="Unlink bank deposit and remove this payment line"
            title="The bank returned this deposit. Remove the payment from the job; the deposit is marked returned in Accounts Receivable."
          >
            {unlinking ? 'Removing…' : 'Unlink and remove'}
          </button>
        ) : null}
        <span className="jobPaymentLineMenu" ref={menuRef}>
          <button
            type="button"
            className="jobPaymentLineMore"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`More for the ${amountText} payment`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
          {menuOpen ? (
            <div role="menu" aria-label={`Actions for the ${amountText} payment`} style={MENU_PANEL}>
              {!readOnly ? (
                <button type="button" role="menuitemcheckbox" aria-checked={editOpen} onClick={() => { closeMenu(); setEditOpen((v) => !v) }} style={menuItem({ on: editOpen })}>
                  <span>{editOpen ? 'Hide the boxes' : 'Edit details'}</span>
                  <span style={MENU_SUB}>amount, dates, check number, memo, which bill</span>
                </button>
              ) : null}
              {source.kind === 'bank' && !row.sent_on && bank?.postedYmd ? (
                <button type="button" role="menuitem" onClick={() => { closeMenu(); actions.updatePaymentRow(row.id, { sent_on: bank.postedYmd }) }} style={menuItem()}>
                  <span>Use the bank date as the check date</span>
                  <span style={MENU_SUB}>the bank posted it on {formatYmdMonthDay(bank.postedYmd)}</span>
                </button>
              ) : null}
              {source.kind === 'bank' ? (
                <button type="button" role="menuitemcheckbox" aria-checked={editOpen} onClick={() => { closeMenu(); setEditOpen((v) => !v) }} style={menuItem({ on: editOpen })}>
                  <span>{row.sent_on ? 'Change the check date' : 'Add the check date'}</span>
                  <span style={MENU_SUB}>the date written on the check</span>
                </button>
              ) : null}
              {canPinHere ? (
                <button type="button" role="menuitem" onClick={() => { closeMenu(); actions.updatePaymentRow(row.id, { invoice_id: bill!.id }) }} style={menuItem()}>
                  <span>Pin it to this bill</span>
                  <span style={MENU_SUB}>today the oldest open bill counts it</span>
                </button>
              ) : null}
              {stripeInv ? (
                <button type="button" role="menuitem" onClick={() => { closeMenu(); if (job) actions.setBillViewInvoice({ ...stripeInv, job }) }} style={menuItem()}>
                  View the Stripe bill
                </button>
              ) : null}
              {undoShown ? (
                <button type="button" role="menuitem" onClick={() => { closeMenu(); actions.requestUndoPartPayment?.(row) }} title="This part payment lowered the Stripe pay link by its amount. Undo voids that credit and removes the payment." style={menuItem()}>
                  <span>Undo part payment</span>
                  <span style={MENU_SUB}>voids the credit, takes the payment off</span>
                </button>
              ) : null}
              {checkDidNotClearShown ? (
                <button type="button" role="menuitem" onClick={() => { closeMenu(); actions.requestCheckDidNotClear?.(row) }} title={CHECK_DID_NOT_CLEAR_TITLE} style={menuItem({ danger: true })}>
                  {CHECK_DID_NOT_CLEAR_LABEL}
                </button>
              ) : null}
              {moveShown ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={moveDisabled}
                  aria-disabled={moveDisabled}
                  onClick={() => { if (moveDisabled) return; closeMenu(); actions.requestMovePaymentRow(row) }}
                  title={moveDisabled ? paymentMoveBlockText('sent-bill', moveBill ? Number(moveBill.amount ?? 0) : null) : 'Move this payment to the job it belongs on — it keeps its date, amount and bank link'}
                  style={menuItem({ disabled: moveDisabled })}
                >
                  <span>Move to job…</span>
                  <span style={MENU_SUB}>{moveDisabled ? paymentMoveBlockText('sent-bill', moveBill ? Number(moveBill.amount ?? 0) : null) : 'it keeps its date, amount and bank link'}</span>
                </button>
              ) : null}
              {unlinkShown ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={unlinking}
                  onClick={() => { closeMenu(); actions.setUnlinkMercuryConfirmRowId(row.id) }}
                  aria-label="Unlink bank deposit and remove this payment line"
                  title={
                    words.returned
                      ? 'The bank returned this deposit. Remove the payment from the job; the deposit is marked returned in Accounts Receivable.'
                      : unlinkLeavesStripeBillUntouched(row, job)
                        ? 'Remove this payment from the job and free the bank deposit in Accounts Receivable. Stripe never recorded it, so the bill’s pay link stays as it is.'
                        : 'Remove this payment from the job and free the bank deposit in Accounts Receivable'
                  }
                  style={menuItem({ danger: true, disabled: unlinking })}
                >
                  <span>{unlinking ? 'Removing…' : 'Unlink and remove'}</span>
                  <span style={MENU_SUB}>takes it off the job; the deposit is free again in Accounts Receivable</span>
                </button>
              ) : null}
              {!readOnly ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canRemove}
                  aria-disabled={!canRemove}
                  aria-label="Remove payment row"
                  onClick={() => { if (!canRemove) return; closeMenu(); actions.requestRemovePaymentRow(row) }}
                  style={menuItem({ danger: true, disabled: !canRemove })}
                >
                  <span>Remove</span>
                  <span style={MENU_SUB}>{canRemove ? 'takes the payment off the job' : 'this row is held by its bill'}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </span>
      </div>
      {sub.length > 0 ? (
        <div className="jobPaymentLineSub">
          {sub.map((s, i) => (
            <span key={i}>{i > 0 ? ' · ' : ''}{s}</span>
          ))}
        </div>
      ) : null}
      {editOpen && source.kind === 'bank' ? (
        <div className="jobPaymentLineEdit">
          <label>
            Check date
            <FinishedDateInput
              id={`edit-job-payment-sent-${row.id}`}
              value={row.sent_on ?? null}
              onCommit={(v) => actions.updatePaymentRow(row.id, { sent_on: v })}
              aria-label="Payment sent date"
              title="The date written on the check. Optional."
            />
          </label>
        </div>
      ) : null}
      {editOpen && !readOnly ? (
        <div className="jobPaymentLineEdit" id={`edit-job-payment-details-${row.id}`}>
          <label>
            Amount
            <span className="jobPaymentLineAmountBox">
              <span aria-hidden>$</span>
              <MoneyDecimalAmountInput
                value={row.amount}
                onChange={(next) => {
                  // First real amount on an unlinked row: default the bill when the job has exactly one open plain bill (v2.2240).
                  const becomingReal = Number(next) > 0 && !(Number(row.amount) > 0)
                  const auto = becomingReal && !row.invoice_id ? autoApplyInvoiceId(job?.invoices ?? []) : null
                  actions.updatePaymentRow(row.id, auto ? { amount: next, invoice_id: auto } : { amount: next })
                }}
                commitOnType
                placeholder="0"
                aria-label="Payment amount"
              />
            </span>
          </label>
          <label>
            Received
            <FinishedDateInput
              id={`edit-job-payment-date-${row.id}`}
              value={row.paid_on ?? null}
              onCommit={(v) => actions.updatePaymentRow(row.id, { paid_on: v })}
              aria-label="Payment date"
              style={futureReceived ? { borderColor: 'var(--border-amber)' } : undefined}
            />
          </label>
          <label>
            Check date
            <FinishedDateInput
              id={`edit-job-payment-sent-${row.id}`}
              value={row.sent_on ?? null}
              onCommit={(v) => actions.updatePaymentRow(row.id, { sent_on: v })}
              aria-label="Payment sent date"
              title="The date written on the check. Optional."
            />
          </label>
          <label>
            Type
            <input
              id={`edit-job-payment-type-${row.id}`}
              type="text"
              value={row.payment_type ?? ''}
              onChange={(e) => actions.updatePaymentRow(row.id, { payment_type: e.target.value === '' ? null : e.target.value })}
              placeholder="check, cash, card"
              aria-label="Payment type"
            />
          </label>
          <label>
            Check number or ref
            <input
              id={`edit-job-payment-ref-${row.id}`}
              type="text"
              value={row.reference_number ?? ''}
              onChange={(e) => actions.updatePaymentRow(row.id, { reference_number: e.target.value === '' ? null : e.target.value })}
              placeholder="Optional"
              aria-label="Payment reference"
            />
          </label>
          <label className={linkable.length > 0 ? '' : 'wide'}>
            Memo
            <input
              id={`edit-job-payment-note-${row.id}`}
              type="text"
              value={row.note ?? ''}
              onChange={(e) => actions.updatePaymentRow(row.id, { note: e.target.value === '' ? null : e.target.value })}
              placeholder="Optional"
              aria-label="Payment memo"
            />
          </label>
          {linkable.length > 0 ? (
            <label>
              Pays
              <select
                id={`edit-job-payment-invoice-${row.id}`}
                value={row.invoice_id ?? ''}
                onChange={(e) => actions.updatePaymentRow(row.id, { invoice_id: e.target.value === '' ? null : e.target.value })}
                aria-label="Apply this payment to a specific invoice"
                title="Attach this payment to a billed invoice so it pays that bill down; leave as Job (no bill picked) for a general job payment."
              >
                <option value="">Job (no bill picked)</option>
                {linkable.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {`$${formatCurrency(Number(inv.amount ?? 0))} bill${inv.sent_to_customer_at ? ` · sent ${String(inv.sent_to_customer_at).slice(0, 10)}` : ''}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
