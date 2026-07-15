import type { ReactNode } from 'react'

/**
 * Groups related dashboard sections into one visible unit: a bordered card with
 * a title, visually matching BillingPipelineCard. Used by "My Inbox" (Due Today /
 * Overdue / Recently Completed Tasks); `id` carries the section-dock anchor.
 * `headerRight` renders in the title row's top-right corner (link-styled controls).
 */
export function DashboardGroupCard({
  id,
  title,
  headerRight,
  children,
}: {
  id?: string
  title: string
  headerRight?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      id={id}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.85rem 1rem 1rem',
        marginTop: '1rem',
        marginBottom: '1rem',
        scrollMarginTop: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{title}</h2>
        {headerRight ?? null}
      </div>
      {children}
    </div>
  )
}
