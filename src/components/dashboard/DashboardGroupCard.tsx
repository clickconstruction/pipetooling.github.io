import { useState, type ReactNode } from 'react'

/**
 * Groups related dashboard sections into one visible unit: a bordered card with
 * a title, visually matching BillingPipelineCard. Used by "My Inbox" (Due Today /
 * Overdue / Recently Completed Tasks); `id` carries the section-dock anchor.
 * `headerRight` renders in the title row's top-right corner (link-styled controls).
 *
 * Collapsible mode (v2.840): pass `collapseStorageKey` to make the title a
 * ▶/▼ toggle. `defaultCollapsed` seeds the state when localStorage has no
 * saved choice; the user's last choice persists per key. `headerRight` stays
 * visible while collapsed.
 */
export function DashboardGroupCard({
  id,
  title,
  headerRight,
  collapseStorageKey,
  defaultCollapsed = false,
  children,
}: {
  id?: string
  title: string
  headerRight?: ReactNode
  collapseStorageKey?: string
  defaultCollapsed?: boolean
  children: ReactNode
}) {
  const collapsible = collapseStorageKey != null
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!collapsible) return false
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(collapseStorageKey) : null
      if (stored !== null) return stored === 'true'
    } catch {
      /* ignore */
    }
    return defaultCollapsed
  })
  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(collapseStorageKey!, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }
  return (
    <div
      id={id}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: collapsible && collapsed ? '0.85rem 1rem' : '0.85rem 1rem 1rem',
        marginTop: '1rem',
        marginBottom: '1rem',
        scrollMarginTop: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: collapsible && collapsed ? 0 : '0.5rem' }}>
        {collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '0.45rem',
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              font: 'inherit',
              textAlign: 'left',
            }}
          >
            <span aria-hidden style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{collapsed ? '▶' : '▼'}</span>
            <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{title}</h2>
          </button>
        ) : (
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{title}</h2>
        )}
        {headerRight ?? null}
      </div>
      {collapsible && collapsed ? null : children}
    </div>
  )
}
