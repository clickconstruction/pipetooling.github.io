import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * "How the Billing Pipeline works" explainer (v2.1470) — opened by the ⓘ next
 * to the card title. Static content: the card's three numbered stages set in
 * the full job pipeline (Waiting/Working upstream, Paid in Full downstream),
 * with who-taps-what chips per stage — including the subcontractor's Collect
 * Payment entry at stage 1. Same per-surface help-modal pattern as
 * ContractsTabHelpModal; footer deep-links the full guide.
 */

const stageBadge: CSSProperties = {
  flexShrink: 0,
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-blue-700)',
  fontSize: '0.6875rem',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const contextBadge: CSSProperties = {
  ...stageBadge,
  background: 'var(--bg-subtle)',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-strong)',
  fontWeight: 500,
}

const actorLabel: CSSProperties = {
  fontSize: '0.625rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
}

const chipBase: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  borderRadius: 5,
  padding: '0.1rem 0.55rem',
  whiteSpace: 'nowrap',
}

function Stage({
  badge,
  title,
  children,
  dimmed = false,
  last = false,
}: {
  badge: ReactNode
  title: string
  children: ReactNode
  dimmed?: boolean
  last?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', opacity: dimmed ? 0.65 : 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {badge}
        {!last ? <span aria-hidden style={{ flex: 1, width: 1, background: 'var(--border-strong)', margin: '3px 0' }} /> : null}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : '0.75rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

export function BillingPipelineInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        zIndex: 80,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-pipeline-info-title"
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          padding: '1.1rem 1.25rem 1rem',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <h2 id="billing-pipeline-info-title" style={{ margin: 0, fontSize: '1.1rem' }}>
            How the Billing Pipeline works
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1, padding: '0.2rem 0.4rem' }}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Every job walks the same road. This card handles the money half.
        </p>

        <Stage badge={<span style={contextBadge} aria-hidden>·</span>} title="Waiting → Working" dimmed>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            The job gets scheduled and crewed on Jobs → Pipeline. Not this card's business yet.
          </p>
        </Stage>

        <Stage badge={<span style={stageBadge}>1</span>} title="Field approval">
          <p style={{ margin: '0.1rem 0 0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            A subcontractor or tech finishes work and asks to collect. Their request lands here; approving unlocks
            their payment page in the field.
          </p>
          <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={actorLabel}>SUB TAPS</span>
            <span style={{ ...chipBase, background: '#3b82f6', color: '#ffffff' }}>Collect Payment</span>
            <span style={actorLabel}>OFFICE TAPS</span>
            <span style={{ ...chipBase, background: '#16a34a', color: '#ffffff' }}>Approve</span>
          </span>
        </Stage>

        <Stage badge={<span style={stageBadge}>2</span>} title="Ready to Bill">
          <p style={{ margin: '0.1rem 0 0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Work is done; the bill goes out — or the job goes back to Working if it isn't ready after all.
          </p>
          <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={actorLabel}>OFFICE TAPS</span>
            <span style={{ ...chipBase, background: '#16a34a', color: '#ffffff' }}>Bill Customer</span>
            <span style={{ ...chipBase, border: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 500 }}>Send Back</span>
          </span>
        </Stage>

        <Stage badge={<span style={stageBadge}>3</span>} title="Billed — waiting for payment">
          <p style={{ margin: '0.1rem 0 0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Money is owed. When it arrives — wire, check, or Stripe — mark it here (bank deposits match up in
            Accounts Receivable).
          </p>
          <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={actorLabel}>OFFICE TAPS</span>
            <span style={{ ...chipBase, background: '#16a34a', color: '#ffffff' }}>Mark Paid</span>
          </span>
        </Stage>

        <Stage badge={<span style={contextBadge} aria-hidden>✓</span>} title="Paid in Full" dimmed last>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Leaves this card. Lives on in Jobs → Pipeline history.
          </p>
        </Stage>

        <div
          style={{
            borderTop: '1px solid var(--border)',
            marginTop: '0.9rem',
            paddingTop: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <Link
            to="/help?g=ready-to-bill-pipeline"
            onClick={onClose}
            style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none' }}
          >
            Full guide in Help →
          </Link>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.35rem 0.9rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
