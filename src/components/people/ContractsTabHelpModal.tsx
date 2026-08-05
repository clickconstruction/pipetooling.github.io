import { useEffect } from 'react'
import type { CSSProperties } from 'react'

/**
 * "How this tab works" helper for People → Contracts (v2.1404): opened by the
 * ⓘ beside the tab heading. Four plain-English cards — Send/Resend, the
 * Dashboard reminder checkbox, the status-dot legend (the dots had no legend
 * anywhere in the UI), and the Applied version date — plus a link to the Help
 * page. Static content; dot colors mirror the roster's literals.
 */

const cardStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.65rem 0.8rem',
  marginBottom: '0.5rem',
}

const cardTitleStyle: CSSProperties = {
  margin: '0 0 0.2rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text-strong)',
}

const cardBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.8125rem',
  color: 'var(--text-600)',
  lineHeight: 1.55,
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: '50%',
        backgroundColor: color,
        verticalAlign: 'baseline',
        marginRight: '0.25rem',
      }}
    />
  )
}

export function ContractsTabHelpModal({
  open,
  onClose,
  onOpenHelp,
}: {
  open: boolean
  onClose: () => void
  /** Navigates to the Help page (host owns routing). */
  onOpenHelp: () => void
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
        zIndex: 1100,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="contracts-tab-help-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          padding: '1.1rem 1.25rem',
          maxWidth: 460,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 id="contracts-tab-help-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            How this tab works
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            style={{ padding: '0.2rem 0.5rem', fontSize: '1rem', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={cardStyle}>
          <p style={cardTitleStyle}>Send / Resend</p>
          <p style={cardBodyStyle}>
            Emails the person a private signing link. You can adjust the email first and see a preview before it goes
            out. The row shows &ldquo;sent&rdquo; until they sign; Resend issues a fresh link. The button only appears
            when the document has something to sign (contract text or an attached document link).
          </p>
        </div>

        <div style={cardStyle}>
          <p style={cardTitleStyle}>Dashboard</p>
          <p style={cardBodyStyle}>
            A reminder, not an email: with the box checked, after each clock-in the person&rsquo;s own Dashboard pops
            &ldquo;you have a contract to sign&rdquo; with a sign-now button. It keeps reminding until they sign, then
            stops on its own.
          </p>
        </div>

        <div style={cardStyle}>
          <p style={cardTitleStyle}>Status chips</p>
          <p style={{ ...cardBodyStyle, lineHeight: 1.8 }}>
            The chips beside each name count their documents:{' '}
            <span style={{ whiteSpace: 'nowrap' }}>
              <StatusDot color="#dc2626" /> unsent
            </span>
            {'  '}
            <span style={{ whiteSpace: 'nowrap' }}>
              <StatusDot color="#eab308" /> waiting on a signature
            </span>
            {'  '}
            <span style={{ whiteSpace: 'nowrap' }}>
              <StatusDot color="#22c55e" /> signed
            </span>
            . The filter buttons above the list use the same colors.
          </p>
        </div>

        <div style={cardStyle}>
          <p style={cardTitleStyle}>Applied version</p>
          <p style={cardBodyStyle}>
            The date of the Contract Book copy that applies to that row. A{' '}
            <span style={{ textDecorationLine: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
              dotted underline
            </span>{' '}
            means the date was set by hand and won&rsquo;t move when the book text is edited.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenHelp()
            }}
            style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            Full guides in Help →
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
