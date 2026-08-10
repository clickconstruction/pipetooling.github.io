import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { buildDupJobEnrichments, type DupJobEnrichment } from './duplicateJobAddressGroups'

/**
 * Evidence detail shown on enriched job-search rows (the "money rail").
 * `money`: line items with revenue + payment recency (office decisions).
 * `lines-only`: line names/count and dates, no dollars and no payment data —
 * the query never even selects prices or payments in this mode.
 */
export type JobSearchEvidenceMode = 'money' | 'lines-only'

export type JobSearchEvidence = DupJobEnrichment

const OFFICE_MONEY_ROLES: ReadonlySet<string> = new Set([
  'dev',
  'master_technician',
  'assistant',
  'controller',
  'primary',
])

export function jobSearchEvidenceModeForRole(role: string | null | undefined): JobSearchEvidenceMode {
  return OFFICE_MONEY_ROLES.has((role ?? '').trim()) ? 'money' : 'lines-only'
}

const EVIDENCE_JOB_ID_CHUNK = 150

async function chunkedIn<T>(
  ids: string[],
  fetchSlice: (slice: string[]) => Promise<T[]>,
): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += EVIDENCE_JOB_ID_CHUNK) {
    out.push(...(await fetchSlice(ids.slice(i, i + EVIDENCE_JOB_ID_CHUNK))))
  }
  return out
}

/**
 * Batched evidence for a set of job ids. Two queries in money mode, one in
 * lines-only mode (and that one omits price columns entirely). Throws only via
 * the underlying retry helper — callers typically catch and render plain rows.
 */
export async function fetchJobSearchEvidence(
  jobIds: string[],
  mode: JobSearchEvidenceMode,
): Promise<Map<string, JobSearchEvidence>> {
  const ids = [...new Set(jobIds)].filter(Boolean)
  if (ids.length === 0) return new Map()

  const fixtureSelect = mode === 'money' ? 'job_id, name, count, line_unit_price' : 'job_id, name, count'
  const [fixtures, payments] = await Promise.all([
    chunkedIn(ids, async (slice) => {
      const rows = await withSupabaseRetry(
        () => supabase.from('jobs_ledger_fixtures').select(fixtureSelect).in('job_id', slice),
        'job search evidence fixtures',
      )
      return (rows ?? []) as unknown as Array<{
        job_id: string
        name: string | null
        count: number | null
        line_unit_price?: number | null
      }>
    }),
    mode === 'money'
      ? chunkedIn(ids, async (slice) => {
          const rows = await withSupabaseRetry(
            () => supabase.from('jobs_ledger_payments').select('job_id, amount, paid_on, created_at').in('job_id', slice),
            'job search evidence payments',
          )
          return (rows ?? []) as Array<{ job_id: string; amount: number | null; paid_on: string | null; created_at: string | null }>
        })
      : Promise.resolve([]),
  ])

  return buildDupJobEnrichments(
    fixtures.map((f) => ({ job_id: f.job_id, name: f.name, count: f.count, line_unit_price: f.line_unit_price ?? 0 })),
    payments,
    Date.now(),
  )
}
