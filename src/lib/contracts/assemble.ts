/**
 * Messages, cut 4c: contracts from clauses (the Messages prototype v1.178, `paperDoc` and `CLAUSES`; `BUILD_PLAN.md` →
 * *Cut 4c*). A contract paper is an ordered set of clauses. A clause covers everyone or the trades the office named on it,
 * and keeps its own version. At send time the paper for this company on this job is the base clauses plus the exhibit for
 * the company's trades, with the job's fields filled. The signed copy freezes the words, the paper's revision and each
 * clause's id and version, so a later change never reaches a paper already signed.
 *
 * What changed from the prototype, and why:
 * - The paper's version is a revision counter, one up on every publish (`approval.ts`). The prototype read the highest
 *   clause version, so two different texts could both read v2 and a new clause never moved it.
 * - A clause is known by its id and placed by `order`, never by its place in an array.
 * - A clause's scope is `'all'` or a list of trade names, matched trimmed and case-blind on whole names. Nothing inherits:
 *   a clause for Electrical is not on an Electrical, low voltage exhibit unless the office named that trade too.
 * - A retired clause leaves the next assembly and stays on every signed copy that carried it. Nothing is deleted.
 * - One numbering: the base clauses 1 to n, then the exhibit from n + 1, the same in Settings and on the sign page.
 * - Spanish: a clause with no Spanish shows its English on the Spanish page until it has one.
 *
 * Pure: the screens read the rows, this decides what the paper says.
 */
import type { EsignLang } from '../esignConsent'

/** Everyone, or the trades the office named on the clause. */
export type ClauseScope = 'all' | readonly string[]

/** One clause of a paper, as `contract_clauses` keeps it. */
export interface Clause {
  id: string
  /** Its place on the paper. The base clauses read in this order, then the exhibit in this order. */
  order: number
  en: string
  /** Empty until someone writes it. The Spanish page shows the English meanwhile. */
  es: string
  scope: ClauseScope
  /** Its own version: 1 when first published, one up each time its words or its scope change. */
  v: number
  /** Set when it was retired. It leaves the next paper and stays on every signed copy that carried it. */
  retiredAt: string | null
  retiredBy: string | null
}

/** A contract paper the clauses hang on: the Contract library's document, in Form Studio's frame. */
export interface ContractPaper {
  id: string
  /** The heading on the page, e.g. *Master services agreement*. */
  title: string
  /** The paper in a sentence, e.g. *the master agreement*. */
  name: string
  /** Between whom, with `{company}` and `{job}` filled when it goes. */
  between: string
  /** One up on every publish. 0 is a draft, which never goes. */
  revision: number
  /** When the newest revision was published. */
  publishedAt: string | null
}

/** Who a paper is assembled for. */
export interface AssembleFor {
  /** The company's name, or the person's when there is no company. */
  company: string
  /** Every trade the company has with us for a master agreement, or the statement of work's one trade. */
  trades: readonly string[]
  /** The job's name. Null on a paper that is for no job. */
  job: string | null
  lang: EsignLang
}

/** A clause as it reads on one paper: its number there, its words in the paper's language, its id and version. */
export interface AssembledClause {
  id: string
  v: number
  n: number
  text: string
}

/** The paper as it goes to one company. */
export interface AssembledPaper {
  paperId: string
  title: string
  between: string
  revision: number
  lang: EsignLang
  /** The clauses for everyone, numbered from 1. */
  clauses: AssembledClause[]
  /** The clauses for the company's trades, numbered on from the base. */
  exhibit: AssembledClause[]
  /** The company's trades the exhibit carries, in the company's own spelling. */
  exhibitFor: string[]
  /** Why it cannot go yet, in words for the office. Null when it can. */
  problem: string | null
}

/** A clause's id and version as the signed copy keeps them (`clause_versions`). */
export interface ClauseVersion {
  id: string
  v: number
}

/** A signed paper: the words, the revision and each clause's version, frozen when it was signed. */
export interface SignedCopy extends Readonly<Omit<AssembledPaper, 'problem' | 'clauses' | 'exhibit' | 'exhibitFor'>> {
  readonly clauses: readonly Readonly<AssembledClause>[]
  readonly exhibit: readonly Readonly<AssembledClause>[]
  readonly exhibitFor: readonly string[]
  readonly clauseVersions: readonly Readonly<ClauseVersion>[]
  readonly signedAt: string
}

/** A trade name as two spellings of it compare: trimmed, spaces collapsed, case-blind. */
export function tradeKey(trade: string): string {
  return trade.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** True when the clause covers everyone. */
export function isBaseClause(clause: Pick<Clause, 'scope'>): boolean {
  return clause.scope === 'all'
}

/** The trades a clause covers, empty for everyone. */
export function clauseTrades(clause: Pick<Clause, 'scope'>): readonly string[] {
  return clause.scope === 'all' ? [] : clause.scope
}

/** True when the clause is on the exhibit for any of these trades. */
export function clauseCoversAny(clause: Pick<Clause, 'scope'>, trades: readonly string[]): boolean {
  const keys = new Set(trades.map(tradeKey))
  return clauseTrades(clause).some((t) => keys.has(tradeKey(t)))
}

const byOrder = (a: Clause, b: Clause): number => a.order - b.order || a.id.localeCompare(b.id)

/** The clauses the next paper carries, in order: none retired. */
export function liveClauses(clauses: readonly Clause[]): Clause[] {
  return clauses.filter((c) => c.retiredAt == null).sort(byOrder)
}

/** A clause's words in the paper's language, the English while the Spanish is empty. */
export function clauseText(clause: Pick<Clause, 'en' | 'es'>, lang: EsignLang): string {
  const es = clause.es.trim()
  return lang === 'es' && es !== '' ? es : clause.en.trim()
}

/** Names in a list, the way a sentence says them: *Sitework*, *Sitework and Paving*, *A, B and C*. */
export function andList(names: readonly string[], lang: EsignLang = 'en'): string {
  const and = lang === 'es' ? ' y ' : ' and '
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')}${and}${names[names.length - 1]}`
}

/** The company's trades a set of exhibit clauses names, in the company's own order and spelling. */
function tradesCarried(exhibit: readonly Clause[], trades: readonly string[]): string[] {
  const named = new Set(exhibit.flatMap((c) => clauseTrades(c).map(tradeKey)))
  const seen = new Set<string>()
  return trades.filter((t) => {
    const k = tradeKey(t)
    if (!named.has(k) || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * The paper for one company: the base clauses for everyone, then the exhibit for its trades, each clause once, numbered
 * on from the base. `{company}` and `{job}` in the paper's between line are filled. A draft paper, or one that needs a job
 * and has none, carries its `problem` and does not go.
 */
export function assemblePaper(paper: ContractPaper, clauses: readonly Clause[], forWhom: AssembleFor): AssembledPaper {
  const live = liveClauses(clauses)
  const base = live.filter(isBaseClause)
  const exhibit = live.filter((c) => !isBaseClause(c) && clauseCoversAny(c, forWhom.trades))
  const numbered = (list: readonly Clause[], from: number): AssembledClause[] =>
    list.map((c, i) => ({ id: c.id, v: c.v, n: from + i, text: clauseText(c, forWhom.lang) }))
  const needsJob = paper.between.includes('{job}')
  const problem =
    paper.revision < 1
      ? `${capitalized(paper.name)} is a draft. Publish it before it goes.`
      : needsJob && !forWhom.job
        ? `Pick the job ${paper.name} is for.`
        : live.length === 0
          ? `${capitalized(paper.name)} has no clauses yet.`
          : null
  return {
    paperId: paper.id,
    title: paper.title,
    between: betweenLine(paper.between, forWhom.company, forWhom.job),
    revision: paper.revision,
    lang: forWhom.lang,
    clauses: numbered(base, 1),
    exhibit: numbered(exhibit, base.length + 1),
    exhibitFor: tradesCarried(exhibit, forWhom.trades),
    problem,
  }
}

/**
 * The between line with its fields filled. With no job the job's piece goes, *, for {job}* and all, so a paper held for its
 * missing job never reads with a sentence cut off.
 */
export function betweenLine(between: string, company: string, job: string | null): string {
  const withJob = job ? between.replace(/\{job\}/g, job) : between.replace(/,?\s*\bfor \{job\}/g, '').replace(/\{job\}/g, '')
  return withJob.replace(/\{company\}/g, company).replace(/\s{2,}/g, ' ').trim()
}

/** The paper's version line under the clauses: *Version 3, with the Sitework exhibit.* */
export function versionLine(paper: Pick<AssembledPaper, 'revision' | 'exhibit' | 'exhibitFor' | 'lang'>): string {
  const es = paper.lang === 'es'
  const head = es ? `Versión ${paper.revision}` : `Version ${paper.revision}`
  if (paper.exhibit.length === 0) return `${head}.`
  const trades = andList(paper.exhibitFor, paper.lang)
  return es ? `${head}, con el anexo de ${trades}.` : `${head}, with the ${trades} exhibit.`
}

/** The exhibit's heading on the page: *Exhibit for Sitework*. */
export function exhibitHeading(paper: Pick<AssembledPaper, 'exhibitFor' | 'lang'>): string {
  const trades = andList(paper.exhibitFor, paper.lang)
  return paper.lang === 'es' ? `Anexo de ${trades}` : `Exhibit for ${trades}`
}

/** A clause's scope as its pills read: *everyone*, or each trade named. */
export function scopeWords(scope: ClauseScope): string[] {
  return scope === 'all' ? ['everyone'] : [...scope]
}

/** The ids and versions a paper carries, for the signed copy's `clause_versions`. */
export function clauseVersionsOf(paper: Pick<AssembledPaper, 'clauses' | 'exhibit'>): ClauseVersion[] {
  return [...paper.clauses, ...paper.exhibit].map((c) => ({ id: c.id, v: c.v }))
}

/**
 * The signed copy: the paper as it read when it was signed, frozen. It shares nothing with the clauses it came from, so a
 * clause changed, retired or edited in place later leaves it as it was.
 */
export function signedCopyOf(paper: AssembledPaper, signedAt: string): SignedCopy {
  if (paper.problem) throw new Error(`A paper that cannot go cannot be signed: ${paper.problem}`)
  const freezeClause = (c: AssembledClause): Readonly<AssembledClause> => Object.freeze({ id: c.id, v: c.v, n: c.n, text: c.text })
  return Object.freeze({
    paperId: paper.paperId,
    title: paper.title,
    between: paper.between,
    revision: paper.revision,
    lang: paper.lang,
    clauses: Object.freeze(paper.clauses.map(freezeClause)),
    exhibit: Object.freeze(paper.exhibit.map(freezeClause)),
    exhibitFor: Object.freeze([...paper.exhibitFor]),
    clauseVersions: Object.freeze(clauseVersionsOf(paper).map((x) => Object.freeze(x))),
    signedAt,
  })
}

/** One trade's exhibit in Settings: the clauses numbered as that trade's paper numbers them. */
export interface SettingsExhibit {
  trade: string
  rows: { clause: Clause; n: number }[]
}

/** A paper's card in Settings → Contracts and clauses. */
export interface SettingsView {
  /** The clauses for everyone, numbered as every paper numbers them. */
  base: { clause: Clause; n: number }[]
  /** One exhibit per trade any clause names, A to Z. A clause for two trades shows under both. */
  exhibits: SettingsExhibit[]
  /** Retired clauses, newest first, kept for the signed copies that carry them. */
  retired: Clause[]
}

/**
 * The paper as Settings lays it out, with the one numbering: a base clause has the number it has on every paper, and an
 * exhibit clause the number it has on that trade's paper.
 */
export function settingsView(clauses: readonly Clause[]): SettingsView {
  const live = liveClauses(clauses)
  const base = live.filter(isBaseClause)
  const spelled = new Map<string, string>()
  for (const c of live) for (const t of clauseTrades(c)) if (!spelled.has(tradeKey(t))) spelled.set(tradeKey(t), t.trim())
  const exhibits = [...spelled.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, trade]) => ({
      trade,
      rows: live
        .filter((c) => clauseTrades(c).some((t) => tradeKey(t) === key))
        .map((clause, i) => ({ clause, n: base.length + 1 + i })),
    }))
  const retired = clauses
    .filter((c) => c.retiredAt != null)
    .sort((a, b) => (b.retiredAt ?? '').localeCompare(a.retiredAt ?? '') || byOrder(a, b))
  return { base: base.map((clause, i) => ({ clause, n: i + 1 })), exhibits, retired }
}

/**
 * How a sentence names a clause: *clause 2* for one for everyone, *clause 6 on the Sitework exhibit* for one trade's,
 * *a clause on the Electrical and Paving exhibits* for one that sits on several, where its number differs by trade.
 */
export function clauseLabel(clauses: readonly Clause[], clauseId: string): string {
  const view = settingsView(clauses)
  const inBase = view.base.find((r) => r.clause.id === clauseId)
  if (inBase) return `clause ${inBase.n}`
  const on = view.exhibits.flatMap((x) => x.rows.filter((r) => r.clause.id === clauseId).map((r) => ({ trade: x.trade, n: r.n })))
  const first = on[0]
  if (on.length === 1 && first) return `clause ${first.n} on the ${first.trade} exhibit`
  if (on.length > 1) return `a clause on the ${andList(on.map((x) => x.trade))} exhibits`
  return 'a retired clause'
}

function capitalized(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
