import { useEffect, useRef, useState } from 'react'
import { chipHasMenu, chipLabel, MAKE_USUAL_LABEL, STOP_MARK, USUAL_MARK, type NumberChoice } from '../../../../lib/messages/toChip'

/**
 * The To chip (punch list #118, PR 1): where this text goes. With one number it is a label and nothing changes. With
 * more it is a press that opens a short menu: each number with when it last carried a line, a STOP marked and not
 * pickable, the usual starred, and under them the tick *Make this their usual number*. Picking one sends there this
 * once; the tick stars it for every send after (the window calls `contact_channel_make_usual` as it sends).
 */
export function ToChip({
  choices,
  pickedId,
  onPick,
  tick,
  onTick,
}: {
  choices: readonly NumberChoice[]
  /** The number the office picked this once, or null for the rule's. */
  pickedId: string | null
  onPick: (id: string) => void
  tick: boolean
  onTick: (on: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  const current = (pickedId ? choices.find((c) => c.id === pickedId) : null) ?? choices[0] ?? null
  const hasMenu = chipHasMenu(choices)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const chip = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${hasMenu ? 'var(--border-blue)' : 'var(--border)'}`,
    borderRadius: 999,
    padding: '2px 10px',
    fontSize: '0.82rem',
    background: 'var(--surface)',
    color: hasMenu ? 'var(--text-blue-700)' : 'var(--text-base)',
    cursor: hasMenu ? 'pointer' : 'default',
    font: 'inherit',
  } as const

  return (
    <div ref={box} data-to-chip={current?.id ?? ''} style={{ position: 'relative', display: 'inline-block' }}>
      {hasMenu ? (
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={chip}>
          {chipLabel(current)}
          {current?.usual && <span aria-hidden="true">★</span>}
          <span aria-hidden="true" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            ▾
          </span>
        </button>
      ) : (
        <span style={chip}>{chipLabel(current)}</span>
      )}
      {open && hasMenu && (
        <div
          role="menu"
          aria-label="Which number"
          style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, marginTop: 4, minWidth: 300, maxWidth: 'min(360px, 90vw)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,.12)', overflow: 'hidden' }}
        >
          {choices.map((c) => {
            const on = current?.id === c.id
            return (
              <button
                key={c.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                aria-disabled={c.optedOut || undefined}
                data-to-choice={c.id}
                onClick={() => {
                  if (c.optedOut) return
                  onPick(c.id)
                  setOpen(false)
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  border: 'none',
                  borderTop: '1px solid var(--border)',
                  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: c.optedOut ? 'var(--text-muted)' : 'var(--text-base)',
                  cursor: c.optedOut ? 'not-allowed' : 'pointer',
                  font: 'inherit',
                  fontSize: '0.82rem',
                }}
              >
                <span>
                  {c.value} <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>· {c.words}</span>
                </span>
                {c.optedOut ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', borderRadius: 6, padding: '1px 6px' }}>{STOP_MARK}</span>
                ) : c.usual ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>{USUAL_MARK}</span>
                ) : (
                  <span />
                )}
              </button>
            )
          })}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.82rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={tick} onChange={(e) => onTick(e.target.checked)} style={{ margin: 0 }} />
            {MAKE_USUAL_LABEL}
          </label>
        </div>
      )}
    </div>
  )
}
