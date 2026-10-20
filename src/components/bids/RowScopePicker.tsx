import { useEffect, useRef, type ReactNode } from 'react'

/** The popover frame the tools share: anchored under its button, Escape and a click outside close it. */
export function ToolPopover({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDoc)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [onClose])
  return (
    <div ref={boxRef} role="dialog" aria-label={label} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40, width: 'min(26rem, calc(100vw - 2rem))', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: '0.75rem 0.9rem', textAlign: 'left' }}>
      {children}
    </div>
  )
}

/** The tools' footer: the one button that says what it does, an Undo when there is one, and the Esc hint. */
export function ToolFooter({ action, disabled, onAction, undoCount, onUndo }: { action: string; disabled: boolean; onAction: () => void; undoCount: number; onUndo: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 700, padding: '0.35rem 0.8rem', borderRadius: 7, border: 'none', background: disabled ? 'var(--border)' : '#8b5cf6', color: disabled ? 'var(--text-muted)' : '#fff', cursor: disabled ? 'default' : 'pointer' }}
      >
        {action}
      </button>
      {undoCount > 0 ? (
        <button type="button" onClick={onUndo} style={{ font: 'inherit', fontSize: '0.74rem', fontWeight: 600, padding: '0.25rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
          ↩ Undo the last set ({undoCount})
        </button>
      ) : null}
      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Esc closes</span>
    </div>
  )
}
