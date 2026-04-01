import type { CSSProperties } from 'react'

/** Shared bar style; pair with `dashboard-skeleton-pulse` in index.css for motion */
export const dashboardSkeletonBarStyle: CSSProperties = {
  background: '#f3f4f6',
  borderRadius: 8,
}

export function ChecklistSkeleton() {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-hidden>
      {[1, 2, 3].map((i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div
            className="dashboard-skeleton-pulse"
            style={{ ...dashboardSkeletonBarStyle, width: 18, height: 18, flexShrink: 0 }}
          />
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, flex: 1, height: 20 }} />
        </li>
      ))}
    </ul>
  )
}

export function AssignedSkeleton() {
  return (
    <div aria-hidden>
      {[1, 2].map((i) => (
        <div key={i} style={{ padding: '1rem', marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 18, width: '60%', marginBottom: 8 }} />
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 14, width: '40%', marginBottom: 8 }} />
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 14, width: '30%' }} />
        </div>
      ))}
    </div>
  )
}

export function SubscribedSkeleton() {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-hidden>
      {[1, 2].map((i) => (
        <li key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 16, width: '50%', marginBottom: 4 }} />
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 14, width: '35%' }} />
        </li>
      ))}
    </ul>
  )
}

/** Two-line list rows (Ready to Bill, Assigned Jobs loading) */
export function DashboardListRowSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 16, width: '50%', marginBottom: 4 }} />
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 14, width: '35%' }} />
        </li>
      ))}
    </ul>
  )
}

export function RecentReportsSkeleton() {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-hidden>
      {[1, 2, 3].map((i) => (
        <li key={i} style={{ marginBottom: '0.5rem' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
            <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 14, width: '70%', marginBottom: 6 }} />
            <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 12, width: '45%' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function MyBidsSectionSkeleton() {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[1, 2].map((i) => (
        <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 16, width: '55%', marginBottom: 8 }} />
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 12, width: '90%', marginBottom: 6 }} />
          <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 12, width: '40%' }} />
        </div>
      ))}
    </div>
  )
}

/** Lazy-loaded My Team block fallback */
export function MyTeamSectionSkeleton() {
  return (
    <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }} aria-hidden>
      <div className="dashboard-skeleton-pulse" style={{ ...dashboardSkeletonBarStyle, height: 22, width: '40%', marginBottom: 12 }} />
      <AssignedSkeleton />
    </div>
  )
}
