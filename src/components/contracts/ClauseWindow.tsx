import { useEffect, type ReactNode } from 'react'

/**
 * Messages, cut 4c: the shell every clause window shares (edit, decline, preview), the GC windows' own: a dimmed backdrop
 * that closes it, a panel above the dock and below the phone's status bar, Escape to close, and a × in the head.
 */
export function ClauseWindow({ label, title, lede, width = 640, onClose, children }: { label: string; title: string; lede?: string; width?: number; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: `min(${width}px, 100%)`, maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{title}</div>
            {lede && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{lede}</div>}
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.8rem' }}>{children}</div>
      </div>
    </div>
  )
}

/** A field's label over its control, as the clause windows lay them out. */
export function ClauseField({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
      {note && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{note}</span>}
    </label>
  )
}
