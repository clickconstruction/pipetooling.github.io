import type { CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { Receipt } from 'lucide-react'

/**
 * The Statement link in the partner's nav (vNAV): a receipt glyph in the
 * header strip beside the home icon (`variant="icon"`), or a labeled row in
 * the ☰ menu (`variant="row"`). `awaitingSignOff` adds an amber dot to the
 * icon and a "sign-off waiting" tag to the row — the same fact as the
 * Dashboard card's nudge. Render only for partners (see useIsPartner).
 */
export function PartnerStatementNavLink({
  variant,
  awaitingSignOff,
  style,
  onClick,
}: {
  variant: 'icon' | 'row'
  awaitingSignOff: boolean
  /** The host's NavLink style fn (iconLinkStyle / dropdownLinkStyle / navStyle). */
  style: (s: { isActive: boolean }) => CSSProperties
  onClick?: () => void
}) {
  const glyph = (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Receipt size="1em" strokeWidth={2.25} aria-hidden style={{ verticalAlign: 'middle' }} />
      {awaitingSignOff ? (
        <span
          aria-hidden
          data-testid="statement-nav-dot"
          style={{ position: 'absolute', top: -2, right: -4, width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }}
        />
      ) : null}
    </span>
  )
  if (variant === 'icon') {
    return (
      <NavLink to="/my-statement" style={style} title={awaitingSignOff ? 'Statement — sign-off waiting' : 'Statement'} aria-label="Statement" onClick={onClick}>
        {glyph}
      </NavLink>
    )
  }
  return (
    <NavLink
      to="/my-statement"
      style={({ isActive }) => ({ ...style({ isActive }), display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%', boxSizing: 'border-box' })}
      title="Statement"
      aria-label="Statement"
      onClick={onClick}
    >
      {glyph}
      Statement
      {awaitingSignOff ? <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-amber-700)' }}>sign-off waiting</span> : null}
    </NavLink>
  )
}
