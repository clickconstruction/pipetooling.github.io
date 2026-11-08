/**
 * The whole of one History line in a window (punch list #208, design spike; the owner, 2026-10-29:
 * *only show so much and show the rest in a modal if the user clicks on it*). The line in the stream
 * folds its words past a few hundred characters behind *more ›*; the press opens this: the verb and
 * the piece, the day and time, who wrote it and whether a robot kept it, then every word. The words
 * are stored whole and go out whole through MCP; the fold is the page's alone. The list reads a long
 * line's first words only (punch list #280, v2.6735): when `line.detailIsHead`, the window reads the
 * whole by `readWhole` on open, shows the head with *Reading the rest…* until it lands, and names the
 * reason with the head when the read fails.
 */
import { useEffect, useState } from 'react'
import type { ChangeLine } from '../../lib/developments/whatChanged'
import { formatErrorMessage } from '../../utils/errorHandling'
import { LinkButton, shortDay, SmallButton, timeOfDay } from './developmentPageBits'
import { JobChip } from './JobChip'

type WholeRead = { entryId: string; state: 'reading' } | { entryId: string; state: 'read'; text: string } | { entryId: string; state: 'failed'; reason: string }

export function DevelopmentLineWindow({ line, onClose, openAbout, readWhole }: { line: ChangeLine | null; onClose: () => void; openAbout: (about: ChangeLine['about']) => void; readWhole?: (entryId: string) => Promise<string> }) {
  const [whole, setWhole] = useState<WholeRead | null>(null)
  useEffect(() => {
    if (!line) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [line, onClose])
  const wantsWhole = !!line?.detailIsHead && !!line.entryId && !!readWhole
  const entryId = line?.entryId ?? null
  useEffect(() => {
    if (!wantsWhole || !entryId || !readWhole) return
    let live = true
    setWhole({ entryId, state: 'reading' })
    readWhole(entryId).then(
      (text) => live && setWhole({ entryId, state: 'read', text }),
      (e) => live && setWhole({ entryId, state: 'failed', reason: formatErrorMessage(e, 'the rest could not be read') }),
    )
    return () => {
      live = false
    }
  }, [wantsWhole, entryId, readWhole])
  if (!line) return null
  const read = wantsWhole && whole && whole.entryId === line.entryId ? whole : null
  const when = `${shortDay(line.at)}${!line.dayOnly && timeOfDay(line.at) ? ` · ${timeOfDay(line.at)}` : ''}`
  const door = line.about.id && line.about.kind !== 'customer'
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${line.verb} · ${line.about.label}`}
      data-testid="history-line-window"
      style={{ position: 'fixed', inset: 0, zIndex: 760, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + var(--app-top-chrome, 0px)) 16px 16px' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, boxShadow: '0 20px 50px rgba(17, 24, 39, 0.3)', width: 640, maxWidth: '100%', maxHeight: 'min(calc(100vh - 32px), 100%)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: '1rem' }}>{line.verb}</strong>
            <span style={{ color: 'var(--text-muted)' }}> · </span>
            {door && line.about.kind === 'job' ? (
              <JobChip jobId={line.about.id!} onOpen={() => openAbout(line.about)} strong>
                {line.about.label}
              </JobChip>
            ) : door ? (
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
          {read?.state === 'read' ? read.text : line.detail}
          {read?.state === 'reading' ? (
            <span style={{ display: 'block', marginTop: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }} data-testid="history-line-window-reading">
              Reading the rest…
            </span>
          ) : read?.state === 'failed' ? (
            <span style={{ display: 'block', marginTop: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }} role="status" data-testid="history-line-window-failed">
              The rest did not come: {read.reason}
            </span>
          ) : null}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <SmallButton onClick={onClose}>Close</SmallButton>
        </div>
      </div>
    </div>
  )
}
