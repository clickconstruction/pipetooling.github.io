import { useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/functions-js'
import { supabase } from '../../lib/supabase'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import type { InvoiceWithJobForBillView } from './HostedStripeBillPanel'

export default function UnwindStripeOobPaymentModal({
  invoice,
  stripeModeForBilling,
  open,
  onClose,
  onSuccess,
}: {
  invoice: InvoiceWithJobForBillView | null
  stripeModeForBilling: BillingStripeModePref
  open: boolean
  onClose: () => void
  onSuccess: () => void | Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason('')
    setError(null)
  }, [open, invoice?.id])

  async function submit() {
    if (!invoice) return
    const r = reason.trim()
    if (r.length < 3) {
      setError('Enter a reason (at least 3 characters)')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not signed in')

      const { data: invokeData, error: fnErr } = await supabase.functions.invoke(
        'reverse-stripe-invoice-out-of-band-payment',
        {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            jobs_ledger_invoice_id: invoice.id,
            reason: r,
            ...stripeModeInvokeBody(stripeModeForBilling),
          },
        },
      )

      if (fnErr) {
        const detail = await readEdgeFunctionErrorBody(fnErr)
        throw new Error(detail ?? (fnErr instanceof Error ? fnErr.message : 'Edge function failed'))
      }
      const payload = invokeData as { error?: string; success?: boolean; warning?: string } | null
      if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) {
        throw new Error(
          payload.warning ? `${payload.error} (${payload.warning})` : payload.error,
        )
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

  if (!open || !invoice) return null

  const amt = Number(invoice.amount ?? 0)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12000,
        padding: '1rem',
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 440,
          width: '100%',
          padding: '1.25rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="unwind-oob-title"
      >
        <h2 id="unwind-oob-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Undo out-of-band payment?
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
          This issues a <strong>credit note</strong> in Stripe for the PipeTooling-recorded out-of-band close, then
          moves the invoice back to <strong>Billed</strong> and removes the linked payment in PipeTooling. Only use
          when the customer did not actually pay or the close was a mistake.
        </p>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Invoice amount:{' '}
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
            ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </p>
        <label htmlFor="unwind-oob-reason" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
          Reason (required)
        </label>
        <textarea
          id="unwind-oob-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: '0.875rem',
            marginBottom: '0.75rem',
          }}
        />
        {error ? (
          <div style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            style={{
              padding: '0.5rem 1rem',
              background: submitting ? '#9ca3af' : '#b91c1c',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {submitting ? 'Working…' : 'Undo out-of-band payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
