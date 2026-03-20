import type { CrewJobAssignment } from './teamLabor'
import type { CrewBidAssignment } from './teamLabor'

export type UnifiedAssignment = { type: 'job'; id: string; pct: number } | { type: 'bid'; id: string; pct: number }

export type JobDetails = { hcp_number: string; job_name: string; job_address: string }
export type BidDetails = { bid_number: string; project_name: string; address: string }

export function mergeToUnified(
  jobAssignments: CrewJobAssignment[],
  bidAssignments: CrewBidAssignment[]
): UnifiedAssignment[] {
  const jobs = (Array.isArray(jobAssignments) ? jobAssignments : []).map((a) => ({
    type: 'job' as const,
    id: a.job_id,
    pct: a.pct,
  }))
  const bids = (Array.isArray(bidAssignments) ? bidAssignments : []).map((a) => ({
    type: 'bid' as const,
    id: a.bid_id,
    pct: a.pct,
  }))
  const merged = [...jobs, ...bids]
  const sum = merged.reduce((s, a) => s + a.pct, 0)
  if (merged.length === 0) return []
  if (Math.abs(sum - 100) < 0.01) return merged
  const scale = sum > 0 ? 100 / sum : 1
  return merged.map((a, i) => ({
    ...a,
    pct: i === merged.length - 1
      ? Math.round((100 - merged.slice(0, -1).reduce((s, x) => s + x.pct * scale, 0)) * 10) / 10
      : Math.round(a.pct * scale * 10) / 10,
  }))
}

export function splitFromUnified(unified: UnifiedAssignment[]): {
  jobAssignments: CrewJobAssignment[]
  bidAssignments: CrewBidAssignment[]
} {
  const jobAssignments: CrewJobAssignment[] = unified
    .filter((a): a is UnifiedAssignment & { type: 'job' } => a.type === 'job')
    .map((a) => ({ job_id: a.id, pct: a.pct }))
  const bidAssignments: CrewBidAssignment[] = unified
    .filter((a): a is UnifiedAssignment & { type: 'bid' } => a.type === 'bid')
    .map((a) => ({ bid_id: a.id, pct: a.pct }))
  return { jobAssignments, bidAssignments }
}

export function formatAssignmentLabel(
  type: 'job' | 'bid',
  details: JobDetails | BidDetails | undefined
): string {
  if (!details) return '—'
  if (type === 'job') {
    const d = details as JobDetails
    const prefix = `J${(d.hcp_number || '').trim() || '—'}`
    return `${prefix} · ${d.job_name || '—'}`
  }
  const d = details as BidDetails
  const prefix = `B${(d.bid_number || '').trim() || '—'}`
  return `${prefix} · ${d.project_name || '—'}`
}
