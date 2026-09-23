import type { CSSProperties, ReactNode } from 'react'

const bar: CSSProperties = {
  position: 'sticky',
  bottom: 'var(--app-bottom-chrome, 0px)',
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '0.5rem',
  padding: '0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom, 0px))',
  background: 'var(--surface)',
  borderTop: '1px solid var(--border)',
  marginTop: '0.75rem',
  zIndex: 5,
}
const btn: CSSProperties = {
  padding: '0.75rem 0.9rem',
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: '0.9375rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/**
 * One section as a screen (punch list #30, PR 3): ‹ · the name · n of N, the section's
 * banner question, the section's own body, and at the thumb Skip · Looked · N open · next.
 * Note-first sections keep their own mark button inside the body; the bar only moves on.
 */
export function QuickfillRoundScreen({
  label,
  position,
  question,
  countLine,
  liveCount,
  needsNote,
  personal,
  marking,
  onBack,
  onSkip,
  onLooked,
  onHistory,
  children,
}: {
  label: string
  /** "4 of 20" — null when the section is not in the round. */
  position: { index: number; total: number } | null
  question: string | null
  countLine: string
  liveCount: number | null
  needsNote: boolean
  personal: boolean
  marking: boolean
  onBack: () => void
  onSkip: () => void
  onLooked: () => void
  onHistory: () => void
  children: ReactNode
}) {
  const nextLabel = position && position.index < position.total ? 'next →' : 'done ✓'
  return (
    <div className="quickfillRoundScreen">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button type="button" onClick={onBack} aria-label="Back to the list" style={{ ...btn, padding: '0.4rem 0.7rem', fontSize: '1.1rem', lineHeight: 1 }}>
          ‹
        </button>
        <h2 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</h2>
        {position ? (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {position.index} of {position.total}
          </span>
        ) : null}
      </div>
      {question ? (
        <div style={{ fontSize: '0.875rem', color: 'var(--text)', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--text-link)', padding: '0.45rem 0.6rem', borderRadius: 4, marginBottom: '0.5rem' }}>{question}</div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        <span>{countLine}</span>
        {!personal ? (
          <button type="button" onClick={onHistory} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.8125rem', cursor: 'pointer', padding: 0 }}>
            📈 history
          </button>
        ) : null}
      </div>
      <div>{children}</div>
      <div style={bar}>
        <button type="button" onClick={onSkip} style={btn}>
          Skip
        </button>
        {personal || needsNote ? (
          <button type="button" onClick={onSkip} style={{ ...btn, textAlign: 'center' }} title={needsNote ? 'Mark this one inside, with a note' : undefined}>
            {needsNote ? `Mark inside · ${nextLabel}` : nextLabel}
          </button>
        ) : (
          <button type="button" onClick={onLooked} disabled={marking} style={{ ...btn, background: '#16a34a', borderColor: '#16a34a', color: '#fff', textAlign: 'center', opacity: marking ? 0.7 : 1 }}>
            {marking ? 'Marking…' : `Looked${liveCount != null ? ` · ${liveCount} open` : ''} · ${nextLabel}`}
          </button>
        )}
      </div>
    </div>
  )
}
