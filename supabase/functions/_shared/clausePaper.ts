/**
 * Messages, cut 4c, the sign page (v2.5294): a copy whose library document is built from clauses is read and signed as
 * its clauses. `contract_paper_clauses` (`20261012150000_contract_clauses.sql`) puts the paper together for the copy's
 * company and language: the clauses for everyone, then the exhibit for the company's trades, numbered once.
 * `get-contract-for-signer` sends it to the page in English and Spanish with its revision. `accept-contract` reads it
 * again and signs only when the revision is the one the page showed, then freezes it on the copy as `clause_versions`,
 * with the revision as `paper_revision`. A trigger keeps them as signed.
 *
 * No imports, so the app's tests import it as the functions do.
 */

export type ClausePaperLang = 'en' | 'es'

export interface ClauseLine {
  id: string
  v: number
  n: number
  text: string
}

/** The paper as the database put it together for one copy, with the between line its company reads. */
export interface ClausePaperJson {
  paperId: string
  revision: number
  lang: ClausePaperLang
  clauses: ClauseLine[]
  exhibit: ClauseLine[]
  exhibitFor: string[]
  /** *Click Construction and Hillside Excavation* on a company's paper, *y* in Spanish; null on a person's, which draws none. */
  between: string | null
}

/** What the signed copy keeps: the paper as it read when signed, with its heading. */
export interface SignedClauses extends ClausePaperJson {
  title: string
}

/** What the accept says when the paper moved on after the page was opened. */
export const PAPER_CHANGED = 'The paper changed since you opened it. Reload to read the new version.'

/** A copy whose paper may be built from clauses. */
export interface ClauseDoc {
  applied_contract_template_document_id: string | null
  company_id: string | null
  form_template_id: string | null
}

type Result = PromiseLike<{ data: unknown; error: unknown }>

/** The few calls this needs from the service-role client. */
export interface ClauseAdmin {
  from(table: string): { select(columns: string): { eq(column: string, value: string): { maybeSingle(): Result; limit(count: number): Result } } }
  rpc(fn: string, args: Record<string, unknown>): Result
}

const isLine = (x: unknown): x is ClauseLine => {
  const o = x as Partial<ClauseLine> | null
  return !!o && typeof o.id === 'string' && typeof o.v === 'number' && typeof o.n === 'number' && typeof o.text === 'string'
}

/** The paper from its JSON (the database's, or a signed copy's), or null when it is not a paper's shape. */
export function readClausePaper(json: unknown): ClausePaperJson | null {
  const o = json as Partial<ClausePaperJson> | null
  if (!o || typeof o !== 'object') return null
  if (typeof o.paperId !== 'string' || typeof o.revision !== 'number' || (o.lang !== 'en' && o.lang !== 'es')) return null
  if (!Array.isArray(o.clauses) || !Array.isArray(o.exhibit) || !Array.isArray(o.exhibitFor)) return null
  if (!o.clauses.every(isLine) || !o.exhibit.every(isLine) || !o.exhibitFor.every((t) => typeof t === 'string')) return null
  const between = typeof o.between === 'string' && o.between.trim() ? o.between : null
  return { paperId: o.paperId, revision: o.revision, lang: o.lang, clauses: o.clauses, exhibit: o.exhibit, exhibitFor: o.exhibitFor, between }
}

/** A signed copy's `clause_versions`, or null when the copy kept none. */
export function readSignedClauses(json: unknown): SignedClauses | null {
  const paper = readClausePaper(json)
  const title = (json as { title?: unknown } | null)?.title
  return paper && typeof title === 'string' ? { ...paper, title } : null
}

/**
 * The paper as it reads today for this copy, in this language. Null when the copy is not built from clauses: no library
 * document, a fillable form, nothing published yet, or no clause live. A read that fails throws, so a signing fails closed
 * rather than freezing nothing.
 */
export async function clausePaperFor(admin: ClauseAdmin, doc: ClauseDoc, lang: ClausePaperLang): Promise<ClausePaperJson | null> {
  const paperId = doc.applied_contract_template_document_id
  if (!paperId || doc.form_template_id) return null
  // Most library documents have no clauses: one small read settles it, and nothing more runs for them.
  const any = await admin.from('contract_clauses').select('id').eq('paper_id', paperId).limit(1)
  if (any.error) throw new Error('could not read the clauses')
  if (!Array.isArray(any.data) || any.data.length === 0) return null
  let trades: string[] = []
  let companyName: string | null = null
  if (doc.company_id) {
    const company = await admin.from('gc_companies').select('name, trades').eq('id', doc.company_id).maybeSingle()
    if (company.error) throw new Error('could not read the company')
    const c = company.data as { name?: unknown; trades?: unknown } | null
    trades = Array.isArray(c?.trades) ? c.trades.filter((x): x is string => typeof x === 'string') : []
    companyName = typeof c?.name === 'string' ? c.name : null
  }
  const res = await admin.rpc('contract_paper_clauses', { p_paper_id: paperId, p_trades: trades, p_lang: lang })
  if (res.error) throw new Error('could not put the paper together')
  const paper = readClausePaper(res.data)
  if (!paper || paper.revision < 1 || paper.clauses.length + paper.exhibit.length === 0) return null
  return { ...paper, between: clauseBetween(companyName, lang) }
}

/**
 * The accept's check. A paper not built from clauses signs as before. A paper built from clauses signs only at the
 * revision the page showed, and the update freezes what was signed.
 */
export function clauseFreeze(paper: ClausePaperJson | null, shownRevision: unknown, title: string): { ok: true; update: Record<string, unknown> } | { ok: false; error: string; code: 'paper_changed' } {
  if (!paper) return { ok: true, update: {} }
  if (shownRevision !== paper.revision) return { ok: false, error: PAPER_CHANGED, code: 'paper_changed' }
  const kept: SignedClauses = { ...paper, title }
  return { ok: true, update: { paper_revision: paper.revision, clause_versions: kept } }
}

/** The between line on a company's paper, the GC frame's, in the paper's language; null for a person's, which draws none. */
export function clauseBetween(companyName: string | null, lang: ClausePaperLang = 'en'): string | null {
  const name = (companyName ?? '').trim()
  return name ? `Click Construction ${lang === 'es' ? 'y' : 'and'} ${name}` : null
}
