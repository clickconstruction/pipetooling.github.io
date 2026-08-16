import type { ReactNode } from 'react'
import { Pencil, ChevronUp } from 'lucide-react'

/**
 * One row of the Edit-tab fact list (v2.1681): collapsed it reads
 * "label — value — pencil"; clicking the row opens the editor beneath (the
 * classic form control for that field). The row header is a div with an
 * icon-button toggle — not one big <button> — so values can carry their own
 * interactive elements (the Folders row's inline links); those must
 * stopPropagation to avoid also toggling the row.
 */
export function JobFormFactRow({
  label,
  labelIcon,
  value,
  valueTail,
  expanded = false,
  onToggle,
  children,
  last = false,
}: {
  label: string
  labelIcon?: ReactNode
  /** Collapsed summary; null renders a muted em dash. */
  value: ReactNode | null
  /** Rendered after the value, outside the ellipsis clamp (chips, inline links). */
  valueTail?: ReactNode
  expanded?: boolean
  /** Omit (with children) for a read-only display row — no pencil, no click. */
  onToggle?: () => void
  children?: ReactNode
  last?: boolean
}) {
  return (
    <>
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.5rem 0.15rem',
          borderBottom: !last || expanded ? '1px solid var(--border)' : 'none',
          cursor: onToggle ? 'pointer' : 'default',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            flex: '0 0 108px',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            minWidth: 0,
          }}
        >
          {labelIcon}
          {label}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.875rem',
          }}
        >
          {value != null ? (
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value}
            </span>
          ) : null}
          {value == null && valueTail == null ? <span style={{ color: 'var(--text-faint)' }}>—</span> : null}
          {valueTail}
        </span>
        {onToggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `Close ${label} editor` : `Edit ${label}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.15rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-faint)',
            flexShrink: 0,
          }}
        >
          {expanded ? <ChevronUp size={14} aria-hidden /> : <Pencil size={13} aria-hidden />}
        </button>
        ) : null}
      </div>
      {expanded ? (
        <div
          role="region"
          aria-label={`${label} editor`}
          style={{
            padding: '0.6rem 0.15rem 0.75rem 1.1rem',
            borderLeft: '2px solid var(--border)',
            borderBottom: !last ? '1px solid var(--border)' : 'none',
          }}
        >
          {children}
        </div>
      ) : null}
    </>
  )
}
