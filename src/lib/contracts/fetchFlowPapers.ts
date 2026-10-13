/**
 * The reads behind Papers on the flows on Settings → Contracts & terms (Messages cut 4, F3): every Contract library
 * document with a flow kind (`flowPaperEntries`), and the live clauses of the contracts among them. The flow columns
 * (v2.5306) and the clause table (cut 4c) are not in the generated types yet, so the rows come back as the written-out
 * types in `flowPaperEntries.ts`.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { FLOW_CLAUSE_COLUMNS, FLOW_PAPER_COLUMNS, type FlowPaperClause, type FlowPaperDoc } from './flowPaperEntries'

export interface FlowPapers {
  docs: FlowPaperDoc[]
  clauses: FlowPaperClause[]
}

export const NO_FLOW_PAPERS: FlowPapers = { docs: [], clauses: [] }

async function rows<T>(op: string, run: () => PromiseLike<unknown>): Promise<T[]> {
  const data = await withSupabaseRetry(run as () => PromiseLike<SupabaseClientResult<unknown>>, op)
  return (data ?? []) as T[]
}

export async function fetchFlowPapers(): Promise<FlowPapers> {
  const docs = await rows<FlowPaperDoc>('contracts tab: papers on the flows', () =>
    supabase.from('contract_template_documents' as never).select(FLOW_PAPER_COLUMNS).not('flow_kind', 'is', null),
  )
  const contracts = docs.filter((d) => d.flow_kind === 'contract').map((d) => d.id)
  if (contracts.length === 0) return { docs, clauses: [] }
  const clauses = await rows<FlowPaperClause>('contracts tab: the clauses of the contracts on the flows', () =>
    supabase.from('contract_clauses' as never).select(FLOW_CLAUSE_COLUMNS).in('paper_id', contracts).is('retired_at', null).order('sequence_order'),
  )
  return { docs, clauses }
}
