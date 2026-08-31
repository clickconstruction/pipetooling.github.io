import { useState } from 'react'
import type { Bid } from '../../types/bids'
import { buildRobotBidPrompt, robotBidReadiness } from '../../lib/bids/robotBidReadiness'

type RobotBidReadinessModalProps = {
  /** The human bid whose readiness is being shown; null = closed. */
  bid: Bid | null
  onClose: () => void
  onEditBid: (bid: Bid) => void
}

/**
 * Grey/yellow states of the Bid Board robot icon (v2.2530). The 'done' state
 * never opens this modal — it deep-links to the twin row on the Robot Board
 * (the comparison view is the follow-up PR).
 */
export function RobotBidReadinessModal({ bid, onClose, onEditBid }: RobotBidReadinessModalProps) {
  const [copied, setCopied] = useState(false)
  if (!bid) return null
  const readiness = robotBidReadiness(bid)
  const ready = readiness.state === 'ready'
  const title = ready
    ? `Robot bid prompt — b${bid.bid_number ?? '?'} ${bid.project_name ?? ''}`
    : `Robot readiness — b${bid.bid_number ?? '?'} ${bid.project_name ?? ''}`

  async function copyPrompt() {
    if (!bid) return
    try {
      await navigator.clipboard.writeText(buildRobotBidPrompt(bid))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="robot-bid-readiness-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1005,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="document"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 560,
          width: '100%',
          padding: '1.25rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="robot-bid-readiness-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          {'\u{1F916} '}{title}
        </h2>

        {ready ? (
          <>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
              Everything a robot needs is on this bid. Copy the prompt below and paste it into the twin
              (Claude with the twin-mcp connector) — it runs the whole pipeline blind and files an audit
              when it&apos;s done.
            </p>
            <pre
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.75rem 0.9rem',
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
                color: 'var(--text-700)',
                maxHeight: 260,
                overflowY: 'auto',
                margin: '0 0 1rem',
              }}
            >
              {buildRobotBidPrompt(bid)}
            </pre>
          </>
        ) : (
          <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'grid', gap: '0.55rem' }}>
            {readiness.items.map((item) => (
              <li key={item.key} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '0.875rem' }}>
                <span
                  aria-hidden
                  style={{ fontWeight: 700, color: item.ok ? 'var(--text-emerald-800)' : item.required ? 'var(--text-red-600)' : 'var(--text-muted)' }}
                >
                  {item.ok ? '✓' : '✗'}
                </span>
                <span>
                  <span style={{ fontWeight: item.ok ? 400 : 600 }}>{item.label}</span>
                  {!item.ok && (
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {item.required ? item.fix : `Warning only — ${item.fix}`}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          {ready ? (
            <button
              type="button"
              onClick={() => void copyPrompt()}
              style={{
                padding: '0.5rem 0.85rem',
                border: 'none',
                borderRadius: 4,
                background: '#3b82f6',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied ✓' : 'Copy prompt'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { onClose(); onEditBid(bid) }}
              style={{
                padding: '0.5rem 0.85rem',
                border: 'none',
                borderRadius: 4,
                background: '#3b82f6',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Edit bid to fix
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
