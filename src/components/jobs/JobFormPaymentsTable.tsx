import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
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
import { autoApplyInvoiceId, paymentDateBeforeBilled, paymentRowNeedsInvoiceLink } from '../../lib/jobs/paymentInvoiceLinking'
import { billChoicesForPayment } from '../../lib/jobs/paymentBillMatching'
import type { InvoiceWithJobForBillView } from './BilledBillViewModal'

const DATE_MINI_LABEL_STYLE: CSSProperties = {
  fontSize: '0.58rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const DATE_MINI_INPUT_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  padding: '0.375rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: '0.875rem',
}

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

/** Pencil toggle for a manual row's folded Type/Ref/Memo details (v2.1223). */
function PaymentDetailsToggle({ open, onToggle, controlsId }: { open: boolean; onToggle: () => void; controlsId: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controlsId}
      title="Payment details (type, ref, memo)"
      aria-label="Toggle payment details"
      style={{
        padding: '0.35rem',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        color: open ? 'var(--text-blue-500)' : 'var(--text-link)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  )
}

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
  updatePaymentRow: (id: string, updates: Partial<PaymentRow>) => void
  addPaymentRow: () => void
  requestRemovePaymentRow: (row: PaymentRow) => void
  setUnlinkMercuryConfirmRowId: (id: string | null) => void
  setBillViewInvoice: (inv: InvoiceWithJobForBillView) => void
}

/**
 * The ③ "Payments received" table in the Edit-Job billing section — one row per
 * payment (date + amount + memo sub-row), with Stripe- and Mercury-locked rows
 * read-only, per-row remove/unlink, a centered add (+) below the table while a
 * manual line is open, and the Phase-2b "Applies to" invoice selector on manual
 * rows. Extracted verbatim from JobFormModal; self-sources auth/toast, takes the
 * job + payments + the row mutators and a couple of setters as props.
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

  // Sent-vs-received (v2.2303): bank-linked rows can offer the Mercury
  // posting date as a one-tap Sent fill; fail-soft if the read is refused.
  const [mercuryPostedById, setMercuryPostedById] = useState<Record<string, string>>({})
  const mercuryIdsKey = payments
    .map((r) => r.mercury_transaction_id)
    .filter(Boolean)
    .sort()
    .join(',')
  useEffect(() => {
    const ids = mercuryIdsKey ? mercuryIdsKey.split(',') : []
    if (ids.length === 0) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('mercury_transactions').select('id, posted_at').in('id', ids)
      if (cancelled || !data) return
      const m: Record<string, string> = {}
      for (const t of data) if (t.posted_at) m[t.id] = String(t.posted_at).slice(0, 10)
      setMercuryPostedById(m)
    })()
    return () => {
      cancelled = true
    }
  }, [mercuryIdsKey])
  const todayYmdLocal = new Date().toLocaleDateString('en-CA')

  // Consolidated start: blank manual draft rows (the seeded empty row) stay
  // hidden behind a "Record non-Stripe payment received" button until the user
  // asks for one — recorded payments and locked (Stripe/Mercury) rows always show.
  const [manualEntryOpen, setManualEntryOpen] = useState(false)
  // Compact layout (v2.1223): the explainer sentence hides behind the ⓘ toggle,
  // and each row's Type/Ref/Memo inputs fold into a one-line summary. A row is
  // open when explicitly toggled, or by default while it is an unsaved manual
  // draft (so the record-a-payment flow still shows its fields immediately —
  // persistedLedgerPaymentIds only changes on refetch, never mid-typing).
  const [explainerOpen, setExplainerOpen] = useState(false)
  const [detailsOpenById, setDetailsOpenById] = useState<Record<string, boolean>>({})
  // A+C (v2.2570): "Keep as job payment" collapses a row's bill chips for this
  // session only — the payment stays unapplied and flagged on the next open.
  const [keepAsJobById, setKeepAsJobById] = useState<Record<string, boolean>>({})
  const [matchPanelOpen, setMatchPanelOpen] = useState(false)
  useEffect(() => {
    setManualEntryOpen(false)
    setExplainerOpen(false)
    setDetailsOpenById({})
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
  const visiblePayments = manualEntryOpen ? payments : payments.filter((r) => !isBlankManualRow(r))
  const openManualEntry = () => {
    if (!payments.some((r) => isBlankManualRow(r))) addPaymentRow()
    setManualEntryOpen(true)
  }

  // The rows the office still has to place. Two or more moves the explanation
  // up into the section-level match bar and shrinks each row's warning to a
  // compact chip, so a legacy backlog doesn't drown the table in amber.
  const unappliedPayments = visiblePayments.filter(
    (r) =>
      !stripeBillInvoiceForPaymentRow(r, editing) &&
      !mercuryLinkedPaymentRow(r) &&
      paymentRowNeedsInvoiceLink(r, editing?.invoices ?? []),
  )
  const showMatchBar = unappliedPayments.length >= 2

  return (
    /* marginTop: the air above ③ matches the address → ① Line Items rhythm
       (owner call, v2.1708). Must exceed the invoices block's 1rem bottom
       margin — block-flow margin collapse eats anything smaller. */
    <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', margin: '0 0 0.4rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 400, textDecoration: 'underline', color: 'var(--text-700)' }}>③ Payments received</h4>
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
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>Money collected on the job. Updates automatically when customer pays through Stripe.</div>
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
        {/* No header band (v2.1223) — the date picker and the $-prefixed amount
            group self-label, matching the ① Line Items input groups. */}
        <tbody>
          {visiblePayments.map((row, idx) => {
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
            // Unsaved manual drafts open by default (the entry flow); saved rows
            // fold to a summary until the pencil toggles them.
            const detailsOpen =
              detailsOpenById[row.id] ?? (!paymentReadOnly && !persistedLedgerPaymentIds.has(row.id))
            const appliedInvoice = row.invoice_id
              ? (editing?.invoices ?? []).find((i) => i.id === row.invoice_id) ?? null
              : null
            const detailsSummaryText = [
              ptTrim,
              refTrim ? `ref ${refTrim}` : '',
              noteTrim,
              row.invoice_id
                ? appliedInvoice
                  ? `✓ pays the $${formatCurrency(Number(appliedInvoice.amount ?? 0))} bill${
                      appliedInvoice.sent_to_customer_at
                        ? ` · sent ${formatPaymentDateForDisplay(String(appliedInvoice.sent_to_customer_at).slice(0, 10))}`
                        : ''
                    }`
                  : '✓ pays a bill'
                : '',
            ]
              .filter(Boolean)
              .join(' · ')
            // Linking hygiene flags (v2.2240): an unlinked real payment on a
            // job with open bills, and a paid date earlier than the linked
            // bill's date. Locked rows manage their own links.
            const needsInvoiceLink = !paymentReadOnly && paymentRowNeedsInvoiceLink(row, editing?.invoices ?? [])
            const paidBeforeBilled = !paymentReadOnly && paymentDateBeforeBilled(row, editing?.invoices ?? [])
            const hasMemoSubRow = paymentReadOnly
              ? noteTrim.length > 0 || ptTrim.length > 0 || refTrim.length > 0
              : detailsOpen || detailsSummaryText.length > 0 || needsInvoiceLink || paidBeforeBilled
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
                    {/* Sent before Received (v2.2303, owner-approved mockup):
                        Sent = the date on the check, optional and editable even
                        on locked rows; Received keeps its lock rules and stays
                        the pay-speed clock. */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 45%', minWidth: 96 }}>
                        <span style={DATE_MINI_LABEL_STYLE}>Sent</span>
                        <input
                          id={`edit-job-payment-sent-${row.id}`}
                          type="date"
                          value={row.sent_on ?? ''}
                          onChange={(e) => updatePaymentRow(row.id, { sent_on: e.target.value ? e.target.value : null })}
                          aria-label="Payment sent date"
                          title="The date the payment was sent — the date on the check. Optional."
                          style={DATE_MINI_INPUT_STYLE}
                        />
                        {!row.sent_on && row.mercury_transaction_id && mercuryPostedById[row.mercury_transaction_id] ? (
                          <button
                            type="button"
                            onClick={() =>
                              updatePaymentRow(row.id, { sent_on: mercuryPostedById[row.mercury_transaction_id!] ?? null })
                            }
                            title="Use the bank's posting date as the sent date"
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: 'var(--text-link)',
                            }}
                          >
                            bank {formatPaymentDateForDisplay(mercuryPostedById[row.mercury_transaction_id] ?? null)} →
                          </button>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 45%', minWidth: 96 }}>
                        <span style={DATE_MINI_LABEL_STYLE}>Received</span>
                        {stripePaymentLocked ? (
                          <span
                            style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums', padding: '0.375rem 0' }}
                            title="Recorded from the Stripe invoice."
                            aria-label={`Payment date ${formatPaymentDateForDisplay(row.paid_on)}`}
                          >
                            {formatPaymentDateForDisplay(row.paid_on)}
                          </span>
                        ) : mercuryPaymentLocked ? (
                          <span
                            style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums', padding: '0.375rem 0' }}
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
                              ...DATE_MINI_INPUT_STYLE,
                              ...(row.paid_on && row.paid_on > todayYmdLocal ? { borderColor: '#d97706' } : {}),
                            }}
                          />
                        )}
                        {row.paid_on && row.paid_on > todayYmdLocal ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                            ⚠ received date is in the future
                          </span>
                        ) : null}
                      </div>
                    </div>
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
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 6,
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0 0.3rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-subtle)',
                            borderRight: '1px solid var(--border)',
                          }}
                        >
                          $
                        </span>
                        <MoneyDecimalAmountInput
                          value={row.amount}
                          onChange={(amount) => {
                            // First real amount on an unlinked row: default the
                            // Applies-to link when the job has exactly one open
                            // bill (v2.2240) — visible in the selector, still
                            // changeable back to Job (unassigned).
                            const becomingReal = Number(amount) > 0 && !(Number(row.amount) > 0)
                            const autoInvoiceId =
                              becomingReal && !row.invoice_id ? autoApplyInvoiceId(editing?.invoices ?? []) : null
                            updatePaymentRow(row.id, autoInvoiceId ? { amount, invoice_id: autoInvoiceId } : { amount })
                          }}
                          commitOnType
                          placeholder="0"
                          aria-label="Payment amount"
                          style={{
                            flex: 1,
                            width: '100%',
                            minWidth: 0,
                            boxSizing: 'border-box',
                            padding: '0.375rem 0.5rem',
                            border: 'none',
                            borderRadius: 0,
                            fontSize: '0.875rem',
                            textAlign: 'right',
                            background: 'transparent',
                          }}
                        />
                      </span>
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
                    ) : mercuryPaymentLocked ? null : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <PaymentDetailsToggle
                          open={detailsOpen}
                          onToggle={() => setDetailsOpenById((prev) => ({ ...prev, [row.id]: !detailsOpen }))}
                          controlsId={`edit-job-payment-details-${row.id}`}
                        />
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
                      </span>
                    )}
                  </td>
                </tr>
                {hasMemoSubRow ? (
                  <tr style={{ borderBottom: rowSep }}>
                    <td
                      colSpan={3}
                      style={
                        !paymentReadOnly && detailsOpen
                          ? PAYMENT_MEMO_SUB_ROW_CELL_STYLE
                          : { ...PAYMENT_MEMO_SUB_ROW_CELL_STYLE, paddingLeft: '0.75rem', paddingBottom: '0.4rem' }
                      }
                    >
                      {paymentReadOnly ? (
                        /* Locked rows compact to one wrapping line (v2.1223) — the
                           same type / copyable ref / memo, without the stacked block. */
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '0.75rem', rowGap: '0.15rem', color: 'var(--text-700)' }}>
                          {ptTrim ? <span>{ptTrim}</span> : null}
                          {refTrim ? (
                            <span>
                              <span style={{ color: 'var(--text-600)' }}>ref </span>
                              <ReadOnlyPaymentRefCopy refText={refTrim} showToast={showToast} />
                            </span>
                          ) : null}
                          {noteTrim ? <span>{noteTrim}</span> : null}
                        </div>
                      ) : !detailsOpen ? (
                        <button
                          type="button"
                          onClick={() => setDetailsOpenById((prev) => ({ ...prev, [row.id]: true }))}
                          title="Edit payment details (type, ref, memo)"
                          aria-label="Edit payment details"
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            font: 'inherit',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {detailsSummaryText}
                        </button>
                      ) : (
                        <div
                          id={`edit-job-payment-details-${row.id}`}
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
                      {paidBeforeBilled && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-red-600)', marginTop: '0.25rem' }}>
                          ⚠ Paid date is earlier than this bill’s billed date — money can’t arrive before the bill goes
                          out. Double-check the date.
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      </div>
      )}
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
            + Record non-Stripe payment received
          </button>
        </div>
      )}
    </div>
  )
}
