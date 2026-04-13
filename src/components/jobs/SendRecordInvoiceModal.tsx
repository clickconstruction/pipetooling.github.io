import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import {
  getBillingStripeModePref,
  setBillingStripeModePref,
  stripeModeInvokeBody,
  type BillingStripeModePref,
} from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import type { StripeInvoiceLinesSnapshot, StripeInvoicePreviewSuccess } from '../../lib/stripeInvoicePreview'
import {
  parseStripeInvoiceLinesSnapshot,
  parseStripeInvoicePreviewResponse,
} from '../../lib/stripeInvoicePreview'
import { buildStripeInvoiceLineDescription } from '../../lib/stripeInvoiceLineDescription'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { StripeBillPreSubmitPreview } from './StripeBillPreSubmitPreview'
import StripeBillingModeToggle from './StripeBillingModeToggle'
import { HostedStripeBillPanel, type InvoiceWithJobForBillView } from './HostedStripeBillPanel'
import { StripeInvoiceLinesSummary } from './StripeInvoiceLinesSummary'
import { StripeInvoicePreviewMeta } from './StripeInvoicePreviewMeta'
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type JobBillingContext = {
  id: string
  master_user_id: string
  hcp_number: string | null
  job_name: string | null
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
}

export type SendRecordInvoicePayload =
  | { kind: 'job'; job: JobBillingContext }
  | { kind: 'invoice'; job: JobBillingContext; invoice: Pick<JobsLedgerInvoice, 'id' | 'amount' | 'status'> }

type ExternalChannel = 'housecallpro' | 'physical'

function channelButtonStyle(selected: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '0.5rem 0.75rem',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: selected ? 600 : 400,
    border: selected ? '2px solid #2563eb' : '1px solid #d1d5db',
    background: selected ? '#eff6ff' : 'white',
    color: '#111827',
  }
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoDatePlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function jobLedgerHasCustomerForBilling(customerId: string | null | undefined): boolean {
  return customerId != null && String(customerId).trim().length > 0
}

type CreateStripeInvoiceFnResponse = {
  success?: boolean
  idempotent?: boolean
  error?: string
  stripe_invoice_id?: string
  hosted_invoice_url?: string
  stripe_invoice_status?: string
  invoice_preview?: unknown
}

/** Bill Customer — Outside bill (date, note, amount) or Stripe hosted invoice. */
export default function SendRecordInvoiceModal({
  payload,
  onClose,
  onSuccess,
  onAfterEnsureSuccess,
  jobUpdating,
  invoiceUpdating,
  overlayZIndex = 60,
}: {
  payload: SendRecordInvoicePayload | null
  onClose: () => void
  onSuccess: () => Promise<void>
  onAfterEnsureSuccess?: () => void | Promise<void>
  jobUpdating: boolean
  invoiceUpdating: boolean
  /** Use &gt; JobFormModal (1010) when opened from Edit Job */
  overlayZIndex?: number
}) {
  const onAfterEnsureSuccessRef = useRef(onAfterEnsureSuccess)
  onAfterEnsureSuccessRef.current = onAfterEnsureSuccess

  const { role: authRole } = useAuth()

  const [tab, setTab] = useState<'outside' | 'stripe'>('stripe')
  const [channel, setChannel] = useState<ExternalChannel>('housecallpro')
  const [sentDate, setSentDate] = useState(todayIsoDate)
  const [externalNote, setExternalNote] = useState('')
  const [billAmountStr, setBillAmountStr] = useState('')
  const [outsideError, setOutsideError] = useState<string | null>(null)
  const [outsideSubmitting, setOutsideSubmitting] = useState(false)

  const [ensuredInvoice, setEnsuredInvoice] = useState<{ jobId: string; id: string; amount: number } | null>(null)
  const [ensureError, setEnsureError] = useState<string | null>(null)
  const [ensureLoading, setEnsureLoading] = useState(false)

  const [stripeDueDate, setStripeDueDate] = useState(() => isoDatePlusDays(30))
  const [stripeMemo, setStripeMemo] = useState('')
  const [stripeSubmitting, setStripeSubmitting] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [stripeResult, setStripeResult] = useState<{
    hosted_invoice_url: string
    stripe_invoice_id: string
    stripe_invoice_status: string | null
    idempotent?: boolean
    invoice_preview: StripeInvoiceLinesSnapshot | null
  } | null>(null)
  const [stripeSuccessInvoice, setStripeSuccessInvoice] = useState<InvoiceWithJobForBillView | null>(null)

  const [stripePreview, setStripePreview] = useState<StripeInvoicePreviewSuccess | null>(null)
  const [stripePreviewLoading, setStripePreviewLoading] = useState(false)
  const [stripePreviewError, setStripePreviewError] = useState<string | null>(null)
  const stripePreviewReqId = useRef(0)
  const [stripeModePref, setStripeModePref] = useState<BillingStripeModePref>(() => getBillingStripeModePref())
  const stripeModeForBilling: BillingStripeModePref = authRole === 'dev' ? stripeModePref : 'live'

  const open = payload !== null
  const kind = payload?.kind ?? 'job'
  const job = payload?.job ?? null
  const invoice = payload?.kind === 'invoice' ? payload.invoice : null

  useEffect(() => {
    if (!open || !job) return
    const hasCustomerEmail = (job.customer_email ?? '').trim().length > 0
    setTab(hasCustomerEmail ? 'stripe' : 'outside')
    setChannel('housecallpro')
    setSentDate(todayIsoDate())
    setExternalNote('')
    setOutsideError(null)
    setOutsideSubmitting(false)
    setEnsuredInvoice(null)
    setEnsureError(null)
    setEnsureLoading(false)
    setStripeDueDate(isoDatePlusDays(30))
    setStripeMemo('')
    setStripeSubmitting(false)
    setStripeError(null)
    setStripeResult(null)
    setStripeSuccessInvoice(null)
    setStripePreview(null)
    setStripePreviewLoading(false)
    setStripePreviewError(null)
    setStripeModePref(getBillingStripeModePref())
    if (invoice) {
      setBillAmountStr(String(Number(invoice.amount)))
    } else {
      setBillAmountStr('')
    }
  }, [open, job?.id, job?.customer_email, invoice?.id])

  // Ensure primary RTB line when opening for a job row (shared for Outside submit).
  useEffect(() => {
    if (!open || !job?.id || kind !== 'job') return
    if (ensuredInvoice?.jobId === job.id) return

    let cancelled = false
    setEnsureLoading(true)
    setEnsureError(null)

    void (async () => {
      try {
        const raw = await withSupabaseRetry(
          async () =>
            await supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: job.id,
            }),
          'ensure RTB invoice for Bill Customer'
        )
        if (cancelled) return
        const obj = raw as Record<string, unknown> | null
        if (obj && typeof obj.error === 'string' && obj.error.length > 0) {
          setEnsuredInvoice(null)
          setEnsureError(obj.error)
          return
        }
        if (obj?.ok === true && typeof obj.invoice_id === 'string') {
          const rawAmt = obj.amount
          const amt =
            typeof rawAmt === 'number' ? rawAmt : typeof rawAmt === 'string' ? Number(rawAmt) : NaN
          if (!Number.isFinite(amt)) {
            setEnsuredInvoice(null)
            setEnsureError('Unexpected response from server')
            return
          }
          setEnsuredInvoice({ jobId: job.id, id: obj.invoice_id, amount: amt })
          setBillAmountStr((prev) => (prev.trim() === '' ? String(amt) : prev))
          setEnsureError(null)
          try {
            await onAfterEnsureSuccessRef.current?.()
          } catch {
            /* ignore */
          }
        } else {
          setEnsuredInvoice(null)
          setEnsureError('Unexpected response from server')
        }
      } catch (e) {
        if (cancelled) return
        setEnsuredInvoice(null)
        setEnsureError(e instanceof Error ? e.message : 'Failed to ensure invoice')
      } finally {
        if (!cancelled) setEnsureLoading(false)
      }
    })()

    return () => {
      cancelled = true
      setEnsureLoading(false)
    }
  }, [open, job?.id, kind])

  useEffect(() => {
    if (!open || !job || tab !== 'stripe' || stripeResult || stripeSuccessInvoice) {
      return
    }

    const amt = Number(billAmountStr)
    const invId = kind === 'invoice' ? invoice?.id : ensuredInvoice?.id
    const outsideReadyForPreview =
      kind === 'invoice'
        ? invoice != null
        : kind === 'job' && ensuredInvoice != null && !ensureLoading && !ensureError

    const canPreview =
      jobLedgerHasCustomerForBilling(job.customer_id) &&
      (job.customer_email ?? '').trim().length > 0 &&
      Number.isFinite(amt) &&
      amt > 0 &&
      Boolean(invId) &&
      stripeDueDate.trim().length > 0 &&
      outsideReadyForPreview

    if (!canPreview) {
      setStripePreview(null)
      setStripePreviewLoading(false)
      setStripePreviewError(null)
      return
    }

    const handle = window.setTimeout(() => {
      const req = ++stripePreviewReqId.current
      setStripePreviewLoading(true)
      setStripePreviewError(null)
      setStripePreview(null)

      void (async () => {
        try {
          const { data: auth } = await supabase.auth.getSession()
          const token = auth.session?.access_token
          if (!token) {
            if (stripePreviewReqId.current === req) {
              setStripePreviewLoading(false)
              setStripePreviewError('Not signed in')
            }
            return
          }
          if (stripePreviewReqId.current !== req) return

          const { data: raw, error: fnErr } = await supabase.functions.invoke('preview-stripe-invoice', {
            body: {
              jobs_ledger_invoice_id: invId,
              customer_id: job.customer_id!,
              amount_dollars: amt,
              customer_email: (job.customer_email ?? '').trim(),
              customer_name: (job.customer_name ?? '').trim() || 'Customer',
              due_date: stripeDueDate.trim(),
              memo: stripeMemo.trim() || undefined,
              ...stripeModeInvokeBody(stripeModeForBilling),
            },
            headers: { Authorization: `Bearer ${token}` },
          })

          if (stripePreviewReqId.current !== req) return

          if (fnErr) {
            const detail = await readEdgeFunctionErrorBody(fnErr)
            setStripePreview(null)
            setStripePreviewError(detail ?? formatErrorMessage(fnErr, 'Preview failed'))
            return
          }

          const body = raw as Record<string, unknown> | null
          if (body && typeof body.error === 'string' && body.error.length > 0) {
            setStripePreview(null)
            setStripePreviewError(body.error)
            return
          }
          const parsedPreview = parseStripeInvoicePreviewResponse(body)
          if (parsedPreview) {
            setStripePreview(parsedPreview)
            setStripePreviewError(null)
          } else {
            setStripePreview(null)
            setStripePreviewError('Unexpected response from server')
          }
        } catch (e) {
          if (stripePreviewReqId.current !== req) return
          setStripePreview(null)
          setStripePreviewError(formatErrorMessage(e, 'Preview failed'))
        } finally {
          if (stripePreviewReqId.current === req) setStripePreviewLoading(false)
        }
      })()
    }, 450)

    return () => window.clearTimeout(handle)
  }, [
    open,
    job?.id,
    job?.customer_id,
    job?.customer_email,
    job?.customer_name,
    tab,
    stripeResult,
    stripeSuccessInvoice,
    billAmountStr,
    stripeDueDate,
    stripeMemo,
    kind,
    invoice?.id,
    ensuredInvoice?.id,
    ensureLoading,
    ensureError,
    authRole,
    stripeModeForBilling,
  ])

  async function confirmOutsideBill() {
    if (!job) return
    const amt = Number(billAmountStr)
    if (!Number.isFinite(amt) || amt <= 0) {
      setOutsideError('Enter a valid bill amount greater than 0')
      return
    }
    setOutsideSubmitting(true)
    setOutsideError(null)
    const sentAt = sentDate.trim() ? new Date(sentDate + 'T12:00:00').toISOString() : new Date().toISOString()
    try {
      if (kind === 'invoice' && invoice) {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_invoices')
              .update({
                status: 'billed',
                amount: amt,
                external_send_channel: channel,
                external_send_note: externalNote.trim() || null,
                sent_to_customer_at: sentAt,
              })
              .eq('id', invoice.id),
          'record outside bill on invoice'
        )
      } else {
        const invId = ensuredInvoice?.id
        if (!invId) {
          throw new Error(ensureError || 'Could not prepare invoice line for this job')
        }
        await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_invoices')
              .update({
                status: 'billed',
                amount: amt,
                external_send_channel: channel,
                external_send_note: externalNote.trim() || null,
                sent_to_customer_at: sentAt,
              })
              .eq('id', invId),
          'record outside bill on ensured invoice'
        )
        const data = await withSupabaseRetry(
          async () => supabase.rpc('update_job_status', { p_job_id: job.id, p_to_status: 'billed' }),
          'job status billed after outside bill'
        )
        const res = data as { error?: string } | null
        if (res?.error) throw new Error(res.error)
      }
      await onSuccess()
      onClose()
    } catch (e) {
      setOutsideError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setOutsideSubmitting(false)
    }
  }

  async function submitStripeInvoice() {
    if (!job?.customer_id) return
    const amt = Number(billAmountStr)
    if (!Number.isFinite(amt) || amt <= 0) {
      setStripeError('Enter a valid bill amount greater than 0')
      return
    }
    if (!(job.customer_email ?? '').trim()) {
      setStripeError('Customer email is required for Stripe invoices. Add it on Edit Job.')
      return
    }
    const invId = kind === 'invoice' ? invoice?.id : ensuredInvoice?.id
    if (!invId) {
      setStripeError(ensureError || 'Could not prepare invoice line for this job')
      return
    }
    if (!stripeDueDate.trim()) {
      setStripeError('Choose a due date')
      return
    }

    setStripeSubmitting(true)
    setStripeError(null)
    try {
      const { data: auth } = await supabase.auth.getSession()
      const token = auth.session?.access_token
      if (!token) {
        setStripeError('Not signed in')
        return
      }

      let body: CreateStripeInvoiceFnResponse | null
      const { data: invokeData, error: fnErr } = await supabase.functions.invoke('create-stripe-invoice', {
        body: {
          jobs_ledger_invoice_id: invId,
          customer_id: job.customer_id,
          amount_dollars: amt,
          customer_email: (job.customer_email ?? '').trim(),
          customer_name: (job.customer_name ?? '').trim() || 'Customer',
          due_date: stripeDueDate.trim(),
          memo: stripeMemo.trim() || undefined,
          ...stripeModeInvokeBody(stripeModeForBilling),
        },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (fnErr) {
        const detail = await readEdgeFunctionErrorBody(fnErr)
        setStripeError(detail ?? formatErrorMessage(fnErr, 'Stripe invoice failed'))
        return
      }
      body = invokeData as CreateStripeInvoiceFnResponse | null
      if (body && typeof body.error === 'string' && body.error.length > 0) {
        setStripeError(body.error)
        return
      }

      const hosted = typeof body?.hosted_invoice_url === 'string' ? body.hosted_invoice_url.trim() : ''
      const stripeId = typeof body?.stripe_invoice_id === 'string' ? body.stripe_invoice_id.trim() : ''
      if (!hosted || !stripeId) {
        setStripeError('Unexpected response from server')
        return
      }

      if (kind === 'job') {
        const dataRpc = await withSupabaseRetry(
          async () => supabase.rpc('update_job_status', { p_job_id: job.id, p_to_status: 'billed' }),
          'job status billed after stripe invoice',
        )
        const res = dataRpc as { error?: string } | null
        if (res?.error) {
          setStripeError(res.error)
          return
        }
      }

      const fresh = await fetchJobWithDetailsById(job.id)
      const row = fresh?.invoices?.find((i) => i.id === invId)
      if (fresh && row) {
        setStripeSuccessInvoice({ ...row, job: fresh })
        setStripeResult(null)
      } else {
        setStripeSuccessInvoice(null)
        setStripeResult({
          hosted_invoice_url: hosted,
          stripe_invoice_id: stripeId,
          stripe_invoice_status: typeof body?.stripe_invoice_status === 'string' ? body.stripe_invoice_status : null,
          idempotent: body?.idempotent === true,
          invoice_preview: parseStripeInvoiceLinesSnapshot(body?.invoice_preview),
        })
      }
      await onSuccess()
    } catch (e) {
      setStripeError(e instanceof Error ? e.message : 'Stripe invoice failed')
    } finally {
      setStripeSubmitting(false)
    }
  }

  if (!open || !job) return null

  const busy = jobUpdating || invoiceUpdating || outsideSubmitting || stripeSubmitting

  if (!jobLedgerHasCustomerForBilling(job.customer_id)) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: overlayZIndex,
        }}
      >
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 420, maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Bill Customer</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
            {job.hcp_number ?? '—'} · {job.job_name ?? '—'}
          </p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#b91c1c' }}>
            Link this job to a customer on the Jobs page before billing.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const outsideReady =
    kind === 'invoice'
      ? invoice != null
      : kind === 'job' && ensuredInvoice != null && !ensureLoading && !ensureError

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
      }}
    >
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 420, maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Bill Customer</h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              {job.hcp_number ?? '—'} · {job.job_name ?? '—'}
              {invoice ? ` · RTB $${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
            </p>
          </div>
          {tab === 'stripe' && !stripeResult && !stripeSuccessInvoice && authRole === 'dev' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.2rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: '#374151',
                flex: '0 0 auto',
              }}
            >
              <span>Stripe</span>
              <StripeBillingModeToggle
                value={stripeModePref}
                onChange={(next) => {
                  setStripeModePref(next)
                  setBillingStripeModePref(next)
                }}
                disabled={stripeSubmitting}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <button
            type="button"
            onClick={() => setTab('stripe')}
            style={{
              padding: '0.5rem 0.75rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === 'stripe' ? 600 : 400,
              borderBottom: tab === 'stripe' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -1,
              color: tab === 'stripe' ? 'inherit' : '#6b7280',
            }}
          >
            Stripe bill
          </button>
          <button
            type="button"
            onClick={() => setTab('outside')}
            style={{
              padding: '0.5rem 0.75rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === 'outside' ? 600 : 400,
              borderBottom: tab === 'outside' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -1,
              color: tab === 'outside' ? 'inherit' : '#6b7280',
            }}
          >
            Outside bill
          </button>
        </div>

        {tab === 'outside' && (
          <>
            {kind === 'job' && ensureLoading && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>Preparing billing line…</p>
            )}
            {kind === 'job' && !ensureLoading && ensureError && (
              <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{ensureError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button type="button" onClick={() => setChannel('housecallpro')} style={channelButtonStyle(channel === 'housecallpro')}>
                HouseCall Pro
              </button>
              <button type="button" onClick={() => setChannel('physical')} style={channelButtonStyle(channel === 'physical')}>
                Physical invoice
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '0.75rem',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: '1 1 8rem', minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                  Amount ($)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={billAmountStr}
                  onChange={(e) => setBillAmountStr(e.target.value)}
                  disabled={!outsideReady && kind === 'job'}
                  style={{ width: '100%', padding: '0.35rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Date</label>
                <input
                  type="date"
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                  style={{ width: '100%', padding: '0.35rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Memo (optional)</label>
            <textarea value={externalNote} onChange={(e) => setExternalNote(e.target.value)} rows={3} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem', boxSizing: 'border-box', resize: 'vertical' }} />
            {outsideError && <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{outsideError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!outsideReady || busy}
                onClick={() => void confirmOutsideBill()}
                style={{
                  padding: '0.5rem 1rem',
                  background: outsideReady && !busy ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: outsideReady && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                {busy ? '…' : 'Save'}
              </button>
            </div>
          </>
        )}

        {tab === 'stripe' && (
          <div style={{ padding: '0.5rem 0' }}>
            {kind === 'job' && ensureLoading && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>Preparing billing line…</p>
            )}
            {kind === 'job' && !ensureLoading && ensureError && (
              <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{ensureError}</p>
            )}
            {stripeSuccessInvoice ? (
              <>
                <p style={{ fontSize: '0.875rem', color: '#15803d', marginBottom: '0.75rem', fontWeight: 600 }}>
                  Stripe invoice created
                  {stripeSuccessInvoice.stripe_invoice_status
                    ? ` (${stripeSuccessInvoice.stripe_invoice_status})`
                    : ''}
                  .
                </p>
                <HostedStripeBillPanel invoice={stripeSuccessInvoice} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : stripeResult ? (
              <>
                <p style={{ fontSize: '0.875rem', color: '#15803d', marginBottom: '0.5rem', fontWeight: 600 }}>
                  {stripeResult.idempotent ? 'Stripe invoice already exists.' : 'Stripe invoice created.'}{' '}
                  {stripeResult.stripe_invoice_status ? `(${stripeResult.stripe_invoice_status})` : ''}
                </p>
                <p style={{ fontSize: '0.8125rem', color: '#b45309', marginBottom: '0.75rem' }}>
                  Could not reload job details; showing summary from the server response.
                </p>
                <StripeInvoiceSharePanel
                  hostedInvoiceUrl={stripeResult.hosted_invoice_url}
                  stripeInvoiceId={stripeResult.stripe_invoice_id}
                  customerEmail={job.customer_email}
                  customerName={job.customer_name}
                  jobName={job.job_name}
                  hcpNumber={job.hcp_number}
                  amountLabel={`$${Number(billAmountStr).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                {stripeResult.invoice_preview ? (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#374151',
                        margin: '0 0 0.35rem',
                      }}
                    >
                      Invoice (Stripe)
                    </div>
                    <StripeInvoicePreviewMeta
                      customerName={
                        stripeResult.invoice_preview.customer_name ?? job.customer_name
                      }
                      customerEmail={
                        stripeResult.invoice_preview.customer_email ?? job.customer_email
                      }
                      invoiceNumber={stripeResult.invoice_preview.invoice_number ?? null}
                      dueYmd={stripeDueDate}
                      memo={stripeMemo}
                    />
                    <StripeInvoiceLinesSummary snapshot={stripeResult.invoice_preview} showTitle={false} />
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: '1 1 8rem', minWidth: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                      Amount ($)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={billAmountStr}
                      onChange={(e) => setBillAmountStr(e.target.value)}
                      disabled={!outsideReady && kind === 'job'}
                      style={{ width: '100%', padding: '0.35rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                      Due date
                    </label>
                    <input
                      type="date"
                      value={stripeDueDate}
                      onChange={(e) => setStripeDueDate(e.target.value)}
                      style={{ width: '100%', padding: '0.35rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Memo (optional)</label>
                <textarea
                  value={stripeMemo}
                  onChange={(e) => setStripeMemo(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
                {job ? (
                  <StripeBillPreSubmitPreview
                    customerName={job.customer_name}
                    customerEmail={job.customer_email}
                    jobName={job.job_name}
                    hcpNumber={job.hcp_number}
                    amountLabel={
                      Number.isFinite(Number(billAmountStr)) && Number(billAmountStr) > 0
                        ? `$${Number(billAmountStr).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : '—'
                    }
                    dueDateYmd={stripeDueDate}
                    memo={stripeMemo}
                    localLineDescription={buildStripeInvoiceLineDescription(
                      (job.customer_name ?? '').trim() || 'Customer',
                      job.job_name,
                      job.hcp_number,
                    )}
                    stripePreview={stripePreview}
                    stripePreviewLoading={stripePreviewLoading}
                    stripePreviewError={stripePreviewError}
                    previewIdleHint={
                      kind === 'job' && ensureLoading
                        ? 'Preparing billing line…'
                        : kind === 'job' && !ensureLoading && ensureError
                          ? 'Fix the billing line error above, then enter amount and due date.'
                          : null
                    }
                  />
                ) : null}
                {stripeError && <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{stripeError}</p>}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!outsideReady || busy}
                    onClick={() => void submitStripeInvoice()}
                    style={{
                      padding: '0.5rem 1rem',
                      background: outsideReady && !busy ? '#3b82f6' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: outsideReady && !busy ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {busy ? '…' : 'Create Stripe invoice'}
                  </button>
                </div>
              </>
            )}
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '1rem', marginBottom: 0 }}>
              Creates a finalized Stripe invoice (hosted pay page). The job billing line moves to Billed. Payment still
              syncs via Stripe webhook when the customer pays.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
