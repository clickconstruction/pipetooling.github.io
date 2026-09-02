import { useMemo, useState } from 'react'
import type { StageRow } from '../../lib/jobsStagesBoard'
import {
  billedBreakdownTotal,
  buildBilledByCustomerBreakdown,
  type BilledBreakdownBill,
} from '../../lib/jobs/billedByCustomerBreakdown'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatCurrency } from '../../lib/format'
import { stripTrailingZip } from '../../lib/displayAddress'
import ViewBillWithPdfTail from './ViewBillWithPdfTail'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'
import PhysicalInvoiceResendButton from './PhysicalInvoiceResendButton'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import { addPaymentChaseTouch } from '../../lib/jobs/paymentChaseIo'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import type { UserRole } from '../../hooks/useAuth'

/**
 * WAITING ON CUSTOMERS → "Who owes what" (v2.1929): the Billed Awaiting
 * Payment rows regrouped per customer — total owed, bill count, worst age —
 * expandable to the individual bills, each rendered as a card (mockup-approved
 * "Option C") with the job address, the bill's scoped line items, and
 * View on board → jump to that row. Same modal frame as the Capable of Being
 * Billed breakdown.
 */
export default function BilledByCustomerBreakdownModal({
  rows,
  loading,
  canSeeCharts,
  authRole,
  onClose,
  onOpenBill,
  onOpenAgingChart,
  onShow90,
  onGoToBilled,
}: {
  rows: StageRow[]
  /** True while any non-paid scope is still fetching — totals can still grow. */
  loading?: boolean
  canSeeCharts: boolean
  /** Gates the Stripe resend mode (dev may use test mode) — PaymentChaseModal pattern. */
  authRole: UserRole | null
  onClose: () => void
  /** Jump the board to this bill (invoice row when invoiceId set, else the job shell row). */
  onOpenBill: (bill: BilledBreakdownBill) => void
  onOpenAgingChart: () => void
  onShow90: () => void
  onGoToBilled: () => void
}) {
  const groups = useMemo(() => buildBilledByCustomerBreakdown(rows), [rows])
  const total = billedBreakdownTotal(groups)
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())
  const cellStyle: React.CSSProperties = { padding: '0.5rem 0.75rem' }

  function ageChip(days: number | null, handSet = false) {
    if (days == null) return <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>no bill line</span>
    const style: React.CSSProperties = {
      fontSize: '0.75rem',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      padding: '0.05rem 0.4rem',
      borderRadius: 9999,
      whiteSpace: 'nowrap',
      // Transparent base border keeps all chips the same height; the neutral
      // chip needs a visible one — its bg matches the sub-row/card surfaces
      // it sits on, so without a border the pill disappears (v2.1929 nit).
      border: '1px solid transparent',
      ...(days >= 90
        ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
        : days >= 30
          ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
          : { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }),
    }
    // The dot marks an age counted from a hand-set est. bill date (a correction)
    // rather than the billed date the app stamped — see stageRowBilledAgeReference.
    return (
      <span
        style={style}
        title={handSet ? `${days} days — from the hand-set est. bill date` : `${days} days since billed`}
        aria-label={handSet ? `${days} days, hand-set bill date` : `${days} days`}
      >
        {days}d{handSet ? <span aria-hidden style={{ marginLeft: 3, opacity: 0.7 }}>·</span> : null}
      </span>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Waiting on Customers — Who owes what"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
    >
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(720px, calc(100vw - 2rem))', maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Waiting on Customers — Who owes what</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Open bills in Billed Awaiting Payment, grouped by customer. Click a customer to see their bills — oldest first.
        </p>
        {loading ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} role="status" aria-busy>
            Loading the whole board — totals can still grow…
          </p>
        ) : null}
        {groups.length === 0 ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No open bills — nothing is waiting on customers.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...cellStyle, textAlign: 'left' }}>Customer</th>
                <th style={{ ...cellStyle, textAlign: 'center' }}>Bills</th>
                <th style={{ ...cellStyle, textAlign: 'center' }}>Oldest</th>
                <th style={{ ...cellStyle, textAlign: 'right' }}>Owed</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const open = openKeys.has(g.key)
                return (
                  <FragmentRows
                    key={g.key}
                    open={open}
                    onToggle={() =>
                      setOpenKeys((prev) => {
                        const next = new Set(prev)
                        if (next.has(g.key)) next.delete(g.key)
                        else next.add(g.key)
                        return next
                      })
                    }
                    group={g}
                    ageChip={ageChip}
                    cellStyle={cellStyle}
                    onOpenBill={onOpenBill}
                    authRole={authRole}
                  />
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                <td colSpan={3} style={cellStyle}>Total</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{formatUsdNoCents(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onGoToBilled}
            style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            take me to Billed Awaiting Payment
          </button>
          <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canSeeCharts && (
              <button type="button" onClick={onOpenAgingChart}>
                Aging chart
              </button>
            )}
            <button type="button" onClick={onShow90}>
              Show 90+ only
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

function FragmentRows({
  group: g,
  open,
  onToggle,
  ageChip,
  cellStyle,
  onOpenBill,
  authRole,
}: {
  group: ReturnType<typeof buildBilledByCustomerBreakdown>[number]
  open: boolean
  onToggle: () => void
  ageChip: (days: number | null, handSet?: boolean) => React.ReactNode
  cellStyle: React.CSSProperties
  onOpenBill: (bill: BilledBreakdownBill) => void
  authRole: UserRole | null
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
        aria-expanded={open}
      >
        <td style={cellStyle}>
          <span aria-hidden style={{ display: 'inline-block', width: '1rem', color: 'var(--text-muted)' }}>
            {open ? '▾' : '▸'}
          </span>
          {g.customerName}
        </td>
        <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{g.count}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{ageChip(g.worstAgeDays, g.worstAgeHandSet)}</td>
        <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {formatUsdNoCents(g.total)}
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <td colSpan={4} style={{ padding: '0.625rem 0.75rem 0.75rem 2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {g.bills.map((b) => (
                <BillCard key={`${g.key}-${b.invoiceId ?? b.jobId}`} bill={b} ageChip={ageChip} onOpenBill={onOpenBill} authRole={authRole} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function BillCard({
  bill: b,
  ageChip,
  onOpenBill,
  authRole,
}: {
  bill: BilledBreakdownBill
  ageChip: (days: number | null, handSet?: boolean) => React.ReactNode
  onOpenBill: (bill: BilledBreakdownBill) => void
  authRole: UserRole | null
}) {
  const address = stripTrailingZip(b.jobAddress)
  const canStripeResend = b.invoiceId != null && b.stripeInvoiceId != null && !b.stripePaid
  const isPhysical = b.stripeInvoiceId == null && b.externalSendChannel === 'physical'
  const isHcp = b.stripeInvoiceId == null && b.externalSendChannel === 'housecallpro'
  const physicalRecipient = b.billToEmail ?? b.customerEmail
  const canPhysicalResend = b.invoiceId != null && isPhysical && physicalRecipient != null
  const sentLabel = b.sentAtIso ? `✉ Email sent ${formatDenverCalendarDayShort(new Date(b.sentAtIso).getTime())}` : null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.625rem 0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{b.jobName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {b.jobNumber}
            {address ? (
              <>
                {' · '}
                <svg
                  aria-hidden
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-faint)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ verticalAlign: -1 }}
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>{' '}
                {address}
              </>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(b.amount)}</span>
          {ageChip(b.ageDays, b.ageHandSet)}
        </div>
      </div>
      {b.lineItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.5rem', paddingTop: '0.375rem', borderTop: '1px solid var(--border)' }}>
          {b.lineItems.map((l, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-700)' }}>
              {/* Wrap, don't ellipsize: nowrap min-content widens the host table past the modal. */}
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{l.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${formatCurrency(l.amount)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {b.stripeInvoiceId ? (
            <>
              {sentLabel ?? '✉ Not emailed yet'}
              {' · '}
              {/* Stripe brand indigo — saturated brand color, intentionally literal (matches STRIPE_TAG_BG). */}
              <span style={{ color: '#635bff', fontWeight: 600 }}>stripe</span>
            </>
          ) : isPhysical ? (
            <>{sentLabel ? `${sentLabel.replace('Email sent', 'Emailed with PDF')} · physical` : '✉ Recorded as physical send'}</>
          ) : isHcp ? (
            <>Billed in HouseCall Pro — HCP sends its own invoice</>
          ) : null}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {canStripeResend && b.invoiceId && b.stripeInvoiceId ? (
          <StripeInvoiceSendFromStripeButton
            jobsLedgerInvoiceId={b.invoiceId}
            stripeInvoiceId={b.stripeInvoiceId}
            customerEmail={b.customerEmail}
            stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
            onSent={() => {
              // The send succeeded; the chase touch is best-effort bookkeeping
              // (same pairing as PaymentChaseModal's "Never got it? Resend").
              if (b.customerId) {
                void addPaymentChaseTouch({ customerId: b.customerId, jobId: b.jobId, outcome: 'resend' }).catch(() => {})
              }
            }}
            compact
            micro
            unboxed
            recordedLastSendAt={b.sentAtIso}
            buttonLabel="Never got it? Resend"
          />
        ) : null}
        {canPhysicalResend && b.invoiceId ? (
          <PhysicalInvoiceResendButton
            invoice={{ id: b.invoiceId, job_id: b.jobId }}
            recipientEmail={physicalRecipient}
            onSent={() => {
              // Same best-effort chase-touch pairing as the Stripe resend.
              if (b.customerId) {
                void addPaymentChaseTouch({ customerId: b.customerId, jobId: b.jobId, outcome: 'resend' }).catch(() => {})
              }
            }}
          />
        ) : null}
        {b.invoiceId ? (
          // Invoice-backed bill: split control — View on board | fresh PDF tail
          // (the v2.2329 Stages control, reused; job-shell bills have no
          // invoice document to render, so they keep the plain jump button).
          <ViewBillWithPdfTail
            label="View on board"
            compact
            invoice={{ id: b.invoiceId, job_id: b.jobId }}
            onViewBill={() => onOpenBill(b)}
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpenBill(b)}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
          >
            View on board
          </button>
        )}
        </span>
      </div>
    </div>
  )
}
