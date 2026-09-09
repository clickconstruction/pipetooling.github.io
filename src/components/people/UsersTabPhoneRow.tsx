import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { RailRow } from '../../lib/people/deskRailAttention'
import { SWIPE_ACTION_WIDTH, classifySwipe, isTwinEmail, needsYouCount, personInitial, phoneRowNote, swipeOffset, swipeSettles } from '../../lib/people/usersTabPhone'
import type { UsersTabRowItem, UsersTabRowMenuAction } from './UsersTabRow'

/**
 * One person on the phone directory (v2.3185, owner picked "C3" from the
 * Users Directory mock-up): initial avatar with a status ring · name (+ the
 * account note under it) · the hours count and a "Needs you N" pill · chevron.
 * Tapping the row opens the desk. A left swipe slides the row over a strip of
 * actions: **Desk**, **Imitate** (dev only, one tap, no confirm — the September 4
 * decision) and **More** (the row's ⋯ items, shown under the row). Only one row
 * is open at a time; the parent owns which. Vertical touches scroll as usual.
 */
export function UsersTabPhoneRow({
  item,
  rail,
  openDesk,
  imitate,
  imitating,
  more,
  swipeOpen,
  onSwipeChange,
  below,
}: {
  item: UsersTabRowItem
  rail: RailRow
  /** Opens the Person Desk; undefined when the viewer can't. */
  openDesk?: () => void
  /** One-tap imitate; undefined unless the viewer is a dev looking at an account row. */
  imitate?: () => void
  imitating: boolean
  /** The row's other actions (invite, edit, link, combine, archive…). */
  more: UsersTabRowMenuAction[]
  swipeOpen: boolean
  onSwipeChange: (open: boolean) => void
  below?: ReactNode
}) {
  const isAccount = item.source === 'user'
  const actions: Array<{ key: string; label: string; background: string; onClick: () => void; disabled?: boolean }> = []
  if (openDesk) actions.push({ key: 'desk', label: 'Desk', background: '#3b82f6', onClick: openDesk })
  if (imitate) actions.push({ key: 'imitate', label: imitating ? '…' : 'Imitate', background: '#7c3aed', onClick: imitate, disabled: imitating })
  const [moreOpen, setMoreOpen] = useState(false)
  if (more.length > 0) actions.push({ key: 'more', label: 'More', background: 'var(--text-muted)', onClick: () => setMoreOpen((v) => !v) })
  const actionsWidth = SWIPE_ACTION_WIDTH * actions.length

  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const axis = useRef<'horizontal' | 'vertical' | 'undecided'>('undecided')
  const [dragX, setDragX] = useState<number | null>(null)
  const suppressClick = useRef(false)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (actions.length === 0) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    axis.current = 'undecided'
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (axis.current === 'undecided') {
      axis.current = classifySwipe(dx, dy)
      if (axis.current === 'horizontal') {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* jsdom / older browsers */
        }
      }
    }
    if (axis.current !== 'horizontal') return
    setDragX(swipeOffset(dx, actionsWidth, swipeOpen))
  }
  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    if (axis.current === 'horizontal') {
      const dx = e.clientX - s.x
      onSwipeChange(swipeSettles(dx, actionsWidth, swipeOpen))
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    start.current = null
    axis.current = 'undecided'
    setDragX(null)
  }
  function onRowClick() {
    if (suppressClick.current) return
    if (swipeOpen) {
      onSwipeChange(false)
      setMoreOpen(false)
      return
    }
    openDesk?.()
  }

  const ring = rail.attention === 'red' ? '#dc2626' : rail.attention === 'amber' ? '#f59e0b' : '#22c55e'
  const twin = isTwinEmail(item.email)
  const note = isAccount ? phoneRowNote(item.notes) : null
  const hours = rail.rowNeeds?.hoursWaiting ?? 0
  const needs = needsYouCount(rail.rowNeeds)
  const needsTone = rail.attention === 'red' ? { background: 'var(--bg-red-tint)', color: 'var(--text-red-600)', border: '1px solid #dc2626' } : { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid #f59e0b' }
  const offset = dragX ?? (swipeOpen ? -actionsWidth : 0)

  const avatar: CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: '50%',
    flex: 'none',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text-700)',
    background: isAccount ? 'var(--bg-muted)' : 'transparent',
    border: isAccount ? 'none' : '1.5px dashed var(--border-strong)',
    boxShadow: isAccount ? `0 0 0 2px var(--surface), 0 0 0 4px ${ring}` : 'none',
  }

  return (
    <li data-testid="users-tab-phone-row" style={{ borderTop: '1px solid var(--border)', listStyle: 'none' }}>
      {/* The strip and the sliding row share one clipped box, so the More menu and the tags panel under the row stay clear of the strip. */}
      <div style={{ position: 'relative', overflow: 'clip' }}>
      {actions.length > 0 ? (
        <div aria-hidden={!swipeOpen} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, display: 'flex', width: actionsWidth }}>
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              tabIndex={swipeOpen ? 0 : -1}
              disabled={a.disabled}
              onClick={(e) => {
                e.stopPropagation()
                a.onClick()
                if (a.key !== 'more') onSwipeChange(false)
              }}
              aria-label={`${a.label} — ${item.name}`}
              style={{ width: SWIPE_ACTION_WIDTH, border: 'none', background: a.background, color: '#fff', fontWeight: 700, fontSize: '0.72rem', cursor: a.disabled ? 'wait' : 'pointer', fontFamily: 'inherit' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        role={openDesk || actions.length > 0 ? 'button' : undefined}
        tabIndex={openDesk || actions.length > 0 ? 0 : undefined}
        aria-label={`${item.name}${actions.length > 0 ? ' — swipe left for actions' : ''}`}
        onClick={onRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onRowClick()
          } else if (e.key === 'ArrowLeft' && actions.length > 0) onSwipeChange(true)
          else if (e.key === 'ArrowRight') onSwipeChange(false)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.5rem 0.75rem',
          minHeight: 46,
          boxSizing: 'border-box',
          background: 'var(--surface)',
          transform: `translateX(${offset}px)`,
          transition: dragX == null ? 'transform 160ms ease-out' : 'none',
          touchAction: 'pan-y',
          cursor: openDesk ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <span aria-hidden title={rail.reasons.join(' · ') || (isAccount ? 'Nothing needs you' : 'A roster row with no app account')} style={avatar}>
          {twin ? '🤖' : personInitial(item.name)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
          {note ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</span> : null}
          {!isAccount ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>no login</span> : null}
        </span>
        {hours > 0 ? (
          <span title={rail.rowNeeds?.hoursLine ?? undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, borderRadius: 999, padding: '0 0.45rem', fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.6, background: 'var(--bg-muted)', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>
            ⏱ {hours}
          </span>
        ) : null}
        {needs > 0 ? (
          <span title={rail.reasons.join(' · ')} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '0 0.45rem', fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.6, whiteSpace: 'nowrap', ...needsTone }}>
            Needs you {needs}
          </span>
        ) : null}
        <span aria-hidden style={{ color: 'var(--text-muted)', paddingLeft: 2 }}>›</span>
      </div>
      </div>
      {moreOpen && swipeOpen && more.length > 0 ? (
        <div role="menu" aria-label={`More for ${item.name}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', padding: '0.4rem 0.75rem 0.6rem', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
          {more.map((m) => (
            <button
              key={m.key}
              type="button"
              role="menuitem"
              disabled={m.disabled}
              title={m.title}
              onClick={() => {
                m.onClick()
                setMoreOpen(false)
                onSwipeChange(false)
              }}
              style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, background: 'var(--surface)', color: m.danger ? 'var(--text-red-700)' : 'var(--text-700)', cursor: m.disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}
      {below}
    </li>
  )
}
