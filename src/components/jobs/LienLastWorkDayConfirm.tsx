import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { lienLastWorkPreview, type LienLastWorkPreviewInput } from '../../lib/jobs/lienLastWorkDayPreview'
import { FinishedDateInput } from '../FinishedDateInput'

/**
 * The window that opens before a hand-set last day of work is saved (v2.4717): how far the day
 * moves from the clock hours, in words; the dates the law hangs on it, today beside the new day,
 * changed rows lit; the reason, asked here. The day can still be
 * fixed inside the window, and everything recomputes as it changes. A refused day explains
 * itself and keeps *Set the day* off; a day far from the hours reads *Set the day anyway*.
 * Nothing is written here — the caller writes on confirm.
 */
type Props = {
  jobLabel: string
  input: Omit<LienLastWorkPreviewInput, 'candidate'>
  day: string
  onDay: (day: string) => void
  note: string
  onNote: (note: string) => void
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

const btn = (primary = false, disabled = false): CSSProperties => ({ padding: '6px 14px', borderRadius: 8, border: primary ? '1px solid transparent' : '1px solid var(--border-strong)', background: primary ? '#2563eb' : 'var(--surface)', color: primary ? '#fff' : 'var(--text-700)', font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 })
const kicker: CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export function LienLastWorkDayConfirm({ jobLabel, input, day, onDay, note, onNote, onConfirm, onCancel, busy = false }: Props) {
  const preview = useMemo(() => lienLastWorkPreview({ ...input, candidate: day }), [input, day])
  const noteRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    noteRef.current?.focus()
  }, [])
  // Esc closes only this window, in the capture phase, so the desk under it never sees the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const refused = preview.verdict === 'refused'
  const canSet = !refused && note.trim().length > 0 && !busy
  const tone = refused ? { border: 'var(--text-red-600)', bg: 'var(--bg-red-tint)' } : preview.verdict === 'look' ? { border: 'var(--border-amber)', bg: 'var(--bg-amber-tint)' } : { border: 'var(--border-green)', bg: 'var(--bg-green-tint)' }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lien-last-work-confirm-title"
      data-testid="lien-last-work-confirm"
      data-verdict={preview.verdict}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onCancel()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 12, width: 'min(640px, calc(100vw - 2rem))', maxHeight: 'min(90dvh, calc(100dvh - 2rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px)))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="lien-last-work-confirm-title" style={{ margin: 0, fontSize: '0.95rem' }}>Set the last day of work by hand?</h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{jobLabel}</div>
          </div>
          <button type="button" aria-label="Close" onClick={onCancel} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 1rem', display: 'grid', gap: '0.7rem', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem 1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 3, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Last day of work
              <FinishedDateInput aria-label="Last day of work" value={day} onCommit={(d) => onDay(d ?? '')} style={{ padding: '0.3rem 0.4rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }} />
            </label>
            <div data-testid="lien-last-work-shift" style={{ fontSize: '0.9rem', flex: '1 1 16rem', minWidth: 0 }}>{preview.shiftWords}</div>
          </div>
          <div data-testid="lien-last-work-say" style={{ borderLeft: `3px solid ${tone.border}`, background: tone.bg, padding: '6px 10px', borderRadius: '0 6px 6px 0' }}>{preview.sayWords}</div>

          {preview.rows.length ? (
            <table data-testid="lien-last-work-diff" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['What', 'Today', '', 'With the new day'].map((h, i) => (
                    <th key={i} style={{ ...kicker, textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--border)', width: i === 2 ? 20 : undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.what} data-changed={r.changed ? 'yes' : 'no'} style={{ background: r.changed ? 'var(--bg-blue-tint)' : undefined, color: r.changed ? undefined : 'var(--text-muted)' }}>
                    <td style={{ padding: '6px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.what}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid var(--border)' }}>{r.before}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'center' }}>{r.changed ? '→' : ''}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid var(--border)', fontWeight: r.changed ? 700 : 400, color: r.changed ? 'var(--text-blue-800)' : undefined }}>
                      {r.after}
                      {r.changed ? null : <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}> · unchanged</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <label style={{ display: 'grid', gap: 3 }}>
            <span style={kicker}>Why, in a line</span>
            <input ref={noteRef} aria-label="Why the last day is set by hand" value={note} onChange={(e) => onNote(e.target.value)} placeholder="what was done that day, and why the hours do not show it" style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', boxSizing: 'border-box' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Kept on the job beside the day. The chip will read <strong>set by hand</strong>; Change › Back puts the clock hours back.
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span data-testid="lien-last-work-hint">{refused ? 'Fix the day, or cancel.' : !note.trim() ? 'Say why in a line, then set it. Clock hours and pay are not changed.' : 'Clock hours and pay are not changed. The day sets the lien months only.'}</span>
          <span style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onCancel} disabled={busy} style={btn(false, busy)}>Cancel</button>
            <button type="button" onClick={onConfirm} disabled={!canSet} data-testid="lien-last-work-confirm-set" style={btn(true, !canSet)}>
              {busy ? 'Saving…' : preview.verdict === 'look' ? 'Set the day anyway' : 'Set the day'}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
