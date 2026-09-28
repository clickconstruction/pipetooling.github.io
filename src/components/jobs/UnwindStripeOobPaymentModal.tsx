import { useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/functions-js'
import { supabase } from '../../lib/supabase'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { sendBackStripeBilledLine } from '../../lib/voidStripeInvoiceForRevert'
import type { InvoiceWithJobForBillView } from './HostedStripeBillPanel'

/** What the modal did, for the host's toast. */
export type UnwindStripeOobResult = {
  /** The bill line was sent back after the undo (the job is Ready to Bill when no other billed line remains). */
  sentBack: boolean
  /** The undo succeeded but the send-back did not — the bill stays Billed; View bill's send-back can finish it. */
  sendBackError?: string
}

export default function UnwindStripeOobPaymentModal({
  invoice,
  stripeModeForBilling,
  open,
  onClose,
  onSuccess,
  initialReason,
  sendBackDefault = true,
  zIndex,
}: {
  invoice: Pick<InvoiceWithJobForBillView, 'id' | 'amount' | 'job_id'> | null
  stripeModeForBilling: BillingStripeModePref
  open: boolean
  onClose: () => void
  onSuccess: (result: UnwindStripeOobResult) => void | Promise<void>
  /** v2.4062: the reason the door was opened with (Edit Job's "Check didn't clear…" prefills it). */
  initialReason?: string
  /**
   * v2.4062: Stripe never reopens a paid invoice, so after the undo the bill can
   * only be collected by billing again — the send-back is on unless the host says otherwise.
   */
  sendBackDefault?: boolean
  zIndex?: number
}) {
  const [reason, setReason] = useState('')
  const [sendBack, setSendBack] = useState(sendBackDefault)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason(initialReason ?? '')
    setSendBack(sendBackDefault)
    setError(null)
  }, [open, invoice?.id, initialReason, sendBackDefault])

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
      if (sendBack) {
        const back = await sendBackStripeBilledLine({
          invoiceId: invoice.id,
          jobId: invoice.job_id,
          stripeModeForBilling,
          accessToken: token,
        })
        if (!back.ok) {
          await onSuccess({ sentBack: false, sendBackError: back.message })
          onClose()
          return
        }
        await onSuccess({ sentBack: true })
        onClose()
        return
      }
      await onSuccess({ sentBack: false })
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
        zIndex: zIndex ?? 12000,
        padding: '1rem',
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          background: 'var(--surface)',
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
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
          This issues a <strong>credit note</strong> in Stripe for the ClickTooling-recorded out-of-band close, then
          moves the invoice back to <strong>Billed</strong> and removes the linked payment in ClickTooling. Only use
          when the customer did not actually pay or the close was a mistake.
        </p>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
          Stripe keeps the old invoice as paid and reversed, so its pay link cannot be used again. To collect, the
          bill has to be billed again with a fresh invoice.
        </p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={sendBack}
            onChange={(e) => setSendBack(e.target.checked)}
            style={{ marginTop: 3 }}
            data-testid="unwind-oob-send-back"
          />
          <span>
            Send the bill back to <strong>Ready to Bill</strong> so it can be billed again (recommended) — the
            billed line is removed and Bill Customer sends a fresh invoice.
          </span>
        </label>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
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
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            fontSize: '0.875rem',
            marginBottom: '0.75rem',
          }}
        />
        {error ? (
          <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-strong)',
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
            {submitting ? 'Working…' : sendBack ? 'Undo and send back' : 'Undo out-of-band payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
