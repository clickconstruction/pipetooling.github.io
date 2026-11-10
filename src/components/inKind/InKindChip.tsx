import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { inKindChipHref, inKindChipTitle, inKindChipWords, type InKindChipForm, type InKindStanding } from '../../lib/inKind/inKindChip'

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '1px 9px',
  borderRadius: 9999,
  fontSize: '0.72rem',
  fontWeight: 700,
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  fontVariantNumeric: 'tabular-nums',
}
const quiet: CSSProperties = { ...base, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', border: '1px solid var(--border-indigo-soft)' }
const due: CSSProperties = { ...base, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }

/**
 * The chip beside a customer's name: this customer pays in kind, and where that stands (punch list #301, mock-up 2).
 * A press opens the deal's ledger on the customer's page. `plain` draws it as words with no press, for a spot that
 * already sits inside a link or a heading.
 */
export default function InKindChip({ standing, form = 'full', plain = false }: { standing: InKindStanding; form?: InKindChipForm; plain?: boolean }) {
  const { text, tone } = inKindChipWords(standing, form)
  const style = tone === 'due' ? due : quiet
  const body = (
    <>
      <span aria-hidden="true">🤝</span>
      {text}
    </>
  )
  if (plain) {
    return (
      <span style={style} title={inKindChipTitle(standing)} data-testid="in-kind-chip">
        {body}
      </span>
    )
  }
  return (
    <Link to={inKindChipHref(standing)} style={style} title={inKindChipTitle(standing)} data-testid="in-kind-chip" onClick={(e) => e.stopPropagation()}>
      {body}
    </Link>
  )
}
