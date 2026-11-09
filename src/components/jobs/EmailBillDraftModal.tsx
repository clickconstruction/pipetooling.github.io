/**
 * The bill's email draft window: the subject and the words of the pay-link email as the share row writes them
 * (`stripeInvoiceShareCopy.ts`). Since punch list #125 PR 6 (v2.6710) the words are the confirm: **Send the email**
 * sends them from the office through `messages-email` (`StripeInvoiceSharePanel`'s `sendBillEmail`), so the line lands
 * in the customer's thread and the answer comes back to the office's box. **Copy** stays for pasting them elsewhere. The
 * `mailto:` press (*Open in email app*) is gone: a send never hands the words to the person's own mail app. A row with no
 * job or customer at hand (`onSend` left out) draws Copy alone.
 */
import { useEffect, type CSSProperties } from 'react'

const preBox: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.8125rem',
  lineHeight: 1.45,
  color: 'var(--text-strong)',
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.65rem 0.75rem',
}

export function EmailBillDraftModal({
  open,
  onClose,
  subject,
  body,
  onCopy,
  onSend,
  sending = false,
  sendLabel = 'Send the email',
  sendingLabel = 'Sending…',
  overlayZIndex = 1300,
}: {
  open: boolean
  onClose: () => void
  subject: string
  body: string
  onCopy: () => void
  /** Send the words from the office (`messages-email`). Left out, the window offers Copy alone. */
  onSend?: () => void
  /** The send is on its way: the press waits and reads `sendingLabel`. */
  sending?: boolean
  sendLabel?: string
  sendingLabel?: string
  overlayZIndex?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
        zIndex: overlayZIndex,
        padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-bill-draft-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          minWidth: 280,
          maxWidth: 520,
          width: '100%',
          maxHeight: 'min(85vh, 560px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="email-bill-draft-title" style={{ margin: 0, padding: '1rem 1rem 0.5rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Email Bill Draft
        </h2>
        <div style={{ padding: '0 1rem', flex: '1 1 auto', minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Subject</p>
            <pre style={{ ...preBox, maxHeight: 120 }}>{subject}</pre>
          </div>
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Email draft</p>
            <pre style={{ ...preBox, flex: '1 1 auto', overflow: 'auto', maxHeight: 280 }}>{body}</pre>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '1rem',
            flexShrink: 0,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onCopy()}
            style={
              onSend
                ? {
                    padding: '0.5rem 1rem',
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }
                : {
                    padding: '0.5rem 1rem',
                    border: 'none',
                    background: '#2563eb',
                    color: 'white',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }
            }
          >
            Copy
          </button>
          {onSend ? (
            <button
              type="button"
              onClick={() => onSend()}
              disabled={sending}
              data-testid="email-bill-draft-send"
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: '#2563eb',
                color: 'white',
                borderRadius: 4,
                cursor: sending ? 'default' : 'pointer',
                opacity: sending ? 0.7 : 1,
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {sending ? sendingLabel : sendLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
