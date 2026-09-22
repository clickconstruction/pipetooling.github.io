import { useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/functions-js'
import { supabase } from '../../lib/supabase'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import type { JobsLedgerInvoiceRow, PaymentRow } from '../../lib/jobs/jobFormTypes'

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Undo a part payment on a Stripe bill (v2.3695): voids the credit note that
 * lowered the pay link and removes the payment row, through
 * reverse-stripe-invoice-out-of-band-payment with `payment_id`. Offered on a
 * locked Stripe row that carries `stripe_credit_note_id`, while the bill is
 * still Billed.
 */
export default function UndoStripePartPaymentModal({
  payment,
  invoice,
  stripeModeForBilling,
  zIndex,
  onClose,
  onSuccess,
}: {
  payment: PaymentRow | null
  invoice: JobsLedgerInvoiceRow | null
  stripeModeForBilling: BillingStripeModePref
  zIndex?: number
  onClose: () => void
  onSuccess: () => void | Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const open = payment != null && invoice != null

  useEffect(() => {
    if (!open) return
    setReason('')
    setError(null)
  }, [open, payment?.id])

  async function submit() {
    if (!payment || !invoice) return
    const r = reason.trim()
    if (r.length < 3) {
      setError('Say why, in a few words (at least 3 characters)')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not signed in')
      const { data: invokeData, error: fnErr } = await supabase.functions.invoke('reverse-stripe-invoice-out-of-band-payment', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          jobs_ledger_invoice_id: invoice.id,
          payment_id: payment.id,
          reason: r,
          ...stripeModeInvokeBody(stripeModeForBilling),
        },
      })
      if (fnErr) {
        const detail = await readEdgeFunctionErrorBody(fnErr)
        throw new Error(detail ?? (fnErr instanceof Error ? fnErr.message : 'Edge function failed'))
      }
      const payload = invokeData as { error?: string; success?: boolean; warning?: string } | null
      if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) {
        throw new Error(payload.warning ? `${payload.error} (${payload.warning})` : payload.error)
      }
      await onSuccess()
      onClose()
    } catch (e: unknown) {
      if (e instanceof FunctionsHttpError) {
        const detail = await readEdgeFunctionErrorBody(e)
        setError(detail ?? e.message)
      } else {
        setError(e instanceof Error ? e.message : 'Request failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null
  const amt = Number(payment.amount ?? 0)
  const billAmt = Number(invoice.amount ?? 0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: zIndex ?? 12000, padding: '1rem' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 440, width: '100%', padding: '1.25rem', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="undo-part-payment-title"
      >
        <h2 id="undo-part-payment-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Undo this ${money(amt)} part payment?
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
          The credit line Stripe put on the ${money(billAmt)} bill is voided, so the pay link asks for the full remainder
          again, and this payment comes off the job. Use it when the money was never received or the amount was wrong;
          then record the right payment.
        </p>
        <label htmlFor="undo-part-payment-reason" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
          Why (required)
        </label>
        <textarea
          id="undo-part-payment-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', marginBottom: '0.75rem' }}
        />
        {error ? <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            style={{ padding: '0.5rem 1rem', background: submitting ? '#9ca3af' : '#b91c1c', color: 'white', border: 'none', borderRadius: 6, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
          >
            {submitting ? 'Working…' : `Undo $${money(amt)} payment`}
          </button>
        </div>
      </div>
    </div>
  )
}
