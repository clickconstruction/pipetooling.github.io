/**
 * Messages, cut 4c: who changes a contract clause, and how a change waits for approval (the Messages prototype v1.178,
 * `editClause`, `approveClause`, `declineClause` and `clauseNeeds`; the owner, 2026-10-12). Anyone in the office edits a
 * clause. A controller's or a dev's own edit publishes at once. Anyone else's becomes a proposal: the approvers get a push
 * and an email, and it waits on their Needs you until one of them approves it or declines it with a why. Every publish
 * moves the paper's revision one up, so the next paper sent carries it and a paper already signed keeps its words.
 *
 * What changed from the prototype, and why:
 * - A proposal keeps the clause's version it was made against, and approving refuses once the clause has moved on since.
 *   The prototype applied it on top, which silently overwrote a newer publish.
 * - A clause can be retired, through the same path as an edit. It is never deleted.
 * - A proposal names its clause by id, and its row names it by the one numbering (`clauseLabel`).
 * - Nothing changed is not a change: an edit with the same words and trades publishes nothing.
 *
 * Pure: the screens and the edge function write the rows, this decides what happens and what the words say.
 */
import type { UserRole } from '../../hooks/useAuth'
import { canApproveClause, canEditClause } from '../gc/access'
import { andList, clauseLabel, scopeWords, tradeKey, type Clause, type ClauseScope, type ContractPaper } from './assemble'

/** A paper and its clauses: what a change is made to. */
export interface ClauseBook {
  paper: ContractPaper
  clauses: readonly Clause[]
}

/** What someone asks to change on a paper. */
export type ClauseChange =
  | { kind: 'new'; en: string; es: string; scope: ClauseScope }
  | { kind: 'edit'; clauseId: string; en: string; es: string; scope: ClauseScope }
  | { kind: 'retire'; clauseId: string }

/** Who is making or deciding a change. */
export interface Signer {
  userId: string
  name: string
  role: UserRole | null
}

/** A change that waits on a controller or a dev, as `contract_clause_proposals` keeps it. */
export interface ClauseProposal {
  id: string
  paperId: string
  kind: ClauseChange['kind']
  /** The clause it changes. Null for a new clause. */
  clauseId: string | null
  /** The clause's version when it was proposed. Approving refuses once the clause has moved on. Null for a new clause. */
  baseV: number | null
  /** The words and trades it asks for. A retire carries the clause's words as they stood, for the row. */
  en: string
  es: string
  scope: ClauseScope
  byUserId: string
  by: string
  at: string
  why: string
  state: 'proposed' | 'approved' | 'declined'
  decidedBy: string | null
  decidedAt: string | null
  declineWhy: string | null
}

/** What a publish changed, for the clause's history. */
export interface PublishedChange {
  kind: ClauseChange['kind']
  clauseId: string
  v: number
  revision: number
  /** Who published it: the editor, or the approver of a proposal. */
  by: string
  /** Who proposed it, when an approver published someone else's change. */
  proposedBy: string | null
  at: string
  why: string
}

export type EditResult =
  | { kind: 'refused'; why: string }
  | { kind: 'published'; book: ClauseBook; change: PublishedChange; toast: string }
  | { kind: 'proposed'; proposal: ClauseProposal; toast: string }

export type DecideResult =
  | { kind: 'refused'; why: string }
  | { kind: 'decided'; proposal: ClauseProposal; book: ClauseBook | null; change: PublishedChange | null; toast: string }

/** A scope with each trade once, trimmed, in the order picked. Empty when no trade is named. */
export function cleanScope(scope: ClauseScope): ClauseScope {
  if (scope === 'all') return 'all'
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of scope) {
    const k = tradeKey(t)
    if (k === '' || seen.has(k)) continue
    seen.add(k)
    out.push(t.trim().replace(/\s+/g, ' '))
  }
  return out
}

const sameScope = (a: ClauseScope, b: ClauseScope): boolean => {
  if (a === 'all' || b === 'all') return a === b
  const keys = (s: readonly string[]) => s.map(tradeKey).sort().join('\n')
  return keys(a) === keys(b)
}

const findClause = (book: ClauseBook, id: string): Clause | undefined => book.clauses.find((c) => c.id === id)

/** Why this change cannot be made to this paper, in words for the editor. Null when it can. */
export function changeProblem(book: ClauseBook, change: ClauseChange): string | null {
  if (change.kind !== 'retire') {
    if (change.en.trim() === '') return 'Write the clause.'
    const scope = cleanScope(change.scope)
    if (scope !== 'all' && scope.length === 0) return 'Pick who it applies to.'
  }
  if (change.kind === 'new') return null
  const clause = findClause(book, change.clauseId)
  if (!clause) return `That clause is not on ${book.paper.name}.`
  if (clause.retiredAt != null) return 'That clause is retired already.'
  if (
    change.kind === 'edit' &&
    clause.en.trim() === change.en.trim() &&
    clause.es.trim() === change.es.trim() &&
    sameScope(clause.scope, cleanScope(change.scope))
  ) {
    return 'Nothing changed.'
  }
  return null
}

/**
 * The change, published: the paper's revision one up, and the clause new (version 1, after the last clause), changed (its
 * version one up) or retired. No check of who: callers check first, as `editClause` and `approveProposal` do.
 */
export function publishChange(book: ClauseBook, change: ClauseChange, who: { name: string; at: string; why: string; newId: () => string }): { book: ClauseBook; change: PublishedChange } {
  const problem = changeProblem(book, change)
  if (problem) throw new Error(problem)
  const revision = book.paper.revision + 1
  const paper: ContractPaper = { ...book.paper, revision, publishedAt: who.at }
  let clauses: Clause[]
  let clauseId: string
  let v: number
  if (change.kind === 'new') {
    clauseId = who.newId()
    v = 1
    const order = Math.max(0, ...book.clauses.map((c) => c.order)) + 1
    clauses = [...book.clauses, { id: clauseId, order, en: change.en.trim(), es: change.es.trim(), scope: cleanScope(change.scope), v, retiredAt: null, retiredBy: null }]
  } else if (change.kind === 'edit') {
    clauseId = change.clauseId
    const old = findClause(book, clauseId)
    v = (old?.v ?? 0) + 1
    clauses = book.clauses.map((c) => (c.id === clauseId ? { ...c, en: change.en.trim(), es: change.es.trim(), scope: cleanScope(change.scope), v } : c))
  } else {
    clauseId = change.clauseId
    v = findClause(book, clauseId)?.v ?? 0
    clauses = book.clauses.map((c) => (c.id === clauseId ? { ...c, retiredAt: who.at, retiredBy: who.name } : c))
  }
  return { book: { paper, clauses }, change: { kind: change.kind, clauseId, v, revision, by: who.name, proposedBy: null, at: who.at, why: who.why.trim() } }
}

/**
 * Whether the approvers' push and email, and the editor's text on a decision, go out. Off until the messages-notify
 * function sends them (`BUILD_PLAN.md` → Cut 4c), so no word on a screen claims a send that never happened.
 */
export const CLAUSE_NOTIFY_LIVE = false

/** *Robert and Maria*, or *a controller or a dev* when no approver is named. */
const approverWords = (approvers: readonly string[]): string => (approvers.length ? andList(approvers) : 'a controller or a dev')

/** *Robert or Maria*, or *a controller or a dev* when no approver is named. */
export function orWords(approvers: readonly string[]): string {
  if (approvers.length === 0) return 'a controller or a dev'
  if (approvers.length === 1) return approvers[0] ?? ''
  return `${approvers.slice(0, -1).join(', ')} or ${approvers[approvers.length - 1]}`
}

/** *the next master services agreement*: the paper by its heading, as the toasts say it. */
const nextPaper = (paper: ContractPaper): string => `The next ${paper.title.toLowerCase()} sent`

/** What the editor reads once their own change is published. */
export function publishedToast(paper: ContractPaper, kind: ClauseChange['kind']): string {
  if (kind === 'retire') return `Retired. ${nextPaper(paper)} leaves it out. Signed copies keep it.`
  return `Published as version ${paper.revision}. ${nextPaper(paper)} carries it. Signed copies keep their words.`
}

/** What the editor reads once their change is sent for approval. `told`: the approvers got a push and an email. */
export function proposedToast(approvers: readonly string[], told = CLAUSE_NOTIFY_LIVE): string {
  if (!told) return `It waits for ${orWords(approvers)} to approve it. Until then it is on their Needs you.`
  const sent = approvers.length ? `Sent to ${andList(approvers)} with a push and an email.` : 'Sent for approval with a push and an email.'
  const once = approvers.length === 1 ? `It goes out once ${approvers[0]} approves it.` : `It goes out once ${approvers.length ? 'one of them' : 'a controller or a dev'} approves it.`
  return `${sent} ${once} Until then it waits on their Needs you.`
}

/** What the approver reads once a change is approved. */
export function approvedToast(approver: string, proposer: string, kind: ClauseChange['kind'], told = CLAUSE_NOTIFY_LIVE): string {
  const carries = kind === 'retire' ? 'The next paper sent leaves it out.' : 'The next paper sent carries it.'
  return told ? `Approved by ${approver}. ${proposer} gets a text that it went out. ${carries}` : `Approved by ${approver}. ${carries}`
}

/** What the approver reads once a change is declined. */
export function declinedToast(proposer: string, told = CLAUSE_NOTIFY_LIVE): string {
  return told ? `Declined. ${proposer} gets a text with your why.` : `Declined. ${proposer} sees your why on the clause's history.`
}

/**
 * Someone changes a clause. A controller or a dev publishes it at once. Anyone else in the office sends it for approval.
 * Anyone outside the office is refused, as is a change with a problem (`changeProblem`).
 */
export function editClause(
  book: ClauseBook,
  change: ClauseChange,
  editor: Signer,
  ctx: { at: string; why: string; approvers: readonly string[]; newId: () => string; told?: boolean },
): EditResult {
  if (!canEditClause(editor.role)) return { kind: 'refused', why: 'Only the office changes a clause.' }
  const problem = changeProblem(book, change)
  if (problem) return { kind: 'refused', why: problem }
  if (canApproveClause(editor.role)) {
    const done = publishChange(book, change, { name: editor.name, at: ctx.at, why: ctx.why, newId: ctx.newId })
    return { kind: 'published', book: done.book, change: done.change, toast: publishedToast(done.book.paper, change.kind) }
  }
  const clause = change.kind === 'new' ? undefined : findClause(book, change.clauseId)
  const words = change.kind === 'retire' ? { en: clause?.en ?? '', es: clause?.es ?? '', scope: clause?.scope ?? 'all' } : { en: change.en.trim(), es: change.es.trim(), scope: cleanScope(change.scope) }
  const proposal: ClauseProposal = {
    id: ctx.newId(),
    paperId: book.paper.id,
    kind: change.kind,
    clauseId: change.kind === 'new' ? null : change.clauseId,
    baseV: clause ? clause.v : null,
    ...words,
    byUserId: editor.userId,
    by: editor.name,
    at: ctx.at,
    why: ctx.why.trim(),
    state: 'proposed',
    decidedBy: null,
    decidedAt: null,
    declineWhy: null,
  }
  return { kind: 'proposed', proposal, toast: proposedToast(ctx.approvers, ctx.told ?? CLAUSE_NOTIFY_LIVE) }
}

/** The change a proposal asks for. */
export function proposalChange(p: ClauseProposal): ClauseChange {
  if (p.kind === 'new') return { kind: 'new', en: p.en, es: p.es, scope: p.scope }
  if (p.kind === 'edit') return { kind: 'edit', clauseId: p.clauseId ?? '', en: p.en, es: p.es, scope: p.scope }
  return { kind: 'retire', clauseId: p.clauseId ?? '' }
}

/** Why an approver cannot decide this proposal, or null. */
function decideProblem(p: ClauseProposal, approver: Signer): string | null {
  if (!canApproveClause(approver.role)) return 'Only a controller or a dev approves a clause.'
  if (p.state !== 'proposed') return 'This change is decided already.'
  return null
}

/**
 * A controller or a dev approves a proposal: it is published as the proposer wrote it. Refused when the clause moved on
 * since it was proposed, so a newer publish is never overwritten: decline it, and the proposer proposes it again.
 */
export function approveProposal(book: ClauseBook, p: ClauseProposal, approver: Signer, ctx: { at: string; newId: () => string; told?: boolean }): DecideResult {
  const no = decideProblem(p, approver)
  if (no) return { kind: 'refused', why: no }
  if (p.paperId !== book.paper.id) return { kind: 'refused', why: `This change is not for ${book.paper.name}.` }
  if (p.clauseId != null) {
    const clause = findClause(book, p.clauseId)
    if (!clause || clause.retiredAt != null) return { kind: 'refused', why: `That clause is retired since ${p.by} proposed this. Decline it with a why.` }
    if (clause.v !== p.baseV) {
      const label = clauseLabel(book.clauses, clause.id)
      return { kind: 'refused', why: `${capitalized(label)} changed since ${p.by} proposed this. Decline it and ask ${p.by} to propose it again.` }
    }
  }
  const change = proposalChange(p)
  const problem = changeProblem(book, change)
  if (problem) return { kind: 'refused', why: problem }
  const done = publishChange(book, change, { name: approver.name, at: ctx.at, why: p.why, newId: ctx.newId })
  return {
    kind: 'decided',
    proposal: { ...p, state: 'approved', decidedBy: approver.name, decidedAt: ctx.at },
    book: done.book,
    change: { ...done.change, proposedBy: p.by },
    toast: approvedToast(approver.name, p.by, p.kind, ctx.told ?? CLAUSE_NOTIFY_LIVE),
  }
}

/** A controller or a dev declines a proposal, with a why the proposer reads on the clause's history, and gets by text once that is live. */
export function declineProposal(p: ClauseProposal, approver: Signer, ctx: { at: string; why: string; told?: boolean }): DecideResult {
  const no = decideProblem(p, approver)
  if (no) return { kind: 'refused', why: no }
  const why = ctx.why.trim()
  if (why === '') return { kind: 'refused', why: `Say why, for ${p.by}.` }
  return {
    kind: 'decided',
    proposal: { ...p, state: 'declined', decidedBy: approver.name, decidedAt: ctx.at, declineWhy: why },
    book: null,
    change: null,
    toast: declinedToast(p.by, ctx.told ?? CLAUSE_NOTIFY_LIVE),
  }
}

/** A proposal's row on an approver's Needs you. */
export interface ClauseNeedRow {
  proposal: ClauseProposal
  /** *Rosa changed clause 2 of the master agreement.* */
  title: string
  badge: string
  /** The row's small facts, each its own piece: who it is for, when, why, who was told. */
  facts: string[]
  /** The words it asks for. */
  words: string
}

/** Who a scope is for, in a sentence's words: *for everyone*, *for Sitework and Paving*. */
export function scopeFor(scope: ClauseScope): string {
  return `for ${andList(scopeWords(scope))}`
}

/** What the proposal asks, as its row's title says it. */
export function proposalTitle(p: ClauseProposal, book: ClauseBook | undefined): string {
  const paper = book?.paper.name ?? 'a paper'
  const label = book && p.clauseId != null ? clauseLabel(book.clauses, p.clauseId) : 'a clause'
  if (p.kind === 'new') return `${p.by} proposed a new clause for ${paper}.`
  if (p.kind === 'retire') return `${p.by} wants to retire ${label} of ${paper}.`
  return `${p.by} changed ${label} of ${paper}.`
}

/**
 * The approver's Needs you rows: every proposal still waiting, the longest waiting first. Nobody else gets the rows, since
 * nobody else can decide them. `when` turns a proposal's time into words.
 */
export function clauseNeeds(
  role: UserRole | null | undefined,
  proposals: readonly ClauseProposal[],
  books: readonly ClauseBook[],
  ctx: { approvers: readonly string[]; when: (at: string) => string; told?: boolean },
): ClauseNeedRow[] {
  if (!canApproveClause(role)) return []
  return proposals
    .filter((p) => p.state === 'proposed')
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .map((p) => {
      const book = books.find((b) => b.paper.id === p.paperId)
      const told = ctx.told ?? CLAUSE_NOTIFY_LIVE
      const facts = [scopeFor(p.scope), ctx.when(p.at), ...(p.why ? [p.why] : []), ...(told ? [`A push and an email went to ${approverWords(ctx.approvers)}.`] : [])]
      return { proposal: p, title: proposalTitle(p, book), badge: 'Waiting on your approval', facts, words: p.en }
    })
}

function capitalized(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
