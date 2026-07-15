import type { ReactNode } from 'react'

/**
 * Groups related dashboard sections into one visible unit: a bordered card with
 * a title, visually matching BillingPipelineCard. Used by "My Inbox" (Due Today /
 * Overdue / Recently Completed Tasks); `id` carries the section-dock anchor.
 */
export function DashboardGroupCard({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
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
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>{title}</h2>
      {children}
    </div>
  )
}
