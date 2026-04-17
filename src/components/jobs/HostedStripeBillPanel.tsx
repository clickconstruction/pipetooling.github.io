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
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']

export type InvoiceWithJobForBillView = JobsLedgerInvoice & { job: JobWithDetails }

type StripeInvoiceLineDetail = {
  description: string
  quantity: number | null
  amount: number
}

type StripeInvoiceDetailsSuccess = {
  success: true
  currency: string
  total: number
  amount_due: number
  amount_remaining: number
  amount_paid: number
  paid_at: number | null
  due_date: number | null
  invoice_number: string | null
  customer_name: string | null
  customer_email: string | null
  seller_name: string | null
  memo: string | null
  footer: string | null
  lines: StripeInvoiceLineDetail[]
}

function parseStripeInvoiceDetailsResponse(raw: unknown): StripeInvoiceDetailsSuccess | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.success !== true) return null
  const currency = o.currency
  if (typeof currency !== 'string' || !currency.trim()) return null
  const total = o.total
  const amount_due = o.amount_due
  if (typeof total !== 'number' || Number.isNaN(total)) return null
  if (typeof amount_due !== 'number' || Number.isNaN(amount_due)) return null
  const dueRaw = o.due_date
  const due_date: number | null =
    dueRaw === null || dueRaw === undefined
      ? null
      : typeof dueRaw === 'number' && Number.isFinite(dueRaw)
        ? dueRaw
        : null
  const str = (k: string): string | null => {
    const v = o[k]
    return typeof v === 'string' && v.trim() ? v.trim() : v === null ? null : null
  }
  const ap = o.amount_paid
  const amount_paid = typeof ap === 'number' && !Number.isNaN(ap) ? ap : 0

  const arRaw = o.amount_remaining
  const amount_remaining =
    typeof arRaw === 'number' && !Number.isNaN(arRaw)
      ? Math.max(0, arRaw)
      : Math.max(0, total - amount_paid)

  const paidAtRaw = o.paid_at
  const paid_at =
    paidAtRaw === null || paidAtRaw === undefined
      ? null
      : typeof paidAtRaw === 'number' && Number.isFinite(paidAtRaw) && paidAtRaw > 0
        ? paidAtRaw
        : null

  const linesRaw = o.lines
  const lines: StripeInvoiceLineDetail[] = []
  if (Array.isArray(linesRaw)) {
    for (const item of linesRaw) {
      if (item == null || typeof item !== 'object') return null
      const li = item as Record<string, unknown>
      const desc = typeof li.description === 'string' ? li.description : ''
      const amt = li.amount
      if (typeof amt !== 'number' || Number.isNaN(amt)) return null
      const q = li.quantity
      const quantity =
        q === null || q === undefined
          ? null
          : typeof q === 'number' && !Number.isNaN(q)
            ? q
            : null
      lines.push({ description: desc, quantity, amount: amt })
    }
  }

  return {
    success: true,
    currency: currency.trim(),
    total,
    amount_due,
    amount_remaining,
    amount_paid,
    paid_at,
    due_date,
    invoice_number: str('invoice_number'),
    customer_name: str('customer_name'),
    customer_email: str('customer_email'),
    seller_name: str('seller_name'),
    memo: str('memo'),
    footer: str('footer'),
    lines,
  }
}

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
}: {
  invoice: InvoiceWithJobForBillView
  /** Runs after a successful `get-stripe-invoice-details` (server backfill has returned). */
  onAfterStripeDetailsLoaded?: () => void
}) {
  const { role: authRole } = useAuth()
  const stripeModeForBilling = authRole === 'dev' ? getBillingStripeModePref() : 'live'

  const onLoadedRef = useRef(onAfterStripeDetailsLoaded)
  onLoadedRef.current = onAfterStripeDetailsLoaded

  const [stripeDetail, setStripeDetail] = useState<StripeInvoiceDetailsSuccess | null>(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [stripeDetailsGeneration, setStripeDetailsGeneration] = useState(0)

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
    </>
  )
}
