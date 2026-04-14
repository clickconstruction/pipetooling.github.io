import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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
import {
  buildStripeInvoiceLineDescription,
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
} from '../../lib/stripeInvoiceLineDescription'
import {
  getStripeInvoiceFooterDefaultOnOpen,
  getStripeInvoiceFooterPresetElectrical,
  getStripeInvoiceFooterPresetPlumbing,
  STRIPE_INVOICE_FOOTER_MAX_CHARS,
  stripeInvoiceFooterActivePreset,
} from '../../lib/stripeInvoiceFooter'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { StripeBillPreSubmitPreview } from './StripeBillPreSubmitPreview'
import StripeBillingModeToggle from './StripeBillingModeToggle'
import { HostedStripeBillPanel, type InvoiceWithJobForBillView } from './HostedStripeBillPanel'
import { StripeInvoiceLinesSummary } from './StripeInvoiceLinesSummary'
import { StripeInvoicePreviewMeta } from './StripeInvoicePreviewMeta'
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'

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

/** Match Edit Job / JobFormModal field styling */
const BILL_CUSTOMER_FIELD_LABEL_STYLE: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 500,
  fontSize: '0.875rem',
  color: '#374151',
}

const BILL_CUSTOMER_CONTROL_STYLE: CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
  background: '#fff',
}

const BILL_CUSTOMER_TEXTAREA_STYLE: CSSProperties = {
  ...BILL_CUSTOMER_CONTROL_STYLE,
  resize: 'vertical',
  lineHeight: 1.4,
  minHeight: '4.25rem',
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

function defaultStripeLineDescriptionFromJob(j: JobBillingContext): string {
  return buildStripeInvoiceLineDescription(
    (j.customer_name ?? '').trim() || 'Customer',
    j.job_name,
    j.hcp_number,
  )
}

function stripeInvoiceFooterSummaryLine(
  footer: string,
  activePreset: ReturnType<typeof stripeInvoiceFooterActivePreset>,
): string {
  if (footer === '') return 'Stripe default'
  if (activePreset === 'plumbing') return 'Plumbing'
  if (activePreset === 'electrical') return 'Electrical'
  return 'Custom'
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
  const [editDueDateOpen, setEditDueDateOpen] = useState(false)
  const [draftDueYmd, setDraftDueYmd] = useState('')
  const [stripeLineDescription, setStripeLineDescription] = useState('')
  const [stripeMemo, setStripeMemo] = useState('')
  const [stripeInvoiceFooter, setStripeInvoiceFooter] = useState(() => getStripeInvoiceFooterDefaultOnOpen())
  const [stripeFooterSectionOpen, setStripeFooterSectionOpen] = useState(false)
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
  /** Keeps last known “had a preview” for stale-while-revalidate (timeout closure reads current value). */
  const stripePreviewExistsRef = useRef(false)
  const [stripeModePref, setStripeModePref] = useState<BillingStripeModePref>(() => getBillingStripeModePref())
  const stripeModeForBilling: BillingStripeModePref = authRole === 'dev' ? stripeModePref : 'live'

  const open = payload !== null
  const kind = payload?.kind ?? 'job'
  const job = payload?.job ?? null
  const invoice = payload?.kind === 'invoice' ? payload.invoice : null

  const activeStripeFooterPreset = stripeInvoiceFooterActivePreset(stripeInvoiceFooter)

  useLayoutEffect(() => {
    if (!open) {
      stripePreviewExistsRef.current = false
      return
    }
    stripePreviewExistsRef.current = stripePreview != null
  }, [open, stripePreview])

  useEffect(() => {
    if (!open) {
      setEnsuredInvoice(null)
      setEnsureError(null)
      setEnsureLoading(false)
      return
    }
    if (!job) return
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
    setEditDueDateOpen(false)
    setDraftDueYmd('')
    setStripeLineDescription(defaultStripeLineDescriptionFromJob(job))
    setStripeMemo('')
    setStripeInvoiceFooter(getStripeInvoiceFooterDefaultOnOpen())
    setStripeFooterSectionOpen(false)
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
          setBillAmountStr(String(amt))
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
      if (!stripePreviewExistsRef.current) {
        setStripePreview(null)
      }

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

          const lineDescTrim = stripeLineDescription.trim()
          const { data: raw, error: fnErr } = await supabase.functions.invoke('preview-stripe-invoice', {
            body: {
              jobs_ledger_invoice_id: invId,
              customer_id: job.customer_id!,
              amount_dollars: amt,
              customer_email: (job.customer_email ?? '').trim(),
              customer_name: (job.customer_name ?? '').trim() || 'Customer',
              due_date: stripeDueDate.trim(),
              ...(lineDescTrim ? { line_description: lineDescTrim } : {}),
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
    kind,
    invoice?.id,
    ensuredInvoice?.id,
    ensureLoading,
    ensureError,
    authRole,
    stripeModeForBilling,
    stripeLineDescription,
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
          () =>
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
          () =>
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
          () => supabase.rpc('update_job_status', { p_job_id: job.id, p_to_status: 'billed' }),
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
      const lineDescTrim = stripeLineDescription.trim()
      const { data: invokeData, error: fnErr } = await supabase.functions.invoke('create-stripe-invoice', {
        body: {
          jobs_ledger_invoice_id: invId,
          customer_id: job.customer_id,
          amount_dollars: amt,
          customer_email: (job.customer_email ?? '').trim(),
          customer_name: (job.customer_name ?? '').trim() || 'Customer',
          due_date: stripeDueDate.trim(),
          memo: stripeMemo.trim() || undefined,
          footer: stripeInvoiceFooter.trim() || undefined,
          ...(lineDescTrim ? { line_description: lineDescTrim } : {}),
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
          () => supabase.rpc('update_job_status', { p_job_id: job.id, p_to_status: 'billed' }),
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
  const stripeFallbackLedgerInvoiceId =
    kind === 'invoice' ? (invoice?.id ?? '') : (ensuredInvoice?.id ?? '')

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

  const billDateInputStyle: CSSProperties = {
    ...BILL_CUSTOMER_CONTROL_STYLE,
    colorScheme: 'light',
  }

  return (
    <Fragment>
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
              {invoice
                ? ` · RTB $${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : kind === 'job' && ensuredInvoice && !ensureLoading && !ensureError
                  ? ` · RTB $${Number(ensuredInvoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                  : ''}
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
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={BILL_CUSTOMER_FIELD_LABEL_STYLE}>Date</label>
              <input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} style={billDateInputStyle} />
            </div>
            <label style={BILL_CUSTOMER_FIELD_LABEL_STYLE}>Memo (optional)</label>
            <textarea
              value={externalNote}
              onChange={(e) => setExternalNote(e.target.value)}
              rows={3}
              style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: '0.75rem' }}
            />
            {outsideError && <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{outsideError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
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
                {stripeFallbackLedgerInvoiceId ? (
                  <StripeInvoiceSendFromStripeButton
                    jobsLedgerInvoiceId={stripeFallbackLedgerInvoiceId}
                    stripeInvoiceId={stripeResult.stripe_invoice_id}
                    customerEmail={job.customer_email}
                    stripeModeForBilling={stripeModeForBilling}
                  />
                ) : null}
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
                      footer={stripeInvoiceFooter}
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
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#111827',
                      marginBottom: '0.65rem',
                      textAlign: 'center',
                    }}
                  >
                    What appears on the invoice
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      marginBottom: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <label
                      htmlFor="bill-customer-stripe-line-description"
                      style={{
                        ...BILL_CUSTOMER_FIELD_LABEL_STYLE,
                        marginBottom: 0,
                        minWidth: 0,
                      }}
                    >
                      Line on bill
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#6b7280',
                          fontWeight: 400,
                        }}
                      >
                        {' '}
                        ({stripeLineDescription.length} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => job && setStripeLineDescription(defaultStripeLineDescriptionFromJob(job))}
                      disabled={!job}
                      title="Reset line on bill to default"
                      aria-label="Reset line on bill to default"
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        color: '#2563eb',
                        cursor: job ? 'pointer' : 'not-allowed',
                        fontSize: '0.8125rem',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                        flexShrink: 0,
                      }}
                    >
                      default
                    </button>
                  </div>
                  <textarea
                    id="bill-customer-stripe-line-description"
                    value={stripeLineDescription}
                    onChange={(e) =>
                      setStripeLineDescription(
                        e.target.value.slice(0, STRIPE_INVOICE_LINE_DESCRIPTION_MAX),
                      )
                    }
                    rows={2}
                    style={{
                      ...BILL_CUSTOMER_TEXTAREA_STYLE,
                      marginBottom: '0.65rem',
                      minHeight: '3.5rem',
                    }}
                  />
                  <label style={BILL_CUSTOMER_FIELD_LABEL_STYLE}>Memo (optional)</label>
                  <textarea
                    value={stripeMemo}
                    onChange={(e) => setStripeMemo(e.target.value)}
                    rows={2}
                    style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: '0.65rem', minHeight: '3.5rem' }}
                  />
                  <button
                    type="button"
                    aria-expanded={stripeFooterSectionOpen}
                    aria-controls="bill-customer-footer-section-panel"
                    onClick={() => setStripeFooterSectionOpen((v) => !v)}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      width: '100%',
                      marginBottom: stripeFooterSectionOpen ? '0.35rem' : '0.65rem',
                      padding: '0.4rem 0.25rem',
                      border: 'none',
                      borderRadius: 4,
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
                        {stripeFooterSectionOpen ? '▼' : '▶'}
                      </span>
                      <span
                        id="bill-customer-footer-disclosure-heading"
                        style={{
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          color: '#374151',
                        }}
                      >
                        Footer (optional)
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        flexShrink: 0,
                      }}
                    >
                      {stripeInvoiceFooterSummaryLine(stripeInvoiceFooter, activeStripeFooterPreset)}
                    </span>
                  </button>
                  <div
                    id="bill-customer-footer-section-panel"
                    role="region"
                    aria-labelledby="bill-customer-footer-disclosure-heading"
                    hidden={!stripeFooterSectionOpen}
                    style={{ marginBottom: '0.65rem' }}
                  >
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <span
                          id="bill-customer-stripe-invoice-footer-count"
                          style={{
                            fontSize: '0.72rem',
                            color: '#6b7280',
                            fontWeight: 400,
                            flex: '1 1 auto',
                            minWidth: 0,
                          }}
                        >
                          ({stripeInvoiceFooter.length} / {STRIPE_INVOICE_FOOTER_MAX_CHARS})
                        </span>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                            alignItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            aria-pressed={activeStripeFooterPreset === 'plumbing'}
                            onClick={() => {
                              if (activeStripeFooterPreset === 'plumbing') {
                                setStripeInvoiceFooter('')
                                return
                              }
                              setStripeInvoiceFooter(
                                getStripeInvoiceFooterPresetPlumbing().slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS),
                              )
                            }}
                            title="Plumbing footer (click again to clear and use Stripe default)"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              border:
                                activeStripeFooterPreset === 'plumbing'
                                  ? '2px solid #2563eb'
                                  : '1px solid #d1d5db',
                              borderRadius: 4,
                              background: activeStripeFooterPreset === 'plumbing' ? '#eff6ff' : '#f9fafb',
                              color: '#374151',
                              cursor: 'pointer',
                              fontWeight: activeStripeFooterPreset === 'plumbing' ? 600 : 500,
                            }}
                          >
                            Plumbing
                          </button>
                          <button
                            type="button"
                            aria-pressed={activeStripeFooterPreset === 'electrical'}
                            onClick={() => {
                              if (activeStripeFooterPreset === 'electrical') {
                                setStripeInvoiceFooter('')
                                return
                              }
                              setStripeInvoiceFooter(
                                getStripeInvoiceFooterPresetElectrical().slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS),
                              )
                            }}
                            title="Electrical footer (click again to clear and use Stripe default)"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              border:
                                activeStripeFooterPreset === 'electrical'
                                  ? '2px solid #2563eb'
                                  : '1px solid #d1d5db',
                              borderRadius: 4,
                              background: activeStripeFooterPreset === 'electrical' ? '#eff6ff' : '#f9fafb',
                              color: '#374151',
                              cursor: 'pointer',
                              fontWeight: activeStripeFooterPreset === 'electrical' ? 600 : 500,
                            }}
                          >
                            Electrical
                          </button>
                        </div>
                      </div>
                      <textarea
                        id="bill-customer-stripe-invoice-footer"
                        aria-labelledby="bill-customer-footer-disclosure-heading"
                        aria-describedby="bill-customer-stripe-invoice-footer-count"
                        value={stripeInvoiceFooter}
                        onChange={(e) =>
                          setStripeInvoiceFooter(e.target.value.slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS))
                        }
                        rows={3}
                        style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0, minHeight: '4.5rem' }}
                      />
                  </div>
                </div>
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
                    footer={stripeFooterSectionOpen ? stripeInvoiceFooter : ''}
                    localLineDescription={
                      stripeLineDescription.trim() || defaultStripeLineDescriptionFromJob(job)
                    }
                    stripePreview={stripePreview}
                    stripePreviewLoading={stripePreviewLoading}
                    stripePreviewError={stripePreviewError}
                    previewIdleHint={
                      kind === 'job' && ensureLoading
                        ? 'Preparing billing line…'
                        : kind === 'job' && !ensureLoading && ensureError
                          ? 'Fix the billing line error above, then edit due date from Preview when ready.'
                          : null
                    }
                    onEditDueDate={() => {
                      setDraftDueYmd(stripeDueDate)
                      setEditDueDateOpen(true)
                    }}
                  />
                ) : null}
                {stripeError && <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{stripeError}</p>}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
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
          </div>
        )}
      </div>
    </div>
    {editDueDateOpen ? (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: overlayZIndex + 20,
          padding: '1rem',
        }}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setEditDueDateOpen(false)
        }}
      >
        <div
          role="dialog"
          aria-labelledby="edit-stripe-due-date-title"
          style={{
            background: 'white',
            padding: '1.25rem',
            borderRadius: 8,
            minWidth: 280,
            maxWidth: 400,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id="edit-stripe-due-date-title" style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 600 }}>
            Edit Due Date
          </h2>
          <label style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, display: 'block' }}>Due date</label>
          <input
            type="date"
            value={draftDueYmd}
            onChange={(e) => setDraftDueYmd(e.target.value)}
            style={{ ...billDateInputStyle, marginBottom: '1rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setEditDueDateOpen(false)}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setStripeDueDate(draftDueYmd.trim())
                setEditDueDateOpen(false)
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </Fragment>
  )
}
