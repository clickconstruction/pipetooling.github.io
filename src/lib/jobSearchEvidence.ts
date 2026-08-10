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

/** Evidence for a bid search row: value, outcome, and the dates that give it context. */
export type BidSearchEvidence = {
  bidValue: number | null
  winLoss: string | null
  dateSent: string | null
  dueDate: string | null
}

/** Bid Board-style outcome chip: Won / Started / Lost / Pending (sent) / Unsent. */
export function bidSearchStatusChip(
  outcome: string | null | undefined,
  dateSent: string | null | undefined,
): { label: string; background: string; color: string } {
  const o = (outcome ?? '').trim().toLowerCase()
  if (o === 'won') return { label: 'Won', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }
  if (o === 'started_or_complete') return { label: 'Started', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }
  if (o === 'lost') return { label: 'Lost', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }
  if ((dateSent ?? '').trim() !== '')
    return { label: 'Pending', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)' }
  return { label: 'Unsent', background: 'var(--bg-muted)', color: 'var(--text-muted)' }
}

export async function fetchBidSearchEvidence(bidIds: string[]): Promise<Map<string, BidSearchEvidence>> {
  const ids = [...new Set(bidIds)].filter(Boolean)
  if (ids.length === 0) return new Map()
  const rows = await chunkedIn(ids, async (slice) => {
    const data = await withSupabaseRetry(
      () => supabase.from('bids').select('id, bid_value, outcome, bid_date_sent, bid_due_date').in('id', slice),
      'bid search evidence',
    )
    return (data ?? []) as Array<{
      id: string
      bid_value: number | null
      outcome: string | null
      bid_date_sent: string | null
      bid_due_date: string | null
    }>
  })
  const out = new Map<string, BidSearchEvidence>()
  for (const r of rows) {
    out.set(r.id, {
      bidValue: r.bid_value === null ? null : Number(r.bid_value),
      winLoss: r.outcome,
      dateSent: r.bid_date_sent,
      dueDate: r.bid_due_date,
    })
  }
  return out
}
