// The words of messages-notify (Messages cut 4c, v2.5317): the approvers' push and email when an office edit to a
// contract clause waits for approval, and the editor's email when a controller or a dev decides it. Shared by the
// function and the app (re-exported at src/lib/contracts/clauseNotify.ts), so the two say the same thing. A clause is
// named as Settings numbers it, the same numbering as `clauseLabel` in src/lib/contracts/assemble.ts, and a paper as
// `paperFromRow` names it; src/lib/contracts/clauseNotify.test.ts holds the copies here to those. Pure: no env reads,
// no network.

/** `all`, or the trades whose exhibit the clause is on, as `contract_clauses.scope` keeps them. */
export type NotifyScope = 'all' | readonly string[]

/** A clause of the paper, as the numbering needs it. */
export interface NotifyClause {
  id: string
  order: number
  scope: NotifyScope
  retiredAt: string | null
}

/** A change to a clause, as `contract_clause_proposals` keeps it. */
export interface NotifyChange {
  kind: 'new' | 'edit' | 'retire'
  /** Null for a new clause until it is approved. */
  clauseId: string | null
  en: string
  es: string
  scope: NotifyScope
  /** The proposer's name as the proposal keeps it. */
  by: string
  why: string
}

/** A push and the email that rides with it. */
export interface ClauseProposalNote {
  title: string
  body: string
  url: string
  tag: string
  subject: string
  emailText: string
}

/** The email the editor gets on a decision. */
export interface ClauseDecisionNote {
  subject: string
  emailText: string
  url: string
}

/** A scope as the table keeps it: `{all}`, or the trade names. */
export function notifyScope(scope: readonly string[]): NotifyScope {
  return scope.length === 1 && scope[0] === 'all' ? 'all' : [...scope]
}

/** The paper in a sentence, as Settings and the Needs you row name it. */
export function notifyPaperName(documentName: string): string {
  return `the ${documentName}`
}

/** The Settings link to a paper's card on Contracts and clauses. */
export function notifyPaperHref(paperId: string): string {
  return `/settings?tab=settings-clauses#settings-clause-paper-${paperId}`
}

const tradeKey = (trade: string): string => trade.trim().replace(/\s+/g, ' ').toLowerCase()
const tradesOf = (c: Pick<NotifyClause, 'scope'>): readonly string[] => (c.scope === 'all' ? [] : c.scope)

function andList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * How a sentence names a clause: *clause 2* for one for everyone, *clause 6 on the Sitework exhibit* for one trade's, *a
 * clause on the Electrical and Paving exhibits* for one on several. The base clauses are numbered first, then each
 * trade's exhibit from after them, the trades by name.
 */
export function notifyClauseLabel(clauses: readonly NotifyClause[], clauseId: string): string {
  const live = clauses.filter((c) => c.retiredAt == null).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  const base = live.filter((c) => c.scope === 'all')
  const inBase = base.findIndex((c) => c.id === clauseId)
  if (inBase >= 0) return `clause ${inBase + 1}`
  const spelled = new Map<string, string>()
  for (const c of live) for (const t of tradesOf(c)) if (!spelled.has(tradeKey(t))) spelled.set(tradeKey(t), t.trim())
  const on = [...spelled.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, trade]) => {
      const n = live.filter((c) => tradesOf(c).some((t) => tradeKey(t) === key)).findIndex((c) => c.id === clauseId)
      return n >= 0 ? [{ trade, n: base.length + 1 + n }] : []
    })
  const first = on[0]
  if (on.length === 1 && first) return `clause ${first.n} on the ${first.trade} exhibit`
  if (on.length > 1) return `a clause on the ${andList(on.map((x) => x.trade))} exhibits`
  return 'a retired clause'
}

/** What a change asks, as its Needs you row's title says it (`proposalTitle` in src/lib/contracts/approval.ts). */
export function notifyChangeTitle(c: NotifyChange, paper: string, clauses: readonly NotifyClause[]): string {
  const label = c.clauseId != null ? notifyClauseLabel(clauses, c.clauseId) : 'a clause'
  if (c.kind === 'new') return `${c.by} proposed a new clause for ${paper}.`
  if (c.kind === 'retire') return `${c.by} wants to retire ${label} of ${paper}.`
  return `${c.by} changed ${label} of ${paper}.`
}

/** The first words of a clause, for a push: up to eight words, with an ellipsis when it goes on. */
export function firstWords(text: string, max = 8): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length <= max ? words.join(' ') : `${words.slice(0, max).join(' ')}…`
}

const scopeLine = (scope: NotifyScope): string => (scope === 'all' ? 'For everyone.' : `For ${andList([...scope])}.`)

/** One change in the email: what it asks, who it is for, its words in both languages, and the why. */
function changeBlock(c: NotifyChange, paper: string, clauses: readonly NotifyClause[]): string {
  const lines = [notifyChangeTitle(c, paper, clauses), scopeLine(c.scope)]
  if (c.kind === 'retire') lines.push(`It reads now: ${c.en.trim()}`)
  else {
    lines.push(`The words: ${c.en.trim()}`)
    if (c.es.trim()) lines.push(`In Spanish: ${c.es.trim()}`)
  }
  if (c.why.trim()) lines.push(`Why: ${c.why.trim()}`)
  return lines.join('\n')
}

/**
 * The approvers' push and email for the changes one person sent for approval in one save, on one paper. One change
 * names its clause and its first words; several are counted, the way the New paper window's clauses arrive together.
 */
export function clauseProposalNote(input: { paperId: string; documentName: string; clauses: readonly NotifyClause[]; changes: readonly NotifyChange[] }): ClauseProposalNote {
  const paper = notifyPaperName(input.documentName)
  const [one] = input.changes
  const n = input.changes.length
  const by = one?.by ?? 'Someone'
  const allNew = input.changes.every((c) => c.kind === 'new')
  const body =
    n === 1 && one
      ? `${notifyChangeTitle(one, paper, input.clauses).replace(/\.$/, '')}: “${firstWords(one.en)}”`
      : allNew
        ? `${by} proposed ${n} new clauses for ${paper}.`
        : `${by} proposed ${n} changes to ${paper}.`
  const subject = `${n === 1 ? 'Approve a clause change' : `Approve ${n} clause changes`} · ${input.documentName}`
  const blocks = input.changes.map((c) => changeBlock(c, paper, input.clauses))
  const close = n === 1 ? 'Open Contracts and clauses to approve it, or to decline it with a why.' : 'Open Contracts and clauses to approve each one, or to decline it with a why.'
  return {
    title: n === 1 ? 'Approve a clause change' : `Approve ${n} clause changes`,
    body,
    url: notifyPaperHref(input.paperId),
    tag: `clause-proposal-${input.paperId}`,
    subject,
    emailText: [...blocks, close].join('\n\n'),
  }
}

/**
 * The editor's email once a controller or a dev decides their change: approved, it is the clause's next version and the
 * next paper sent carries it; declined, with the decider's why. The text by phone comes with Quo (cut 5).
 */
export function clauseDecisionNote(input: {
  paperId: string
  documentName: string
  clauses: readonly NotifyClause[]
  change: NotifyChange
  decider: string
  state: 'approved' | 'declined'
  declineWhy: string | null
  resultV: number | null
}): ClauseDecisionNote {
  const paper = notifyPaperName(input.documentName)
  const c = input.change
  const label = c.clauseId != null ? notifyClauseLabel(input.clauses, c.clauseId) : 'a clause'
  const what = c.kind === 'new' ? `your new clause for ${paper}` : c.kind === 'retire' ? `retiring ${label} of ${paper}` : `your change to ${label} of ${paper}`
  const url = notifyPaperHref(input.paperId)
  if (input.state === 'approved') {
    const carries =
      c.kind === 'retire'
        ? 'The next paper sent leaves it out. Signed copies keep it.'
        : `${input.resultV != null ? `It is version ${input.resultV} of ${c.kind === 'new' ? 'the clause' : label}. ` : ''}The next paper sent carries it. Signed copies keep their words.`
    return { subject: `Approved · ${input.documentName}`, emailText: [`${input.decider} approved ${what}.`, carries].join('\n\n'), url }
  }
  return {
    subject: `Declined · ${input.documentName}`,
    emailText: [`${input.decider} declined ${what}.`, `Why: ${(input.declineWhy ?? '').trim()}`, 'Your words stay on the clause’s history. Change them and send them again when you are ready.'].join('\n\n'),
    url,
  }
}
