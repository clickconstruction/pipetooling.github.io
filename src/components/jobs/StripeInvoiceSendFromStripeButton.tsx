import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { getDispatchNoteDisplayMeta } from '../../utils/dispatchNoteDisplay'

const CONFIRM_MODAL_Z = 120000

/** Survives parent remount after `onSent` (e.g. refetch) so the inline success line stays visible. */
function stripeEmailSentSessionKey(jobsLedgerInvoiceId: string, stripeInvoiceId: string): string {
  return `pt-stripe-invoice-email-sent:${jobsLedgerInvoiceId}:${stripeInvoiceId}`
}

export type StripeInvoiceSendFromStripeButtonProps = {
  jobsLedgerInvoiceId: string
  stripeInvoiceId: string
  customerEmail: string | null
  stripeModeForBilling: BillingStripeModePref
  /** After Stripe accepts send (e.g. refetch invoice details). */
  onSent?: () => void
  compact?: boolean
  /** Default: "Send Email invoice". The chip's indigo "stripe" tag already says who sends — don't repeat "from Stripe" here. */
  buttonLabel?: string
  /** Omit bordered panel chrome (e.g. Stages Last activity cell). */
  unboxed?: boolean
  /** When true, button does not open confirm (e.g. Stripe invoice already paid). */
  sendDisabled?: boolean
  /** Shown as native `title` when `sendDisabled` is true. */
  sendDisabledTitle?: string
  /** Tiny control for inline use (e.g. Stages Last activity next to hint text). */
  micro?: boolean
  /** When true, do not render the green success line (toast still shows). Use when parent already shows send state. */
  hideInlineSuccessLine?: boolean
  /** Shown in the confirm modal when the send log is empty (e.g. sends before the log table existed). */
  recordedLastSendAt?: string | null
}

const DEFAULT_BUTTON_LABEL = 'Send Email invoice'

/** Stripe brand indigo — saturated brand color, intentionally literal (not a theme token). */
const STRIPE_TAG_BG = '#635bff'

export function StripeInvoiceSendFromStripeButton({
  jobsLedgerInvoiceId,
  stripeInvoiceId,
  customerEmail,
  stripeModeForBilling,
  onSent,
  compact = false,
  buttonLabel = DEFAULT_BUTTON_LABEL,
  unboxed = false,
  sendDisabled = false,
  sendDisabledTitle,
  micro = false,
  hideInlineSuccessLine = false,
  recordedLastSendAt = null,
}: StripeInvoiceSendFromStripeButtonProps) {
  const { showToast } = useToastContext()
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSucceeded, setSendSucceeded] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendHistoryLoading, setSendHistoryLoading] = useState(false)
  const [sendHistoryError, setSendHistoryError] = useState<string | null>(null)
  const [sendHistoryAt, setSendHistoryAt] = useState<string[]>([])

  const emailHint = (customerEmail ?? '').trim()
  const canTry = jobsLedgerInvoiceId.trim() && stripeInvoiceId.trim()
  const emailLine = emailHint
    ? emailHint
    : 'the customer (no email on file in the app preview)'

  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  useEffect(() => {
    const jid = jobsLedgerInvoiceId.trim()
    const sid = stripeInvoiceId.trim()
    let fromSession = false
    try {
      if (jid && sid) {
        fromSession = sessionStorage.getItem(stripeEmailSentSessionKey(jid, sid)) === '1'
      }
    } catch {
      /* private mode */
    }
    setSendSucceeded(fromSession)
  }, [jobsLedgerInvoiceId, stripeInvoiceId])

  useEffect(() => {
    if (!confirmOpen) return
    const jid = jobsLedgerInvoiceId.trim()
    if (!jid) return
    let cancelled = false
    setSendHistoryLoading(true)
    setSendHistoryError(null)
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          () =>
            supabase
              .from('jobs_ledger_invoice_stripe_email_sends')
              .select('sent_at')
              .eq('jobs_ledger_invoice_id', jid)
              .order('sent_at', { ascending: false })
              .limit(20),
          'load stripe invoice send history',
        )
        if (!cancelled) {
          const at = (rows ?? []).map((r) => r.sent_at).filter((s): s is string => !!s && String(s).trim() !== '')
          setSendHistoryAt(at)
        }
      } catch (e) {
        if (!cancelled) {
          setSendHistoryError(formatErrorMessage(e, 'Could not load send history'))
          setSendHistoryAt([])
        }
      } finally {
        if (!cancelled) setSendHistoryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [confirmOpen, jobsLedgerInvoiceId])

  function openConfirm() {
    if (!canTry || sending || sendDisabled) return
    setConfirmOpen(true)
  }

  async function performSend() {
    if (!canTry || sending) return

    setSending(true)
    setSendError(null)
    try {
      const jid = jobsLedgerInvoiceId.trim()
      const sid = stripeInvoiceId.trim()
      if (jid && sid) {
        sessionStorage.removeItem(stripeEmailSentSessionKey(jid, sid))
      }
    } catch {
      /* private mode */
    }
    setSendSucceeded(false)
    try {
      const { data: auth } = await supabase.auth.getSession()
      const token = auth.session?.access_token
      if (!token) {
        setSendError('Not signed in')
        showToast('Not signed in', 'error')
        return
      }

      const { data: raw, error: fnErr } = await supabase.functions.invoke('send-stripe-invoice', {
        body: {
          jobs_ledger_invoice_id: jobsLedgerInvoiceId.trim(),
          ...stripeModeInvokeBody(stripeModeForBilling),
        },
        headers: { Authorization: `Bearer ${token}` },
      })

      if (fnErr) {
        const detail = await readEdgeFunctionErrorBody(fnErr)
        const msg = detail ?? formatErrorMessage(fnErr, 'Could not send from Stripe')
        setSendError(msg)
        showToast(msg, 'error')
        return
      }

      const body = raw as Record<string, unknown> | null
      if (body && typeof body.error === 'string' && body.error.length > 0) {
        setSendError(body.error)
        showToast(body.error, 'error')
        return
      }

      if (body?.success !== true) {
        const msg = 'Unexpected response from server'
        setSendError(msg)
        showToast(msg, 'error')
        return
      }

      const testHint =
        stripeModeForBilling === 'test'
          ? ' Test mode: Stripe does not deliver a real customer email, but the send succeeded.'
          : ''
      showToast(`Stripe sent the invoice email.${testHint}`, 'success')
      try {
        const jid = jobsLedgerInvoiceId.trim()
        const sid = stripeInvoiceId.trim()
        if (jid && sid) {
          sessionStorage.setItem(stripeEmailSentSessionKey(jid, sid), '1')
        }
      } catch {
        /* private mode */
      }
      setSendSucceeded(true)
      onSent?.()
    } catch (e) {
      const msg = formatErrorMessage(e, 'Could not send from Stripe')
      setSendError(msg)
      showToast(msg, 'error')
    } finally {
      setSending(false)
    }
  }

  const padY = micro ? '0.0625rem' : compact ? '0.35rem' : '0.5rem'
  const padX = micro ? '0.35rem' : '0.75rem'
  const btnLooksDisabled = !canTry || sending || sendDisabled
  // Two-segment chip: indigo "stripe" tag + yellow action, so provenance reads at every size.
  const btnStyle: CSSProperties = {
    padding: 0,
    display: 'inline-flex',
    alignItems: 'stretch',
    overflow: 'hidden',
    fontSize: micro ? '0.625rem' : compact ? '0.75rem' : '0.8125rem',
    lineHeight: micro ? 1.2 : undefined,
    textAlign: 'center',
    borderRadius: micro ? 3 : 4,
    border: btnLooksDisabled ? '1px solid #a8a29e' : '1px solid #000000',
    background: 'none',
    cursor: btnLooksDisabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    maxWidth: '100%',
  }
  const tagStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: micro ? '0 0.3rem' : '0 0.5rem',
    background: STRIPE_TAG_BG,
    color: '#ffffff',
    fontWeight: 700,
    fontSize: micro ? '0.5625rem' : compact ? '0.6875rem' : '0.75rem',
    letterSpacing: '0.01em',
    opacity: btnLooksDisabled ? 0.55 : 1,
  }
  const actStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${padY} ${padX}`,
    background: btnLooksDisabled ? '#e7de9a' : '#ffdf00',
    color: btnLooksDisabled ? '#57534e' : '#1c1917',
    whiteSpace: micro ? 'nowrap' : undefined,
  }

  const wrapStyle: CSSProperties =
    unboxed && micro
      ? {
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.15rem',
          marginTop: 0,
          alignSelf: 'center',
          maxWidth: '100%',
        }
      : unboxed
    ? {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginTop: '0.35rem',
        alignSelf: 'stretch',
      }
    : {
        marginTop: compact ? '0.65rem' : '0.75rem',
        paddingTop: compact ? '0.65rem' : '0.75rem',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }

  const messageAlign: CSSProperties['textAlign'] = unboxed && !micro ? 'left' : 'center'

  const recordedFallbackIso = (recordedLastSendAt ?? '').trim()
  const sendHistoryDisplayIso =
    sendHistoryAt.length > 0
      ? sendHistoryAt
      : recordedFallbackIso
        ? [recordedFallbackIso]
        : []

  const confirmModal =
    confirmOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: CONFIRM_MODAL_Z,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setConfirmOpen(false)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="stripe-send-invoice-confirm-title"
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface)',
                borderRadius: 8,
                padding: '1.25rem',
                maxWidth: 480,
                width: '100%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                border: '1px solid var(--border)',
              }}
            >
              <h2
                id="stripe-send-invoice-confirm-title"
                style={{
                  margin: '0 0 0.75rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-strong)',
                  lineHeight: 1.4,
                }}
              >
                Have Stripe email this invoice?
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  background: 'var(--bg-indigo-100)',
                  border: '1px solid var(--border-indigo-soft)',
                  borderRadius: 6,
                  padding: '0.55rem 0.7rem',
                  margin: '0 0 0.85rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-indigo-800)',
                  lineHeight: 1.45,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    background: STRIPE_TAG_BG,
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                  }}
                >
                  S
                </span>
                <span>
                  Sent by <strong>Stripe</strong> to <strong style={{ wordBreak: 'break-all' }}>{emailLine}</strong> —
                  not from ClickTooling.
                </span>
              </div>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
                It&rsquo;s the invoice email with the payment link — sending it again doesn&rsquo;t create a new
                bill or charge anything.
              </p>
              <div
                style={{
                  margin: '0 0 1.25rem',
                  padding: '0.75rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-700)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Most recent sends (ClickTooling)
                </div>
                {sendHistoryLoading ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</div>
                ) : sendHistoryError ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{sendHistoryError}</div>
                ) : sendHistoryDisplayIso.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    No sends recorded yet. After you send, times appear here.
                  </div>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '1.1rem',
                      fontSize: '0.8125rem',
                      color: 'var(--text-700)',
                      lineHeight: 1.45,
                      maxHeight: '11rem',
                      overflowY: 'auto',
                    }}
                  >
                    {sendHistoryDisplayIso.map((iso, idx) => {
                      const meta = getDispatchNoteDisplayMeta(iso)
                      return (
                        <li key={`${iso}-${idx}`} style={{ marginBottom: '0.25rem' }}>
                          {meta.weekdayTimeChicago}{' '}
                          <span style={{ color: 'var(--text-muted)' }}>({meta.daysAgoLabel})</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  style={{
                    padding: '0.5rem 0.85rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    color: 'var(--text-700)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false)
                    void performSend()
                  }}
                  style={{
                    padding: '0.5rem 0.85rem',
                    fontSize: '0.875rem',
                    border: '1px solid #000000',
                    borderRadius: 4,
                    background: '#ffdf00',
                    color: '#1c1917',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Yes, have Stripe send it
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  const sendSuccessLine =
    stripeModeForBilling === 'test'
      ? 'Stripe sent the invoice email. Test mode: Stripe does not deliver a real customer email, but the send succeeded.'
      : 'Stripe sent the invoice email.'

  const showGreen = sendSucceeded && !sendError && !hideInlineSuccessLine
  const btnDisabled = !canTry || sending || sendDisabled

  return (
    <div style={wrapStyle}>
      {confirmModal}
      <button
        type="button"
        onClick={openConfirm}
        disabled={btnDisabled}
        title={sendDisabled ? sendDisabledTitle : undefined}
        style={btnStyle}
      >
        <span style={tagStyle}>stripe</span>
        <span style={actStyle}>{sending ? 'Sending…' : buttonLabel}</span>
      </button>
      {showGreen ? (
        <p
          role="status"
          aria-live="polite"
          style={{
            margin: micro ? '0' : '0.45rem 0 0',
            fontSize: micro ? '0.625rem' : '0.8125rem',
            color: '#15803d',
            textAlign: messageAlign,
            alignSelf: 'stretch',
            lineHeight: micro ? 1.35 : 1.45,
            maxWidth: micro ? 'min(16rem, 100%)' : undefined,
          }}
        >
          {sendSuccessLine}
        </p>
      ) : null}
      {sendError ? (
        <p
          style={{
            margin: micro ? '0' : '0.45rem 0 0',
            fontSize: micro ? '0.625rem' : '0.75rem',
            color: 'var(--text-red-700)',
            textAlign: messageAlign,
            alignSelf: 'stretch',
            lineHeight: micro ? 1.35 : undefined,
            maxWidth: micro ? 'min(16rem, 100%)' : undefined,
          }}
        >
          {sendError}
        </p>
      ) : null}
    </div>
  )
}
