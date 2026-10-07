import { useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/functions-js'
import { supabase } from '../../lib/supabase'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import type { JobsLedgerInvoiceRow, PaymentRow } from '../../lib/jobs/jobFormTypes'
import { applyToStripeWords } from '../../lib/jobs/applyPaymentToStripeBill'
import { attributeJobPayments } from '../../lib/jobs/paymentAttribution'

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Apply a payment the app already counts to the Stripe bill it pays (v2.4847):
 * record-stripe-invoice-out-of-band-payment with `payment_id` writes the same
 * credit note a part payment gets, for the row that already exists, and pins the
 * row to the bill. Offered on a saved row under an open Stripe bill that carries
 * no credit note. Undo part payment is the way back.
 */
export default function ApplyPaymentToStripeBillModal({
  payment,
  invoice,
  invoices,
  payments,
  jobRevenue,
  stripeModeForBilling,
  zIndex,
  onClose,
  onSuccess,
}: {
  payment: PaymentRow | null
  invoice: JobsLedgerInvoiceRow | null
  invoices: JobsLedgerInvoiceRow[]
  payments: PaymentRow[]
  jobRevenue: number | null
  stripeModeForBilling: BillingStripeModePref
  zIndex?: number
  onClose: () => void
  onSuccess: () => void | Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const open = payment != null && invoice != null

  useEffect(() => {
    if (!open) return
    setError(null)
  }, [open, payment?.id])

  async function submit() {
    if (!payment || !invoice) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not signed in')
      const { data: invokeData, error: fnErr } = await supabase.functions.invoke('record-stripe-invoice-out-of-band-payment', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          jobs_ledger_invoice_id: invoice.id,
          payment_id: payment.id,
          ...stripeModeInvokeBody(stripeModeForBilling),
        },
      })
      if (fnErr) {
        const detail = await readEdgeFunctionErrorBody(fnErr)
        throw new Error(detail ?? (fnErr instanceof Error ? fnErr.message : 'Edge function failed'))
      }
      const payload = invokeData as { error?: string; success?: boolean } | null
      if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) {
        throw new Error(payload.error)
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
  // What the app shows open on the bill once every payment it counts is in — the oldest-first rule.
  const applied = (attributeJobPayments(invoices, payments, jobRevenue).byBill.get(invoice.id)?.slices ?? []).reduce((s, sl) => s + (Number(sl.amount) || 0), 0)
  const words = applyToStripeWords({ row: payment, bill: invoice, openAfter: Number(invoice.amount ?? 0) - applied })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: zIndex ?? 12000, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 440, width: '100%', padding: '1.25rem', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-to-stripe-title"
      >
        <h2 id="apply-to-stripe-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Apply this ${money(amt)} payment to the Stripe bill?
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
          {words.sentence}
        </p>
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
            style={{ padding: '0.5rem 1rem', background: submitting ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
          >
            {submitting ? 'Working…' : `Apply · $${words.staysDue} stays due`}
          </button>
        </div>
      </div>
    </div>
  )
}
