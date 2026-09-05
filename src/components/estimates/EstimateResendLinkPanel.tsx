import type { CSSProperties } from 'react'
import {
  estimateLinkResendBlockMessage,
  type EstimateLinkResendVerdict,
} from '../../../supabase/functions/_shared/estimateLinkResend'

/**
 * "Waiting for customer" block on a sent estimate (v2.2856, J17-F2/N3): says where the
 * link went, offers **Resend link** when the kernel allows it, and — once a resend has
 * happened in this tab — shows the fresh URL a single time so the office can paste it
 * into a text. The URL is the new token the staff member just minted; the old one is dead.
 */
export type EstimateResendLinkPanelProps = {
  /** Address the last send (or resend) went to; null when the row has none on record. */
  sentTo: string | null
  verdict: EstimateLinkResendVerdict
  busy: boolean
  onResend: () => void
  /** Set after a successful resend in this tab; cleared on row change. */
  resent: { email: string; emailed: boolean; url: string } | null
  onCopyUrl: (url: string) => void
  style?: CSSProperties
}

const buttonStyle = (disabled: boolean): CSSProperties => ({
  padding: '0.35rem 0.65rem',
  fontSize: '0.8125rem',
  fontWeight: 500,
  border: 'none',
  borderRadius: 4,
  background: disabled ? '#9ca3af' : '#3b82f6',
  color: 'white',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

export default function EstimateResendLinkPanel({
  sentTo,
  verdict,
  busy,
  onResend,
  resent,
  onCopyUrl,
  style,
}: EstimateResendLinkPanelProps) {
  const canResend = verdict.ok
  const blockReason = verdict.ok ? null : verdict.reason
  const showStartNew = blockReason === 'pricing_expired' || blockReason === 'declined'
  return (
    <div style={{ marginTop: '1rem', ...style }} data-testid="estimate-resend-link-panel">
      <p style={{ margin: 0, color: 'var(--text-amber-800)' }}>
        Waiting for customer.{' '}
        {sentTo ? (
          <>
            The link went to <strong>{sentTo}</strong>.
          </>
        ) : (
          'The link went out by email.'
        )}{' '}
        {canResend
          ? 'Lost it? Resend link emails a fresh one to the same address — the old link stops working, and you can copy the new one from here.'
          : null}
      </p>
      {blockReason ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {estimateLinkResendBlockMessage(blockReason)}
          {showStartNew ? ' Use New estimate at the top of the Estimates page.' : ''}
        </p>
      ) : null}
      {canResend ? (
        <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onResend}
            disabled={busy}
            style={buttonStyle(busy)}
            aria-label="Resend the customer link by email"
            title="Mint a fresh link, email it to the customer again, and show it here once so you can copy it."
          >
            {busy ? 'Resending…' : 'Resend link'}
          </button>
        </div>
      ) : null}
      {resent ? (
        <div
          role="status"
          style={{
            marginTop: '0.6rem',
            padding: '0.6rem 0.75rem',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-muted)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ color: 'var(--text-700)' }}>
            {resent.emailed ? (
              <>
                Link resent to <strong>{resent.email}</strong>.
              </>
            ) : (
              <>
                New link ready — the email to <strong>{resent.email}</strong> did not go out, so send it yourself.
              </>
            )}{' '}
            Shown here once (this tab only):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
            <code
              style={{
                fontSize: '0.78rem',
                wordBreak: 'break-all',
                color: 'var(--text-700)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '0.2rem 0.4rem',
                flex: '1 1 16rem',
              }}
            >
              {resent.url}
            </code>
            <button
              type="button"
              onClick={() => onCopyUrl(resent.url)}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.8rem',
                fontWeight: 500,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text-700)',
                cursor: 'pointer',
              }}
              aria-label="Copy the new customer link"
            >
              Copy link
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
