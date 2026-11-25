/**
 * A GC proposes a stricter setting for a job's paper (punch list #389, step 6): the write behind their page, as the
 * service role, for `submit-portal-request`. The page's own reader says whether it is a proposal at all
 * (`gcProposalAsk`). The database decides every rule (`job_paper_propose`): that the job is one this customer is the
 * GC on, that no topic loosens and one tightens, the typed name, the notice's tick and how many an hour. A refusal
 * comes back in the database's own words.
 *
 * A proposal changes no paper. It waits for the office, which takes it or declines.
 */
import { gcProposalAsk } from './portalJobPapers.ts'

type Admin = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> }

export interface PortalLinkForProposal {
  id: string
  customer_id: string
  audience: string
}

export const GC_PROPOSAL_WORDS = {
  notThisPage: 'This page cannot propose settings. Ask our office for your contractor page.',
  bad: 'That proposal could not be read. Reload the page and try again.',
  failed: 'We could not send that just now. Try again in a moment.',
} as const

/** A refusal the database raised in words (P0001, or 42501 for a job that is not theirs) is said as it is. */
export async function gcPaperPropose(admin: Admin, link: PortalLinkForProposal, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  if (link.audience !== 'gc' && link.audience !== 'all') return { status: 403, json: { error: GC_PROPOSAL_WORDS.notThisPage } }
  const ask = gcProposalAsk(body)
  if (!ask) return { status: 400, json: { error: GC_PROPOSAL_WORDS.bad } }
  const { data, error } = await admin.rpc('job_paper_propose', {
    p_required_paper_id: ask.requiredPaperId,
    p_customer_id: link.customer_id,
    p_link_id: link.id,
    p_settings: ask.picks,
    p_name: ask.name,
    p_notice_read: ask.noticeRead,
  })
  if (error) {
    if (error.code === 'P0001') return { status: 400, json: { error: error.message } }
    if (error.code === '42501') return { status: 403, json: { error: error.message } }
    console.error('submit-portal-request job_paper_proposal', error.message)
    return { status: 500, json: { error: GC_PROPOSAL_WORDS.failed } }
  }
  const out = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  return { status: 200, json: { ok: true, proposedAt: typeof out.proposed_at === 'string' ? out.proposed_at : null } }
}
