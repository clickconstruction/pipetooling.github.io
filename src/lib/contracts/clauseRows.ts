/**
 * Messages, cut 4c's screens: the clause tables' rows (`20261012150000_contract_clauses.sql`) in the kernels' types, for
 * Settings → Contracts and clauses and the approvers' Needs you. The tables are on prod and not yet in the generated
 * types, so the rows are written out here, as the loader selects them (`clausesIo.ts`).
 *
 * - A paper is a Contract library document. Its heading is the document's name. Its between line is the GC frame's,
 *   *Click Construction and {company}*, until Form Studio's template holds one.
 * - The approved and declined changes are each clause's history (`clauseHistory`), since every change is a row.
 * - The trades a clause can name are the trades the app already has: every trade package's, every company's, and every
 *   trade a clause names, each once.
 *
 * Pure: `clausesIo.ts` reads the rows, this shapes them.
 */
import type { UserRole } from '../../hooks/useAuth'
import { canApproveClause } from '../gc/access'
import type { ClauseBook, ClauseProposal } from './approval'
import { clauseTrades, tradeKey, type Clause, type ClauseScope, type ContractPaper } from './assemble'

/** A Contract library document, as the loader selects it. */
export interface PaperRow {
  id: string
  document_name: string
  template_id: string
  form_template_id: string | null
  sequence_order: number
  revision: number
  published_at: string | null
}

/** A packet of the Contract library. */
export interface TemplateRow {
  id: string
  name: string
  sequence_order: number
}

/** A row of `contract_clauses`. */
export interface ClauseRow {
  id: string
  paper_id: string
  sequence_order: number
  text_en: string
  text_es: string
  scope: string[]
  version: number
  published_by_name: string
  published_at: string
  retired_at: string | null
  retired_by_name: string | null
}

/** A row of `contract_clause_proposals`. */
export interface ProposalRow {
  id: string
  paper_id: string
  kind: 'new' | 'edit' | 'retire'
  clause_id: string | null
  base_v: number | null
  text_en: string
  text_es: string
  scope: string[]
  by_user_id: string | null
  by_name: string
  why: string
  state: 'proposed' | 'approved' | 'declined'
  decided_by_name: string | null
  decided_at: string | null
  decline_why: string | null
  result_v: number | null
  paper_revision: number | null
  created_at: string
}

/** The GC frame's between line, until Form Studio's template holds one. */
export const CLAUSE_PAPER_BETWEEN = 'Click Construction and {company}'

/** A scope as the table keeps it: `{all}`, or the trade names. */
export function scopeFromRow(scope: readonly string[]): ClauseScope {
  return scope.length === 1 && scope[0] === 'all' ? 'all' : [...scope]
}

/** A scope as the RPC takes it. */
export function scopeToRow(scope: ClauseScope): string[] {
  return scope === 'all' ? ['all'] : [...scope]
}

export function clauseFromRow(r: ClauseRow): Clause {
  return { id: r.id, order: r.sequence_order, en: r.text_en, es: r.text_es, scope: scopeFromRow(r.scope), v: r.version, retiredAt: r.retired_at, retiredBy: r.retired_by_name }
}

export function proposalFromRow(r: ProposalRow): ClauseProposal {
  return {
    id: r.id,
    paperId: r.paper_id,
    kind: r.kind,
    clauseId: r.clause_id,
    baseV: r.base_v,
    en: r.text_en,
    es: r.text_es,
    scope: scopeFromRow(r.scope),
    byUserId: r.by_user_id ?? '',
    by: r.by_name,
    at: r.created_at,
    why: r.why,
    state: r.state,
    decidedBy: r.decided_by_name,
    decidedAt: r.decided_at,
    declineWhy: r.decline_why,
  }
}

/** A decided or waiting change, with what an approved one made. */
export type ClauseChangeRecord = ClauseProposal & { resultV: number | null; paperRevision: number | null }

export function changeFromRow(r: ProposalRow): ClauseChangeRecord {
  return { ...proposalFromRow(r), resultV: r.result_v, paperRevision: r.paper_revision }
}

/** A library document as a clause paper. */
export function paperFromRow(r: PaperRow): ContractPaper {
  return { id: r.id, title: r.document_name, name: `the ${r.document_name}`, between: CLAUSE_PAPER_BETWEEN, revision: r.revision, publishedAt: r.published_at }
}

/** A paper's card in Settings: its book, its packet's name, and the changes waiting on it, oldest first. */
export interface ClausePaperCard {
  book: ClauseBook
  packet: string
  waiting: ClauseProposal[]
  /** Every change ever made to its clauses, for the clauses' history. */
  changes: ClauseChangeRecord[]
}

/** Everything Settings → Contracts and clauses reads, as the loader hands it over. */
export interface ClauseLibraryRows {
  papers: readonly PaperRow[]
  templates: readonly TemplateRow[]
  clauses: readonly ClauseRow[]
  proposals: readonly ProposalRow[]
}

const packetOrder = (templates: readonly TemplateRow[]) => {
  const at = new Map(templates.map((t) => [t.id, t] as const))
  return (a: PaperRow, b: PaperRow): number => {
    const ta = at.get(a.template_id)
    const tb = at.get(b.template_id)
    return (ta?.sequence_order ?? 0) - (tb?.sequence_order ?? 0) || (ta?.name ?? '').localeCompare(tb?.name ?? '') || a.sequence_order - b.sequence_order || a.document_name.localeCompare(b.document_name)
  }
}

/**
 * One card per library document that has clauses or a change waiting on it, in the library's order: by packet, then by
 * the document's place in it. A paper whose every clause is retired still shows, with its history.
 */
export function clausePaperCards(rows: ClauseLibraryRows): ClausePaperCard[] {
  const names = new Map(rows.templates.map((t) => [t.id, t.name] as const))
  const proposals = rows.proposals.map(changeFromRow)
  const has = new Set([...rows.clauses.map((c) => c.paper_id), ...rows.proposals.map((p) => p.paper_id)])
  return rows.papers
    .filter((p) => has.has(p.id))
    .sort(packetOrder(rows.templates))
    .map((p) => {
      const mine = proposals.filter((x) => x.paperId === p.id).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
      return {
        book: { paper: paperFromRow(p), clauses: rows.clauses.filter((c) => c.paper_id === p.id).map(clauseFromRow) },
        packet: names.get(p.template_id) ?? '',
        waiting: mine.filter((x) => x.state === 'proposed'),
        changes: mine,
      }
    })
}

/** A library document that can become a clause paper: not a fillable form, and no clause on it yet. */
export interface BuildablePaper {
  id: string
  /** *Subs · Master Subcontract Agreement*. */
  label: string
}

/** The library documents *Build a paper from clauses* offers, in the library's order. */
export function buildablePapers(rows: ClauseLibraryRows): BuildablePaper[] {
  const names = new Map(rows.templates.map((t) => [t.id, t.name] as const))
  const has = new Set([...rows.clauses.map((c) => c.paper_id), ...rows.proposals.map((p) => p.paper_id)])
  return rows.papers
    .filter((p) => !p.form_template_id && !has.has(p.id))
    .sort(packetOrder(rows.templates))
    .map((p) => ({ id: p.id, label: names.get(p.template_id) ? `${names.get(p.template_id)} · ${p.document_name}` : p.document_name }))
}

/** One line of a clause's history. */
export interface HistoryLine {
  id: string
  /** *Version 2, proposed by Rosa and approved by Maria.* */
  title: string
  /** When, then why, each its own piece. */
  facts: string[]
  /** The words the change asked for. */
  words: string
}

/** Who made a change and who decided it, in a sentence's words. */
function whoWords(p: ClauseChangeRecord): string {
  if (p.state === 'declined') return `proposed by ${p.by} and declined by ${p.decidedBy ?? 'an approver'}`
  if (p.decidedBy && p.decidedBy !== p.by) return `proposed by ${p.by} and approved by ${p.decidedBy}`
  return `published by ${p.by}`
}

/**
 * A clause's history: every decided change to it, the newest first, each with the version an approved one made. A change
 * still waiting is not history yet. `when` turns a time into words.
 */
export function clauseHistory(changes: readonly ClauseChangeRecord[], clauseId: string, when: (at: string) => string): HistoryLine[] {
  return changes
    .filter((p) => p.clauseId === clauseId && p.state !== 'proposed')
    .sort((a, b) => (b.decidedAt ?? b.at).localeCompare(a.decidedAt ?? a.at) || b.id.localeCompare(a.id))
    .map((p) => {
      const v = p.resultV
      const what =
        p.state === 'declined'
          ? p.kind === 'retire'
            ? 'A retire'
            : p.kind === 'new'
              ? 'The new clause'
              : 'A change'
          : p.kind === 'retire'
            ? 'Retired'
            : v != null
              ? `Version ${v}`
              : 'A change'
      const title = `${what}, ${whoWords(p)}.`
      const facts = [when(p.decidedAt ?? p.at), ...(p.why ? [p.why] : []), ...(p.state === 'declined' && p.declineWhy ? [`why not: ${p.declineWhy}`] : [])]
      return { id: p.id, title, facts, words: p.en }
    })
}

/**
 * The trades *Applies to* offers: every trade a trade package names, every trade a company has, and every trade a clause
 * already names, each once in its first spelling, A to Z.
 */
export function tradeChoices(packageTrades: readonly string[], companyTrades: readonly (readonly string[])[], clauses: readonly Clause[]): string[] {
  const seen = new Map<string, string>()
  const add = (t: string) => {
    const k = tradeKey(t)
    if (k !== '' && k !== 'all' && !seen.has(k)) seen.set(k, t.trim().replace(/\s+/g, ' '))
  }
  for (const t of packageTrades) add(t)
  for (const list of companyTrades) for (const t of list) add(t)
  for (const c of clauses) for (const t of clauseTrades(c)) add(t)
  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, t]) => t)
}

/** The approvers by name, for the words that say who gets the push: the team's devs and controllers. */
export function approverNames(users: readonly { name: string | null; role: UserRole | null }[]): string[] {
  return users
    .filter((u) => canApproveClause(u.role) && (u.name ?? '').trim() !== '')
    .map((u) => (u.name ?? '').trim())
    .sort((a, b) => a.localeCompare(b))
}

/** The anchor of a paper's card in Settings, which the Needs you row opens. */
export function clausePaperAnchor(paperId: string): string {
  return `settings-clause-paper-${paperId}`
}

/** The Settings link to a paper's card. */
export function clausePaperHref(paperId: string): string {
  return `/settings?tab=settings-clauses#${clausePaperAnchor(paperId)}`
}
