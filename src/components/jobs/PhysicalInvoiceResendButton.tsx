import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { resendPhysicalInvoiceEmailForBilledInvoice } from '../../lib/resendPhysicalInvoiceEmail'

const CONFIRM_MODAL_Z = 120000

/**
 * "Email again — PDF attached" (v2.2605): re-emails a BILLED physical invoice
 * — confirm first, like the Stripe resend. The PDF is rebuilt fresh
 * (same builders as the PDF tail); nothing on the row changes.
 */
export default function PhysicalInvoiceResendButton({
  invoice,
  recipientEmail,
  onSent,
}: {
  invoice: { id: string; job_id: string }
  /** Shown in the confirm so the sender knows who receives it (bill-to override, else job customer email). */
  recipientEmail: string | null
  /** After the email is accepted (e.g. record a chase touch). */
  onSent?: () => void
}) {
  const { showToast } = useToastContext()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  const emailLine = (recipientEmail ?? '').trim() || 'the customer'

  async function send() {
    if (sending) return
    setSending(true)
    const result = await resendPhysicalInvoiceEmailForBilledInvoice(invoice)
    setSending(false)
    if (result.ok) {
      setConfirmOpen(false)
      showToast(`Invoice re-emailed to ${result.sentTo}`, 'success')
      onSent?.()
    } else {
      showToast(result.message, 'error')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
      >
        Email again — PDF attached
      </button>
      {confirmOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Re-email invoice"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: CONFIRM_MODAL_Z }}
            onClick={() => !sending && setConfirmOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--surface)', padding: '1rem 1.25rem', borderRadius: 8, width: 'min(380px, calc(100vw - 2rem))' }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.375rem' }}>Re-email this invoice?</div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                A freshly generated invoice PDF goes to <strong>{emailLine}</strong>. Nothing about the bill changes.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" disabled={sending} onClick={() => setConfirmOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void send()}
                  style={{ background: 'var(--text-link)', color: '#fff', border: '1px solid var(--text-link)' }}
                >
                  {sending ? 'Sending…' : 'Send email'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
