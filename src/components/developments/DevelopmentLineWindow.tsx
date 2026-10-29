/**
 * The whole of one History line in a window (punch list #208, design spike; the owner, 2026-10-29:
 * *only show so much and show the rest in a modal if the user clicks on it*). The line in the stream
 * folds its words past a few hundred characters behind *more ›*; the press opens this: the verb and
 * the piece, the day and time, who wrote it and whether a robot kept it, then every word. The words
 * are stored whole and go out whole through MCP; the fold is the page's alone.
 */
import { useEffect } from 'react'
import type { ChangeLine } from '../../lib/developments/whatChanged'
import { LinkButton, shortDay, SmallButton, timeOfDay } from './developmentPageBits'

export function DevelopmentLineWindow({ line, onClose, openAbout }: { line: ChangeLine | null; onClose: () => void; openAbout: (about: ChangeLine['about']) => void }) {
  useEffect(() => {
    if (!line) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [line, onClose])
  if (!line) return null
  const when = `${shortDay(line.at)}${!line.dayOnly && timeOfDay(line.at) ? ` · ${timeOfDay(line.at)}` : ''}`
  const door = line.about.id && line.about.kind !== 'customer'
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${line.verb} · ${line.about.label}`}
      data-testid="history-line-window"
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, boxShadow: '0 20px 50px rgba(17, 24, 39, 0.3)', width: 640, maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: '1rem' }}>{line.verb}</strong>
            <span style={{ color: 'var(--text-muted)' }}> · </span>
            {door ? (
              <LinkButton onClick={() => openAbout(line.about)} strong>
                {line.about.label}
              </LinkButton>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{line.about.label}</span>
            )}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {when}
              {line.by ? ` · ${line.by}` : ''}
              {line.via === 'mcp' ? <span className="developmentViaMark" title={`Kept through MCP${line.agent ? ` by ${line.agent}` : ''}`}>via MCP</span> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', fontSize: '1.2rem', lineHeight: 1, padding: '0 2px' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '12px 16px', overflow: 'auto', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} data-testid="history-line-window-body">
          {line.detail}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <SmallButton onClick={onClose}>Close</SmallButton>
        </div>
      </div>
    </div>
  )
}
