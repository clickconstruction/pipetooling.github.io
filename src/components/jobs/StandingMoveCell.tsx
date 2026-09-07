/**
 * Where it stands → next, one cell (v2.2963 prototype): the rail (or a stage
 * row's one-line standing) on the left, an arrow, and the move on the right —
 * one button in the tone of its urgency, a second only where the state has
 * two real moves, a ⋯ menu for everything else, the hint beneath.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { StandingMove, MoveTone } from '../../lib/subs/standingMove'

export type MoveMenuItem = { label: string; onClick: () => void; danger?: boolean; title?: string } | 'sep'

export type StandingMoveCellProps = {
  standing: ReactNode
  primary: StandingMove
  second?: StandingMove | null
  onPrimary?: () => void
  onSecond?: () => void
  menu: MoveMenuItem[]
  busy?: boolean
}

function moveStyle(tone: MoveTone, disabled: boolean): CSSProperties {
  const base: CSSProperties = { font: 'inherit', fontSize: '0.76rem', fontWeight: 700, padding: '5px 11px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', textAlign: 'left', opacity: disabled ? 0.6 : 1 }
  switch (tone) {
    case 'primary':
      return { ...base, background: disabled ? '#9ca3af' : '#2563eb', border: '1px solid transparent', color: 'white' }
    case 'warn':
      return { ...base, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)' }
    case 'ok':
      return { ...base, background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', color: 'var(--text-green-700)' }
    case 'quiet':
      return { ...base, background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)', fontWeight: 600, cursor: 'default', paddingLeft: 0 }
    default:
      return base
  }
}

export function MoreMenu({ items, ariaLabel = 'More' }: { items: MoveMenuItem[]; ariaLabel?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (items.length === 0) return null
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid transparent', background: open ? 'var(--bg-subtle)' : 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-subtle)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = open ? 'var(--bg-subtle)' : 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
        }}
      >
        <MoreHorizontal size={18} strokeWidth={2.25} aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" style={{ position: 'absolute', top: 30, right: 0, zIndex: 30, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.22)', padding: 4, minWidth: 190, display: 'flex', flexDirection: 'column' }}>
          {items.map((it, i) =>
            it === 'sep' ? (
              <span key={`sep-${i}`} aria-hidden="true" style={{ height: 1, background: 'var(--border)', margin: '3px 4px' }} />
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                title={it.title}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
                style={{ font: 'inherit', fontSize: '0.78rem', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'none', color: it.danger ? 'var(--text-red-700)' : 'var(--text-700)', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </span>
  )
}

export function StandingMoveCell({ standing, primary, second, onPrimary, onSecond, menu, busy = false }: StandingMoveCellProps) {
  const quiet = primary.tone === 'quiet'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 'none' }}>{standing}</div>
      <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: '0.95rem', lineHeight: 1, flex: 'none' }}>
        →
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {quiet ? (
            <span style={moveStyle('quiet', false)}>{primary.label}</span>
          ) : (
            <button type="button" style={moveStyle(primary.tone, busy)} disabled={busy} onClick={onPrimary}>
              {primary.label}
            </button>
          )}
          {second ? (
            <button type="button" style={moveStyle(second.tone, busy)} disabled={busy} onClick={onSecond}>
              {second.label}
            </button>
          ) : null}
          <MoreMenu items={menu} />
        </div>
        {primary.hint ? <div style={{ fontSize: '0.68rem', color: primary.tone === 'warn' ? 'var(--text-amber-800)' : 'var(--text-muted)', fontWeight: primary.tone === 'warn' ? 600 : 400 }}>{primary.hint}</div> : null}
      </div>
    </div>
  )
}

export default StandingMoveCell
