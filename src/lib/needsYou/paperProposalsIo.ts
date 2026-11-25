import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { parsePaperProposalSource, type PaperProposalJobSource, type PaperProposalSource } from './paperProposals'

/**
 * The reads behind *a GC proposed stricter settings* (punch list #389, step 6, its second part): the
 * proposals that wait, then their jobs for a name. Two reads, and the first is small: at most one
 * proposal waits on a paper. The table's policy hands the office its rows and everyone else none.
 */
export type PaperProposalsIo = {
  fetchSources: () => Promise<{ proposals: PaperProposalSource[]; jobs: PaperProposalJobSource[] }>
}

async function fetchSources(): Promise<{ proposals: PaperProposalSource[]; jobs: PaperProposalJobSource[] }> {
  // The table is newer than the generated types, so it is read loosely and checked by `parsePaperProposalSource`.
  const raw = await fetchAllRows<Record<string, unknown>>(
    (from, to) =>
      supabase
        .from('job_paper_proposals' as never)
        .select('id, job_id, proposed_by_name, proposed_at' as never)
        .eq('state' as never, 'waiting' as never)
        .order('proposed_at' as never)
        .order('id' as never)
        .range(from, to) as never,
    'a GC’s proposal: the ones that wait',
  )
  const proposals = raw.flatMap((r) => {
    const p = parsePaperProposalSource(r)
    return p ? [p] : []
  })
  const ids = [...new Set(proposals.map((p) => p.job_id))]
  if (ids.length === 0) return { proposals: [], jobs: [] }
  const jobs = await fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address').in('id', chunk).order('id').range(from, to), 'a GC’s proposal: the jobs')
  return { proposals, jobs: jobs as unknown as PaperProposalJobSource[] }
}

export const paperProposalsIo: PaperProposalsIo = { fetchSources }
