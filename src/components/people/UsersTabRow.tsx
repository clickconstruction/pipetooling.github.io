import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { loginAsUser } from '../../lib/loginAsUser'
import { APP_HOSTNAME, appUrl } from '../../lib/appOrigin'
import type { RailRow, RailSignal } from '../../lib/people/deskRailAttention'
import type { PersonDeskSectionId } from '../../lib/people/personDeskSections'
import { PersonNameDoor } from '../personDesk/PersonNameDoor'
import { UsersNeedsFoldOut, UsersNeedsPill, UsersRailCells } from './UsersTabStatusColumn'

export type UsersTabRowItem = {
  source: 'user' | 'people'
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  master_user_id?: string
}

export type UsersTabRowMenuAction = { key: string; label: string; onClick: () => void; disabled?: boolean; title?: string; danger?: boolean }

const CHIP_TONE: Record<RailSignal['tone'] | 'green' | 'ghost', { background: string; color: string; border: string }> = {
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid #f59e0b' },
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-600)', border: '1px solid #dc2626' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', border: '1px solid #93c5fd' },
  gray: { background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border)' },
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', border: '1px solid #22c55e' },
  ghost: { background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)' },
}

function Chip({ tone, title, children }: { tone: keyof typeof CHIP_TONE; title?: string; children: ReactNode }) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '0 0.45rem', fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.6, whiteSpace: 'nowrap', ...CHIP_TONE[tone] }}>
      {children}
    </span>
  )
}

/**
 * One row shape for every person on People → Users (v2.2762): imitate
 * (unchanged, one click, dev only) · attention dot · name (Desk door) ·
 * login / no-login chip · contact · the status column · one ⋯ menu. Roster-only
 * and account rows read the same; the chip says which is which.
 * v2.2815: the status column is the icon rail on wide screens and the hours counter +
 * "Needs you" pill on narrow ones (UsersTabStatusColumn), from the row's grouped needs;
 * without needs (an older caller) the row falls back to the loose signal chips.
 */
export function UsersTabRow({
  item,
  rail,
  narrowViewport,
  isDev,
  openDesk,
  openHours,
  activeProjects,
  loggingInAsId,
  setLoggingInAsId,
  setError,
  menu,
  createdBy,
  below,
}: {
  item: UsersTabRowItem
  rail: RailRow
  narrowViewport: boolean
  isDev: boolean
  /** Opens the Person Desk at a section — the status column's doors; undefined when the viewer can't open the Desk. */
  openDesk?: (section: PersonDeskSectionId) => void
  /** v2.2822: the hours cell opens the approvals queue pinned to this account. */
  openHours?: () => void
  activeProjects: Array<{ id: string; name: string }>
  loggingInAsId: string | null
  setLoggingInAsId: (id: string | null) => void
  setError: (message: string | null) => void
  menu: UsersTabRowMenuAction[]
  /** "Created by Malachi" for roster rows someone else owns. */
  createdBy?: string | null
  /** Extra content under the row (the dev tags panel). */
  below?: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  /** Narrow only: the "Needs you" pill's fold-out, rendered under the row so ⋯ stays beside the pill. */
  const [needsOpen, setNeedsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const isAccount = item.source === 'user'

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

  const dotColor = rail.attention === 'red' ? '#dc2626' : rail.attention === 'amber' ? '#f59e0b' : '#22c55e'
  const imitate = isDev && isAccount && item.email

  async function runImitate(redirect: string) {
    setLoggingInAsId(item.id)
    setError(null)
    try {
      await loginAsUser({ email: item.email }, redirect)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to imitate')
    } finally {
      setLoggingInAsId(null)
    }
  }

  return (
    <li
      style={{
        padding: '0.45rem 0',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: narrowViewport ? 'flex-start' : 'center', gap: '0.5rem', flexWrap: narrowViewport ? 'wrap' : 'nowrap' }}>
        {/* Imitate stays exactly where it was: one click, always on, dev only (owner decision, 2026-09-04). */}
        {imitate && window.location.hostname === APP_HOSTNAME ? (
          <button
            type="button"
            title={`Imitate ${item.name} on ${APP_HOSTNAME}`}
            aria-label={`Imitate ${item.name}`}
            onClick={() => void runImitate(appUrl('/dashboard'))}
            disabled={loggingInAsId === item.id}
            style={{ display: 'inline-flex', alignItems: 'center', padding: 0, background: 'none', border: 'none', cursor: loggingInAsId === item.id ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
              <path d="M96 64C60.7 64 32 92.7 32 128L32 200C32 213.3 42.7 224 56 224C69.3 224 80 213.3 80 200L80 128C80 119.2 87.2 112 96 112L168 112C181.3 112 192 101.3 192 88C192 74.7 181.3 64 168 64L96 64zM472 64C458.7 64 448 74.7 448 88C448 101.3 458.7 112 472 112L544 112C552.8 112 560 119.2 560 128L560 200C560 213.3 570.7 224 584 224C597.3 224 608 213.3 608 200L608 128C608 92.7 579.3 64 544 64L472 64zM80 440C80 426.7 69.3 416 56 416C42.7 416 32 426.7 32 440L32 512C32 547.3 60.7 576 96 576L168 576C181.3 576 192 565.3 192 552C192 538.7 181.3 528 168 528L96 528C87.2 528 80 520.8 80 512L80 440zM608 440C608 426.7 597.3 416 584 416C570.7 416 560 426.7 560 440L560 512C560 520.8 552.8 528 544 528L472 528C458.7 528 448 538.7 448 552C448 565.3 458.7 576 472 576L544 576C579.3 576 608 547.3 608 512L608 440zM320 280C350.9 280 376 254.9 376 224C376 193.1 350.9 168 320 168C289.1 168 264 193.1 264 224C264 254.9 289.1 280 320 280zM320 320C267 320 224 363 224 416L224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440L416 416C416 363 373 320 320 320zM512 256C512 229.5 490.5 208 464 208C437.5 208 416 229.5 416 256C416 282.5 437.5 304 464 304C490.5 304 512 282.5 512 256zM200 336.3C150.7 340.4 112 381.6 112 432L112 442.7C112 454.5 121.6 464 133.3 464L180.1 464C177.4 456.5 176 448.4 176 440L176 416C176 386.5 184.8 359.1 200 336.3zM459.9 464L506.7 464C518.5 464 528 454.4 528 442.7L528 432C528 381.7 489.3 340.4 440 336.3C455.2 359.1 464 386.5 464 416L464 440C464 448.4 462.6 456.5 459.9 464zM224 256C224 229.5 202.5 208 176 208C149.5 208 128 229.5 128 256C128 282.5 149.5 304 176 304C202.5 304 224 282.5 224 256z" />
            </svg>
          </button>
        ) : null}
        {imitate && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? (
          <button
            type="button"
            title={`Imitate ${item.name} (localhost)`}
            aria-label={`Imitate ${item.name} on localhost`}
            onClick={() => void runImitate(`${window.location.origin}/dashboard`)}
            disabled={loggingInAsId === item.id}
            style={{ display: 'inline-flex', alignItems: 'center', padding: 0, background: 'none', border: 'none', cursor: loggingInAsId === item.id ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
              <path d="M31 31C21.7 40.4 21.7 55.6 31 65L87 121C96.4 130.4 111.6 130.4 120.9 121C130.2 111.6 130.3 96.4 120.9 87.1L65 31C55.6 21.6 40.4 21.6 31.1 31zM609 31C599.6 21.6 584.4 21.6 575.1 31L519 87C509.6 96.4 509.6 111.6 519 120.9C528.4 130.2 543.6 130.3 552.9 120.9L609 65C618.4 55.6 618.4 40.4 609 31.1zM65 609L121 553C130.4 543.6 130.4 528.4 121 519.1C111.6 509.8 96.4 509.7 87.1 519.1L31 575C21.6 584.4 21.6 599.6 31 608.9C40.4 618.2 55.6 618.3 64.9 608.9zM609 609C618.4 599.6 618.4 584.4 609 575.1L553 519.1C543.6 509.7 528.4 509.7 519.1 519.1C509.8 528.5 509.7 543.7 519.1 553L575.1 609C584.5 618.4 599.7 618.4 609 609zM320 272C355.3 272 384 243.3 384 208C384 172.7 355.3 144 320 144C284.7 144 256 172.7 256 208C256 243.3 284.7 272 320 272zM320 304C258.1 304 208 354.1 208 416L208 424C208 437.3 218.7 448 232 448L408 448C421.3 448 432 437.3 432 424L432 416C432 354.1 381.9 304 320 304zM536 224C536 193.1 510.9 168 480 168C449.1 168 424 193.1 424 224C424 254.9 449.1 280 480 280C510.9 280 536 254.9 536 224zM451.2 324.4C469.4 350.3 480 381.9 480 416L480 424C480 432.4 478.6 440.5 475.9 448L554.7 448C566.5 448 576 438.4 576 426.7L576 416C576 363 533 320 480 320C470 320 460.3 321.5 451.2 324.4zM188.8 324.4C179.7 321.5 170 320 160 320C107 320 64 363 64 416L64 426.7C64 438.5 73.6 448 85.3 448L164.1 448C161.4 440.5 160 432.4 160 424L160 416C160 381.9 170.6 350.3 188.8 324.4zM216 224C216 193.1 190.9 168 160 168C129.1 168 104 193.1 104 224C104 254.9 129.1 280 160 280C190.9 280 216 254.9 216 224z" />
            </svg>
          </button>
        ) : null}
        <span aria-hidden title={rail.reasons.join(' · ') || 'Nothing needs you'} style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <PersonNameDoor name={item.name} userId={isAccount ? item.id : null} personId={isAccount ? rail.personId : item.id} style={{ fontWeight: 600, color: 'var(--text-link)' }} />
        {isAccount ? <Chip tone="gray">login</Chip> : <Chip tone="ghost" title="A roster row with no app account — their portal, paperwork and pay work without one">no login</Chip>}
        {(item.email || item.phone) && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: narrowViewport ? 'normal' : 'nowrap' }}>
            {item.email && (
              <a href={`mailto:${item.email}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                {item.email}
              </a>
            )}
            {item.email && item.phone && ' · '}
            {item.phone && (
              <a href={`tel:${item.phone}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                {item.phone}
              </a>
            )}
          </span>
        )}
        {isAccount && item.notes ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: narrowViewport ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>— {item.notes}</span> : null}
        {rail.rowNeeds ? (
          narrowViewport ? (
            <UsersNeedsPill rowNeeds={rail.rowNeeds} name={item.name} openDesk={openDesk} openHours={openHours} open={needsOpen} onToggle={() => setNeedsOpen((v) => !v)} />
          ) : (
            <UsersRailCells rowNeeds={rail.rowNeeds} name={item.name} openDesk={openDesk} openHours={openHours} />
          )
        ) : (
          <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap', marginLeft: narrowViewport ? 0 : 'auto', flexShrink: 0 }}>
            {rail.signals.map((s) => (
              <Chip key={s.key} tone={s.tone}>
                {s.label}
              </Chip>
            ))}
          </span>
        )}
        {menu.length > 0 ? (
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Actions for ${item.name}`}
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
                    style={{ textAlign: 'left', border: 'none', background: 'none', padding: '0.35rem 0.6rem', fontSize: '0.8125rem', cursor: m.disabled ? 'not-allowed' : 'pointer', color: m.danger ? 'var(--text-red-700)' : 'var(--text-700)', opacity: m.disabled ? 0.55 : 1, fontFamily: 'inherit', borderRadius: 4 }}
                  >
                    {m.label}
                  </button>
                ))}
                {createdBy ? <span style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>Created by {createdBy}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {narrowViewport && needsOpen && rail.rowNeeds ? <UsersNeedsFoldOut rowNeeds={rail.rowNeeds} name={item.name} openDesk={openDesk} /> : null}
      {activeProjects.length > 0 ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', paddingLeft: narrowViewport ? 0 : '1.4rem' }}>
          Active projects:{' '}
          {activeProjects.map((row, i) => (
            <span key={row.id}>
              {i > 0 ? ', ' : null}
              <Link to={`/workflows/${row.id}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                {row.name}
              </Link>
            </span>
          ))}
        </div>
      ) : null}
      {below}
    </li>
  )
}
