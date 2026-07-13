import { useCallback, useEffect, useMemo, useState } from 'react'
import { FunctionsHttpError } from '@supabase/functions-js'
import type { Database } from '../../types/database'
import { getBillingStripeModePref, stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import {
  agreedWriteDownNewTotalBounds,
  agreedWriteDownDiscountBounds,
  agreedWriteDownDisplayMaxNewTotal,
  resolveWriteDownNewTotalFromInputs,
  WRITE_DOWN_NEW_TOTAL_EPS,
} from '../../lib/agreedWriteDownBounds'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

type JobsLedgerInvoiceRow = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type AgreedWriteDownModalProps = {
  open: boolean
  onClose: () => void
  invoice: JobsLedgerInvoiceRow | null
  /** Sum of `jobs_ledger_payments.amount` rows linked to this invoice */
  paidOnInvoice: number
  isStripeHosted: boolean
  onSuccess: () => void | Promise<void>
  /** Fixed scrim z-index; pass above `JobFormModal` shell (e.g. `JOB_FORM_BILL_VIEW_OVERLAY_Z_INDEX`). */
  overlayZIndex?: number
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function writeDownAmountInputStyle(inactive: boolean, omitTopMargin = false) {
  return {
    display: 'block' as const,
    width: '100%',
    marginTop: omitTopMargin ? 0 : '0.35rem',
    padding: '0.5rem 0.65rem',
    border: `1px solid ${inactive ? '#cbd5e1' : 'var(--border-strong)'}`,
    borderRadius: 6,
    fontSize: '0.9375rem',
    boxSizing: 'border-box' as const,
    opacity: inactive ? 0.38 : 1,
    backgroundColor: inactive ? 'var(--bg-200)' : 'var(--surface)',
    color: inactive ? 'var(--text-slate-500)' : 'var(--text-strong)',
    cursor: inactive ? 'not-allowed' : 'text',
  }
}

export default function AgreedWriteDownModal({
  open,
  onClose,
  invoice,
  paidOnInvoice,
  isStripeHosted,
  onSuccess,
  overlayZIndex = 80,
}: AgreedWriteDownModalProps) {
  const [discountInput, setDiscountInput] = useState('')
  const [newTotalInput, setNewTotalInput] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const currentAmount = invoice != null ? Number(invoice.amount ?? 0) : 0
  const bounds = useMemo(
    () => agreedWriteDownNewTotalBounds(currentAmount, paidOnInvoice),
    [currentAmount, paidOnInvoice],
  )
  const discountBounds = useMemo(
    () => agreedWriteDownDiscountBounds(currentAmount, paidOnInvoice),
    [currentAmount, paidOnInvoice],
  )
  const displayMaxNewTotal = useMemo(() => agreedWriteDownDisplayMaxNewTotal(bounds), [bounds])

  useEffect(() => {
    if (!open) return
    setError(null)
    setNote('')
    setDiscountInput('')
    setNewTotalInput('')
    setSubmitting(false)
  }, [open, invoice?.id])

  const discountLocked = newTotalInput.trim() !== ''
  const totalLocked = discountInput.trim() !== ''

  const submit = useCallback(async () => {
    if (!invoice) return
    setError(null)
    const noteTrim = note.trim()
    if (noteTrim.length < 3) {
      setError('Note is required (at least 3 characters).')
      return
    }
    const resolved = resolveWriteDownNewTotalFromInputs(currentAmount, discountInput, newTotalInput)
    if (!resolved.ok) {
      setError(resolved.error)
      return
    }
    const newTotal = resolved.newTotal
    if (newTotal < bounds.min - WRITE_DOWN_NEW_TOTAL_EPS) {
      setError(`New total cannot be less than payments on this invoice (${formatUsd(bounds.min)}).`)
      return
    }
    if (newTotal > bounds.max + WRITE_DOWN_NEW_TOTAL_EPS) {
      setError(`New total cannot exceed the current billed amount (${formatUsd(bounds.max)}).`)
      return
    }
    if (newTotal >= bounds.max - WRITE_DOWN_NEW_TOTAL_EPS) {
      setError('New total must be less than the current billed amount (otherwise there is no discount).')
      return
    }

    setSubmitting(true)
    try {
      if (isStripeHosted) {
        const token = await getAccessTokenForEdgeFunctions()
        if (!token) {
          setError('Not signed in.')
          return
        }
        const { data: invokeData, error: fnErr } = await supabase.functions.invoke(
          'stripe-invoice-agreed-write-down',
          {
            body: {
              jobs_ledger_invoice_id: invoice.id,
              new_total_dollars: newTotal,
              note: noteTrim,
              ...stripeModeInvokeBody(getBillingStripeModePref()),
            },
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        if (fnErr) {
          setError((await readEdgeFunctionErrorBody(fnErr)) ?? formatErrorMessage(fnErr, 'Request failed'))
          return
        }
        const data = invokeData as { error?: string; ok?: boolean } | null
        if (data && typeof data.error === 'string' && data.error) {
          setError(data.error)
          return
        }
      } else {
        try {
          const data = await withSupabaseRetry(
            () =>
              supabase.rpc('apply_agreed_write_down_to_billed_invoice', {
                p_invoice_id: invoice.id,
                p_new_amount: newTotal,
                p_note: noteTrim,
              }),
            'apply_agreed_write_down_to_billed_invoice',
          )
          const result = data as { error?: string; ok?: boolean } | null
          if (result && typeof result === 'object' && typeof result.error === 'string' && result.error) {
            setError(result.error)
            return
          }
        } catch (e: unknown) {
          setError(formatErrorMessage(e, 'Could not apply discount'))
          return
        }
      }
      await onSuccess()
      onClose()
    } catch (e: unknown) {
      if (e instanceof FunctionsHttpError) {
        setError((await readEdgeFunctionErrorBody(e)) ?? e.message)
      } else {
        setError(formatErrorMessage(e, 'Could not apply discount'))
      }
    } finally {
      setSubmitting(false)
    }
  }, [
    invoice,
    isStripeHosted,
    discountInput,
    newTotalInput,
    note,
    bounds,
    currentAmount,
    onClose,
    onSuccess,
  ])

  if (!open || !invoice) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agreed-discount-title"
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 420,
          width: '100%',
          padding: '1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <h2 id="agreed-discount-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>
          Apply discount
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-600)', lineHeight: 1.45 }}>
          Lower the billed amount for this invoice to match an agreed discount. Payments already linked to this
          line must stay at or below the new total.
        </p>
        {isStripeHosted ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#1e40af', lineHeight: 1.4 }}>
            This invoice is hosted on Stripe: we will create a <strong>credit note</strong> for the difference so
            Stripe stays in sync with PipeTooling.
          </p>
        ) : null}
        <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Current billed: </span>
            <strong>${formatUsd(currentAmount)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Payments on this invoice: </span>
            <strong>${formatUsd(paidOnInvoice)}</strong>
          </div>
        </div>
        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
          Discount (amount off, USD)
          <span style={{ display: 'block', marginTop: '0.35rem', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {discountBounds.max > 0 ? (
              <>
                Discount can be between ${formatUsd(discountBounds.min)} and ${formatUsd(discountBounds.max)}.
              </>
            ) : (
              <>No discount range for this invoice.</>
            )}
          </span>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              marginTop: '0.35rem',
            }}
          >
            <input
              type="number"
              step="0.01"
              min={discountBounds.max > 0 ? discountBounds.min : undefined}
              max={discountBounds.max > 0 ? discountBounds.max : undefined}
              value={discountInput}
              onChange={(e) => {
                setDiscountInput(e.target.value)
                setNewTotalInput('')
              }}
              disabled={submitting || discountLocked}
              aria-disabled={submitting || discountLocked}
              style={{
                ...writeDownAmountInputStyle(submitting || discountLocked, true),
                flex: 1,
                minWidth: 0,
              }}
            />
            <button
              type="button"
              disabled={submitting || discountBounds.max <= 0}
              aria-label="Set discount to maximum allowed"
              onClick={() => {
                setNewTotalInput('')
                setDiscountInput(String(discountBounds.max))
              }}
              style={{
                flexShrink: 0,
                padding: '0.45rem 0.65rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                background: submitting || discountBounds.max <= 0 ? 'var(--bg-muted)' : 'var(--surface)',
                color: submitting || discountBounds.max <= 0 ? 'var(--text-faint)' : 'var(--text-700)',
                cursor: submitting || discountBounds.max <= 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              Max
            </button>
          </div>
        </label>
        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
          New invoice total (USD)
          <span style={{ display: 'block', marginTop: '0.35rem', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            New total can be between ${formatUsd(bounds.min)} and ${formatUsd(displayMaxNewTotal)}
          </span>
          <input
            type="number"
            step="0.01"
            min={bounds.min}
            max={displayMaxNewTotal}
            value={newTotalInput}
            onChange={(e) => {
              setNewTotalInput(e.target.value)
              setDiscountInput('')
            }}
            disabled={submitting || totalLocked}
            aria-disabled={submitting || totalLocked}
            style={writeDownAmountInputStyle(submitting || totalLocked)}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
          Note (internal)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder="e.g. Customer discount agreed by phone on …"
            style={{
              display: 'block',
              width: '100%',
              marginTop: '0.35rem',
              padding: '0.5rem 0.65rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              fontSize: '0.875rem',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </label>
        {error ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }} role="alert">
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              border: 'none',
              borderRadius: 6,
              background: submitting ? '#93c5fd' : '#2563eb',
              color: 'white',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {submitting ? 'Applying…' : 'Apply discount'}
          </button>
        </div>
      </div>
    </div>
  )
}
