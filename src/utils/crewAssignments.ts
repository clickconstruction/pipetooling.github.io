import type { CrewJobAssignment } from './teamLabor'
import type { CrewBidAssignment } from './teamLabor'
import {
  formatBidLedgerShortLine,
  formatJobLedgerShortLine,
  type LedgerPrefixMap,
} from '../lib/ledgerDisplayPrefixes'

export type UnifiedAssignment = { type: 'job'; id: string; pct: number } | { type: 'bid'; id: string; pct: number }

export type JobDetails = {
  hcp_number: string
  job_name: string
  job_address: string
  service_type_id?: string | null
}
export type BidDetails = {
  bid_number: string
  project_name: string
  address: string
  service_type_id?: string | null
}

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

/** Merged crew row for Hours grid / unassigned modal (jobs + bids per date:person). */
export type MergedCrewMapRow = {
  unifiedAssignments: UnifiedAssignment[]
}

/**
 * Build `${work_date}:${person_name}` map from people_crew_jobs + people_crew_bids rows.
 * Same keying and merge as HoursUnassignedModal initial load.
 */
export function buildCrewMapFromJobsAndBidRows(
  jobsRows: Array<{
    work_date: string
    person_name: string
    job_assignments: CrewJobAssignment[] | null | undefined
  }>,
  bidsRows: Array<{
    work_date: string
    person_name: string
    bid_assignments: CrewBidAssignment[] | null | undefined
  }>
): Record<string, MergedCrewMapRow> {
  const jobsByKey: Record<string, CrewJobAssignment[]> = {}
  for (const r of jobsRows) {
    jobsByKey[`${r.work_date}:${r.person_name}`] = Array.isArray(r.job_assignments) ? r.job_assignments : []
  }
  const bidsByKey: Record<string, CrewBidAssignment[]> = {}
  for (const r of bidsRows) {
    bidsByKey[`${r.work_date}:${r.person_name}`] = Array.isArray(r.bid_assignments) ? r.bid_assignments : []
  }
  const allKeys = new Set([...Object.keys(jobsByKey), ...Object.keys(bidsByKey)])
  const crewMap: Record<string, MergedCrewMapRow> = {}
  for (const k of allKeys) {
    const unified = mergeToUnified(jobsByKey[k] ?? [], bidsByKey[k] ?? [])
    crewMap[k] = { unifiedAssignments: unified }
  }
  return crewMap
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
  details: JobDetails | BidDetails | undefined,
  prefixMap: LedgerPrefixMap,
): string {
  if (!details) return '—'
  if (type === 'job') {
    const d = details as JobDetails
    return formatJobLedgerShortLine(prefixMap, d.service_type_id ?? null, d.hcp_number, d.job_name)
  }
  const d = details as BidDetails
  return formatBidLedgerShortLine(prefixMap, d.service_type_id ?? null, d.bid_number, d.project_name)
}
