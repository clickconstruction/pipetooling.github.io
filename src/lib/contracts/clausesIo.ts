/**
 * Messages, cut 4c's screens: the reads and writes behind Settings → Contracts and clauses and the approvers' Needs you
 * (`20261012150000_contract_clauses.sql`, on prod since v2.5269). The clause tables and the new library columns are not
 * in the generated types yet, so the rows come back as the written-out types in `clauseRows.ts`. Every write is one of
 * the three RPCs, which refuse in their own words; a refusal reaches the screen through `formatErrorMessage`.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import type { UserRole } from '../../hooks/useAuth'
import { GC_CLAUSE_APPROVE_TEAM, canApproveClause } from '../gc/access'
import { clauseNeeds, type ClauseChange, type ClauseNeedRow } from './approval'
import { approverNames, clausePaperCards, scopeToRow, type ClauseLibraryRows, type ClauseRow, type PaperRow, type ProposalRow, type TemplateRow } from './clauseRows'

const PAPER_COLUMNS = 'id, document_name, template_id, form_template_id, sequence_order, revision, published_at'
const CLAUSE_COLUMNS = 'id, paper_id, sequence_order, text_en, text_es, scope, version, published_by_name, published_at, retired_at, retired_by_name'
const PROPOSAL_COLUMNS =
  'id, paper_id, kind, clause_id, base_v, text_en, text_es, scope, by_user_id, by_name, why, state, decided_by_name, decided_at, decline_why, result_v, paper_revision, created_at'

/** A company the preview can assemble a paper for. */
export interface PreviewCompany {
  id: string
  name: string
  trades: string[]
}

/** Everything Settings → Contracts and clauses reads. */
export interface ClauseLibrary extends ClauseLibraryRows {
  /** Every trade a trade package names, for *Applies to*. */
  packageTrades: string[]
  companies: PreviewCompany[]
  /** The devs and controllers by name, for the words that say who gets the push. */
  approvers: string[]
}

/** One read, retried, its rows as the written-out type. */
async function rows<T>(op: string, run: () => PromiseLike<unknown>): Promise<T[]> {
  const data = await withSupabaseRetry(run as () => PromiseLike<SupabaseClientResult<unknown>>, op)
  return (data ?? []) as T[]
}

/** The approvers by name. A read the viewer may not make leaves the words general rather than failing the page. */
async function loadApprovers(): Promise<string[]> {
  try {
    const users = await rows<{ name: string | null; role: UserRole | null }>('load the approvers', () => supabase.from('users').select('name, role').in('role', [...GC_CLAUSE_APPROVE_TEAM]))
    return approverNames(users)
  } catch {
    return []
  }
}

/** The library, its clauses, every change to them, and what *Applies to* and the preview offer. */
export async function loadClauseLibrary(): Promise<ClauseLibrary> {
  const [papers, templates, clauses, proposals, packages, companies, approvers] = await Promise.all([
    rows<PaperRow>('load the contract library', () => supabase.from('contract_template_documents' as never).select(PAPER_COLUMNS)),
    rows<TemplateRow>('load the contract packets', () => supabase.from('contract_templates').select('id, name, sequence_order')),
    rows<ClauseRow>('load the clauses', () => supabase.from('contract_clauses' as never).select(CLAUSE_COLUMNS).order('sequence_order')),
    rows<ProposalRow>('load the clause changes', () => supabase.from('contract_clause_proposals' as never).select(PROPOSAL_COLUMNS).order('created_at')),
    rows<{ trade: string | null }>('load the trades', () => supabase.from('gc_trade_packages').select('trade')),
    rows<{ id: string; name: string; trades: string[] | null }>('load the trade partners', () => supabase.from('gc_companies').select('id, name, trades')),
    loadApprovers(),
  ])
  return {
    papers,
    templates: templates.map((t) => ({ ...t, sequence_order: t.sequence_order ?? 0 })),
    clauses,
    proposals,
    packageTrades: packages.map((p) => p.trade ?? '').filter(Boolean),
    companies: companies.map((c) => ({ id: c.id, name: c.name, trades: c.trades ?? [] })).sort((a, b) => a.name.localeCompare(b.name)),
    approvers,
  }
}

/** What an RPC hands back. */
export interface ClauseWriteResult {
  state: 'published' | 'proposed' | 'declined'
  proposal_id: string
  clause_id?: string | null
  version?: number
  revision?: number
}

/** A change to a clause, as `edit_clause` takes it: published at once for a dev or a controller, else proposed. */
export async function saveClauseChange(paperId: string, change: ClauseChange, why: string): Promise<ClauseWriteResult> {
  const args =
    change.kind === 'retire'
      ? { p_paper_id: paperId, p_kind: 'retire', p_clause_id: change.clauseId, p_why: why }
      : {
          p_paper_id: paperId,
          p_kind: change.kind,
          p_clause_id: change.kind === 'edit' ? change.clauseId : null,
          p_text_en: change.en,
          p_text_es: change.es,
          p_scope: scopeToRow(change.scope),
          p_why: why,
        }
  const res = await supabase.rpc('edit_clause' as never, args as never)
  checkSupabaseError(res, 'change a clause')
  return res.data as unknown as ClauseWriteResult
}

/** A controller or a dev approves a waiting change. */
export async function approveClauseProposal(proposalId: string): Promise<ClauseWriteResult> {
  const res = await supabase.rpc('approve_clause_proposal' as never, { p_proposal_id: proposalId } as never)
  checkSupabaseError(res, 'approve the change')
  return res.data as unknown as ClauseWriteResult
}

/** A controller or a dev declines a waiting change, with the why the proposer gets. */
export async function declineClauseProposal(proposalId: string, why: string): Promise<ClauseWriteResult> {
  const res = await supabase.rpc('decline_clause_proposal' as never, { p_proposal_id: proposalId, p_why: why } as never)
  checkSupabaseError(res, 'decline the change')
  return res.data as unknown as ClauseWriteResult
}

/**
 * The approvers' Needs you rows: every change waiting, the longest waiting first. Empty for anyone who cannot approve,
 * without a read. `when` turns a time into words.
 */
export async function loadClauseNeeds(role: UserRole | null, when: (at: string) => string): Promise<ClauseNeedRow[]> {
  if (!canApproveClause(role)) return []
  const [papers, templates, clauses, proposals, approvers] = await Promise.all([
    rows<PaperRow>('load the contract library', () => supabase.from('contract_template_documents' as never).select(PAPER_COLUMNS)),
    rows<TemplateRow>('load the contract packets', () => supabase.from('contract_templates').select('id, name, sequence_order')),
    rows<ClauseRow>('load the clauses', () => supabase.from('contract_clauses' as never).select(CLAUSE_COLUMNS)),
    rows<ProposalRow>('load the clause changes', () => supabase.from('contract_clause_proposals' as never).select(PROPOSAL_COLUMNS).eq('state', 'proposed')),
    loadApprovers(),
  ])
  const cards = clausePaperCards({ papers, templates, clauses, proposals })
  return clauseNeeds(
    role,
    cards.flatMap((c) => c.waiting),
    cards.map((c) => c.book),
    { approvers, when },
  )
}
