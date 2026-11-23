import type { CSSProperties } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import type { LienBoardDot } from '../../lib/jobs/lienBoard'
import { recordNavClick } from '../../lib/navClickTelemetry'

const LABEL: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const DOOR: CSSProperties = { color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }

/**
 * The Lien desk's Board as dots on one line (v2.7334): one press that opens the desk at the Board.
 *
 * Drawn in two places, with the same dots and the same click count (`#lien-board`):
 *
 * - at the top of the Needs you card, above its heading, which is where it was born: the label, the dots and
 *   *The Board ›* on one wrapping line, as it has been;
 * - `standalone`, on a Dashboard whose Needs you card is the one-line door of the new phone layout
 *   (`needsYouPlace.ts`). The door stands in for the card's list, not for the desk's four numbers, so the
 *   strip stays on the page under the door as a card of its own: the label and *The Board ›* on a head row,
 *   the dots under it. On a phone the one wrapping line left *The Board ›* alone on a third row.
 *
 * Draws nothing with no dots.
 */
export default function NeedsYouLienBoardStrip({
  strip,
  userId,
  role,
  onOpenBoard,
  standalone = false,
}: {
  strip: LienBoardDot[] | null | undefined
  userId: string | undefined
  role: UserRole | null
  onOpenBoard?: () => void
  /** Outside the card: the page's own card surface and bottom gap, and the head row over the dots. */
  standalone?: boolean
}) {
  if (!strip || strip.length === 0) return null
  const label = <span style={LABEL}>Lien desk</span>
  const dots = strip.map((d) => (
    <span key={d.key} data-needs-you-lien-dot={d.key} data-tone={d.tone} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, fontSize: '0.8125rem' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', alignSelf: 'center', background: d.tone === 'red' ? 'var(--text-red-700)' : d.tone === 'amber' ? 'var(--text-amber-800)' : d.tone === 'violet' ? 'var(--text-violet-700)' : 'var(--border-strong)' }} />
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{d.figure}</strong>
      <span style={{ color: 'var(--text-muted)' }}>{d.words}</span>
    </span>
  ))
  const press = () => {
    recordNavClick(userId, role, 'needs-you', '#lien-board')
    onOpenBoard?.()
  }
  if (standalone) {
    return (
      <button
        type="button"
        data-needs-you-lien-board
        data-standalone=""
        onClick={press}
        title="Open the Lien desk at the Board"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, width: '100%', margin: '0 0 1rem', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          {label}
          <span style={DOOR}>The Board ›</span>
        </span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>{dots}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      data-needs-you-lien-board
      onClick={press}
      title="Open the Lien desk at the Board"
      style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', width: '100%', margin: '0 0 0.75rem', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
    >
      {label}
      {dots}
      <span style={{ ...DOOR, marginLeft: 'auto' }}>The Board ›</span>
    </button>
  )
}
