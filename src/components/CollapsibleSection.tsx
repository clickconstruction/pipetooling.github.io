import type { ReactNode, CSSProperties } from 'react'

type CollapsibleSectionProps = {
  title: string
  count?: number
  /** When set, shown instead of ` (${count})`, e.g. "3 of 12 matching". */
  headerCountLabel?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  headerStyle?: CSSProperties
}

export function CollapsibleSection({ title, count, headerCountLabel, open, onToggle, children, headerStyle }: CollapsibleSectionProps) {
  return (
    <div style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          padding: '0.5rem 0.75rem',
          width: '100%',
          background: headerStyle?.background ?? 'var(--bg-subtle)',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
          textAlign: 'left',
          ...headerStyle,
        }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        {title}
        {headerCountLabel !== undefined ? ` (${headerCountLabel})` : count !== undefined ? ` (${count})` : null}
      </button>
      {open && children}
    </div>
  )
}
