import { useCallback, useEffect, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsLedgerInvoiceRow, PaymentRow } from '../../lib/jobs/jobFormTypes'
import { formatCurrency, formatPaymentDateForDisplay } from '../../lib/jobs/jobFormMoney'
import { mercuryLinkedPaymentRow, stripeBillInvoiceForPaymentRow } from '../../lib/jobs/jobFormPaymentPredicates'
import { jobPaymentTraceLines } from '../../lib/jobs/jobPaymentMove'
import { useJobPaymentTrace } from '../../hooks/useJobPaymentTrace'
import { openStripeBills, paymentRowNeedsInvoiceLink } from '../../lib/jobs/paymentInvoiceLinking'
import { billChoicesForPayment } from '../../lib/jobs/paymentBillMatching'
import { splitBillsAndPayments, type MercuryDepositFacts } from '../../lib/jobs/billsAndPayments'
import { JobFormPaymentLine, type PaymentLineActions } from './JobFormPaymentLine'
import type { InvoiceWithJobForBillView } from './BilledBillViewModal'

/**
 * Tappable bill choices for an unapplied payment (v2.2570) — one tap applies.
 * A bill whose open balance equals the payment gets the green "matches"
 * treatment and sorts first (highlight only; applying always takes the tap).
 */
function BillApplyChips({
  payment,
  editing,
  payments,
  onApply,
}: {
  payment: PaymentRow
  editing: JobWithDetails | null
  payments: PaymentRow[]
  onApply: (invoiceId: string) => void
}) {
  const choices = billChoicesForPayment(payment, editing?.invoices ?? [], payments)
  if (choices.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'stretch', marginTop: '0.35rem' }}>
      {choices.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onApply(c.id)}
          title={`Apply this payment to the $${formatCurrency(c.amount)} bill`}
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 1,
            padding: '0.3rem 0.6rem',
            borderRadius: 8,
            cursor: 'pointer',
            border: c.matchesAmount ? '1px solid var(--border-green)' : '1px solid var(--border-amber)',
            background: c.matchesAmount ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)',
            textAlign: 'left',
            lineHeight: 1.3,
            font: 'inherit',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
            ${formatCurrency(c.amount)} bill{c.sentYmd ? ` · sent ${formatPaymentDateForDisplay(c.sentYmd)}` : ''}
          </span>
          <span style={{ fontSize: '0.66rem', color: c.matchesAmount ? 'var(--text-green-700)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {c.remaining < 0
              ? `over-applied by $${formatCurrency(Math.abs(c.remaining))}`
              : `$${formatCurrency(c.remaining)} left${c.matchesAmount ? ' · matches this payment' : ''}`}
          </span>
        </button>
      ))}
    </div>
  )
}

type JobFormPaymentsTableProps = {
  editing: JobWithDetails | null
  payments: PaymentRow[]
  persistedLedgerPaymentIds: Set<string>
  unlinkingMercuryPaymentId: string | null
  /** What the bank synced about the deposits behind bank-linked rows (`useMercuryDepositFacts`). */
  bankFacts?: Record<string, MercuryDepositFacts>
  updatePaymentRow: (id: string, updates: Partial<PaymentRow>) => void
  addPaymentRow: () => void
  requestRemovePaymentRow: (row: PaymentRow) => void
  /** v2.3576: Move to job… on a saved row no sent bill has counted. */
  requestMovePaymentRow: (row: PaymentRow) => void
  setUnlinkMercuryConfirmRowId: (id: string | null) => void
  setBillViewInvoice: (inv: InvoiceWithJobForBillView) => void
  /**
   * v2.3692: the hand-off from a hand-typed row to the Record a cash or check
   * payment window for an open Stripe bill. The host opens the window with
   * the typed amount and drops the draft row once Stripe has recorded it.
   */
  onRecordPaymentOnBill?: (inv: JobsLedgerInvoiceRow, opts: { amount: number; draftRowId: string }) => void
  /**
   * v2.3695: Undo part payment on a locked Stripe row that carries a credit
   * note id — the host opens the undo window (voids the note, removes the row).
   */
  requestUndoPartPayment?: (row: PaymentRow) => void
  /**
   * v2.4082: "Check didn't clear…" on a locked row Stripe holds as a whole-bill
   * out-of-band mark (Mark Paid · check) while the bill is still Paid — the
   * host opens Undo out-of-band payment with the send-back on, so the mark is
   * reversed in Stripe, the payment comes off and the job can be billed again.
   */
  requestCheckDidNotClear?: (row: PaymentRow) => void
}

/**
 * ③ in the Edit-Job billing section. Since v2.4288 a payment that pays a bill
 * is drawn under that bill in the Invoices block above, so this block holds
 * the rest — money on no bill, a payment linked to a bill not listed, and
 * rows still being typed — plus the entry flow for a cash or check payment,
 * the bill-apply chips for money the office still has to place, and the grey
 * trace lines (what left this job and what arrived). Every row is one
 * `JobFormPaymentLine`; the host's doors come in as props.
 */
export function JobFormPaymentsTable({
  editing,
  payments,
  persistedLedgerPaymentIds,
  unlinkingMercuryPaymentId,
  bankFacts,
  updatePaymentRow,
  addPaymentRow,
  requestRemovePaymentRow,
  requestMovePaymentRow,
  setUnlinkMercuryConfirmRowId,
  setBillViewInvoice,
  onRecordPaymentOnBill,
  requestUndoPartPayment,
  requestCheckDidNotClear,
}: JobFormPaymentsTableProps) {
  // v2.3576: the grey trace lines under the list — what left this job and what arrived.
  const trace = useJobPaymentTrace(editing?.id ?? null, editing)
  const traceLines = editing ? jobPaymentTraceLines(trace.events, editing.id, trace.labelFor, (n) => `$${formatCurrency(n)}`) : []
  const actions: PaymentLineActions = {
    updatePaymentRow,
    requestRemovePaymentRow,
    requestMovePaymentRow,
    setUnlinkMercuryConfirmRowId,
    setBillViewInvoice,
    requestUndoPartPayment,
    requestCheckDidNotClear,
  }

  // Consolidated start: blank manual draft rows (the seeded empty row) stay
  // hidden behind a "Record a cash or check payment" button until the user
  // asks for one — recorded payments and locked (Stripe/Mercury) rows always show.
  const [manualEntryOpen, setManualEntryOpen] = useState(false)
  const [explainerOpen, setExplainerOpen] = useState(false)
  // A+C (v2.2570): "Keep as job payment" collapses a row's bill chips for this
  // session only — the payment stays unapplied and flagged on the next open.
  const [keepAsJobById, setKeepAsJobById] = useState<Record<string, boolean>>({})
  const [matchPanelOpen, setMatchPanelOpen] = useState(false)
  useEffect(() => {
    setManualEntryOpen(false)
    setExplainerOpen(false)
    setKeepAsJobById({})
    setMatchPanelOpen(false)
  }, [editing?.id])
  const isBlankManualRow = useCallback(
    // paid_on is deliberately NOT part of blankness: newEmptyPaymentRow() seeds
    // today's date, and a date with no amount isn't a recordable payment (the
    // save path only persists rows with amount > 0).
    (row: PaymentRow) =>
      !persistedLedgerPaymentIds.has(row.id) &&
      !stripeBillInvoiceForPaymentRow(row, editing) &&
      !mercuryLinkedPaymentRow(row) &&
      !(Number(row.amount) > 0) &&
      !(row.note ?? '').trim() &&
      !(row.payment_type ?? '').trim() &&
      !(row.reference_number ?? '').trim() &&
      !row.invoice_id,
    [editing, persistedLedgerPaymentIds],
  )
  // The rows this block draws: money no listed bill counts, and rows still being typed.
  const invoices = editing?.invoices ?? []
  const split = splitBillsAndPayments(invoices, payments, persistedLedgerPaymentIds)
  const placedCount = payments.length - split.onNoBill.length
  const visiblePayments = manualEntryOpen ? split.onNoBill : split.onNoBill.filter((r) => !isBlankManualRow(r))
  const openManualEntry = () => {
    if (!payments.some((r) => isBlankManualRow(r))) addPaymentRow()
    setManualEntryOpen(true)
  }

  // The rows the office still has to place. Two or more moves the explanation
  // up into the section-level match bar and shrinks each row's warning to a
  // compact chip, so a legacy backlog doesn't drown the list in amber.
  const unappliedPayments = visiblePayments.filter(
    (r) =>
      !stripeBillInvoiceForPaymentRow(r, editing) &&
      !mercuryLinkedPaymentRow(r) &&
      paymentRowNeedsInvoiceLink(r, invoices),
  )
  const showMatchBar = unappliedPayments.length >= 2
  // v2.3692: open Stripe bills take no hand-typed row (the row would render
  // Stripe-locked on its first keystroke — job 1022). A real unlinked row on
  // such a job gets the hand-off note instead of a bill chip.
  const stripeHandoffBills = openStripeBills(invoices)
  const hasBillsAbove = invoices.some((i) => i.status === 'billed' || i.status === 'paid')
  const heading = hasBillsAbove ? '③ Other money on the job' : '③ Payments received'

  return (
    /* marginTop: the air above ③ matches the address → ① Line Items rhythm
       (owner call, v2.1708). Must exceed the invoices block's 1rem bottom
       margin — block-flow margin collapse eats anything smaller. */
    <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', margin: '0 0 0.4rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 400, textDecoration: 'underline', color: 'var(--text-700)' }}>{heading}</h4>
        <button
          type="button"
          onClick={() => setExplainerOpen((v) => !v)}
          aria-expanded={explainerOpen}
          style={{
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-link)',
            fontSize: '0.6875rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          ⓘ How payments update
        </button>
      </div>
      {explainerOpen && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
          A payment that pays a bill shows under that bill above. This is the rest: money on the job with no bill, and a payment still being typed. Updates automatically when the customer pays through Stripe. A bill that went out through Stripe records cash and checks through Stripe too — use <b>Record payment</b> on the bill, and the payment shows under it.
        </div>
      )}
      {showMatchBar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            flexWrap: 'wrap',
            background: 'var(--bg-amber-tint)',
            border: '1px solid var(--border-amber)',
            borderRadius: 8,
            padding: '0.5rem 0.75rem',
            margin: '0 0 0.5rem',
            fontSize: '0.8125rem',
            color: 'var(--text-amber-800)',
          }}
        >
          <span>
            ⚠ {unappliedPayments.length} payments aren&rsquo;t applied to a bill — they don&rsquo;t count toward pay
            speed yet.
          </span>
          <button
            type="button"
            onClick={() => setMatchPanelOpen((v) => !v)}
            aria-expanded={matchPanelOpen}
            style={{
              marginLeft: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border-amber)',
              color: 'var(--text-amber-800)',
              borderRadius: 6,
              padding: '0.25rem 0.65rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {matchPanelOpen ? 'Close' : 'Match payments…'}
          </button>
        </div>
      )}
      {showMatchBar && matchPanelOpen && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.25rem 0.75rem',
            margin: '0 0 0.6rem',
            background: 'var(--surface)',
          }}
        >
          {unappliedPayments.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                flexWrap: 'wrap',
                padding: '0.5rem 0',
                borderBottom: i < unappliedPayments.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ minWidth: '6.5rem' }}>
                <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem', color: 'var(--text-strong)' }}>
                  ${formatCurrency(Number(p.amount) || 0)}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  received {formatPaymentDateForDisplay(p.paid_on)}
                </div>
              </div>
              <BillApplyChips
                payment={p}
                editing={editing}
                payments={payments}
                onApply={(invoiceId) => updatePaymentRow(p.id, { invoice_id: invoiceId })}
              />
            </div>
          ))}
        </div>
      )}
      {visiblePayments.length === 0 && placedCount > 0 && !manualEntryOpen ? (
        <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }} data-testid="payments-all-under-bills">
          Every payment on this job sits under a bill above.
        </div>
      ) : null}
      {visiblePayments.length > 0 && (
        <div className="jobPaymentsList" data-testid="payments-on-no-bill">
          {visiblePayments.map((row) => {
            const locked = Boolean(stripeBillInvoiceForPaymentRow(row, editing)) || mercuryLinkedPaymentRow(row)
            const needsInvoiceLink = !locked && paymentRowNeedsInvoiceLink(row, invoices)
            const stripeHandoff = !locked && !row.invoice_id && Number(row.amount) > 0 && stripeHandoffBills.length > 0
            return (
              <JobFormPaymentLine
                key={row.id}
                row={row}
                bill={null}
                job={editing}
                bankFacts={bankFacts ?? {}}
                persisted={persistedLedgerPaymentIds.has(row.id)}
                unlinking={unlinkingMercuryPaymentId === row.id}
                actions={actions}
              >
                {needsInvoiceLink &&
                  (showMatchBar || keepAsJobById[row.id] ? (
                    /* The match bar (or a deliberate "keep") carries the
                       explanation — the row shrinks to a compact chip. */
                    <div style={{ marginTop: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() =>
                          showMatchBar
                            ? setMatchPanelOpen(true)
                            : setKeepAsJobById((prev) => ({ ...prev, [row.id]: false }))
                        }
                        title="This payment isn't applied to a bill yet — click to pick one"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          border: '1px solid var(--border-amber)',
                          background: 'var(--bg-amber-tint)',
                          color: 'var(--text-amber-800)',
                          borderRadius: 999,
                          padding: '0.15rem 0.55rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          font: 'inherit',
                        }}
                      >
                        ⚠ Not applied — pick bill
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.25rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                        ⚠ Which bill does this ${formatCurrency(Number(row.amount) || 0)} pay? It won&rsquo;t count
                        toward the customer&rsquo;s pay speed until it&rsquo;s applied.
                      </div>
                      <BillApplyChips
                        payment={row}
                        editing={editing}
                        payments={payments}
                        onApply={(invoiceId) => updatePaymentRow(row.id, { invoice_id: invoiceId })}
                      />
                      <div style={{ marginTop: '0.3rem' }}>
                        <button
                          type="button"
                          onClick={() => setKeepAsJobById((prev) => ({ ...prev, [row.id]: true }))}
                          title="Leave this as a general job payment (it stays flagged until it's applied to a bill)"
                          style={{
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            font: 'inherit',
                            fontSize: '0.72rem',
                            color: 'var(--text-link)',
                            cursor: 'pointer',
                          }}
                        >
                          Keep as job payment
                        </button>
                      </div>
                    </div>
                  ))}
                {stripeHandoff
                  ? stripeHandoffBills.map((inv) => (
                      <div key={inv.id} style={{ marginTop: '0.35rem' }} data-testid="stripe-handoff-note">
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                          ⚠ The ${formatCurrency(Number(inv.amount ?? 0))} bill went out through Stripe. Record the payment on the bill so
                          Stripe knows it was paid — this row can&rsquo;t be applied to it.
                        </div>
                        {onRecordPaymentOnBill ? (
                          <button
                            type="button"
                            onClick={() => onRecordPaymentOnBill(inv, { amount: Number(row.amount) || 0, draftRowId: row.id })}
                            title="Opens Record a cash or check payment for this bill with the amount you typed; this row is dropped once Stripe has recorded it"
                            style={{
                              marginTop: '0.3rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              border: '1px solid var(--border-amber)',
                              background: 'var(--surface)',
                              color: 'var(--text-amber-800)',
                              borderRadius: 6,
                              padding: '0.25rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              font: 'inherit',
                            }}
                          >
                            Record on the ${formatCurrency(Number(inv.amount ?? 0))} bill →
                          </button>
                        ) : null}
                      </div>
                    ))
                  : null}
              </JobFormPaymentLine>
            )
          })}
        </div>
      )}
      {traceLines.length > 0 ? (
        <div style={{ margin: '0.35rem 0 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {traceLines.map((l) => (
            <div key={l.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }} title="From the job's payment trace (jobs_ledger_payment_events)">
              {l.direction === 'out' ? '↗ ' : '↙ '}{l.text}
            </div>
          ))}
        </div>
      ) : null}
      {manualEntryOpen && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={addPaymentRow}
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
        </div>
      )}
      {!manualEntryOpen && (
        /* Left-aligned like the section's other controls (owner call, v2.1691). */
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginTop: visiblePayments.length > 0 ? '0.5rem' : 0,
          }}
        >
          <button
            type="button"
            onClick={openManualEntry}
            style={{
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
            + Record a cash or check payment
          </button>
        </div>
      )}
    </div>
  )
}
