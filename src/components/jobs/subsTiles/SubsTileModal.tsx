/**
 * The shell every Subs tile opens into (v2.2963): the tile's words as the
 * title, its number large at right, a queue bar counting what the office has
 * handled since opening, the rows, and the counting rule in the footer so
 * nobody has to guess why a row is or isn't here. Escape and ✕ close; the
 * primary footer button is the queue's "Next row ↓".
 */
import { useEffect, type ReactNode } from 'react'

export type SubsTileModalProps = {
  ariaLabel: string
  title: string
  subtitle: string
  big: { value: string; label: string; red?: boolean }
  /** `done` of `total` handled since opening; `hint` is the keyboard line. */
  queue: { done: number; total: number; hint: string }
  /** One sentence: what counts. */
  rule: ReactNode
  footer?: ReactNode
  onClose: () => void
  children: ReactNode
}

export function SubsTileModal({ ariaLabel, title, subtitle, big, queue, rule, footer, onClose, children }: SubsTileModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const pct = queue.total > 0 ? Math.round((queue.done / queue.total) * 100) : 0
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 54, overflowY: 'auto', padding: '2rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, width: 'min(960px, 100%)', boxShadow: '0 20px 60px rgba(0,0,0,.25)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '1rem 1.1rem 0.7rem' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{title}</h3>
            <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '62ch' }}>{subtitle}</p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: big.red ? 'var(--text-red-700)' : 'inherit' }}>{big.value}</div>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>{big.label}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>
            ✕
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 1.1rem 0.7rem', borderBottom: '1px solid var(--border)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          <span>
            <b style={{ color: 'var(--text-base)', fontWeight: 600 }}>
              {queue.done} of {queue.total}
            </b>{' '}
            handled
          </span>
          <div role="progressbar" aria-valuenow={queue.done} aria-valuemin={0} aria-valuemax={queue.total} style={{ flex: 1, height: 6, background: 'var(--bg-subtle)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', borderRadius: 999, transition: 'width 160ms' }} />
          </div>
          <span>{queue.hint}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', flex: '1 1 320px' }}>{rule}</span>
          {footer}
        </div>
      </div>
    </div>
  )
}

/** The green line a handled row reads. */
export function HandledCell({ label, onUndo }: { label: string; onUndo?: (() => void) | null }) {
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>✓ {label}</span>
      {onUndo ? (
        <button type="button" onClick={onUndo} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-blue-700)', fontWeight: 600, fontSize: '0.74rem' }}>
          Undo
        </button>
      ) : null}
    </span>
  )
}

export default SubsTileModal
