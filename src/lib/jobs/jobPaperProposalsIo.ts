/**
 * The reads and writes behind the office's answer to a GC's proposal (punch list #389, step 6): the table and the
 * function of `20261125023655_job_paper_gc_proposals.sql`. One interface, so the section's smoke hands it a fake; one
 * implementation on the app's client. The database decides every rule: who may answer, that only a proposal still
 * waiting is answered, and what a take does once somebody has signed.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import type { PaperPicks } from '../contracts/paperSettings'

/** A proposal that waits on a paper a job requires. */
export interface JobPaperProposal {
  id: string
  requiredPaperId: string
  /** The name the GC typed on their page. */
  byName: string
  proposedAt: string | null
  /** The job's picks the day it was proposed, and the picks asked for. */
  fromPicks: PaperPicks
  picks: PaperPicks
}

export interface JobPaperProposalsIo {
  /** Every proposal waiting on this job's papers. At most one a paper. */
  readWaiting(jobId: string): Promise<JobPaperProposal[]>
  /** Take it or decline it. `signAgain` counts who signs the new version after a take. */
  decide(proposalId: string, take: boolean, why?: string): Promise<{ took: boolean; signAgain: number }>
}

const picksOf = (v: unknown): PaperPicks => {
  const out: PaperPicks = {}
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) for (const [k, x] of Object.entries(v)) if (typeof x === 'string') out[k] = x
  return out
}

/** One row of the table, read loosely. Null when it has no id or names no paper. */
export function parseJobPaperProposal(row: Record<string, unknown> | null | undefined): JobPaperProposal | null {
  const id = typeof row?.id === 'string' ? row.id : ''
  const requiredPaperId = typeof row?.required_paper_id === 'string' ? row.required_paper_id : ''
  if (!row || !id || !requiredPaperId) return null
  return {
    id,
    requiredPaperId,
    byName: typeof row.proposed_by_name === 'string' ? row.proposed_by_name.trim() : '',
    proposedAt: typeof row.proposed_at === 'string' ? row.proposed_at : null,
    fromPicks: picksOf(row.from_settings),
    picks: picksOf(row.settings),
  }
}

/** What the database answers to a decide: a decline, or what the change of settings answered with the take. */
export function parseDecided(data: unknown): { took: boolean; signAgain: number } {
  const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  const n = typeof d.sign_again === 'number' && Number.isFinite(d.sign_again) ? Math.max(0, Math.floor(d.sign_again)) : 0
  return { took: d.proposal === 'taken', signAgain: d.proposal === 'taken' ? n : 0 }
}

export const supabaseJobPaperProposalsIo: JobPaperProposalsIo = {
  async readWaiting(jobId) {
    // The table is newer than the generated types, so it is read loosely and checked by `parseJobPaperProposal`.
    const rows = (await withSupabaseRetry(
      () =>
        supabase
          .from('job_paper_proposals' as never)
          .select('id, required_paper_id, proposed_by_name, proposed_at, from_settings, settings' as never)
          .eq('job_id' as never, jobId as never)
          .eq('state' as never, 'waiting' as never) as never,
      'read what the GC proposed',
    )) as unknown as Array<Record<string, unknown>> | null
    return (rows ?? []).flatMap((r) => {
      const p = parseJobPaperProposal(r)
      return p ? [p] : []
    })
  },
  async decide(proposalId, take, why) {
    const res = await supabase.rpc('job_paper_proposal_decide' as never, { p_proposal_id: proposalId, p_take: take, p_why: why ?? null } as never)
    checkSupabaseError(res, take ? 'take the proposal' : 'decline the proposal')
    return parseDecided((res as { data: unknown }).data)
  },
}
