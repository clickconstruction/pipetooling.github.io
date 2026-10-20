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
import { approverNames, clausePaperCards, paperChoices, scopeToRow, type ClauseLibraryRows, type ClauseRow, type PaperChoice, type PaperRow, type ProposalRow, type TemplateRow } from './clauseRows'

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

/** Who `messages-notify` reached, and how. */
export interface ClauseTold {
  pushSent: number
  emailSent: number
  /** The approvers it reached, or the editor, by name. */
  names: string[]
}

async function tell(body: Record<string, unknown>): Promise<ClauseTold | null> {
  try {
    const { data, error } = await supabase.functions.invoke('messages-notify', { body })
    if (error) return null
    const d = (data ?? {}) as { push_sent?: number; email_sent?: number | boolean; approvers?: string[]; editor_name?: string | null }
    const emailSent = typeof d.email_sent === 'boolean' ? Number(d.email_sent) : (d.email_sent ?? 0)
    return { pushSent: d.push_sent ?? 0, emailSent, names: d.approvers ?? (d.editor_name ? [d.editor_name] : []) }
  } catch {
    return null
  }
}

/**
 * Tell the approvers of the changes one save sent for approval (`messages-notify`): a push on every device and an email.
 * Best effort: null when it could not, and the changes still wait on their Needs you.
 */
export async function tellClauseApprovers(proposalIds: readonly string[]): Promise<ClauseTold | null> {
  return proposalIds.length ? tell({ proposal_ids: [...proposalIds] }) : null
}

/** Tell the editor of a decision on their change (`messages-notify`): an email now, a text once Quo is in. Best effort. */
export async function tellClauseEditor(proposalId: string): Promise<ClauseTold | null> {
  return tell({ decided: proposalId })
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

/**
 * Messages, cut 4c (v2.5334): the paper pickers on a statement of work and on our contract's send, over
 * `20261013000000_gc_clause_papers.sql`'s `paper_id` columns and setters, which are not in the generated types yet. The
 * setters refuse in their own words: a twin, a form, a paper not in the library, a copy signed already.
 */

/** The papers a statement of work or our contract can be built from, in the library's order. */
export async function loadPaperChoices(): Promise<PaperChoice[]> {
  const [papers, templates, clauses] = await Promise.all([
    rows<PaperRow>('load the contract library', () => supabase.from('contract_template_documents' as never).select(PAPER_COLUMNS)),
    rows<TemplateRow>('load the contract packets', () => supabase.from('contract_templates').select('id, name, sequence_order')),
    rows<ClauseRow>('load the clauses', () => supabase.from('contract_clauses' as never).select(CLAUSE_COLUMNS).order('sequence_order')),
  ])
  return paperChoices({ papers, templates: templates.map((t) => ({ ...t, sequence_order: t.sequence_order ?? 0 })), clauses })
}

/**
 * A trade's statement of work not signed yet, with the paper it is built from now (null for its lines). Read by its
 * trade, since the board's statement of work carries no id. Null when it has none waiting.
 */
export async function loadSowPaper(packageId: string): Promise<{ sowId: string; paperId: string | null } | null> {
  const [row] = await rows<{ id: string; paper_id: string | null }>('load the statement of work’s paper', () =>
    supabase.from('gc_sows' as never).select('id, paper_id').eq('package_id', packageId).in('status', ['draft', 'sent']),
  )
  return row ? { sowId: row.id, paperId: row.paper_id } : null
}

/** The paper a send of our contract is built from, or null for our contract file. */
export async function loadOwnerContractPaper(sendId: string): Promise<string | null> {
  const [row] = await rows<{ paper_id: string | null }>('load our contract’s paper', () => supabase.from('gc_owner_contract_sends' as never).select('paper_id').eq('id', sendId))
  return row?.paper_id ?? null
}

/** A dev picks the paper a statement of work is built from, or null for its lines, until it is signed. */
export async function setSowPaper(sowId: string, paperId: string | null): Promise<void> {
  const res = await supabase.rpc('gc_set_sow_paper' as never, { p_sow_id: sowId, p_paper_id: paperId } as never)
  checkSupabaseError(res, 'pick the paper')
}

/** The money team picks the paper a send of our contract is built from, or null for our contract file, until it is signed. */
export async function setOwnerContractPaper(sendId: string, paperId: string | null): Promise<void> {
  const res = await supabase.rpc('gc_set_owner_contract_paper' as never, { p_send_id: sendId, p_paper_id: paperId } as never)
  checkSupabaseError(res, 'pick the paper')
}
