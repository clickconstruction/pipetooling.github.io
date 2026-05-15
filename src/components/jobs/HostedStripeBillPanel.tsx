import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { supabase } from '../../lib/supabase'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { getBillingStripeModePref, stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { formatErrorMessage } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ, denverCalendarDayKey, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { formatStripeCents } from '../../lib/stripeInvoicePreview'
import {
  parseStripeInvoiceDetailsResponse,
  type StripeInvoiceDetailsSuccess,
} from '../../lib/stripeInvoiceDetailsResponse'
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'
import UnwindStripeOobPaymentModal from './UnwindStripeOobPaymentModal'
import {
  ensureLedgerInvoiceRemovedAfterStripeSendBack,
  invokeVoidStripeInvoiceForRevert,
  invoiceNeedsStripeVoidForRevert,
  stripeModeForBillingFromRole,
} from '../../lib/voidStripeInvoiceForRevert'
import { syncJobToReadyToBillIfNoBilledInvoicesRemain } from '../../lib/syncJobToReadyToBillIfNoBilledInvoicesRemain'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']

export type InvoiceWithJobForBillView = JobsLedgerInvoice & { job: JobWithDetails }

function displayLineQuantity(q: number | null): number {
  if (q != null && q > 0) return q
  return 1
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatStripeDueDateChicago(dueUnix: number): string {
  const d = new Date(dueUnix * 1000)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function formatStripePaidAtChicago(paidUnixSec: number): string {
  const d = new Date(paidUnixSec * 1000)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'shortGeneric',
  }).format(d)
}

function ymdToUtcNoonMs(ymd: string): number {
  const parts = ymd.split('-').map((x) => parseInt(x, 10))
  const y = parts[0] ?? 0
  const mo = parts[1] ?? 1
  const day = parts[2] ?? 1
  return Date.UTC(y, mo - 1, day, 12, 0, 0)
}

function calendarDaysFromTo(earlierYmd: string, laterYmd: string): number {
  return Math.round((ymdToUtcNoonMs(laterYmd) - ymdToUtcNoonMs(earlierYmd)) / 86400000)
}

function formatStripePaidRelativeAgo(paidUnixSec: number): string {
  const paidMs = paidUnixSec * 1000
  const paidYmd = denverCalendarDayKey(paidMs)
  const todayYmd = denverCalendarDayKey(Date.now())
  const n = calendarDaysFromTo(paidYmd, todayYmd)
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  return `${n} days ago`
}

function fallbackPaidUnixSecFromJobPayments(
  payments: JobsLedgerPayment[] | undefined,
  invoiceId: string,
): number | null {
  if (!payments?.length) return null
  const rows = payments.filter((p) => p.invoice_id === invoiceId && Number(p.amount) > 0)
  if (!rows.length) return null
  let bestMs: number | null = null
  for (const p of rows) {
    const raw = p.created_at
    if (raw && String(raw).trim()) {
      const ms = Date.parse(String(raw))
      if (!Number.isNaN(ms) && (bestMs == null || ms > bestMs)) bestMs = ms
    }
  }
  if (bestMs != null) return Math.floor(bestMs / 1000)
  for (const p of rows) {
    const po = p.paid_on?.trim()
    if (!po || !/^\d{4}-\d{2}-\d{2}$/.test(po)) continue
    const ms = referenceDateForWorkDateYmd(po).getTime()
    if (!Number.isNaN(ms) && (bestMs == null || ms > bestMs)) bestMs = ms
  }
  return bestMs != null ? Math.floor(bestMs / 1000) : null
}

function sumPaymentsForInvoice(payments: JobsLedgerPayment[] | undefined, invoiceId: string): number {
  if (!payments?.length) return 0
  let s = 0
  for (const p of payments) {
    if (p.invoice_id === invoiceId) s += Number(p.amount ?? 0)
  }
  return s
}

export function billingTypeLabel(inv: JobsLedgerInvoice): string {
  if ((inv.stripe_invoice_id ?? '').trim() && (inv.hosted_invoice_url ?? '').trim()) return 'Stripe'
  const ch = (inv.external_send_channel ?? '').trim()
  if (ch === 'housecallpro') return 'Outside (Housecall Pro)'
  if (ch === 'physical') return 'Outside (Physical)'
  if (ch === 'stripe') return 'Stripe'
  if (ch) return `Outside (${ch})`
  return 'Billed'
}

const metaLabel: CSSProperties = {
  padding: '0.15rem 0.75rem 0.15rem 0',
  verticalAlign: 'top',
  color: '#6b7280',
  fontSize: '0.72rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const metaValue: CSSProperties = {
  padding: '0.15rem 0',
  verticalAlign: 'top',
  fontSize: '0.875rem',
  color: '#111827',
  wordBreak: 'break-word',
}

const stripeHeroAmountText: CSSProperties = {
  fontSize: '1.35rem',
  fontWeight: 700,
  color: '#111827',
}

/**
 * Stripe hosted bill body shared by View bill and Bill Customer (after create).
 * Loads `get-stripe-invoice-details` and renders line items, totals, share links, PipeTooling footer.
 */
export function HostedStripeBillPanel({
  invoice,
  onAfterStripeDetailsLoaded,
  onAfterOobUnwindSuccess,
  onAfterVoidStripeInvoiceSuccess,
  voidConfirmOverlayZIndex = 120,
  viewBillOnClose,
}: {
  invoice: InvoiceWithJobForBillView
  /** Runs after a successful `get-stripe-invoice-details` (server backfill has returned). */
  onAfterStripeDetailsLoaded?: () => void
  /** After Undo out-of-band payment succeeds (Stripe + DB revert); not passed on ordinary invoice loads. */
  onAfterOobUnwindSuccess?: () => void | Promise<void>
  /**
   * When set (e.g. View bill modal), staff can void/remove an unpaid hosted Stripe bill via
   * `void-stripe-invoice-for-revert` and this runs after success so the parent can close and refresh.
   */
  onAfterVoidStripeInvoiceSuccess?: () => void | Promise<void>
  /**
   * `position:fixed` overlay z-index for the void confirmation layer; should be greater than the parent modal (e.g. `overlayZIndex + 1` from View bill).
   */
  voidConfirmOverlayZIndex?: number
  /** View bill: footer row with Close on the right, Void Stripe on the left when eligible. */
  viewBillOnClose?: () => void
}) {
  const { role: authRole } = useAuth()
  const stripeModeForBilling = authRole === 'dev' ? getBillingStripeModePref() : 'live'

  const onLoadedRef = useRef(onAfterStripeDetailsLoaded)
  onLoadedRef.current = onAfterStripeDetailsLoaded
  const onOobUnwindRef = useRef(onAfterOobUnwindSuccess)
  onOobUnwindRef.current = onAfterOobUnwindSuccess
  const onVoidSuccessRef = useRef(onAfterVoidStripeInvoiceSuccess)
  onVoidSuccessRef.current = onAfterVoidStripeInvoiceSuccess

  const [stripeDetail, setStripeDetail] = useState<StripeInvoiceDetailsSuccess | null>(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [stripeDetailsGeneration, setStripeDetailsGeneration] = useState(0)
  const [unwindOobOpen, setUnwindOobOpen] = useState(false)
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false)
  const [voidConfirmChecked, setVoidConfirmChecked] = useState(false)
  const [voidConfirmBusy, setVoidConfirmBusy] = useState(false)
  const [voidConfirmError, setVoidConfirmError] = useState<string | null>(null)

  const inv = invoice
  const job = invoice.job
  const applied = sumPaymentsForInvoice(job.payments, inv.id)
  const invoiceRemaining = Math.max(0, Number(inv.amount ?? 0) - applied)
  const amountLabel = `$${Number(inv.amount ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  const stripeId = (inv.stripe_invoice_id ?? '').trim()
  const hostedUrl = (inv.hosted_invoice_url ?? '').trim()
  const isStripeHosted = Boolean(stripeId && hostedUrl)
  const canUnwindStripeOob =
    inv.status === 'paid' &&
    isStripeHosted &&
    (authRole === 'dev' ||
      authRole === 'master_technician' ||
      authRole === 'assistant' ||
      authRole === 'primary')

  const canRoleVoidStripeHosted =
    authRole === 'dev' ||
    authRole === 'master_technician' ||
    authRole === 'assistant' ||
    authRole === 'primary'

  const voidStripeHostedFooterEligible =
    typeof onAfterVoidStripeInvoiceSuccess === 'function' &&
    canRoleVoidStripeHosted &&
    inv.status === 'billed' &&
    invoiceNeedsStripeVoidForRevert(inv) &&
    isStripeHosted &&
    applied <= 0

  const showVoidStripeHostedButton =
    voidStripeHostedFooterEligible &&
    stripeDetail != null &&
    !stripeError &&
    !stripeLoading &&
    stripeDetail.amount_paid <= 0

  const showVoidStripeHostedDisabledWhileLoading =
    voidStripeHostedFooterEligible && stripeLoading && !stripeError

  useEffect(() => {
    if (!isStripeHosted) {
      setStripeDetail(null)
      setStripeLoading(false)
      setStripeError(null)
      return
    }

    let cancelled = false
    const ac = new AbortController()
    setStripeDetail(null)
    setStripeError(null)
    setStripeLoading(true)

    void (async () => {
      try {
        const token = await getAccessTokenForEdgeFunctions()
        if (!token) {
          if (!cancelled) {
            setStripeError('Not signed in')
            setStripeLoading(false)
          }
          return
        }

        const { data: invokeData, error: fnErr } = await supabase.functions.invoke('get-stripe-invoice-details', {
          body: {
            jobs_ledger_invoice_id: inv.id,
            ...stripeModeInvokeBody(stripeModeForBilling),
          },
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        })

        if (ac.signal.aborted || cancelled) return

        const data = invokeData as Record<string, unknown> | null
        if (fnErr) {
          const detail = await readEdgeFunctionErrorBody(fnErr)
          setStripeError(detail ?? formatErrorMessage(fnErr, 'Could not load Stripe invoice'))
          setStripeDetail(null)
          return
        }
        if (data && typeof data.error === 'string' && data.error.length > 0) {
          setStripeError(data.error)
          setStripeDetail(null)
          return
        }
        const parsed = parseStripeInvoiceDetailsResponse(data)
        if (parsed) {
          setStripeDetail(parsed)
          setStripeError(null)
          onLoadedRef.current?.()
        } else {
          setStripeError('Unexpected response from server')
          setStripeDetail(null)
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!cancelled && !ac.signal.aborted) {
          setStripeError(formatErrorMessage(e, 'Could not load Stripe invoice'))
          setStripeDetail(null)
        }
      } finally {
        if (!cancelled && !ac.signal.aborted) setStripeLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [inv.id, isStripeHosted, stripeModeForBilling, stripeDetailsGeneration])

  const fallbackPaidUnixSecFromApp = fallbackPaidUnixSecFromJobPayments(job.payments, invoice.id)

  return (
    <>
      {isStripeHosted ? (
        <>
          {stripeLoading ? (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading invoice from Stripe…</p>
          ) : null}
          {stripeError ? (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#b45309' }}>
              {stripeError} Showing saved amounts below.
            </p>
          ) : null}

          {stripeDetail ? (
            <div
              style={{
                position: 'relative',
                marginBottom: '0.75rem',
                padding: '0.75rem',
                paddingRight: '9.5rem',
                background: '#fafafa',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                fontSize: '0.875rem',
              }}
            >
              <button
                type="button"
                title="Open Stripe hosted invoice (customer pay page)"
                onClick={() => window.open(hostedUrl, '_blank', 'noopener,noreferrer')}
                style={{
                  position: 'absolute',
                  top: '0.6rem',
                  right: '0.6rem',
                  zIndex: 1,
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  borderRadius: 4,
                  border: '1px solid #2563eb',
                  background: 'white',
                  cursor: 'pointer',
                  color: '#1d4ed8',
                  fontWeight: 500,
                }}
              >
                Customer pay page
              </button>
              <div style={{ ...stripeHeroAmountText, marginBottom: '0.25rem' }}>
                {formatStripeCents(stripeDetail.amount_remaining, stripeDetail.currency)}
              </div>
              {stripeDetail.due_date != null ? (
                <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.65rem' }}>
                  Due {formatStripeDueDateChicago(stripeDetail.due_date)}
                </div>
              ) : (
                <div style={{ marginBottom: '0.65rem' }} />
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={metaLabel}>To</td>
                    <td style={metaValue}>
                      {stripeDetail.customer_name ?? job.customer_name ?? '—'}
                      {(stripeDetail.customer_email ?? job.customer_email)?.trim() ? (
                        <>
                          <br />
                          <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>
                            {(stripeDetail.customer_email ?? job.customer_email ?? '').trim()}
                          </span>
                        </>
                      ) : null}
                    </td>
                  </tr>
                  <tr>
                    <td style={metaLabel}>From</td>
                    <td style={metaValue}>{stripeDetail.seller_name ?? '—'}</td>
                  </tr>
                  <tr>
                    <td style={metaLabel}>Invoice</td>
                    <td style={metaValue}>
                      {stripeDetail.invoice_number ? `#${stripeDetail.invoice_number}` : '—'}
                    </td>
                  </tr>
                  {stripeDetail.memo ? (
                    <tr>
                      <td style={metaLabel}>Memo</td>
                      <td style={metaValue}>{stripeDetail.memo}</td>
                    </tr>
                  ) : null}
                  {stripeDetail.footer ? (
                    <tr>
                      <td style={metaLabel}>Footer</td>
                      <td style={metaValue}>{stripeDetail.footer}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}

          {(!stripeDetail || stripeError) && (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: '#f9fafb',
                borderRadius: 6,
                fontSize: '0.875rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Saved in PipeTooling</div>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <div>
                  <span style={{ color: '#6b7280' }}>Billed amount: </span>${formatMoney(Number(inv.amount ?? 0))}
                </div>
                {applied > 0 && (
                  <div>
                    <span style={{ color: '#6b7280' }}>Applied to date: </span>${formatMoney(applied)}
                  </div>
                )}
                <div>
                  <span style={{ color: '#6b7280' }}>Open on invoice: </span>${formatMoney(invoiceRemaining)}
                </div>
                {inv.stripe_invoice_status ? (
                  <div>
                    <span style={{ color: '#6b7280' }}>Stripe status: </span>
                    {inv.stripe_invoice_status}
                  </div>
                ) : null}
                {inv.sent_to_customer_at ? (
                  <div>
                    <span style={{ color: '#6b7280' }}>Sent: </span>
                    {String(inv.sent_to_customer_at).slice(0, 10)}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {stripeDetail && !stripeError ? (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: '#fafafa',
                fontSize: '0.875rem',
              }}
            >
              {stripeDetail.lines.length === 0 ? (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                  No line items returned from Stripe.
                </p>
              ) : (
                stripeDetail.lines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      marginBottom: i < stripeDetail.lines.length - 1 ? '0.65rem' : 0,
                      paddingBottom: i < stripeDetail.lines.length - 1 ? '0.65rem' : 0,
                      borderBottom: i < stripeDetail.lines.length - 1 ? '1px solid #e5e7eb' : 'none',
                    }}
                  >
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div style={{ color: '#111827', marginBottom: '0.2rem' }}>
                        {line.description.trim() || '—'}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                        Qty {displayLineQuantity(line.quantity)}
                      </div>
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        fontSize: '0.875rem',
                        color: '#111827',
                      }}
                    >
                      {formatStripeCents(line.amount, stripeDetail.currency)}
                    </div>
                  </div>
                ))
              )}
              <div
                style={{
                  marginTop: stripeDetail.lines.length > 0 ? '0.65rem' : 0,
                  paddingTop: '0.65rem',
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    paddingBottom: '0.65rem',
                    borderBottom: '1px solid #e5e7eb',
                    marginBottom: '0.65rem',
                  }}
                >
                  <span style={{ color: '#374151' }}>Total due</span>
                  <span style={{ fontWeight: 600 }}>{formatStripeCents(stripeDetail.total, stripeDetail.currency)}</span>
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <span style={{ color: '#374151', lineHeight: 1.35, minWidth: 0 }}>
                      {(() => {
                        const paidDisplaySec = stripeDetail.paid_at ?? fallbackPaidUnixSecFromApp
                        const showPaidWhen =
                          (stripeDetail.amount_paid > 0 || applied > 0) && paidDisplaySec != null
                        if (!showPaidWhen) return 'Amount paid'
                        const fromStripe = stripeDetail.paid_at != null
                        return (
                          <>
                            Amount paid{' '}
                            <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.8125rem' }}>
                              ({formatStripePaidAtChicago(paidDisplaySec)} | {formatStripePaidRelativeAgo(paidDisplaySec)})
                            </span>
                            {!fromStripe ? (
                              <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem' }}>
                                {' '}
                                · PipeTooling record
                              </span>
                            ) : null}
                          </>
                        )
                      })()}
                    </span>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 600 }}>{formatStripeCents(stripeDetail.amount_paid, stripeDetail.currency)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: '#374151' }}>Amount remaining</span>
                    <span style={{ fontWeight: 600 }}>
                      {formatStripeCents(stripeDetail.amount_remaining, stripeDetail.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <StripeInvoiceSharePanel
            hostedInvoiceUrl={hostedUrl}
            stripeInvoiceId={stripeId}
            customerEmail={job.customer_email}
            customerName={job.customer_name}
            jobName={job.job_name}
            hcpNumber={job.hcp_number}
            amountLabel={amountLabel}
            compact
            omitCustomerPayPage={!!stripeDetail}
            omitOpenInStripe
            emailButtonLabel="Draft Email"
            paymentLinkActionsAsIcons
            unboxed
          />
          {stripeDetail && !stripeError && stripeDetail.amount_remaining > 0 ? (
            <StripeInvoiceSendFromStripeButton
              jobsLedgerInvoiceId={inv.id}
              stripeInvoiceId={stripeId}
              customerEmail={stripeDetail.customer_email ?? job.customer_email}
              stripeModeForBilling={stripeModeForBilling}
              onSent={() => setStripeDetailsGeneration((g) => g + 1)}
              compact
              recordedLastSendAt={inv.sent_to_customer_at}
            />
          ) : null}
          {canUnwindStripeOob && stripeDetail && !stripeError ? (
            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setUnwindOobOpen(true)}
                style={{
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#991b1b',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Undo out-of-band payment…
              </button>
            </div>
          ) : null}
          <UnwindStripeOobPaymentModal
            invoice={unwindOobOpen ? inv : null}
            stripeModeForBilling={stripeModeForBilling}
            open={unwindOobOpen}
            onClose={() => setUnwindOobOpen(false)}
            onSuccess={async () => {
              setStripeDetailsGeneration((g) => g + 1)
              onLoadedRef.current?.()
              await onOobUnwindRef.current?.()
            }}
          />
          {voidConfirmOpen ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: voidConfirmOverlayZIndex,
              }}
            >
              <div
                style={{
                  background: 'white',
                  padding: '1.25rem',
                  borderRadius: 8,
                  minWidth: 360,
                  maxWidth: 440,
                  maxHeight: '90vh',
                  overflow: 'auto',
                  margin: '0.75rem',
                }}
              >
                <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', lineHeight: 1.35 }}>Void Stripe invoice?</h2>
                <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.45, marginBottom: '0.85rem' }}>
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem' }}>
                    <li style={{ marginBottom: '0.35rem' }}>
                      Stripe will delete a draft invoice or void an open unpaid invoice so this hosted link cannot be paid.
                    </li>
                    <li style={{ marginBottom: '0.35rem' }}>PipeTooling will remove this billed line.</li>
                    <li>
                      If this is the last billed invoice on the job, the job moves back to <strong>Ready to Bill</strong>.
                    </li>
                  </ul>
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: '#92400e' }}>
                    Paid Stripe invoices or invoices with recorded payments here cannot be voided this way; fix them in Stripe
                    or unlink payments first.
                  </p>
                </div>
                {voidConfirmError ? (
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#b45309', lineHeight: 1.4 }}>{voidConfirmError}</p>
                ) : null}
                <label
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}
                >
                  <input
                    type="checkbox"
                    checked={voidConfirmChecked}
                    onChange={(e) => setVoidConfirmChecked(e.target.checked)}
                    style={{ marginTop: 4 }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>
                    I understand this bill line will be removed and the job may return to Ready to Bill.
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={voidConfirmBusy}
                    onClick={() => {
                      if (voidConfirmBusy) return
                      setVoidConfirmOpen(false)
                      setVoidConfirmChecked(false)
                      setVoidConfirmError(null)
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #d1d5db',
                      background: 'white',
                      borderRadius: 4,
                      cursor: voidConfirmBusy ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!voidConfirmChecked || voidConfirmBusy}
                    onClick={() => {
                      void (async () => {
                        if (!voidConfirmChecked || voidConfirmBusy) return
                        setVoidConfirmBusy(true)
                        setVoidConfirmError(null)
                        try {
                          const token = await getAccessTokenForEdgeFunctions()
                          if (!token) {
                            setVoidConfirmError('Not signed in')
                            return
                          }
                          const r = await invokeVoidStripeInvoiceForRevert({
                            invoiceId: inv.id,
                            stripeModeForBilling: stripeModeForBillingFromRole(authRole),
                            accessToken: token,
                          })
                          if (!r.ok) {
                            setVoidConfirmError(r.message)
                            return
                          }
                          const cleaned = await ensureLedgerInvoiceRemovedAfterStripeSendBack(inv.id)
                          if (!cleaned.ok) {
                            setVoidConfirmError(cleaned.message)
                            return
                          }
                          const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, job.id)
                          if (!sync.ok) {
                            setVoidConfirmError(sync.message)
                            return
                          }
                          setVoidConfirmOpen(false)
                          setVoidConfirmChecked(false)
                          await onVoidSuccessRef.current?.()
                        } finally {
                          setVoidConfirmBusy(false)
                        }
                      })()
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: !voidConfirmChecked || voidConfirmBusy ? '#9ca3af' : '#ca8a04',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: !voidConfirmChecked || voidConfirmBusy ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    {voidConfirmBusy ? '…' : 'Void invoice'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: '#f9fafb',
            borderRadius: 6,
            fontSize: '0.875rem',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Bill sent ({billingTypeLabel(inv)})</div>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <div>
              <span style={{ color: '#6b7280' }}>Billed amount: </span>${formatMoney(Number(inv.amount ?? 0))}
            </div>
            {applied > 0 && (
              <div>
                <span style={{ color: '#6b7280' }}>Applied to date: </span>${formatMoney(applied)}
              </div>
            )}
            <div>
              <span style={{ color: '#6b7280' }}>Open on invoice: </span>${formatMoney(invoiceRemaining)}
            </div>
            {inv.sent_to_customer_at ? (
              <div>
                <span style={{ color: '#6b7280' }}>Sent: </span>
                {String(inv.sent_to_customer_at).slice(0, 10)}
              </div>
            ) : null}
            {inv.external_send_note ? (
              <div>
                <span style={{ color: '#6b7280' }}>Note: </span>
                {inv.external_send_note}
              </div>
            ) : null}
            {stripeId && !hostedUrl ? (
              <div style={{ color: '#92400e', fontSize: '0.8125rem' }}>
                Stripe invoice id is on file, but no hosted payment link. Open the invoice in Stripe Dashboard using the id{' '}
                <span style={{ fontFamily: 'ui-monospace, monospace' }}>{stripeId}</span>.
              </div>
            ) : null}
          </div>
        </div>
      )}

      {applied > 0 && stripeDetail && !stripeError ? (
        <div
          style={{
            marginTop: '1rem',
            marginBottom: '0.25rem',
            fontSize: '0.75rem',
            color: '#6b7280',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.2rem',
          }}
        >
          <div>Applied in PipeTooling: ${formatMoney(applied)}</div>
          <div>Open on invoice (app): ${formatMoney(invoiceRemaining)}</div>
        </div>
      ) : null}

      {viewBillOnClose ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            marginTop: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 auto', minWidth: '8rem' }}>
            {showVoidStripeHostedButton ? (
              <button
                type="button"
                onClick={() => {
                  setVoidConfirmChecked(false)
                  setVoidConfirmError(null)
                  setVoidConfirmOpen(true)
                }}
                style={{
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#92400e',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Void Stripe invoice…
              </button>
            ) : showVoidStripeHostedDisabledWhileLoading ? (
              <button
                type="button"
                disabled
                aria-busy="true"
                title="Loading invoice…"
                style={{
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#92400e',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 6,
                  cursor: 'not-allowed',
                  opacity: 0.75,
                }}
              >
                Void Stripe invoice…
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={viewBillOnClose}
            style={{
              flexShrink: 0,
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      ) : null}
    </>
  )
}
