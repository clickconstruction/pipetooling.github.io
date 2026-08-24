import type { CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { Receipt } from 'lucide-react'

/**
 * The Statement link in the partner's nav (vNAV): a receipt glyph in the
 * header strip beside the home icon (`variant="icon"`), or a labeled row in
 * the ☰ menu (`variant="row"`). Render only for partners (see useIsPartner).
 */
export function PartnerStatementNavLink({
  variant,
  style,
  onClick,
}: {
  variant: 'icon' | 'row'
  /** The host's NavLink style fn (iconLinkStyle / dropdownLinkStyle / navStyle). */
  style: (s: { isActive: boolean }) => CSSProperties
  onClick?: () => void
}) {
  const glyph = <Receipt size="1em" strokeWidth={2.25} aria-hidden style={{ verticalAlign: 'middle' }} />
  if (variant === 'icon') {
    return (
      <NavLink to="/my-statement" style={style} title="Statement" aria-label="Statement" onClick={onClick}>
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
    </NavLink>
  )
}
