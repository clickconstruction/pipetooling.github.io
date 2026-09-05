import type { CSSProperties, ReactNode } from 'react'
import type { PersonDeskSectionId } from '../../lib/people/personDeskSections'
import { ROW_RAIL_SUBJECTS, type RowNeed, type RowNeeds } from '../../lib/people/rowNeeds'

/**
 * People → Users status column (v2.2815, owner pick from artifact 747a0b27): one model, two
 * renderings. Wide rows carry a three-cell icon rail — Hours · Paper · Acct — each cell a door
 * to the Person Desk section that answers it. Narrow rows carry a slate hours counter beside a
 * "Needs you · N" pill that unfolds one line per need, each ending in the verb that clears it.
 * Hours are a queue, not an alarm: slate, never amber, never the dot.
 */

type CellTone = 'hours' | 'amber' | 'red' | 'fact' | 'blue' | 'quiet'

const CELL_TONE: Record<CellTone, CSSProperties> = {
  hours: { background: 'var(--bg-subtle)', color: 'var(--text-700)' },
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-600)' },
  fact: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' },
  quiet: { background: 'transparent', color: 'var(--text-muted)', opacity: 0.35 },
}

const RAIL_CELL_WIDTH = 54

function toneFor(need: RowNeed | undefined): CellTone {
  if (!need) return 'quiet'
  if (need.tone === 'red') return 'red'
  if (need.tone === 'amber') return 'amber'
  return need.key === 'portal' ? 'blue' : 'fact'
}

/** Small inline glyphs so the rail reads the same on every phone (no emoji font lottery). */
export function SubjectIcon({ subject }: { subject: 'hours' | 'paperwork' | 'account' }) {
  const common = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (subject === 'hours')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  if (subject === 'paperwork')
    return (
      <svg {...common}>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5M10 13h6M10 17h6" />
      </svg>
    )
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

/** The rail's column header — rendered once above the first group on wide screens. */
export function UsersRailHeader() {
  return (
    <div aria-hidden style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${RAIL_CELL_WIDTH}px)`, gap: 4, marginLeft: 'auto', paddingRight: 34 }}>
      {ROW_RAIL_SUBJECTS.map((s) => (
        <span key={s.key} title={s.label} style={{ textAlign: 'center', fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
          {s.short}
        </span>
      ))}
    </div>
  )
}

function Cell({ tone, title, onClick, label, children }: { tone: CellTone; title: string; onClick?: () => void; label: string; children: ReactNode }) {
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 24, borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, border: 'none', fontFamily: 'inherit', ...CELL_TONE[tone] }
  if (!onClick || tone === 'quiet') return <span title={title} aria-label={label} style={base}>{children}</span>
  return (
    <button type="button" title={title} aria-label={label} onClick={onClick} style={{ ...base, cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function needsBySubject(needs: RowNeed[], subject: RowNeed['subject']): RowNeed[] {
  return needs.filter((n) => n.subject === subject)
}

/** The strongest need of a subject decides the cell: a counted need beats a fact. */
function leadNeed(list: RowNeed[]): RowNeed | undefined {
  return list.find((n) => n.tone === 'red') ?? list.find((n) => n.tone === 'amber') ?? list[0]
}

/** Wide: three cells, fixed columns, quiet when empty. */
export function UsersRailCells({ rowNeeds, name, openDesk }: { rowNeeds: RowNeeds; name: string; openDesk?: (section: PersonDeskSectionId) => void }) {
  const paper = needsBySubject(rowNeeds.needs, 'paperwork')
  const account = needsBySubject(rowNeeds.needs, 'account')
  const paperLead = leadNeed(paper)
  const accountLead = leadNeed(account)
  const accountCount = account.reduce((s, n) => s + n.count, 0)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${RAIL_CELL_WIDTH}px)`, gap: 4, marginLeft: 'auto', flexShrink: 0 }} data-testid="users-rail">
      <Cell
        tone={rowNeeds.hoursWaiting > 0 ? 'hours' : 'quiet'}
        title={rowNeeds.hoursLine ?? 'No sessions waiting'}
        label={`${name}: ${rowNeeds.hoursLine ?? 'no sessions waiting'}`}
        onClick={rowNeeds.hoursWaiting > 0 && openDesk ? () => openDesk('hours') : undefined}
      >
        <SubjectIcon subject="hours" />
        {rowNeeds.hoursWaiting > 0 ? rowNeeds.hoursWaiting : null}
      </Cell>
      <Cell
        tone={toneFor(paperLead)}
        title={paper.length ? paper.map((n) => n.long).join(' ') : 'Paperwork in order'}
        label={`${name}: ${paper.length ? paper.map((n) => n.long).join(' ') : 'paperwork in order'}`}
        onClick={paperLead && openDesk ? () => openDesk(paperLead.door) : undefined}
      >
        <SubjectIcon subject="paperwork" />
        {paperLead ? paperLead.count || null : null}
      </Cell>
      <Cell
        tone={toneFor(accountLead)}
        title={account.length ? account.map((n) => n.long).join(' ') : 'Account in order'}
        label={`${name}: ${account.length ? account.map((n) => n.long).join(' ') : 'account in order'}`}
        onClick={accountLead && openDesk ? () => openDesk(accountLead.door) : undefined}
      >
        <SubjectIcon subject="account" />
        {accountCount > 1 ? accountCount : null}
      </Cell>
    </div>
  )
}

const PILL: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, borderRadius: 999, padding: '0.15rem 0.6rem', border: '1px solid', whiteSpace: 'nowrap', fontFamily: 'inherit', cursor: 'pointer' }
const PILL_TONE: Record<'amber' | 'red', CSSProperties> = {
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderColor: '#f59e0b' },
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-600)', borderColor: '#dc2626' },
}

/**
 * Narrow: the hours counter beside the pill. The row owns `open` and renders
 * `UsersNeedsFoldOut` under itself, so the ⋯ menu stays beside the pill while it is unfolded.
 */
export function UsersNeedsPill({ rowNeeds, name, openDesk, open, onToggle }: { rowNeeds: RowNeeds; name: string; openDesk?: (section: PersonDeskSectionId) => void; open: boolean; onToggle: () => void }) {
  const counted = rowNeeds.needs.filter((n) => n.tone !== 'fact')
  const tone = rowNeeds.attention === 'red' ? 'red' : 'amber'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end', minWidth: 0 }} data-testid="users-pill">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Cell
          tone={rowNeeds.hoursWaiting > 0 ? 'hours' : 'quiet'}
          title={rowNeeds.hoursLine ?? 'No sessions waiting'}
          label={`${name}: ${rowNeeds.hoursLine ?? 'no sessions waiting'}`}
          onClick={rowNeeds.hoursWaiting > 0 && openDesk ? () => openDesk('hours') : undefined}
        >
          <SubjectIcon subject="hours" />
          {rowNeeds.hoursWaiting > 0 ? rowNeeds.hoursWaiting : null}
        </Cell>
        {rowNeeds.needs.length > 0 ? (
          <button type="button" aria-expanded={open} onClick={onToggle} style={{ ...PILL, ...(counted.length ? PILL_TONE[tone] : { background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border)' }) }}>
            {counted.length ? `Needs you · ${counted.length}` : 'Clear'} {open ? '▴' : '▾'}
          </button>
        ) : (
          <span style={{ ...PILL, cursor: 'default', background: 'transparent', color: 'var(--text-green-800)', borderColor: 'transparent' }}>Clear</span>
        )}
      </div>
    </div>
  )
}

/** The unfolded list: one line per need with its verb, facts after, and the Desk door at the foot. */
export function UsersNeedsFoldOut({ rowNeeds, name, openDesk }: { rowNeeds: RowNeeds; name: string; openDesk?: (section: PersonDeskSectionId) => void }) {
  const counted = rowNeeds.needs.filter((n) => n.tone !== 'fact')
  const facts = rowNeeds.needs.filter((n) => n.tone === 'fact')
  return (
    <div data-testid="users-foldout" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.6rem', display: 'grid', gap: '0.4rem' }}>
          {[...counted, ...facts].map((n) => (
            <div key={n.key} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem' }}>
              <span style={{ color: n.tone === 'red' ? 'var(--text-red-600)' : n.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)', display: 'inline-flex' }}>
                <SubjectIcon subject={n.subject} />
              </span>
              <span style={{ minWidth: 0 }}>
                <strong style={{ color: 'var(--text-strong)' }}>{n.subject === 'paperwork' ? 'Paperwork' : 'Account'}</strong>
                <span style={{ color: 'var(--text-muted)' }}> — {n.long}</span>
              </span>
              {openDesk ? (
                <button type="button" onClick={() => openDesk(n.door)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 700, color: n.tone === 'fact' ? 'var(--text-link)' : '#fff', background: n.tone === 'fact' ? 'transparent' : '#2563eb', border: n.tone === 'fact' ? '1px solid var(--border)' : 'none', borderRadius: 6, padding: '0.25rem 0.55rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {n.verb} ›
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          {openDesk ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.35rem' }}>
              <span>Everything about {name}</span>
              <button type="button" onClick={() => openDesk('hours')} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Open desk ›
              </button>
            </div>
          ) : null}
    </div>
  )
}
