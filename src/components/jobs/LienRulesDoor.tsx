import type { CSSProperties } from 'react'
import { LIEN_RULES_DOOR, lienRuleHref } from '../../lib/jobs/lienRuleCites'

/**
 * § The rules (v2.3594): the door from the Lien desk header and the Lien window's tab row to
 * the guide *read the Texas lien rules the app follows*, opened at the row that matters for
 * what is on screen. A plain link in a new tab — the desk or window stays open behind it.
 * Shows wherever its surface shows; the guide's own front matter gates who reads it.
 */
export function LienRulesDoor({ where, style }: { where: keyof typeof LIEN_RULES_DOOR; style?: CSSProperties }) {
  const cite = LIEN_RULES_DOOR[where]
  return (
    <a
      href={lienRuleHref(cite)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="lien-rules-door"
      title={`The Texas lien rules the app follows — opens the guide at ${cite}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '2px 10px',
        borderRadius: 7,
        border: '1px solid var(--border-strong)',
        background: 'var(--surface)',
        color: 'var(--text-700)',
        fontSize: '0.78rem',
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      § The rules
    </a>
  )
}
