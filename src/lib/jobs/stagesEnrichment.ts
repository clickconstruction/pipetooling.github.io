/**
 * The Stages board's enrichment, as data (Pipeline load speed PR 2, v2.3600).
 *
 * A board row is painted from the primary `jobs_ledger` query (payments, invoices, team
 * members and the to-one embeds ride on it); four fields arrive a moment later from the
 * batched passes — `materials`, `fixtures`, `last_schedule_work_date`, `linkedEstimateForStages`.
 * `applyStagesEnrichment` puts them on a list of rows; `patchJobsById` lays enriched rows over
 * the cache in place, so rows a later scope merge brought keep theirs and a row that left the
 * board is not resurrected. Both are pure; the fetch is in `fetchJobsLedgerWithDetailsForStages`.
 */
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { pickLinkedEstimateForStagesBanner } from '../pickLinkedEstimateForStagesBanner'

type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']

export type StagesEstimateCandidate = {
  estimate_number: number
  title: string
  status: Database['public']['Enums']['estimate_status']
  updated_at: string | null
}

export type StagesEnrichment = {
  materialsByJobId: ReadonlyMap<string, JobsLedgerMaterial[]>
  fixturesByJobId: ReadonlyMap<string, JobsLedgerFixture[]>
  scheduleMaxByJobId: ReadonlyMap<string, string>
  estimateCandidatesByJobId: ReadonlyMap<string, StagesEstimateCandidate[]>
}

/**
 * The `get_stages_enrichment` RPC payload (v2.3602) as maps — `{ materials, fixtures, schedule_max,
 * estimates }` keyed by job id. Null when the payload is not that shape (an older function, an
 * error body), so the caller can fall back to the chunked passes.
 */
export function parseStagesEnrichmentPayload(raw: unknown): StagesEnrichment | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
  const materials = obj(r.materials)
  const fixtures = obj(r.fixtures)
  const scheduleMax = obj(r.schedule_max)
  const estimates = obj(r.estimates)
  if (!materials || !fixtures || !scheduleMax || !estimates) return null
  const listMap = <T>(m: Record<string, unknown>): Map<string, T[]> => {
    const out = new Map<string, T[]>()
    for (const [jobId, rows] of Object.entries(m)) if (Array.isArray(rows)) out.set(jobId, rows as T[])
    return out
  }
  const scheduleMaxByJobId = new Map<string, string>()
  for (const [jobId, ymd] of Object.entries(scheduleMax)) if (typeof ymd === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ymd)) scheduleMaxByJobId.set(jobId, ymd.slice(0, 10))
  return {
    materialsByJobId: listMap<JobsLedgerMaterial>(materials),
    fixturesByJobId: listMap<JobsLedgerFixture>(fixtures),
    scheduleMaxByJobId,
    estimateCandidatesByJobId: listMap<StagesEstimateCandidate>(estimates),
  }
}

export const EMPTY_STAGES_ENRICHMENT: StagesEnrichment = {
  materialsByJobId: new Map(),
  fixturesByJobId: new Map(),
  scheduleMaxByJobId: new Map(),
  estimateCandidatesByJobId: new Map(),
}

const bySequence = <T extends { sequence_order: number }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.sequence_order - b.sequence_order)

/** The four enriched fields onto every row; a row the passes did not cover reads empty / null. */
export function applyStagesEnrichment(jobs: ReadonlyArray<JobWithDetails>, e: StagesEnrichment): JobWithDetails[] {
  return jobs.map((j) => ({
    ...j,
    materials: bySequence(e.materialsByJobId.get(j.id) ?? []),
    fixtures: bySequence(e.fixturesByJobId.get(j.id) ?? []),
    last_schedule_work_date: e.scheduleMaxByJobId.get(j.id) ?? null,
    linkedEstimateForStages: pickLinkedEstimateForStagesBanner(e.estimateCandidatesByJobId.get(j.id) ?? []),
  }))
}

/**
 * Enriched rows over the cache, by id: a row on the board takes its enriched twin's four
 * fields (nothing else — a mutation that landed meanwhile keeps its status and money); a row
 * not on the board any more is dropped, and a row the enrichment did not cover is left alone.
 */
export function patchJobsById(prev: ReadonlyArray<JobWithDetails>, enriched: ReadonlyArray<JobWithDetails>): JobWithDetails[] {
  if (enriched.length === 0) return [...prev]
  const byId = new Map(enriched.map((j) => [j.id, j]))
  return prev.map((p) => {
    const e = byId.get(p.id)
    return e
      ? { ...p, materials: e.materials, fixtures: e.fixtures, last_schedule_work_date: e.last_schedule_work_date ?? null, linkedEstimateForStages: e.linkedEstimateForStages ?? null }
      : p
  })
}
