import type { CSSProperties } from 'react'
import { staffOutcomeDrilldownMetricLabel, staffOutcomeDrilldownRolePhrase } from '../../lib/bids/bidBoardStaffOutcomes'
import type { StaffOutcomeDrilldownRole, StaffOutcomeDrilldownMetric, StaffOutcomeDrilldownState } from '../../lib/bids/bidBoardStaffOutcomes'

export function StaffOutcomeDrilldownCountCell({
  count,
  userId,
  displayName,
  role,
  metric,
  onOpen,
}: {
  count: number
  userId: string
  displayName: string
  role: StaffOutcomeDrilldownRole
  metric: StaffOutcomeDrilldownMetric
  onOpen: (s: StaffOutcomeDrilldownState) => void
}) {
  const tdStyle: CSSProperties = { padding: '0.375rem 0.75rem', fontSize: '0.875rem', textAlign: 'right' }
  if (count <= 0) return <td style={tdStyle}>{count}</td>
  const metricLabel = staffOutcomeDrilldownMetricLabel(metric)
  const rolePhrase = staffOutcomeDrilldownRolePhrase(role)
  return (
    <td style={tdStyle}>
      <button
        type="button"
        onClick={() => onOpen({ userId, staffDisplayName: displayName, role, metric })}
        aria-label={`View ${count} bids, ${metricLabel}, ${displayName} as ${rolePhrase}`}
        style={{
          padding: 0,
          margin: 0,
          border: 'none',
          background: 'none',
          color: '#3b82f6',
          cursor: 'pointer',
          font: 'inherit',
          textDecoration: 'underline',
        }}
      >
        {count}
      </button>
    </td>
  )
}
