import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { formatErrorMessage } from '../../utils/errorHandling'
import { parseStripeInvoicePreviewResponse, type StripeInvoicePreviewSuccess } from '../../lib/stripeInvoicePreview'
import { StripeBillPreSubmitPreview } from './StripeBillPreSubmitPreview'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { convertMemoLine, formatConvertLongDate } from '../../lib/jobs/convertBillToStripe'
import type { JobsLedgerInvoiceRow } from '../../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

/**
 * "Make Stripe bill" confirm (v2.2045): converts a BILLED non-Stripe line to
 * a hosted Stripe invoice. Shows the same no-side-effects live preview Bill
 * Customer uses, then calls create-stripe-invoice with convert_billed. The
 * ledger's billed date never moves (server patch omits billed_at; DB trigger
 * COALESCEs); the ORIGINAL billed date is sent as the due date so the Stripe
 * number inherits it and the server's clamp renders it "due now" — Stripe
 * refuses past due dates outright.
 */
export function ConvertBillToStripeModal({
  invoice,
  job,
  zIndex,
  onClose,
  onConverted,
}: {
  invoice: JobsLedgerInvoiceRow
  job: JobWithDetails
  zIndex: number
  onClose: () => void
  onConverted: () => void
}) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [preview, setPreview] = useState<StripeInvoicePreviewSuccess | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const alive = useRef(true)

  const amount = Number(invoice.amount ?? 0)
  // Chicago wall dates throughout — billed_at is a timestamptz and its UTC
  // date can differ from the company-calendar date around midnight.
  const billedYmd = invoice.billed_at ? calendarYmdInAppTzFromIso(invoice.billed_at) : ''
  const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
  const dueDateYmd = billedYmd || todayYmd
  const memo = convertMemoLine(billedYmd || null)
  const billedLong = formatConvertLongDate(billedYmd || null)
  const stripeModeForBilling = stripeModeForBillingFromRole(role)

  useEffect(() => {
    alive.current = true
    void (async () => {
      try {
        const token = await getAccessTokenForEdgeFunctions()
        if (!token) throw new Error('Not signed in')
        const { data, error } = await supabase.functions.invoke('preview-stripe-invoice', {
          body: {
            jobs_ledger_invoice_id: invoice.id,
            customer_id: job.customer_id!,
            amount_dollars: amount,
            customer_email: (job.customer_email ?? '').trim(),
            customer_name: (job.customer_name ?? '').trim() || 'Customer',
            due_date: dueDateYmd,
            convert_billed: true,
            ...stripeModeInvokeBody(stripeModeForBilling),
          },
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!alive.current) return
        if (error) {
          setPreviewError((await readEdgeFunctionErrorBody(error)) ?? formatErrorMessage(error, 'Preview failed'))
          return
        }
        const parsed = parseStripeInvoicePreviewResponse(data)
        if (!parsed) {
          const errMsg =
            data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
              ? String((data as { error: string }).error)
              : 'Preview failed'
          setPreviewError(errMsg)
          return
        }
        setPreview(parsed)
      } catch (e) {
        if (alive.current) setPreviewError(formatErrorMessage(e, 'Preview failed'))
      } finally {
        if (alive.current) setPreviewLoading(false)
      }
    })()
    return () => {
      alive.current = false
    }
    // Inputs are fixed for the modal's lifetime — one preview per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id])

  async function convert() {
    setCreating(true)
    setCreateError(null)
    try {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) throw new Error('Not signed in')
      const { data, error } = await supabase.functions.invoke('create-stripe-invoice', {
        body: {
          jobs_ledger_invoice_id: invoice.id,
          customer_id: job.customer_id,
          amount_dollars: amount,
          customer_email: (job.customer_email ?? '').trim(),
          customer_name: (job.customer_name ?? '').trim() || 'Customer',
          due_date: dueDateYmd,
          memo,
          convert_billed: true,
          ...stripeModeInvokeBody(stripeModeForBilling),
        },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) {
        setCreateError((await readEdgeFunctionErrorBody(error)) ?? formatErrorMessage(error, 'Conversion failed'))
        return
      }
      const body = data as { error?: string; hosted_invoice_url?: string } | null
      if (body?.error) {
        setCreateError(body.error)
        return
      }
      if (!body?.hosted_invoice_url) {
        setCreateError('Stripe did not return a pay link — check the bill before retrying.')
        return
      }
      showToast('Now a Stripe bill — pay link is live. Nothing was emailed.', 'success')
      onConverted()
    } catch (e) {
      setCreateError(formatErrorMessage(e, 'Conversion failed'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Make this a Stripe bill"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, padding: '1rem' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(560px, 100%)', maxHeight: 'calc(100vh - 3rem)', overflowY: 'auto', padding: '1.15rem 1.35rem 1.25rem' }}
      >
        <h3 style={{ margin: 0, fontSize: '1.02rem' }}>Make this a Stripe bill</h3>
        <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Creates the hosted Stripe invoice for this exact line. Nothing is emailed — you choose that after, like any Stripe bill.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.3rem 0.9rem', fontSize: '0.8125rem', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '0.6rem 0' }}>
          <span style={{ color: 'var(--text-muted)' }}>Line</span>
          <span style={{ fontWeight: 600 }}>${formatCurrency(amount)}</span>
          <span style={{ color: 'var(--text-muted)' }}>Customer</span>
          <span style={{ fontWeight: 600 }}>
            {(job.customer_name ?? '').trim() || 'Customer'}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {(job.customer_email ?? '').trim()}</span>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>Billed date</span>
          <span style={{ fontWeight: 700, color: '#16a34a' }}>stays {billedLong ?? 'as recorded'}</span>
          <span style={{ color: 'var(--text-muted)' }}>Payment due</span>
          <span style={{ fontWeight: 600 }}>now — this bill is already outstanding</span>
        </div>

        <div style={{ marginTop: '0.8rem' }}>
          <StripeBillPreSubmitPreview
            customerName={job.customer_name}
            customerEmail={job.customer_email}
            jobName={job.job_name}
            hcpNumber={job.hcp_number}
            amountLabel={`$${formatCurrency(amount)}`}
            dueDateYmd={dueDateYmd}
            memo={memo}
            localLineDescription=""
            stripePreview={preview}
            stripePreviewLoading={previewLoading}
            stripePreviewError={previewError}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.55rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-700)', marginTop: '0.8rem', lineHeight: 1.5 }}>
          <span aria-hidden>🔒</span>
          <span>
            <b>The ledger doesn't move.</b> Billed date, AR aging, and Pipeline stay exactly as they are — and the
            invoice number and memo both carry the original billed date, so the paperwork tells the true story.
            Stripe won't accept a <i>past</i> due date, so the closest it allows is due&nbsp;now.
          </span>
        </div>

        {createError && (
          <div style={{ marginTop: '0.7rem', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{createError}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.95rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void convert()}
            disabled={creating || previewLoading || !!previewError}
            title={previewError ? 'Fix the preview error first' : undefined}
            style={{ padding: '0.4rem 1rem', fontSize: '0.8125rem', border: 'none', borderRadius: 6, background: '#635bff', color: '#ffffff', fontWeight: 700, cursor: creating || previewLoading || previewError ? 'not-allowed' : 'pointer', opacity: creating || previewLoading || previewError ? 0.7 : 1, fontFamily: 'inherit' }}
          >
            {creating ? 'Creating…' : '⚡ Create Stripe bill'}
          </button>
        </div>
      </div>
    </div>
  )
}
