import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { roundWindow, type RoundAction } from '../../../lib/flows/roundWindow'
import type { RoundSpec } from './gcRoundOpener'

/**
 * A round's window (Messages cut 4, the prototype's v1.168): a change order with its facts and Ask again, a pay
 * application with what it covers and its certificate, any other round with its day. The words are `roundWindow.ts`'s;
 * each press goes back to the page (`onAction`), which knows the windows to open.
 */
export function GcRoundWindow({ spec, onClose, onAction }: { spec: RoundSpec; onClose: () => void; onAction: (action: RoundAction['kind'], spec: RoundSpec) => void }) {
  const w = roundWindow(spec.step, spec.round, spec.who, spec.detail)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={w.title}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(560px, 100%)', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', border: '1px solid var(--border-strong)', padding: '1rem', display: 'grid', gap: '0.6rem' }}
      >
        <div>
          <strong style={{ fontSize: '1.05rem' }}>{w.title}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{w.sub}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              borderRadius: 999,
              padding: '0.1rem 0.6rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: w.state.tone === 'ok' ? 'var(--bg-green-tint)' : w.state.tone === 'wait' ? 'var(--bg-amber-tint)' : 'var(--bg-muted)',
              color: w.state.tone === 'ok' ? 'var(--text-green-700)' : w.state.tone === 'wait' ? 'var(--text-amber-800)' : 'var(--text-600)',
            }}
          >
            {w.state.words}
          </span>
          {w.line && <span style={{ fontSize: '0.875rem', color: 'var(--text-600)' }}>{w.line}</span>}
        </div>
        {w.facts.length > 0 && (
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.25rem 0.75rem', margin: 0, fontSize: '0.875rem' }}>
            {w.facts.map((f) => (
              <div key={f.label} style={{ display: 'contents' }}>
                <dt style={{ color: 'var(--text-muted)' }}>{f.label}</dt>
                <dd style={{ margin: 0 }}>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {w.actions.map((a) => (
            <button
              key={a.kind}
              type="button"
              onClick={() => onAction(a.kind, spec)}
              style={{
                border: `1px solid ${a.kind === 'ask-again' ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                background: a.kind === 'ask-again' ? 'var(--text-blue-500)' : 'var(--surface)',
                color: a.kind === 'ask-again' ? 'var(--surface)' : 'var(--text-700)',
                borderRadius: 8,
                padding: '0.3rem 0.75rem',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: '0.85rem',
              }}
            >
              {a.label}
            </button>
          ))}
          <button type="button" onClick={onClose} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 8, padding: '0.3rem 0.75rem', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
