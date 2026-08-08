import type { CSSProperties, ReactNode } from 'react'

/**
 * Groups the three billing sections (Field approval → Ready to Bill → Billed
 * waiting for payment) into one visible unit: a bordered card titled
 * "Billing Pipeline" whose stages carry numbered badges connected by a
 * downward arrow rail in the left gutter.
 */
export function BillingPipelineCard({ children, onInfoClick }: { children: ReactNode; onInfoClick?: () => void }) {
  return (
    <div
      // billingPipelineCard declares the container that drives the
      // .billingPipelineActionAgePair width band in index.css.
      className="billingPipelineCard"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.85rem 1rem 1rem',
        marginTop: '1rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Billing Pipeline</h2>
        {onInfoClick ? (
          <button
            type="button"
            onClick={onInfoClick}
            title="How the Billing Pipeline works"
            aria-label="How the Billing Pipeline works"
            style={{
              width: 20,
              height: 20,
              padding: 0,
              borderRadius: '50%',
              border: '1.5px solid var(--text-link)',
              background: 'none',
              color: 'var(--text-link)',
              fontSize: '0.75rem',
              fontWeight: 600,
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              lineHeight: 1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            i
          </button>
        ) : null}
      </div>
      {children}
    </div>
  )
}

const stageBadgeStyle: CSSProperties = {
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
  flexShrink: 0,
}

/**
 * One pipeline stage: numbered badge in the left gutter; `connectToNext` draws
 * a vertical line ending in a ▼ down to the next stage's badge.
 */
export function BillingPipelineStage({
  step,
  connectToNext = false,
  children,
}: {
  step: number
  connectToNext?: boolean
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'stretch' }}>
      <div
        aria-hidden
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 20,
          flexShrink: 0,
          paddingTop: 2,
          paddingBottom: connectToNext ? 2 : 0,
        }}
      >
        <span style={stageBadgeStyle}>{step}</span>
        {connectToNext ? (
          <>
            <span style={{ width: 1, flex: 1, minHeight: 8, background: 'var(--border-strong)', marginTop: 3 }} />
            <span style={{ color: 'var(--text-faint)', fontSize: '0.625rem', lineHeight: 1, marginTop: 1 }}>▼</span>
          </>
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
