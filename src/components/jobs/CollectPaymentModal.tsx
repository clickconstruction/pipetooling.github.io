import { useCallback, useEffect, useRef, useState } from 'react'
import { loadStripeTerminal } from '@stripe/terminal-js'
import type { Reader } from '@stripe/terminal-js'
import { supabase } from '../../lib/supabase'
import { APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE } from '../../lib/appSettingsKeys'
import { parseFieldDispatchPhoneFromValueText } from '../../lib/fieldDispatchPhone'
import { getBillingStripeModePref, stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { formatWaitingLabelFromCertifiedAt } from '../../lib/formatElapsedCountUp'
import FieldDispatchPhoneIcon from '../icons/FieldDispatchPhoneIcon'
import { useIntervalNowMs } from '../../hooks/useIntervalNowMs'
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

type FlowRow = {
  id?: string
  status?: string
  certify_mode?: string | null
  certified_at?: string | null
} | null

type CertifyPayload = {
  fixtures: CertifyFixture[]
  invoice: CertifyInvoice
  flow: FlowRow
  error?: string
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
}

function lineTotalDollars(f: CertifyFixture): number {
  const u = f.line_unit_price != null ? Number(f.line_unit_price) : 0
  return Math.round(f.count * u * 100) / 100
}

export default function CollectPaymentModal({
  open,
  onClose,
  jobId,
  hcpNumber,
  jobName,
  initialFlowStatus,
  onFlowChanged,
}: Props) {
  const { showToast } = useToastContext()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loadingPayload, setLoadingPayload] = useState(false)
  const [payload, setPayload] = useState<CertifyPayload | null>(null)
  const [certifyMode, setCertifyMode] = useState<'clean' | 'correction_requested'>('clean')
  const [correctionNotes, setCorrectionNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [flowStatus, setFlowStatus] = useState<string | null>(initialFlowStatus ?? null)
  const [terminalBusy, setTerminalBusy] = useState(false)
  const [terminalLog, setTerminalLog] = useState<string | null>(null)
  const [dispatchPhone, setDispatchPhone] = useState(() => parseFieldDispatchPhoneFromValueText(null))
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const dispatchWaitNowMs = useIntervalNowMs(1000)

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
    setTerminalLog(null)
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
            showToast('Dispatch approved — you can collect payment now.', 'success')
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
    if (!open) return
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refreshFlowFromPayload(true)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [open, refreshFlowFromPayload])

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

  async function runTerminalCollection() {
    setTerminalBusy(true)
    setTerminalLog(null)
    try {
      const StripeTerminal = await loadStripeTerminal()
      if (!StripeTerminal) {
        showToast('Could not load Stripe Terminal', 'error')
        return
      }

      const modeBody = stripeModeInvokeBody(getBillingStripeModePref())

      const terminal = StripeTerminal.create({
        onFetchConnectionToken: async () => {
          const { data: sessionData } = await supabase.auth.getSession()
          const jwt = sessionData.session?.access_token
          if (!jwt) throw new Error('Not signed in')
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/terminal-connection-token`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
              },
              body: JSON.stringify({ job_id: jobId, ...modeBody }),
            },
          )
          const json = (await res.json()) as { secret?: string; error?: string }
          if (!res.ok || !json.secret) {
            throw new Error(json.error ?? 'Connection token failed')
          }
          return json.secret
        },
      })

      const simulated = import.meta.env.DEV
      setTerminalLog(simulated ? 'Discovering simulated reader…' : 'Discovering readers…')
      const discover = await terminal.discoverReaders(simulated ? { simulated: true } : {})
      if ('error' in discover) {
        showToast(discover.error.message, 'error')
        return
      }
      const readers = discover.discoveredReaders
      if (!readers.length) {
        showToast('No readers found. Connect a Stripe reader or use dev mode (simulated).', 'warning')
        return
      }
      const reader = readers[0] as Reader
      const conn = await terminal.connectReader(reader)
      if ('error' in conn) {
        showToast(conn.error.message, 'error')
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const jwt = sessionData.session?.access_token
      if (!jwt) {
        showToast('Session expired', 'error')
        return
      }
      const piRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-terminal-collect-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ job_id: jobId, ...modeBody }),
        },
      )
      const piJson = (await piRes.json()) as {
        payment_intent_client_secret?: string
        error?: string
      }
      if (!piRes.ok || !piJson.payment_intent_client_secret) {
        showToast(piJson.error ?? 'Could not create payment', 'error')
        return
      }

      setTerminalLog('Present card…')
      const collect = await terminal.collectPaymentMethod(piJson.payment_intent_client_secret)
      if ('error' in collect) {
        showToast(collect.error.message, 'error')
        return
      }
      const proc = await terminal.processPayment(collect.paymentIntent)
      if ('error' in proc) {
        showToast(proc.error.message, 'error')
        return
      }
      showToast('Payment submitted. This screen will update when the payment clears.', 'success')
      setTerminalLog('Success — waiting for confirmation…')
      void refreshFlowFromPayload(true)
      onFlowChanged?.()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Terminal error', 'error')
    } finally {
      setTerminalBusy(false)
    }
  }

  if (!open) return null

  const titleId = 'collect-payment-modal-title'

  const dispatchWaitElapsedLabel =
    step === 2
      ? formatWaitingLabelFromCertifiedAt(dispatchWaitNowMs, payload?.flow?.certified_at)
      : null

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
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'auto',
          margin: '1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              {hcpNumber} · {jobName}
            </p>
          </div>
          {step === 2 ? (
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
                background: '#f0fdf4',
                color: '#166534',
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
          ) : null}
        </div>

        <div
          style={{
            marginBottom: '1rem',
            fontSize: '0.8125rem',
            color: '#6b7280',
            textAlign: step === 2 ? 'center' : undefined,
          }}
        >
          Step {step} of 3:{' '}
          {step === 1 ? 'Certify line items' : step === 2 ? 'Awaiting dispatch' : 'Stripe Terminal'}
        </div>

        {loadingPayload ? (
          <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p>
        ) : step === 1 ? (
          <div>
            {payload?.invoice ? (
              <p style={{ fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                Draft invoice total:{' '}
                <strong>
                  ${Number(payload.invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
              </p>
            ) : (
              <p style={{ fontSize: '0.875rem', color: '#b45309', margin: '0 0 0.75rem' }}>
                No Ready-to-Bill invoice row yet. Office may need to add a bill line first.
              </p>
            )}
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: 8 }}>Item</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: 8 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(payload?.fixtures ?? []).map((f) => (
                    <tr key={f.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 8 }}>
                        {f.name}
                        {f.line_description ? (
                          <span style={{ color: '#6b7280', display: 'block' }}>{f.line_description}</span>
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
                  border: '1px solid #d1d5db',
                  boxSizing: 'border-box',
                }}
              />
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
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
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : step === 2 ? (
          <div>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.5rem' }}>
              Status: <span style={{ color: '#374151' }}>{flowStatus ?? 'pending_dispatch'}</span>
            </p>
            <p style={{ fontSize: '0.875rem', color: '#374151', margin: '0 0 1rem' }}>
              Dispatch will review your certification
              {certifyMode === 'correction_requested' ? ' and correction request' : ''}. You can close this
              screen — the <strong>Collect Payment</strong> button on your dashboard will turn{' '}
              <strong style={{ color: '#15803d' }}>green</strong> when you can take payment.
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Close
              </button>
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: '#6b7280',
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
            <p style={{ fontSize: '0.875rem', color: '#374151', margin: '0 0 1rem' }}>
              Connect your Stripe reader (same network as this device in production). In development, a
              simulated reader is used automatically.
            </p>
            {terminalLog ? (
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 1rem' }}>{terminalLog}</p>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void runTerminalCollection()}
                disabled={terminalBusy}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#15803d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: terminalBusy ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {terminalBusy ? 'Working…' : 'Start reader & collect'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
