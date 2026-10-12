/**
 * The New paper window's write (Messages cut 4): `flow_paper_create`, the office team's definer, makes the library
 * document and returns its id; a contract's clauses then go one by one through cluster 9's `edit_clause`, which
 * publishes a dev's or a controller's at once and keeps anyone else's as proposals. The clauses that wait reach the
 * approvers once for the whole paper (`messages-notify`, v2.5317), so a contract of five clauses buzzes them once. Each
 * write goes once: a retry could add the paper twice.
 */
import { checkSupabaseError } from '../../utils/errorHandling'
import { tellClauseApprovers, type ClauseTold } from '../contracts/clausesIo'
import { supabase } from '../supabase'
import type { FlowKind } from './facts'
import { newPaperClauses, newPaperCreateArgs, newPaperFacts, newPaperLabel, type NewPaperDraft, type NewPaperKind, type SavedPaper } from './newPaper'

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null; status?: number }>
const rpc: Rpc = (fn, args) => supabase.rpc(fn as never, args as never) as never

/**
 * Writes the paper, then a contract's clauses. The paper is published unless one of its clauses waits for a controller
 * or a dev; then the approvers are told, best effort, and `told` says who it reached (null: nobody, or nothing waits).
 */
export async function saveFlowPaper(flow: Exclude<FlowKind, 'unknown'>, draft: NewPaperDraft & { kind: NewPaperKind }): Promise<SavedPaper & { clauses: number; told: ClauseTold | null }> {
  const made = await rpc('flow_paper_create', newPaperCreateArgs(flow, draft))
  checkSupabaseError(made, 'add the paper')
  const id = String(made.data)
  const clauses = newPaperClauses(draft)
  let state: SavedPaper['state'] = 'published'
  const waiting: string[] = []
  for (const c of clauses) {
    const res = await rpc('edit_clause', { p_paper_id: id, p_kind: 'new', p_clause_id: null, p_text_en: c.en, p_text_es: c.es, p_scope: c.scope, p_why: 'A new paper from the flow editor.' })
    checkSupabaseError(res, 'write a clause')
    const done = res.data as { state?: string; proposal_id?: string } | null
    if (done?.state !== 'published') {
      state = 'proposed'
      if (done?.proposal_id) waiting.push(done.proposal_id)
    }
  }
  const told = waiting.length ? await tellClauseApprovers(waiting) : null
  return { paperId: `doc:${id}`, factIds: newPaperFacts(draft.kind, draft.runsOut, id), label: newPaperLabel(draft.name), kind: draft.kind, state, clauses: clauses.length, told }
}
