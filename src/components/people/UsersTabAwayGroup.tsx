import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AWAY_SECTION_WORDS, awayDoorPlace, awayGroupCount, awayWhenTitle, type AwayRow } from '../../lib/people/awaySection'
import { AWAY_PREVIEW_WORDS } from '../../lib/people/awayPreview'
import { MORE_SWIPE_GREY, SWIPE_ACTION_WIDTH, personInitial } from '../../lib/people/usersTabPhone'
import { humanRoleLabel } from '../../lib/roleLabels'
import { PersonNameDoor } from '../personDesk/PersonNameDoor'
import { UsersTabChip } from './UsersTabRow'
import { useSwipeRow } from './useSwipeRow'

/**
 * The Away group on People → Users (v2.6863, the owner's pick of direction C from the mock-up of 2026-11-10):
 * the people who are away, drawn as roster rows under a heading in the roster's own style, in place of the
 * boxed table that sat under it. One line says who and when: a quiet dot, the name as the desk's door, the
 * role as the chip (Away mixes the groups), the day they left and the day back with how far off it is, and a
 * bell when the office asked to be told on the day. The roster's second line carries the note they will read
 * and ends in See what they see. Edit the note… and the door (Bring back… or Restore) wait in the ⋯ menu; on
 * the day back the row turns amber and the door comes out onto the row, since it is then the next press.
 * On a phone the group is one card like every other group, each row an avatar row that slides over its presses.
 */

type DoorKind = 'bring_back' | 'restore'

export type UsersTabAwayGroupProps = {
  rows: readonly AwayRow[]
  narrowViewport: boolean
  /** The desk can bring a person back (login and roster row together); without it the door is Restore. */
  bringBackThroughDesk: boolean
  onSee: (row: AwayRow) => void
  onEditNote: (row: AwayRow) => void
  /** Bring back… opens the desk's window; Restore asks first, then brings the login back. */
  onDoor: (row: AwayRow, kind: DoorKind) => void
  /** Opens the person's desk; undefined when the viewer cannot. */
  openDesk?: (row: AwayRow) => void
  /** The login a Restore is running on. */
  restoringUserId: string | null
  /** Phone: the one row slid open across the whole directory, and its setter. */
  swipeOpenId: string | null
  onSwipeChange: (rowId: string, open: boolean) => void
}

const AMBER_PRESS: CSSProperties = { border: '1px solid #f59e0b', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 6, padding: '0.1rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit' }

function doorKindFor(row: AwayRow, bringBackThroughDesk: boolean): DoorKind {
  return row.door === 'bring_back' && bringBackThroughDesk ? 'bring_back' : 'restore'
}

function doorWords(kind: DoorKind, restoring: boolean): { label: string; title: string } {
  if (kind === 'bring_back') return { label: AWAY_SECTION_WORDS.bringBack, title: AWAY_SECTION_WORDS.bringBackTitle }
  return { label: restoring ? 'Restoring…' : AWAY_SECTION_WORDS.restore, title: AWAY_SECTION_WORDS.restoreTitle }
}

function Bell() {
  return (
    <span role="img" aria-label={AWAY_SECTION_WORDS.bellTitle} title={AWAY_SECTION_WORDS.bellTitle} style={{ display: 'inline-flex', color: 'var(--text-muted)', flexShrink: 0 }}>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    </span>
  )
}

/** The line of days: muted, the distance a shade stronger; amber and bold once the day back is here. */
function WhenLine({ row, size }: { row: AwayRow; size: string }) {
  const tone: CSSProperties = row.due ? { color: 'var(--text-amber-800)', fontWeight: 600 } : { color: 'var(--text-muted)' }
  return (
    <span data-testid="away-when" title={awayWhenTitle(row)} style={{ fontSize: size, whiteSpace: 'nowrap', ...tone }}>
      {row.when.left} · {row.when.back}
      {row.when.distance ? (
        <>
          , <span style={row.due ? undefined : { fontWeight: 600, color: 'var(--text-700)' }}>{row.when.distance}</span>
        </>
      ) : null}
    </span>
  )
}

function AwayDeskRow({ row, bringBackThroughDesk, onSee, onEditNote, onDoor, openDesk, restoringUserId }: Omit<UsersTabAwayGroupProps, 'rows' | 'narrowViewport' | 'swipeOpenId' | 'onSwipeChange'> & { row: AwayRow }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const kind = doorKindFor(row, bringBackThroughDesk)
  const restoring = restoringUserId === row.userId
  const door = doorWords(kind, restoring)
  const doorOnRow = awayDoorPlace(row) === 'row'
  const menu: Array<{ key: string; label: string; title?: string; disabled?: boolean; onClick: () => void }> = []
  if (openDesk) menu.push({ key: 'desk', label: AWAY_SECTION_WORDS.openDesk, onClick: () => openDesk(row) })
  menu.push({ key: 'note', label: AWAY_SECTION_WORDS.editNote, title: AWAY_SECTION_WORDS.editNoteTitle, onClick: () => onEditNote(row) })
  if (!doorOnRow) menu.push({ key: 'door', label: door.label, title: door.title, disabled: restoring, onClick: () => onDoor(row, kind) })

  return (
    <li data-testid="users-tab-away-row" style={{ padding: '0.45rem 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.2rem' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: row.due ? '#f59e0b' : 'var(--border-strong)', flexShrink: 0 }} />
        <PersonNameDoor name={row.displayName} userId={row.userId} personId={row.personId} style={{ fontWeight: 600, color: 'var(--text-link)' }} />
        <UsersTabChip tone="gray">{humanRoleLabel(row.role)}</UsersTabChip>
        <WhenLine row={row} size="0.8125rem" />
        {row.alertOn ? <Bell /> : null}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          {doorOnRow ? (
            <button type="button" onClick={() => onDoor(row, kind)} disabled={restoring} title={door.title} style={AMBER_PRESS}>
              {door.label}
            </button>
          ) : null}
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Actions for ${row.displayName}`}
              onClick={() => setMenuOpen((v) => !v)}
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', borderRadius: 4, padding: '0 0.45rem', fontWeight: 700, cursor: 'pointer', lineHeight: 1.5, fontFamily: 'inherit' }}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div role="menu" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 5, minWidth: 190, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: '0.25rem', display: 'flex', flexDirection: 'column' }}>
                {menu.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="menuitem"
                    disabled={m.disabled}
                    title={m.title}
                    onClick={() => {
                      setMenuOpen(false)
                      m.onClick()
                    }}
                    style={{ textAlign: 'left', border: 'none', background: 'none', padding: '0.35rem 0.6rem', fontSize: '0.8125rem', cursor: m.disabled ? 'not-allowed' : 'pointer', color: 'var(--text-700)', opacity: m.disabled ? 0.55 : 1, fontFamily: 'inherit', borderRadius: 4 }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </span>
      </div>
      {/* The roster's second line, where an active row lists its projects: the note they will read, then the look at their screen. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', paddingLeft: '1.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: 0 }}>
        {row.noteLine ? (
          <>
            <span style={{ flexShrink: 0 }}>{AWAY_SECTION_WORDS.theyRead}</span>
            <span data-testid="away-note-line" title={row.noteLine} style={{ fontStyle: 'italic', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              “{row.noteLine}”
            </span>
          </>
        ) : (
          <span style={{ flexShrink: 0 }}>{AWAY_SECTION_WORDS.noWords}</span>
        )}
        <span aria-hidden style={{ flexShrink: 0 }}>
          ·
        </span>
        <button type="button" onClick={() => onSee(row)} title={AWAY_PREVIEW_WORDS.pressTitle} style={{ flexShrink: 0, border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontFamily: 'inherit', fontSize: 'inherit' }}>
          {AWAY_PREVIEW_WORDS.press}
        </button>
      </div>
    </li>
  )
}

function AwayPhoneRow({ row, bringBackThroughDesk, onSee, onEditNote, onDoor, openDesk, restoringUserId, swipeOpen, onSwipeChange }: Omit<UsersTabAwayGroupProps, 'rows' | 'narrowViewport' | 'swipeOpenId' | 'onSwipeChange'> & { row: AwayRow; swipeOpen: boolean; onSwipeChange: (open: boolean) => void }) {
  const kind = doorKindFor(row, bringBackThroughDesk)
  const restoring = restoringUserId === row.userId
  const door = doorWords(kind, restoring)
  const doorOnRow = awayDoorPlace(row) === 'row'
  const actions: Array<{ key: string; label: string; background: string; onClick: () => void; disabled?: boolean }> = [
    { key: 'see', label: AWAY_PREVIEW_WORDS.press, background: '#2563eb', onClick: () => onSee(row) },
    { key: 'note', label: AWAY_SECTION_WORDS.editNote, background: '#7c3aed', onClick: () => onEditNote(row) },
  ]
  // A literal grey from the directory's own strip: a text token turns pale in dark under the white words.
  if (!doorOnRow) actions.push({ key: 'door', label: door.label, background: MORE_SWIPE_GREY, onClick: () => onDoor(row, kind), disabled: restoring })
  const actionsWidth = SWIPE_ACTION_WIDTH * actions.length
  const swipe = useSwipeRow({ actionsWidth, swipeOpen, onSwipeChange, enabled: true })

  function onRowClick() {
    if (swipe.suppressClick.current) return
    if (swipeOpen) {
      onSwipeChange(false)
      return
    }
    openDesk?.(row)
  }

  const ring = row.due ? '#f59e0b' : 'var(--border-strong)'
  return (
    <li data-testid="users-tab-away-phone-row" style={{ borderTop: '1px solid var(--border)', listStyle: 'none' }}>
      <div style={{ position: 'relative', overflow: 'clip' }}>
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
                onSwipeChange(false)
              }}
              aria-label={`${a.label} — ${row.displayName}`}
              style={{ width: SWIPE_ACTION_WIDTH, border: 'none', background: a.background, color: '#fff', fontWeight: 700, fontSize: '0.72rem', lineHeight: 1.15, padding: '0 0.2rem', cursor: a.disabled ? 'wait' : 'pointer', fontFamily: 'inherit' }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div
          role="button"
          tabIndex={0}
          aria-label={`${row.displayName} — swipe left for actions`}
          onClick={onRowClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onRowClick()
            } else if (e.key === 'ArrowLeft') onSwipeChange(true)
            else if (e.key === 'ArrowRight') onSwipeChange(false)
          }}
          {...swipe.handlers}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 0.75rem',
            minHeight: 46,
            boxSizing: 'border-box',
            background: 'var(--surface)',
            transform: `translateX(${swipe.offset}px)`,
            transition: swipe.dragging ? 'none' : 'transform 160ms ease-out',
            touchAction: 'pan-y',
            cursor: openDesk ? 'pointer' : 'default',
            userSelect: 'none',
          }}
        >
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-700)', background: 'var(--bg-muted)', boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${ring}` }}>
            {personInitial(row.displayName)}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600 }}>{row.displayName}</span> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{humanRoleLabel(row.role)}</span>
            </span>
            <span data-testid="away-when" title={awayWhenTitle(row)} style={{ display: 'block', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(row.due ? { color: 'var(--text-amber-800)', fontWeight: 600 } : { color: 'var(--text-muted)' }) }}>
              {row.when.back}
              {row.when.distance ? `, ${row.when.distance}` : ''}
            </span>
            <span data-testid="away-note-line" style={{ display: 'block', fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.noteLine ? `“${row.noteLine}”` : AWAY_SECTION_WORDS.noWords}</span>
          </span>
          {row.alertOn ? <Bell /> : null}
          <span aria-hidden style={{ color: 'var(--text-muted)', paddingLeft: 2 }}>
            ›
          </span>
        </div>
      </div>
      {doorOnRow ? (
        <div style={{ padding: '0.1rem 0.75rem 0.6rem 3.2rem', background: 'var(--surface)' }}>
          <button type="button" onClick={() => onDoor(row, kind)} disabled={restoring} title={door.title} style={{ ...AMBER_PRESS, padding: '0.25rem 0.7rem', fontSize: '0.8rem' }}>
            {door.label}
          </button>
        </div>
      ) : null}
    </li>
  )
}

export function UsersTabAwayGroup(props: UsersTabAwayGroupProps) {
  const { rows, narrowViewport, swipeOpenId, onSwipeChange, ...rest } = props
  if (rows.length === 0) return null
  const count = awayGroupCount(rows)
  if (narrowViewport) {
    return (
      <section id="users-tab-away" aria-label={AWAY_SECTION_WORDS.heading} style={{ marginBottom: '0.6rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'clip' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.55rem 0.75rem 0.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{AWAY_SECTION_WORDS.heading}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{count}</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((r) => {
            const rowId = `away-${r.userId}`
            return <AwayPhoneRow key={r.userId} row={r} {...rest} swipeOpen={swipeOpenId === rowId} onSwipeChange={(open) => onSwipeChange(rowId, open)} />
          })}
        </ul>
      </section>
    )
  }
  return (
    <section id="users-tab-away" aria-label={AWAY_SECTION_WORDS.heading} style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem', gap: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.0625rem' }}>
          {AWAY_SECTION_WORDS.heading} <span style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{count}</span>
        </h2>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{AWAY_SECTION_WORDS.side}</span>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <AwayDeskRow key={r.userId} row={r} {...rest} />
        ))}
      </ul>
    </section>
  )
}
