import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']

export type JobLikeForPayment = {
  id: string
  hcp_number: string | null
  job_name: string | null
  revenue: number | null
  payments_made: number | null
}

export type InvoiceWithJobLike = JobsLedgerInvoice & { job: JobLikeForPayment }

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sumPaymentsForInvoice(payments: JobsLedgerPayment[] | undefined, invoiceId: string): number {
  if (!payments?.length) return 0
  let s = 0
  for (const p of payments) {
    if (p.invoice_id === invoiceId) s += Number(p.amount ?? 0)
  }
  return s
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Confirmation when recording cash received for a billed invoice (partial pay supported) or a whole job in Billed status. */
export default function BilledPaymentConfirmationModal({
  mode,
  invoice,
  payments,
  job,
  onClose,
  onSuccess,
}: {
  mode: 'invoice' | 'job'
  invoice: InvoiceWithJobLike | null
  payments: JobsLedgerPayment[] | undefined
  job: JobLikeForPayment | null
  onClose: () => void
  onSuccess: () => void | Promise<void>
}) {
  const open = mode === 'invoice' ? invoice !== null : job !== null
  const [amountStr, setAmountStr] = useState('')
  const [paidOn, setPaidOn] = useState(todayIsoDate())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inv = invoice
  const jb = job

  const applied =
    mode === 'invoice' && inv ? sumPaymentsForInvoice(payments, inv.id) : 0
  const invoiceRemaining =
    mode === 'invoice' && inv ? Math.max(0, Number(inv.amount ?? 0) - applied) : 0
  const jobRemaining =
    mode === 'job' && jb
      ? Math.max(0, Number(jb.revenue ?? 0) - Number(jb.payments_made ?? 0))
      : 0
  const defaultPayAmount = mode === 'invoice' ? invoiceRemaining : jobRemaining

  useEffect(() => {
    if (!open) return
    setAmountStr(defaultPayAmount > 0 ? String(defaultPayAmount) : '')
    setPaidOn(todayIsoDate())
    setNote('')
    setError(null)
  }, [open, inv?.id, jb?.id, defaultPayAmount])

  async function submit() {
    setSubmitting(true)
    setError(null)
    const amt = Number(amountStr)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than 0')
      setSubmitting(false)
      return
    }
    if (!paidOn.trim()) {
      setError('Payment date required')
      setSubmitting(false)
      return
    }
    try {
      if (mode === 'invoice' && inv) {
        const data = await withSupabaseRetry(
          async () =>
            supabase.rpc('mark_invoice_paid', {
              p_invoice_id: inv.id,
              p_amount: amt,
              p_paid_on: paidOn.trim(),
              p_note: note.trim() || undefined,
            }),
          'mark_invoice_paid'
        )
        const result = data as { error?: string } | null
        if (result && typeof result === 'object' && result.error) throw new Error(result.error)
      } else if (mode === 'job' && jb) {
        const data = await withSupabaseRetry(
          async () =>
            supabase.rpc('mark_job_paid', {
              p_job_id: jb.id,
              p_amount: amt,
              p_paid_on: paidOn.trim(),
              p_note: note.trim() || undefined,
            }),
          'mark_job_paid'
        )
        const result = data as { error?: string } | null
        if (result && typeof result === 'object' && result.error) throw new Error(result.error)
      }
      await onSuccess()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const title =
    mode === 'invoice' ? 'Outside Bill Paid Confirmation' : 'Record payment'

  const subtitle =
    mode === 'invoice' && inv
      ? `${inv.job.hcp_number ?? '—'} · ${inv.job.job_name ?? '—'}`
      : jb
        ? `${jb.hcp_number ?? '—'} · ${jb.job_name ?? '—'}`
        : '—'

  const outsideOrStripe =
    mode === 'invoice' && inv
      ? inv.stripe_invoice_id
        ? 'Stripe'
        : 'Outside Bill'
      : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 420,
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>{title}</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{subtitle}</p>

        {mode === 'invoice' && inv && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: 6,
              fontSize: '0.875rem',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Outstanding billing ({outsideOrStripe})</div>
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
              {inv.sent_to_customer_at && (
                <div>
                  <span style={{ color: '#6b7280' }}>Sent: </span>
                  {String(inv.sent_to_customer_at).slice(0, 10)}
                </div>
              )}
              {inv.external_send_note && (
                <div>
                  <span style={{ color: '#6b7280' }}>Note: </span>
                  {inv.external_send_note}
                </div>
              )}
              {inv.stripe_invoice_id && inv.hosted_invoice_url && (
                <div>
                  <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                    Open Stripe invoice
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'job' && jb && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: 6,
              fontSize: '0.875rem',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Job balance</div>
            <div>
              <span style={{ color: '#6b7280' }}>Bid / revenue: </span>${formatMoney(Number(jb.revenue ?? 0))}
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Payments to date: </span>${formatMoney(Number(jb.payments_made ?? 0))}
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Remaining: </span>${formatMoney(jobRemaining)}
            </div>
          </div>
        )}

        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
          Payment amount ($)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
          Payment date
        </label>
        <input
          type="date"
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
          style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem', boxSizing: 'border-box', resize: 'vertical' }}
        />

        {error && <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            style={{
              padding: '0.5rem 1rem',
              background: submitting ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? '…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
