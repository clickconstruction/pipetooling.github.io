import { contractJobLabel } from './fillInContracts'

/**
 * A GC's proposal that waits on the office (punch list #389, step 6, its second part).
 *
 * A GC proposes a stricter setting for a job's paper on their own page. Until this line, the
 * proposal showed only under the paper's row on that job's Documents tab, so the office heard
 * of it only by opening the job. This is the same fact on the office's Needs you, with the job
 * named. It sends no push and no email, and the press answers nothing: it opens the job, and a
 * person takes the proposal or declines it there.
 *
 * Pure; `paperProposalsIo.ts` reads. The table's policy shows a proposal to the office alone,
 * so anyone else reads none and has no line.
 */

/** A waiting row of `job_paper_proposals`, as the read hands it. */
export type PaperProposalSource = { id: string; job_id: string; proposed_by_name: string | null; proposed_at: string | null }

/** The job a proposal is on. */
export type PaperProposalJobSource = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null }

export type PaperProposalRow = { proposalId: string; jobId: string; jobLabel: string; byName: string; proposedAt: string | null }

export type PaperProposalsWaiting = {
  /** The waiting proposals, the one that has waited longest first. */
  rows: PaperProposalRow[]
  /** The jobs they sit on, in the rows' order. */
  jobIds: string[]
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/** One row of the table, read loosely: the table is newer than the generated types. Null with no id or no job. */
export function parsePaperProposalSource(row: unknown): PaperProposalSource | null {
  const r = (typeof row === 'object' && row !== null && !Array.isArray(row) ? row : {}) as Record<string, unknown>
  const id = text(r.id)
  const jobId = text(r.job_id)
  if (!id || !jobId) return null
  return { id, job_id: jobId, proposed_by_name: text(r.proposed_by_name) || null, proposed_at: text(r.proposed_at) || null }
}

/**
 * The proposals to answer, the longest wait first. A proposal on a job the reader cannot read keeps
 * its place and is named by the job's id, so a count never hides one.
 */
export function paperProposalsWaiting(proposals: readonly PaperProposalSource[], jobs: readonly PaperProposalJobSource[]): PaperProposalsWaiting {
  const byId = new Map(jobs.map((j) => [j.id, j] as const))
  const rows = proposals
    .map((p) => {
      const job = byId.get(p.job_id)
      return {
        proposalId: p.id,
        jobId: p.job_id,
        jobLabel: job ? contractJobLabel(job) : `job ${p.job_id.slice(0, 8)}`,
        byName: (p.proposed_by_name ?? '').trim(),
        proposedAt: p.proposed_at,
      }
    })
    .sort((a, b) => (a.proposedAt ?? '').localeCompare(b.proposedAt ?? '') || a.jobLabel.localeCompare(b.jobLabel) || a.proposalId.localeCompare(b.proposalId))
  return { rows, jobIds: [...new Set(rows.map((r) => r.jobId))] }
}

/** The line's title: *A GC proposed stricter settings*, *3 GC proposals wait on an answer*. */
export function paperProposalsTitle(n: number): string {
  return n === 1 ? 'A GC proposed stricter settings' : `${n} GC proposals wait on an answer`
}

/** Under the title: who proposed and on which job, how many more there are, and what the press does. */
export function paperProposalsDetail(d: Pick<PaperProposalsWaiting, 'rows'>): string {
  const first = d.rows[0]
  if (!first) return ''
  const lead = `${first.byName || 'The GC'} proposed them for the paper on ${first.jobLabel}.`
  const more = d.rows.length - 1
  if (more <= 0) return `${lead} Nothing changes until you answer. Open the job to take it or decline.`
  return `${lead} ${more} more. Nothing changes until you answer. Open a job to take it or decline.`
}

/** The press: it opens the job that holds the first proposal. It answers nothing. */
export const PAPER_PROPOSALS_ACTION = 'Open the job'

/** The first proposal's job in the Pipeline, its window open on Documents, where the proposal waits. */
export function paperProposalsHref(jobId: string | null | undefined): string {
  return jobId ? `/jobs?tab=stages&jobDetail=${encodeURIComponent(jobId)}&jobTab=documents` : '/jobs?tab=stages'
}
