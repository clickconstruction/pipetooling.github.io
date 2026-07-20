import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE } from '../../lib/appSettingsKeys'
import { parseFieldDispatchPhoneFromValueText } from '../../lib/fieldDispatchPhone'
import { formatWaitingLabelFromCertifiedAt } from '../../lib/formatElapsedCountUp'
import { formatCollectPaymentInvoiceEmailLastSentLabel } from '../../lib/formatCollectPaymentInvoiceEmailLastSentLabel'
import FieldDispatchPhoneIcon from '../icons/FieldDispatchPhoneIcon'
import { useIntervalNowMs } from '../../hooks/useIntervalNowMs'
import {
  stripeDashboardInvoiceUrl,
  stripeModeInvokeBody,
  type BillingStripeModePref,
} from '../../lib/billingStripeModePref'
import { useAuth } from '../../hooks/useAuth'
import {
  IMPERSONATION_CHROME_BUTTON_STYLE,
  isImpersonationSessionActive,
} from '../../lib/impersonationSession'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { invokeVoidStripeInvoiceForCollectPaymentSendBack } from '../../lib/voidStripeInvoiceForRevert'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

type CertifyFixture = {
  id: string
  name: string
  count: number
  line_unit_price: number | null
  line_description: string | null
  sequence_order: number
}

type CertifyInvoice = {
  id: string
  amount: number
  status: string
  sequence_order: number
  estimated_bill_date: string | null
} | null

/** Billed line linked from collect flow (hosted Stripe invoice for step 3). */
type CollectInvoice = {
  id: string
  amount: number
  status: string
  hosted_invoice_url: string | null
  stripe_invoice_id: string | null
  sent_to_customer_at?: string | null
} | null

type FlowRow = {
  id?: string
  status?: string
  certify_mode?: string | null
  certified_at?: string | null
} | null

type BillingCustomer = {
  email: string | null
  name: string | null
}

type CertifyPayload = {
  fixtures: CertifyFixture[]
  invoice: CertifyInvoice
  flow: FlowRow
  collect_invoice?: CollectInvoice
  billing_customer?: BillingCustomer | null
  /** From job's linked bid; filters Job Book rows client-side (universal rows have null service_type_id). */
  job_service_type_id?: string | null
  error?: string
}

type JobBookCatalogRow = {
  id: string
  work_label: string
  unit_cost: number
  service_type_id: string | null
  sequence_order: number
}

type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  hcpNumber: string
  jobName: string
  /** From dashboard row when known (avoids flash). */
  initialFlowStatus?: string | null
  onFlowChanged?: () => void
  stripeModeForBilling: BillingStripeModePref
}

function lineTotalDollars(f: CertifyFixture): number {
  const u = f.line_unit_price != null ? Number(f.line_unit_price) : 0
  return Math.round(f.count * u * 100) / 100
}

function CollectPaymentFixturesLineItemsTable({ fixtures }: { fixtures: CertifyFixture[] }) {
  return (
    <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
      <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-subtle)' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Item</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Qty</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {fixtures.map((f) => (
            <tr key={f.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: 8 }}>
                {f.name}
                {f.line_description ? (
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>{f.line_description}</span>
                ) : null}
              </td>
              <td style={{ padding: 8, textAlign: 'right' }}>{f.count}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>
                ${lineTotalDollars(f).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const COLLECT_PAYMENT_EMAIL_MAX = 320

function isValidCollectPaymentEmail(raw: string): boolean {
  const t = raw.trim()
  if (!t || t.length > COLLECT_PAYMENT_EMAIL_MAX || !t.includes('@')) return false
  return true
}

function collectPaymentAddFixtureFromJobBookErrorMessage(code: string): string {
  switch (code) {
    case 'job_book_entry_not_found':
      return 'That line is no longer in the Job Book.'
    case 'job_book_entry_service_type_mismatch':
      return 'That line does not apply to this job’s service type.'
    case 'forbidden':
      return 'You can’t add lines on this job.'
    case 'not_authenticated':
      return 'Sign in to add lines.'
    default:
      return code
  }
}

/** Font Awesome Free v7.2.0 arrows-rotate — sync / refresh (license: fontawesome.com/license/free). */
function CollectPaymentRefreshIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      className={className}
      style={style}
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M129.9 292.5C143.2 199.5 223.3 128 320 128C373 128 421 149.5 455.8 184.2C456 184.4 456.2 184.6 456.4 184.8L464 192L416.1 192C398.4 192 384.1 206.3 384.1 224C384.1 241.7 398.4 256 416.1 256L544.1 256C561.8 256 576.1 241.7 576.1 224L576.1 96C576.1 78.3 561.8 64 544.1 64C526.4 64 512.1 78.3 512.1 96L512.1 149.4L500.8 138.7C454.5 92.6 390.5 64 320 64C191 64 84.3 159.4 66.6 283.5C64.1 301 76.2 317.2 93.7 319.7C111.2 322.2 127.4 310 129.9 292.6zM573.4 356.5C575.9 339 563.7 322.8 546.3 320.3C528.9 317.8 512.6 330 510.1 347.4C496.8 440.4 416.7 511.9 320 511.9C267 511.9 219 490.4 184.2 455.7C184 455.5 183.8 455.3 183.6 455.1L176 447.9L223.9 447.9C241.6 447.9 255.9 433.6 255.9 415.9C255.9 398.2 241.6 383.9 223.9 383.9L96 384C87.5 384 79.3 387.4 73.3 393.5C67.3 399.6 63.9 407.7 64 416.3L65 543.3C65.1 561 79.6 575.2 97.3 575C115 574.8 129.2 560.4 129 542.7L128.6 491.2L139.3 501.3C185.6 547.4 249.5 576 320 576C449 576 555.7 480.6 573.4 356.5z"
      />
    </svg>
  )
}

export default function CollectPaymentModal({
  open,
  onClose,
  jobId,
  hcpNumber,
  jobName,
  initialFlowStatus,
  onFlowChanged,
  stripeModeForBilling,
}: Props) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loadingPayload, setLoadingPayload] = useState(false)
  const [payload, setPayload] = useState<CertifyPayload | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  /** From get-stripe-invoice-details: same resolution as send-stripe-invoice; null until loaded or on error. */
  const [stripeEmailResolved, setStripeEmailResolved] = useState<string | null>(null)
  const [stripeEmailLoading, setStripeEmailLoading] = useState(false)
  const [stripeEmailError, setStripeEmailError] = useState<string | null>(null)
  /** Bumps to re-run Stripe email fetch after correcting email on step 3. */
  const [stripeEmailFetchGen, setStripeEmailFetchGen] = useState(0)
  const [changeEmailOpen, setChangeEmailOpen] = useState(false)
  const [changeEmailDraft, setChangeEmailDraft] = useState('')
  const [changeEmailBaseline, setChangeEmailBaseline] = useState('')
  const [changeEmailSaving, setChangeEmailSaving] = useState(false)
  const [sendBackOpen, setSendBackOpen] = useState(false)
  const [sendBackNote, setSendBackNote] = useState('')
  const [sendingBack, setSendingBack] = useState(false)
  const sendBackTitleId = useId()
  const [certifyMode, setCertifyMode] = useState<'clean' | 'correction_requested'>('clean')
  const [correctionNotes, setCorrectionNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [flowStatus, setFlowStatus] = useState<string | null>(initialFlowStatus ?? null)
  const [dispatchPhone, setDispatchPhone] = useState(() => parseFieldDispatchPhoneFromValueText(null))
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  /** Clears Stripe email label only when collect_invoice id changes, not on stripeEmailFetchGen-only refetch. */
  const stripeEmailFetchInvIdRef = useRef<string | null>(null)
  const dispatchWaitNowMs = useIntervalNowMs(1000)
  const [jobBookAll, setJobBookAll] = useState<JobBookCatalogRow[]>([])
  const [jobBookLoading, setJobBookLoading] = useState(false)
  const [addingJobBookEntryId, setAddingJobBookEntryId] = useState<string | null>(null)
  const [jobBookSearchQuery, setJobBookSearchQuery] = useState('')
  const [jobBookSectionExpanded, setJobBookSectionExpanded] = useState(false)
  const jobBookSectionHeaderId = useId()
  const jobBookSectionPanelId = useId()

  const jobBookFiltered = useMemo(() => {
    const st = payload?.job_service_type_id ?? null
    return jobBookAll.filter((r) => r.service_type_id == null || r.service_type_id === st)
  }, [jobBookAll, payload?.job_service_type_id])

  const jobBookSearchRows = useMemo(() => {
    const q = jobBookSearchQuery.trim().toLowerCase()
    if (!q) return jobBookFiltered
    return jobBookFiltered.filter((r) => r.work_label.toLowerCase().includes(q))
  }, [jobBookFiltered, jobBookSearchQuery])

  const refreshFlowFromPayload = useCallback(
    async (setStepFromFlow: boolean) => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.rpc('get_collect_payment_certify_payload', { p_job_id: jobId }),
          'get_collect_payment_certify_payload',
        )
        const raw = data as unknown
        if (raw && typeof raw === 'object' && raw !== null && 'error' in raw) {
          return
        }
        const p = raw as CertifyPayload
        setPayload(p)
        const st = (p.flow as { status?: string } | null)?.status ?? null
        setFlowStatus(st)
        if (setStepFromFlow) {
          if (st === 'approved_for_terminal') setStep(3)
          else if (st === 'pending_dispatch') setStep(2)
          else setStep(1)
        }
      } catch {
        /* ignore refresh errors (e.g. tab backgrounded) */
      }
    },
    [jobId],
  )

  useEffect(() => {
    if (open) return
    setJobBookAll([])
    setJobBookLoading(false)
    setAddingJobBookEntryId(null)
    setJobBookSearchQuery('')
    setJobBookSectionExpanded(false)
  }, [open])

  useEffect(() => {
    if (!open || step !== 1 || loadingPayload || !payload) return
    let cancelled = false
    setJobBookLoading(true)
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            supabase
              .from('job_book_entries')
              .select('id, work_label, unit_cost, service_type_id, sequence_order')
              .order('sequence_order', { ascending: true }),
          'job_book_entries collect payment modal',
        )
        if (cancelled) return
        setJobBookAll((rows ?? []) as JobBookCatalogRow[])
      } catch {
        if (!cancelled) {
          setJobBookAll([])
          showToast('Could not load Job Book', 'error')
        }
      } finally {
        if (!cancelled) setJobBookLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, step, loadingPayload, payload, showToast])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setDispatchPhone(parseFieldDispatchPhoneFromValueText(null))
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('app_settings')
              .select('value_text')
              .eq('key', APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE)
              .maybeSingle(),
          'load field dispatch phone for collect payment modal',
        )
        if (cancelled) return
        const vt = (data as { value_text: string | null } | null)?.value_text
        setDispatchPhone(parseFieldDispatchPhoneFromValueText(vt))
      } catch {
        if (!cancelled) setDispatchPhone(parseFieldDispatchPhoneFromValueText(null))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setFlowStatus(initialFlowStatus ?? null)
    setStep(1)
    setCertifyMode('clean')
    setCorrectionNotes('')
    setLoadingPayload(true)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.rpc('get_collect_payment_certify_payload', { p_job_id: jobId }),
          'get_collect_payment_certify_payload',
        )
        setLoadingPayload(false)
        const raw = data as unknown
        if (raw && typeof raw === 'object' && raw !== null && 'error' in raw) {
          const err = (raw as { error?: string }).error ?? 'Unable to load'
          showToast(err, 'error')
          setPayload(null)
          return
        }
        const p = raw as CertifyPayload
        setPayload(p)
        const st = (p.flow as { status?: string } | null)?.status ?? null
        setFlowStatus(st)
        if (st === 'approved_for_terminal') setStep(3)
        else if (st === 'pending_dispatch') setStep(2)
        else setStep(1)
      } catch (e) {
        setLoadingPayload(false)
        showToast(formatErrorMessage(e, 'Failed to load certify data'), 'error')
      }
    })()
  }, [open, jobId, showToast, initialFlowStatus])

  useEffect(() => {
    if (!open || !jobId) return
    const ch = supabase
      .channel(`job_collect_payment_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_collect_payment_flows',
          filter: `job_id=eq.${jobId}`,
        },
        (evt) => {
          const row = evt.new as { status?: string } | null
          if (row?.status === 'approved_for_terminal') {
            showToast('Dispatch approved — open the payment page when you are ready.', 'success')
          }
          void refreshFlowFromPayload(true)
          onFlowChanged?.()
        },
      )
      .subscribe()
    channelRef.current = ch
    return () => {
      void supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [open, jobId, refreshFlowFromPayload, onFlowChanged, showToast])

  useEffect(() => {
    if (!open || step !== 3) {
      stripeEmailFetchInvIdRef.current = null
      setStripeEmailResolved(null)
      setStripeEmailLoading(false)
      setStripeEmailError(null)
      return
    }
    const invId = payload?.collect_invoice?.id?.trim() ?? ''
    if (!invId) {
      stripeEmailFetchInvIdRef.current = null
      setStripeEmailResolved(null)
      setStripeEmailLoading(false)
      setStripeEmailError(null)
      return
    }
    let cancelled = false
    const ac = new AbortController()
    setStripeEmailLoading(true)
    setStripeEmailError(null)
    if (stripeEmailFetchInvIdRef.current !== invId) {
      stripeEmailFetchInvIdRef.current = invId
      setStripeEmailResolved(null)
    }
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession()
        const token = auth.session?.access_token
        if (!token) {
          if (!cancelled) {
            setStripeEmailError('Not signed in')
            setStripeEmailLoading(false)
          }
          return
        }
        const { data: raw, error: fnErr } = await supabase.functions.invoke('get-stripe-invoice-details', {
          body: {
            jobs_ledger_invoice_id: invId,
            ...stripeModeInvokeBody(stripeModeForBilling),
          },
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        })
        if (cancelled || ac.signal.aborted) return
        if (fnErr) {
          const detail = await readEdgeFunctionErrorBody(fnErr)
          setStripeEmailError(detail ?? formatErrorMessage(fnErr, 'Could not load Stripe email'))
          setStripeEmailLoading(false)
          return
        }
        const data = raw as Record<string, unknown> | null
        if (data && typeof data.error === 'string' && data.error.length > 0) {
          setStripeEmailError(data.error)
          setStripeEmailLoading(false)
          return
        }
        if (data?.success !== true) {
          setStripeEmailError('Unexpected response from server')
          setStripeEmailLoading(false)
          return
        }
        const em =
          typeof data.customer_email === 'string' && data.customer_email.trim()
            ? data.customer_email.trim()
            : null
        setStripeEmailResolved(em)
        setStripeEmailError(null)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!cancelled) {
          setStripeEmailError(formatErrorMessage(e, 'Could not load Stripe email'))
        }
      } finally {
        if (!cancelled && !ac.signal.aborted) setStripeEmailLoading(false)
      }
    })()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [open, step, payload?.collect_invoice?.id, stripeModeForBilling, stripeEmailFetchGen])

  useEffect(() => {
    if (!open || step !== 3) {
      setChangeEmailOpen(false)
      setChangeEmailDraft('')
      setChangeEmailBaseline('')
      setChangeEmailSaving(false)
      setSendBackOpen(false)
      setSendBackNote('')
    }
  }, [open, step])

  useEffect(() => {
    if (!open) {
      setSendBackOpen(false)
      setSendBackNote('')
      setSendingBack(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refreshFlowFromPayload(true)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [open, refreshFlowFromPayload])

  async function handleAddFromJobBook(entryId: string) {
    setAddingJobBookEntryId(entryId)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('add_collect_payment_fixture_from_job_book', {
            p_job_id: jobId,
            p_job_book_entry_id: entryId,
          }),
        'add_collect_payment_fixture_from_job_book',
      )
      const raw = data as unknown
      if (raw && typeof raw === 'object' && raw !== null && 'error' in raw) {
        const code = String((raw as { error?: string }).error ?? 'failed')
        showToast(collectPaymentAddFixtureFromJobBookErrorMessage(code), 'error')
        return
      }
      showToast('Line added to job', 'success')
      await refreshFlowFromPayload(false)
      onFlowChanged?.()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add line'), 'error')
    } finally {
      setAddingJobBookEntryId(null)
    }
  }

  async function handleSubmitCertify() {
    setSubmitting(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('submit_collect_payment_certification', {
            p_job_id: jobId,
            p_mode: certifyMode,
            p_correction_notes:
              certifyMode === 'correction_requested' ? correctionNotes : undefined,
            p_per_line_notes: undefined,
          }),
        'submit_collect_payment_certification',
      )
      const raw = data as unknown
      if (raw && typeof raw === 'object' && raw !== null && 'error' in raw) {
        showToast(String((raw as { error?: string }).error ?? 'Submit failed'), 'error')
        return
      }
      showToast(
        certifyMode === 'clean'
          ? 'Certification sent to dispatch.'
          : 'Correction request sent to dispatch.',
        'success',
      )
      setFlowStatus('pending_dispatch')
      setStep(2)
      await refreshFlowFromPayload(false)
      onFlowChanged?.()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Submit failed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReturnCollectPaymentToDispatch() {
    const note = sendBackNote.trim()
    if (note.length < 3) {
      showToast('Describe the issue (at least 3 characters).', 'error')
      return
    }
    setSendingBack(true)
    try {
      const collectInv = payload?.collect_invoice
      const collectInvId = collectInv?.id?.trim() ?? ''
      if (collectInv?.status === 'billed' && collectInvId.length > 0) {
        const { data: auth } = await supabase.auth.getSession()
        const token = auth.session?.access_token
        if (!token) {
          showToast('Not signed in', 'error')
          return
        }
        const revert = await invokeVoidStripeInvoiceForCollectPaymentSendBack({
          jobId,
          invoiceId: collectInvId,
          stripeModeForBilling,
          accessToken: token,
        })
        if (!revert.ok) {
          showToast(revert.message, 'error')
          return
        }
      }

      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('return_collect_payment_to_dispatch', {
            p_job_id: jobId,
            p_note: note,
          }),
        'return_collect_payment_to_dispatch',
      )
      const raw = data as unknown
      if (raw && typeof raw === 'object' && raw !== null && 'error' in raw) {
        showToast(String((raw as { error?: string }).error ?? 'Could not send back'), 'error')
        return
      }
      showToast('Sent back to dispatch. They will fix the invoice and re-approve.', 'success')
      setSendBackOpen(false)
      setSendBackNote('')
      setFlowStatus('pending_dispatch')
      setStep(2)
      await refreshFlowFromPayload(false)
      onFlowChanged?.()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not send back'), 'error')
    } finally {
      setSendingBack(false)
    }
  }

  async function copyPaymentLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      showToast('Payment link copied', 'success')
    } catch {
      showToast('Could not copy link', 'error')
    }
  }

  async function saveCollectPaymentCustomerEmail() {
    const invId = payload?.collect_invoice?.id?.trim() ?? ''
    if (!invId || changeEmailSaving) return
    const trimmed = changeEmailDraft.trim()
    if (!isValidCollectPaymentEmail(changeEmailDraft)) {
      showToast('Enter a valid email', 'error')
      return
    }
    if (trimmed.toLowerCase() === changeEmailBaseline.trim().toLowerCase()) return

    setChangeEmailSaving(true)
    try {
      const { data: auth } = await supabase.auth.getSession()
      const token = auth.session?.access_token
      if (!token) {
        showToast('Not signed in', 'error')
        return
      }
      const { data: raw, error: fnErr } = await supabase.functions.invoke(
        'update-collect-payment-stripe-customer-email',
        {
          body: {
            jobs_ledger_invoice_id: invId,
            customer_email: trimmed,
            ...stripeModeInvokeBody(stripeModeForBilling),
          },
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (fnErr) {
        const detail = await readEdgeFunctionErrorBody(fnErr)
        showToast(detail ?? formatErrorMessage(fnErr, 'Could not update email'), 'error')
        return
      }
      const body = raw as Record<string, unknown> | null
      if (body && typeof body.error === 'string' && body.error.length > 0) {
        showToast(body.error, 'error')
        return
      }
      if (body?.success !== true) {
        showToast('Unexpected response from server', 'error')
        return
      }
      const resolved =
        typeof body.customer_email === 'string' && body.customer_email.trim()
          ? body.customer_email.trim()
          : trimmed
      setStripeEmailResolved(resolved)
      showToast('Email updated for Stripe and billing', 'success')
      setChangeEmailOpen(false)
      setChangeEmailDraft('')
      setChangeEmailBaseline('')
      await refreshFlowFromPayload(false)
      setStripeEmailFetchGen((g) => g + 1)
      onFlowChanged?.()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not update email'), 'error')
    } finally {
      setChangeEmailSaving(false)
    }
  }

  async function sendInvoiceEmailToCustomer() {
    const invId = payload?.collect_invoice?.id?.trim() ?? ''
    if (!invId || emailSending) return
    setEmailSending(true)
    try {
      const { data: auth } = await supabase.auth.getSession()
      const token = auth.session?.access_token
      if (!token) {
        showToast('Not signed in', 'error')
        return
      }
      const { data: raw, error: fnErr } = await supabase.functions.invoke('send-stripe-invoice', {
        body: {
          jobs_ledger_invoice_id: invId,
          ...stripeModeInvokeBody(stripeModeForBilling),
        },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (fnErr) {
        const detail = await readEdgeFunctionErrorBody(fnErr)
        showToast(detail ?? formatErrorMessage(fnErr, 'Could not send invoice email'), 'error')
        return
      }
      const body = raw as Record<string, unknown> | null
      if (body && typeof body.error === 'string' && body.error.length > 0) {
        showToast(body.error, 'error')
        return
      }
      if (body?.success !== true) {
        showToast('Unexpected response from server', 'error')
        return
      }
      const testHint =
        stripeModeForBilling === 'test'
          ? ' Test mode: Stripe does not deliver a real customer email, but the send succeeded.'
          : ''
      showToast(`Stripe sent the invoice email.${testHint}`, 'success')
      void refreshFlowFromPayload(false)
      onFlowChanged?.()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not send invoice email'), 'error')
    } finally {
      setEmailSending(false)
    }
  }

  if (!open) return null

  const titleId = 'collect-payment-modal-title'

  const dispatchWaitElapsedLabel =
    step === 2
      ? formatWaitingLabelFromCertifiedAt(dispatchWaitNowMs, payload?.flow?.certified_at)
      : null

  const collectInv = payload?.collect_invoice
  const lastInvoiceEmailSentLabel = formatCollectPaymentInvoiceEmailLastSentLabel(
    dispatchWaitNowMs,
    collectInv?.sent_to_customer_at,
  )
  const invOkForEmail =
    Boolean(collectInv?.id?.trim()) && (collectInv?.status ?? '') === 'billed'
  const stripeEmailLoadDone = !stripeEmailLoading
  const hasStripeEmailForSend = Boolean((stripeEmailResolved ?? '').trim())
  const blockEmailSend = stripeEmailLoadDone && !hasStripeEmailForSend && !stripeEmailError
  const emailInvoiceDisabled =
    emailSending || !invOkForEmail || stripeEmailLoading || blockEmailSend

  const collectStripeInvoiceId = (collectInv?.stripe_invoice_id ?? '').trim()
  const impersonatingUi = isImpersonationSessionActive()
  const showStripeDashDevLink = role === 'dev' || impersonatingUi
  const stripeDashOpenEnabled = showStripeDashDevLink && Boolean(collectStripeInvoiceId)

  const stripeDashButtonStyle = impersonatingUi
    ? ({
        ...IMPERSONATION_CHROME_BUTTON_STYLE,
        fontSize: '0.75rem',
        flexShrink: 0,
        cursor: stripeDashOpenEnabled ? 'pointer' : 'not-allowed',
        opacity: stripeDashOpenEnabled ? 1 : 0.55,
      } as const)
    : ({
        padding: '0.35rem 0.55rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        borderRadius: 6,
        border: '1px solid var(--border-strong)',
        background: stripeDashOpenEnabled ? 'var(--bg-slate-tint)' : 'var(--bg-muted)',
        color: stripeDashOpenEnabled ? 'var(--text-blue-800)' : 'var(--text-faint)',
        cursor: stripeDashOpenEnabled ? 'pointer' : 'not-allowed',
        flexShrink: 0,
      } as const)

  const stripeDashTitle =
    !collectStripeInvoiceId
      ? 'No Stripe invoice id on this line'
      : impersonatingUi
        ? 'Open this invoice in Stripe Dashboard (while impersonating)'
        : 'Open this invoice in Stripe Dashboard (dev)'
  const stripeDashAriaLabel = stripeDashTitle

  const canSendBackToDispatch =
    step === 3 &&
    !loadingPayload &&
    (flowStatus === 'approved_for_terminal' || payload?.flow?.status === 'approved_for_terminal')

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        if (sendBackOpen) {
          setSendBackOpen(false)
          setSendBackNote('')
          e.stopPropagation()
          return
        }
        onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'hidden',
          margin: '1rem',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
            margin: '0 0 1rem',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: '1.25rem' }}>
              Collect Payment
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {hcpNumber} · {jobName}
            </p>
          </div>
          {step === 3 ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                margin: '-0.25rem -0.25rem 0 0',
              }}
            >
              {showStripeDashDevLink ? (
                <button
                  type="button"
                  disabled={!collectStripeInvoiceId}
                  onClick={() => {
                    if (!collectStripeInvoiceId) return
                    window.open(
                      stripeDashboardInvoiceUrl(collectStripeInvoiceId, stripeModeForBilling),
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }}
                  aria-label={stripeDashAriaLabel}
                  title={stripeDashTitle}
                  style={stripeDashButtonStyle}
                >
                  Stripe
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void refreshFlowFromPayload(true)}
                aria-label="Refresh payment status"
                title="Refresh payment status"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  padding: 0,
                  border: 'none',
                  borderRadius: 8,
                  background: 'transparent',
                  color: 'var(--text-600)',
                  cursor: 'pointer',
                }}
              >
                <CollectPaymentRefreshIcon style={{ width: 22, height: 22 }} />
              </button>
            </div>
          ) : null}
        </div>

        <div
          style={{
            marginBottom: '1rem',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Step {step} of 3:{' '}
          {step === 1 ? 'Certify line items' : step === 2 ? 'Awaiting dispatch' : 'Customer pays'}
        </div>

        {loadingPayload ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p>
        ) : step === 1 ? (
          <div>
            {payload?.invoice ? (
              <p style={{ fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                Draft invoice total:{' '}
                <strong>
                  ${Number(payload.invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
              </p>
            ) : (payload?.fixtures ?? []).length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-amber-700)', margin: '0 0 0.75rem' }}>
                No Ready-to-Bill invoice row yet. Office may need to add a bill line first.
              </p>
            ) : null}
            <CollectPaymentFixturesLineItemsTable fixtures={payload?.fixtures ?? []} />
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                id={jobBookSectionHeaderId}
                aria-expanded={jobBookSectionExpanded}
                aria-controls={jobBookSectionPanelId}
                onClick={() => setJobBookSectionExpanded((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  width: '100%',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  margin: '0 0 0.5rem',
                  color: 'var(--text-700)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'center',
                  padding: '0.25rem 0',
                }}
              >
                <span aria-hidden style={{ fontSize: '0.65rem', lineHeight: 1 }}>
                  {jobBookSectionExpanded ? '▼' : '▶'}
                </span>
                Add line items from Job Book
              </button>
              {jobBookSectionExpanded ? (
                <div id={jobBookSectionPanelId} role="region" aria-labelledby={jobBookSectionHeaderId}>
                  {jobBookLoading ? (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Loading Job Book…</p>
                  ) : jobBookFiltered.length === 0 ? (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-amber-700)', margin: 0 }}>
                      {jobBookAll.length === 0
                        ? 'No Job Book lines yet. Ask office staff to add entries in Settings → Job Book.'
                        : 'No Job Book lines match this job’s service type. Use “All types” lines or ask office to add entries for this type.'}
                    </p>
                  ) : (
                    <>
                      <input
                        type="search"
                        value={jobBookSearchQuery}
                        onChange={(e) => setJobBookSearchQuery(e.target.value)}
                        placeholder="Search work…"
                        aria-label="Search Job Book lines"
                        autoComplete="off"
                        style={{
                          display: 'block',
                          width: '100%',
                          boxSizing: 'border-box',
                          margin: '0 0 0.75rem',
                          padding: '0.45rem 0.6rem',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          fontSize: '0.875rem',
                        }}
                      />
                      {jobBookSearchRows.length === 0 ? (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                          No lines match your search.
                        </p>
                      ) : (
                        <div
                          style={{
                            maxHeight: 220,
                            overflow: 'auto',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                          }}
                        >
                          <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-subtle)' }}>
                                <th style={{ textAlign: 'left', padding: 8 }}>Work</th>
                                <th style={{ textAlign: 'right', padding: 8 }}>Cost</th>
                                <th style={{ padding: 8, width: 88 }} />
                              </tr>
                            </thead>
                            <tbody>
                              {jobBookSearchRows.map((row) => (
                                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td style={{ padding: 8 }}>{row.work_label}</td>
                                  <td style={{ padding: 8, textAlign: 'right' }}>
                                    ${Number(row.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: 8, textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      disabled={addingJobBookEntryId !== null}
                                      onClick={() => void handleAddFromJobBook(row.id)}
                                      style={{
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.75rem',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: addingJobBookEntryId !== null ? 'not-allowed' : 'pointer',
                                        opacity: addingJobBookEntryId === row.id ? 0.7 : 1,
                                      }}
                                    >
                                      {addingJobBookEntryId === row.id ? 'Adding…' : 'Add'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="certifyMode"
                  checked={certifyMode === 'clean'}
                  onChange={() => setCertifyMode('clean')}
                />
                <span>Certify — line items match work completed</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="certifyMode"
                  checked={certifyMode === 'correction_requested'}
                  onChange={() => setCertifyMode('correction_requested')}
                />
                <span>Request correction from office</span>
              </label>
            </div>
            {certifyMode === 'correction_requested' ? (
              <textarea
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
                placeholder="What needs to change?"
                rows={4}
                style={{
                  width: '100%',
                  marginTop: '0.75rem',
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  boxSizing: 'border-box',
                }}
              />
            ) : null}
          </div>
        ) : step === 2 ? (
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0 0 1rem' }}>
              Dispatch now has your Invoice Request, you can call them and close this tab. The{' '}
              <strong>Collect Payment</strong> button will turn{' '}
              <strong style={{ color: '#15803d' }}>green</strong> when the invoice is approved and has been
              sent to the customer via email.
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
                aria-label="Time waiting for dispatch review"
              >
                Waiting{' '}
                <span style={{ fontFamily: 'ui-monospace, monospace' }}>{dispatchWaitElapsedLabel}</span>
              </span>
            </div>
          </div>
        ) : (
          <div>
            {payload?.collect_invoice ? (
              <>
                {(payload.fixtures ?? []).length > 0 ? (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <CollectPaymentFixturesLineItemsTable fixtures={payload.fixtures} />
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      margin: '0 0 0.75rem',
                      textAlign: 'center',
                    }}
                  >
                    No billable line items
                  </p>
                )}
                <p
                  style={{
                    fontSize: '0.875rem',
                    margin: '0 0 0.75rem',
                    textAlign: 'center',
                  }}
                >
                  Amount due:{' '}
                  <strong>
                    ${Number(payload.collect_invoice.amount).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                </p>
              </>
            ) : null}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 0 1rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const u = payload?.collect_invoice?.hosted_invoice_url?.trim() ?? ''
                  if (!u) return
                  window.open(u, '_blank', 'noopener,noreferrer')
                }}
                disabled={!payload?.collect_invoice?.hosted_invoice_url?.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#15803d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: payload?.collect_invoice?.hosted_invoice_url?.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                Open payment page
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = payload?.collect_invoice?.hosted_invoice_url?.trim() ?? ''
                  if (u) void copyPaymentLink(u)
                }}
                disabled={!payload?.collect_invoice?.hosted_invoice_url?.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  color: 'var(--text-700)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: payload?.collect_invoice?.hosted_invoice_url?.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Copy payment link
              </button>
            </div>
            <div style={{ margin: '0 0 1rem', textAlign: 'center' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => void sendInvoiceEmailToCustomer()}
                  disabled={emailInvoiceDisabled}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: emailInvoiceDisabled ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    opacity: emailInvoiceDisabled ? 0.55 : 1,
                  }}
                >
                  {emailSending ? 'Sending…' : 'Email invoice to customer'}
                </button>
                {lastInvoiceEmailSentLabel ? (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.35rem',
                    }}
                  >
                    {lastInvoiceEmailSentLabel}
                  </div>
                ) : null}
              </div>
              {changeEmailOpen && invOkForEmail ? (
                <div
                  style={{
                    margin: '0.75rem auto 0',
                    maxWidth: 400,
                    textAlign: 'left',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg-page)',
                  }}
                >
                  <label htmlFor="collect-payment-change-email" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Customer email (Stripe will use this)
                  </label>
                  <input
                    id="collect-payment-change-email"
                    type="email"
                    autoComplete="email"
                    value={changeEmailDraft}
                    onChange={(e) => setChangeEmailDraft(e.target.value)}
                    disabled={changeEmailSaving}
                    style={{
                      display: 'block',
                      width: '100%',
                      marginTop: 6,
                      padding: '0.5rem 0.65rem',
                      borderRadius: 4,
                      border: '1px solid var(--border-strong)',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => void saveCollectPaymentCustomerEmail()}
                      disabled={
                        changeEmailSaving ||
                        !isValidCollectPaymentEmail(changeEmailDraft) ||
                        changeEmailDraft.trim().toLowerCase() === changeEmailBaseline.trim().toLowerCase()
                      }
                      style={{
                        padding: '0.45rem 0.85rem',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor:
                          changeEmailSaving ||
                          !isValidCollectPaymentEmail(changeEmailDraft) ||
                          changeEmailDraft.trim().toLowerCase() === changeEmailBaseline.trim().toLowerCase()
                            ? 'not-allowed'
                            : 'pointer',
                        fontWeight: 600,
                        opacity:
                          changeEmailSaving ||
                          !isValidCollectPaymentEmail(changeEmailDraft) ||
                          changeEmailDraft.trim().toLowerCase() === changeEmailBaseline.trim().toLowerCase()
                            ? 0.55
                            : 1,
                      }}
                    >
                      {changeEmailSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      disabled={changeEmailSaving}
                      onClick={() => {
                        setChangeEmailOpen(false)
                        setChangeEmailDraft('')
                        setChangeEmailBaseline('')
                      }}
                      style={{
                        padding: '0.45rem 0.85rem',
                        background: 'var(--bg-muted)',
                        color: 'var(--text-700)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        cursor: changeEmailSaving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-700)',
                    }}
                  >
                    {invOkForEmail && !stripeEmailLoading ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const initial = (
                              stripeEmailResolved ??
                              payload?.billing_customer?.email ??
                              ''
                            ).trim()
                            setChangeEmailDraft(initial)
                            setChangeEmailBaseline(initial)
                            setChangeEmailOpen(true)
                          }}
                          style={{
                            padding: '0.35rem 0.65rem',
                            background: 'transparent',
                            color: 'var(--text-link)',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            textDecoration: 'underline',
                          }}
                        >
                          Change email
                        </button>
                        <span aria-hidden="true" style={{ color: 'var(--text-faint)', userSelect: 'none' }}>
                          |
                        </span>
                      </>
                    ) : null}
                    <span>Stripe will email:</span>
                  </div>
                  {stripeEmailLoading ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.75rem' }}>
                      Loading Stripe email…
                    </p>
                  ) : stripeEmailError ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-amber-700)', margin: '0.25rem 0 0.35rem' }}>
                      {stripeEmailError}
                    </p>
                  ) : stripeEmailResolved ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.25rem 0 0.35rem' }}>
                      <strong>{stripeEmailResolved}</strong>
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.35rem' }}>
                      No email on this Stripe customer or invoice.
                    </p>
                  )}
                </>
              )}
              {(() => {
                const jobEm = (payload?.billing_customer?.email ?? '').trim()
                if (
                  !jobEm ||
                  !stripeEmailResolved ||
                  jobEm.toLowerCase() === stripeEmailResolved.toLowerCase()
                ) {
                  return null
                }
                return (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
                    Job billing line: {jobEm}
                  </p>
                )
              })()}
              {stripeEmailError && (payload?.billing_customer?.email ?? '').trim() ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
                  Job billing line: {(payload?.billing_customer?.email ?? '').trim()}
                </p>
              ) : null}
            </div>
            {!payload?.collect_invoice?.hosted_invoice_url?.trim() ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-amber-700)', margin: '0 0 1rem' }}>
                No payment link is available yet. Ask the office to finalize the Stripe invoice for this job.
              </p>
            ) : null}
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '1rem 0 0' }}>
              After the customer pays, this job updates automatically. If the screen does not change, use the
              refresh icon above.
            </p>
          </div>
        )}
        </div>
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-muted)',
              color: 'var(--text-700)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          {canSendBackToDispatch ? (
            <button
              type="button"
              onClick={() => setSendBackOpen(true)}
              disabled={sendingBack}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--surface)',
                color: 'var(--text-amber-700)',
                border: '1px solid #f59e0b',
                borderRadius: 4,
                cursor: sendingBack ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              Send back to office
            </button>
          ) : step === 2 ? (
            <a
              href={`tel:${dispatchPhone.telHref}`}
              aria-label={`Call dispatch at ${dispatchPhone.display}`}
              style={{
                display: 'inline-flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.65rem',
                borderRadius: 6,
                border: '1px solid #15803d',
                background: 'var(--bg-green-tint)',
                color: 'var(--text-green-800)',
                textDecoration: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  width: 'calc(2 * 1.35em)',
                  height: 'calc(2 * 1.35em)',
                }}
              >
                <FieldDispatchPhoneIcon style={{ width: '100%', height: '100%' }} />
              </span>
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 2,
                  lineHeight: 1.35,
                }}
              >
                <span>Call Dispatch</span>
                <span style={{ fontWeight: 500, color: '#15803d' }}>{dispatchPhone.display}</span>
              </span>
            </a>
          ) : step === 1 && !loadingPayload ? (
            <button
              type="button"
              onClick={() => void handleSubmitCertify()}
              disabled={submitting || (certifyMode === 'correction_requested' && correctionNotes.trim().length < 3)}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              {submitting ? 'Sending…' : 'Submit'}
            </button>
          ) : null}
        </div>
        {sendBackOpen ? (
          <div
            role="presentation"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 2,
            }}
            onClick={() => {
              setSendBackOpen(false)
              setSendBackNote('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSendBackOpen(false)
                setSendBackNote('')
                e.stopPropagation()
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={sendBackTitleId}
              style={{
                background: 'var(--surface)',
                padding: '1.25rem',
                borderRadius: 8,
                maxWidth: 400,
                width: '100%',
                boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id={sendBackTitleId} style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
                Send back to office
              </h3>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Dispatch will see your note on the dashboard. You cannot collect payment until they fix the
                invoice and approve again.
              </p>
              <label htmlFor={sendBackTitleId + '-note'} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                What needs to change?
              </label>
              <textarea
                id={sendBackTitleId + '-note'}
                value={sendBackNote}
                onChange={(e) => setSendBackNote(e.target.value)}
                disabled={sendingBack}
                rows={4}
                placeholder="Describe the invoice issue…"
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  boxSizing: 'border-box',
                  fontSize: '0.875rem',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  marginTop: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  disabled={sendingBack}
                  onClick={() => {
                    setSendBackOpen(false)
                    setSendBackNote('')
                  }}
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: 'var(--bg-muted)',
                    color: 'var(--text-700)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    cursor: sendingBack ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sendingBack || sendBackNote.trim().length < 3}
                  onClick={() => void handleReturnCollectPaymentToDispatch()}
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: '#b45309',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor:
                      sendingBack || sendBackNote.trim().length < 3 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {sendingBack ? 'Sending…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
