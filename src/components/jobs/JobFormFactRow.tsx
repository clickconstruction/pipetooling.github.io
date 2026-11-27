import type { ReactNode } from 'react'
import { Pencil, ChevronUp, ChevronRight } from 'lucide-react'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { recordJobEditRowOpened } from '../../lib/navClickViewer'

/**
 * One row of the Edit-tab fact list (v2.1681): collapsed it reads
 * "label — value — pencil"; clicking the row opens the editor beneath (the
 * classic form control for that field). The row header is a div with an
 * icon-button toggle — not one big <button> — so values can carry their own
 * interactive elements (the Folders row's inline links); those must
 * stopPropagation to avoid also toggling the row.
 *
 * Opening a row's editor writes one press row under the row's name (v2.8704, punch list #190), by the
 * row's body or its pencil alike. Closing it writes none, and a read-only row has no press.
 */
export function JobFormFactRow({
  label,
  labelIcon,
  labelNoWrap = false,
  value,
  valueTail,
  expanded = false,
  onToggle,
  children,
  last = false,
}: {
  label: string
  labelIcon?: ReactNode
  /** Keeps a label that is a few pixels wider than its column on one line; it runs into the gap before the value, never over it. */
  labelNoWrap?: boolean
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
  // Punch list #355 E (v2.7283): on a phone a row stands 44 px, the whole row is the press, and a chevron stands for the pencil.
  const phone = useNarrowViewport640()
  const toggle = onToggle
    ? () => {
        if (!expanded) recordJobEditRowOpened(label)
        onToggle()
      }
    : undefined
  return (
    <>
      <div
        onClick={toggle}
        data-fact-row={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          minHeight: phone ? 44 : undefined,
          padding: phone ? '0.4rem 0.15rem' : '0.5rem 0.15rem',
          borderBottom: !last || expanded ? '1px solid var(--border)' : 'none',
          cursor: toggle ? 'pointer' : 'default',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            flex: phone ? '0 0 104px' : '0 0 108px',
            fontSize: phone ? '0.875rem' : '0.8125rem',
            color: 'var(--text-muted)',
            minWidth: 0,
            whiteSpace: labelNoWrap ? 'nowrap' : undefined,
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
            fontSize: phone ? '0.9375rem' : '0.875rem',
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
        {toggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `Close ${label} editor` : `Edit ${label}`}
          onClick={(e) => {
            e.stopPropagation()
            toggle()
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
          {expanded ? <ChevronUp size={phone ? 18 : 14} aria-hidden /> : phone ? <ChevronRight size={18} aria-hidden /> : <Pencil size={13} aria-hidden />}
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
