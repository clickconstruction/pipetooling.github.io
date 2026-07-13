import { useId } from 'react'

export type MaterialsCostAccordionRowProps = {
  title: string
  totalDisplay: string
  expanded: boolean
  onToggle: () => void
  busy?: boolean
  /** When false, header is not interactive and children are never shown. */
  expandable?: boolean
  children?: React.ReactNode
}

export function MaterialsCostAccordionRow({
  title,
  totalDisplay,
  expanded,
  onToggle,
  busy = false,
  expandable = true,
  children,
}: MaterialsCostAccordionRowProps) {
  const safeId = useId().replace(/:/g, '')
  const headerId = `${safeId}-hdr`
  const panelId = `${safeId}-pnl`

  const headerStyle = {
    width: '100%' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: '0.625rem 0.75rem',
    background: expanded ? 'var(--bg-muted)' : 'var(--bg-subtle)',
    border: 'none',
    textAlign: 'left' as const,
    fontSize: '0.875rem',
    gap: '0.5rem',
    boxSizing: 'border-box' as const,
  }

  const titleRow = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-strong)', fontWeight: 500 }}>
      {expandable ? (
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--text-muted)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      ) : null}
      {title}
    </span>
  )

  const totalEl = (
    <span style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
      {busy ? '…' : totalDisplay}
    </span>
  )

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {expandable ? (
        <button
          type="button"
          id={headerId}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggle()
            }
          }}
          style={{
            ...headerStyle,
            cursor: 'pointer',
          }}
        >
          {titleRow}
          {totalEl}
        </button>
      ) : (
        <div
          id={headerId}
          style={{
            ...headerStyle,
            cursor: 'default',
          }}
        >
          {titleRow}
          {totalEl}
        </div>
      )}
      {expandable && expanded && (
        <div id={panelId} role="region" aria-labelledby={headerId} style={{ padding: '0.75rem', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}
