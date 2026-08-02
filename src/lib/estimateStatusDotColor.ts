import type { Database } from '../types/database'

export type EstimateStatus = Database['public']['Enums']['estimate_status']

/**
 * Projects-card estimate chips: one saturated dot color per estimate status
 * (mirrors jobsLedgerStatusDotColor in jobsLedgerStatusPipeline.ts).
 * Draft/superseded read as "not in flight" → neutral; sent blue; accepted
 * green; declined red. Unknown/legacy values fall back to neutral.
 */
const ESTIMATE_STATUS_DOT_COLORS: Record<EstimateStatus, string> = {
  draft: '#9ca3af',
  sent: '#3b82f6',
  customer_accepted: '#22c55e',
  declined: '#ef4444',
  superseded: '#9ca3af',
}

export function estimateStatusDotColor(raw: string | null | undefined): string {
  const k = raw?.trim().toLowerCase()
  if (k && k in ESTIMATE_STATUS_DOT_COLORS) {
    return ESTIMATE_STATUS_DOT_COLORS[k as EstimateStatus]
  }
  return '#9ca3af'
}
