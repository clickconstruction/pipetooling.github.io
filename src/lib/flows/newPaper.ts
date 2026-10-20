/**
 * A new paper from the flow editor (Messages cut 4, the prototype's v1.177, `newPaperWindow` and `npSave`): one word,
 * paper, for three things. An upload is something they give us: a name, and sometimes a date it runs out. A contract is
 * something we write and they sign: clauses, signers and a version. A notice is something we send to inform: its words
 * and what rides with it. Pure: the draft, what it still needs, the facts that finish the step, and what the office's
 * `flow_paper_create` and cluster 9's `edit_clause` are called with. The paper is the library document's id.
 */
import { andList } from '../contracts/assemble'
import { docFactId, type DocFactId, type DocPaperId, type FlowKind } from './facts'

export type NewPaperKind = 'upload' | 'contract' | 'notice'

export interface NewPaperClause {
  en: string
  es: string
  /** 'all' for the base, else the trades whose exhibit it goes on. */
  scope: string[]
}

export interface NewPaperDraft {
  kind: NewPaperKind | null
  name: string
  nameEs: string
  /** An upload with a date on it: ask for the next one this many days before it runs out. */
  runsOut: boolean
  renewAskDays: number
  /** A contract: its clauses, the base and each trade's exhibit. */
  clauses: NewPaperClause[]
  /** A notice: its words in both languages. */
  bodyEn: string
  bodyEs: string
}

export const RENEW_ASK_DAYS_DEFAULT = 30

export function emptyDraft(): NewPaperDraft {
  return { kind: null, name: '', nameEs: '', runsOut: false, renewAskDays: RENEW_ASK_DAYS_DEFAULT, clauses: [{ en: '', es: '', scope: ['all'] }], bodyEn: '', bodyEs: '' }
}

export const KIND_CARDS: readonly { kind: NewPaperKind; title: string; words: string }[] = [
  { kind: 'upload', title: 'They give it to us', words: 'Their words, their file: a W-9, insurance, a bond, their quote. It has a name and, sometimes, a date it runs out.' },
  { kind: 'contract', title: 'We write it, they sign it', words: 'Our words, their signature: an agreement, a statement of work, a change order. It has clauses, signers and a version.' },
  { kind: 'notice', title: 'We send it to inform', words: 'Our words, no signature: an invitation, a schedule letter, a pay application. It has its words and what rides with it.' },
]

const written = (c: NewPaperClause) => c.en.trim() !== ''

/** What the draft still needs before it saves, in the window's words; empty when it is ready. */
export function newPaperProblems(d: NewPaperDraft): string[] {
  const out: string[] = []
  if (!d.kind) return ['Pick what kind of paper it is.']
  if (!d.name.trim()) out.push('Give it a name.')
  if (d.name.trim().length > 120) out.push('A name holds at most 120 characters.')
  if (d.kind === 'upload' && d.runsOut && !(Number.isInteger(d.renewAskDays) && d.renewAskDays >= 1 && d.renewAskDays <= 365)) out.push('Ask between 1 and 365 days before it runs out.')
  if (d.kind === 'contract' && !d.clauses.some(written)) out.push('A contract needs at least one clause.')
  if (d.kind === 'notice' && !d.bodyEn.trim()) out.push('Write the notice.')
  return out
}

/**
 * The one fact that finishes the step for this paper: an upload on file, or current when it runs out (current is the
 * newest on file with its date ahead, so it holds on file too); a contract signed; a notice sent. One fact a paper, so
 * adding one never changes how the step joins its facts.
 */
export function newPaperFacts(kind: NewPaperKind, runsOut: boolean, docId: string): DocFactId[] {
  if (kind === 'upload') return [docFactId(docId, runsOut ? 'current' : 'on_file')]
  return [docFactId(docId, kind === 'contract' ? 'signed' : 'sent')]
}

/** The column's word and the paper's label: "their bond" reads "Bond". */
export function newPaperLabel(name: string): string {
  const bare = name.trim().replace(/^(their|our|the|a|an) /i, '')
  return bare ? bare[0]!.toUpperCase() + bare.slice(1) : ''
}

/** `flow_paper_create`'s arguments. A contract's words are its clauses, written after, so it sends none. */
export function newPaperCreateArgs(flow: Exclude<FlowKind, 'unknown'>, d: NewPaperDraft & { kind: NewPaperKind }) {
  return {
    p_flow: flow,
    p_kind: d.kind,
    p_name: d.name.trim(),
    p_name_es: d.nameEs.trim(),
    p_renew_ask_days: d.kind === 'upload' && d.runsOut ? d.renewAskDays : null,
    p_body_en: d.kind === 'notice' ? d.bodyEn.trim() : '',
    p_body_es: d.kind === 'notice' ? d.bodyEs.trim() : '',
  }
}

/** Each clause with words, as `edit_clause(paper, 'new', ...)` takes it. */
export function newPaperClauses(d: NewPaperDraft): NewPaperClause[] {
  return d.kind === 'contract' ? d.clauses.filter(written).map((c) => ({ en: c.en.trim(), es: c.es.trim(), scope: c.scope.length ? c.scope : ['all'] })) : []
}

/** The window's Done when line: the fact that finishes the step, in a sentence or two. */
export function newPaperDoneWhen(d: NewPaperDraft, stepName: string): string {
  const name = d.name.trim() || 'The paper'
  const it = name[0]!.toUpperCase() + name.slice(1)
  if (d.kind === 'contract') return `${it} is signed. ${stepName} finishes on the signature.`
  if (d.kind === 'notice') return `${it} went. Sending it finishes ${stepName}, and nothing comes back.`
  const upload = `${it} is on file${d.runsOut ? ' and its date is ahead of today' : ''}.`
  return `${upload} Their upload in the portal, or one we file by hand, finishes ${stepName}.`
}

export interface SavedPaper {
  paperId: DocPaperId
  factIds: DocFactId[]
  label: string
  kind: NewPaperKind
  /** A contract whose clauses wait for a controller or a dev is proposed; anything else is published. */
  state: 'published' | 'proposed'
}

/**
 * What the window says once the paper is saved. `told`: whom `messages-notify` reached about the clauses that wait, and
 * how; null or nobody reached says only that they wait.
 */
export function savedWords(p: SavedPaper, stepName: string, clauses: number, told: { names: readonly string[]; pushSent: number; emailSent: number } | null = null): string {
  if (p.kind === 'contract') {
    const n = `${clauses} ${clauses === 1 ? 'clause' : 'clauses'}`
    if (p.state === 'published') return `${p.label} is published as v1 with ${n}. ${stepName} finishes on the signature.`
    if (!told || (told.pushSent === 0 && told.emailSent === 0)) return `${p.label} is saved with ${n}. They wait for a controller or a dev to approve them.`
    const how = told.pushSent > 0 && told.emailSent > 0 ? 'a push and an email' : told.pushSent > 0 ? 'a push' : 'an email'
    const who = told.names.length ? andList(told.names) : 'The approvers'
    return `${p.label} is saved with ${n}. ${who} got ${how} to approve them.`
  }
  if (p.kind === 'notice') return `${p.label} is a notice now. ${stepName} finishes when it goes.`
  return `${p.label} is a paper now. Their upload finishes ${stepName}.`
}
