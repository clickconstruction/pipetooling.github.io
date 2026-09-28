/**
 * The segmented bar under the Bids tab strips — one pill per lens of a group (🤖 Robots,
 * Followup), the open one filled. Presentational: `lib/bids/bidsLenses` says which pills and
 * what they say; the page owns the tab, the gates and `selectBidsTab`. Anything passed as
 * children (the Followup bar's chip and caption) sits beside the bar on the same row.
 */
import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { BidsLens, BidsLensBadgeTone } from '../../lib/bids/bidsLenses'
import type { BidsTabKey } from '../../lib/bids/bidsTabAccess'

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: '0.45rem 1rem',
    border: 'none',
    cursor: 'pointer',
    background: active ? '#3b82f6' : 'transparent',
    color: active ? 'white' : 'var(--text-700)',
    fontWeight: active ? 700 : 400,
  }
}

function badgeStyle(tone: BidsLensBadgeTone, active: boolean): CSSProperties {
  if (tone === 'dev') {
    return {
      fontSize: '0.58rem',
      fontWeight: 800,
      letterSpacing: '0.05em',
      padding: '0 4px',
      borderRadius: 3,
      border: active ? '1px solid rgba(255,255,255,0.6)' : '1px solid #ca8a04',
      color: active ? 'white' : 'var(--text-yellow-800)',
      verticalAlign: '1px',
    }
  }
  return {
    fontSize: '0.62rem',
    fontWeight: 700,
    padding: '0.06rem 0.35rem',
    borderRadius: 999,
    background: active ? 'rgba(255,255,255,0.25)' : tone === 'new' ? 'var(--bg-emerald-tint)' : 'var(--bg-amber-tint)',
    color: active ? 'white' : tone === 'new' ? 'var(--text-emerald-800)' : 'var(--text-amber-800)',
    verticalAlign: '1px',
  }
}

export function BidsLensBar({
  lenses,
  activeKey,
  onSelect,
  children,
}: {
  lenses: BidsLens[]
  activeKey: BidsTabKey
  onSelect: (key: BidsTabKey) => void
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 0.75rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', fontSize: '0.875rem', background: 'var(--surface)', alignItems: 'center' }}>
        {lenses.map((lens) => {
          const active = lens.key === activeKey
          return (
            <Fragment key={lens.key}>
              {lens.leadIn ? (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0 0.35rem 0 0.6rem', borderLeft: '1px solid var(--border)' }}>{lens.leadIn}</span>
              ) : null}
              <button type="button" onClick={() => onSelect(lens.key)} title={lens.title} data-testid={lens.testId} style={pillStyle(active)}>
                {lens.label}
                {lens.badge ? (
                  <>
                    {' '}
                    <span style={badgeStyle(lens.badge.tone, active)}>{lens.badge.text}</span>
                  </>
                ) : null}
              </button>
            </Fragment>
          )
        })}
      </div>
      {children}
    </div>
  )
}
