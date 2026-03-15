import type { ReactNode, CSSProperties } from 'react'

type CollapsibleSectionProps = {
  title: string
  count?: number
  open: boolean
  onToggle: () => void
  children: ReactNode
  headerStyle?: CSSProperties
}

export function CollapsibleSection({ title, count, open, onToggle, children, headerStyle }: CollapsibleSectionProps) {
  return (
    <div style={{ marginBottom: '1rem', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
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
          background: headerStyle?.background ?? '#f9fafb',
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
        {count !== undefined && ` (${count})`}
      </button>
      {open && children}
    </div>
  )
}
