import type { CSSProperties } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { LienDeskCard } from '../../lib/dashboard/lienDeskCard'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

const LABEL: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const DOOR: CSSProperties = { color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }
const LINE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-red-700)' }

/**
 * The Lien desk's card on the Dashboard (punch list #423): one press that opens the desk at the Board.
 *
 * It stands beside the Needs you list, under its door or right above its card, and never inside it: Needs
 * you is a place for action, and this is how the desk stands. Until this card the same counts were a strip
 * at the top of the Needs you card, above its title (v2.7334), and on a phone under the new layout a card
 * of their own (v2.8289).
 *
 * The label and *The Board ›* share a line, so the door is never left alone on a row. Under them the three
 * values stand side by side, the count over its words, the way the Board draws its tiles. Only the day's
 * count takes a color, red, and the red line under the values shows only while a paper is late or at risk.
 * At a desk the same pieces are one line.
 *
 * The click is counted as `#lien-board`, as the strip's was. Draws nothing with no card.
 */
export default function DashboardLienDeskCard({
  card,
  userId,
  role,
  onOpenBoard,
}: {
  card: LienDeskCard | null | undefined
  userId: string | undefined
  role: UserRole | null
  onOpenBoard?: () => void
}) {
  const isPhone = useIsMobile()
  if (!card || card.values.length === 0) return null
  const press = () => {
    recordNavClick(userId, role, 'needs-you', '#lien-board')
    onOpenBoard?.()
  }
  const label = <span style={LABEL}>Lien desk</span>
  const door = <span style={DOOR}>The Board ›</span>
  const line = card.line ? (
    <span data-lien-desk-card-line style={LINE}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-red-700)', flex: 'none' }} />
      {card.line}
    </span>
  ) : null
  const box: CSSProperties = { width: '100%', margin: '0 0 1rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', fontFamily: 'inherit', fontSize: '1rem', color: 'inherit', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box' }

  if (!isPhone) {
    return (
      <button type="button" data-lien-desk-card data-layout="line" onClick={press} title="Open the Lien desk at the Board" style={{ ...box, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px 22px', padding: '10px 16px' }}>
        {label}
        {card.values.map((v) => (
          <span key={v.key} data-lien-desk-card-value={v.key} data-tone={v.tone ?? undefined} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: '0.8125rem' }}>
            <span style={{ fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}>
              <WorkedOutValue tone={v.tone ?? undefined}>{v.figure}</WorkedOutValue>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{v.words}</span>
          </span>
        ))}
        {line}
        <span style={{ ...DOOR, marginLeft: 'auto' }}>The Board ›</span>
      </button>
    )
  }
  return (
    <button type="button" data-lien-desk-card data-layout="card" onClick={press} title="Open the Lien desk at the Board" style={{ ...box, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '12px 16px 14px' }}>
      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        {label}
        {door}
      </span>
      <span style={{ display: 'flex' }}>
        {card.values.map((v, i) => (
          <span
            key={v.key}
            data-lien-desk-card-value={v.key}
            data-tone={v.tone ?? undefined}
            // The short words keep one line where they can: the first two values hold their width and the last one wraps.
            style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: `1 ${i < 2 ? 0 : 1} auto`, minWidth: 0, padding: i === 0 ? '0 10px 0 0' : '0 10px', borderLeft: i === 0 ? 'none' : '1px solid var(--border)' }}
          >
            <span style={{ fontSize: '1.3rem', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
              <WorkedOutValue tone={v.tone ?? undefined}>{v.figure}</WorkedOutValue>
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.25, color: 'var(--text-700)' }}>{v.words}</span>
          </span>
        ))}
      </span>
      {line}
    </button>
  )
}
