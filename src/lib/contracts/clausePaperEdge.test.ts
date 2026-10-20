import { describe, expect, it } from 'vitest'
import { PAPER_CHANGED, clauseBetween, clauseFreeze, clausePaperFor, clausePaperOf, clausePaperPair, readClausePaper, readClausePaperPair, readSignedClauses, type ClauseAdmin } from '../../../supabase/functions/_shared/clausePaper'
import { plainWordsFailures } from '../plainWords'

/**
 * The sign paths' clause paper (Messages, cut 4c, v2.5294): `get-contract-for-signer` and `accept-contract` read the
 * paper the database puts together for a copy, and the accept freezes it only at the revision the page showed.
 */
const PAPER = {
  paperId: 'doc-msa',
  revision: 3,
  lang: 'en',
  clauses: [
    { id: 'msa-1', v: 2, n: 1, text: 'Term: one year from signing.' },
    { id: 'msa-2', v: 1, n: 2, text: 'Insurance: $1,000,000 per occurrence.' },
  ],
  exhibit: [{ id: 'msa-6', v: 1, n: 3, text: 'Utilities: a locate before any dig.' }],
  exhibitFor: ['Sitework'],
}

function fakeAdmin(over: { company?: { name: string; trades: string[] } | null; companyError?: boolean; paper?: unknown; paperFor?: (args: Record<string, unknown>) => unknown; rpcError?: boolean; clauseRows?: number; gateError?: boolean } = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const reads: string[] = []
  const admin: ClauseAdmin = {
    from: (table) => ({
      select: (columns) => ({
        eq: (_column, value) => ({
          maybeSingle: () => {
            reads.push(`${table}:${columns}:${value}`)
            return Promise.resolve(over.companyError ? { data: null, error: { message: 'no' } } : { data: over.company ?? null, error: null })
          },
          limit: () => {
            reads.push(`${table}:${columns}:${value}`)
            if (over.gateError) return Promise.resolve({ data: null, error: { message: 'no' } })
            return Promise.resolve({ data: Array.from({ length: over.clauseRows ?? 1 }, (_, i) => ({ id: `c${i}` })), error: null })
          },
        }),
      }),
    }),
    rpc: (fn, args) => {
      calls.push({ fn, args })
      const paper = over.paperFor ? over.paperFor(args) : over.paper === undefined ? PAPER : over.paper
      return Promise.resolve(over.rpcError ? { data: null, error: { message: 'no' } } : { data: paper, error: null })
    },
  }
  return { admin, calls, reads }
}

const DOC = { applied_contract_template_document_id: 'doc-msa', company_id: 'co-hillside', form_template_id: null }

describe('clausePaperFor', () => {
  it('puts a company’s paper together with its trades, in the language asked, with its between line', async () => {
    const { admin, calls, reads } = fakeAdmin({ company: { name: 'Hillside Excavation', trades: ['Sitework'] } })
    const paper = await clausePaperFor(admin, DOC, 'es')
    expect(reads).toEqual(['contract_clauses:id:doc-msa', 'gc_companies:name, trades:co-hillside'])
    expect(calls).toEqual([{ fn: 'contract_paper_clauses', args: { p_paper_id: 'doc-msa', p_trades: ['Sitework'], p_lang: 'es' } }])
    expect(paper).toEqual({ ...PAPER, between: 'Click Construction y Hillside Excavation' })
  })

  it('reads a person’s paper with no trades and no between line', async () => {
    const { admin, calls, reads } = fakeAdmin()
    expect(await clausePaperFor(admin, { ...DOC, company_id: null }, 'en')).toEqual({ ...PAPER, between: null })
    expect(reads).toEqual(['contract_clauses:id:doc-msa'])
    expect(calls[0]?.args.p_trades).toEqual([])
  })

  it('is null for a copy not built from clauses: no library document, a form, nothing published, no clause live', async () => {
    expect(await clausePaperFor(fakeAdmin().admin, { ...DOC, applied_contract_template_document_id: null }, 'en')).toBeNull()
    expect(await clausePaperFor(fakeAdmin().admin, { ...DOC, form_template_id: 'form-w9' }, 'en')).toBeNull()
    expect(await clausePaperFor(fakeAdmin({ paper: { ...PAPER, revision: 0 } }).admin, DOC, 'en')).toBeNull()
    expect(await clausePaperFor(fakeAdmin({ paper: { ...PAPER, clauses: [], exhibit: [] } }).admin, DOC, 'en')).toBeNull()
    expect(await clausePaperFor(fakeAdmin({ paper: { nonsense: true } }).admin, DOC, 'en')).toBeNull()
  })

  it('puts nothing together for a library document with no clauses: one small read and no call', async () => {
    const { admin, calls, reads } = fakeAdmin({ clauseRows: 0 })
    expect(await clausePaperFor(admin, DOC, 'en')).toBeNull()
    expect(reads).toEqual(['contract_clauses:id:doc-msa'])
    expect(calls).toEqual([])
  })

  it('throws when a read fails, so a signing fails closed', async () => {
    await expect(clausePaperFor(fakeAdmin({ gateError: true }).admin, DOC, 'en')).rejects.toThrow()
    await expect(clausePaperFor(fakeAdmin({ rpcError: true }).admin, DOC, 'en')).rejects.toThrow()
    await expect(clausePaperFor(fakeAdmin({ companyError: true }).admin, DOC, 'en')).rejects.toThrow()
  })
})

/**
 * The portals' read (v2.5329): a statement of work built from clauses in the trade's portal, with the exhibit for its
 * package's one trade and the company on the between line; our contract in the customer's, with no trades.
 */
describe('clausePaperOf', () => {
  const SOW = { paperId: 'doc-sow', trades: ['Electrical'], betweenName: 'Sample Electric Co.' }

  it('puts a statement of work’s paper together for its one trade, with the company on the between line', async () => {
    const { admin, calls, reads } = fakeAdmin()
    expect(await clausePaperOf(admin, SOW, 'en')).toEqual({ ...PAPER, between: 'Click Construction and Sample Electric Co.' })
    expect(reads).toEqual(['contract_clauses:id:doc-sow'])
    expect(calls).toEqual([{ fn: 'contract_paper_clauses', args: { p_paper_id: 'doc-sow', p_trades: ['Electrical'], p_lang: 'en' } }])
  })

  it('reads nothing for a copy with no paper, and puts nothing together for a document with no clauses', async () => {
    const none = fakeAdmin()
    expect(await clausePaperOf(none.admin, { ...SOW, paperId: null }, 'en')).toBeNull()
    expect(none.reads).toEqual([])
    const empty = fakeAdmin({ clauseRows: 0 })
    expect(await clausePaperOf(empty.admin, SOW, 'en')).toBeNull()
    expect(empty.reads).toEqual(['contract_clauses:id:doc-sow'])
    expect(empty.calls).toEqual([])
  })

  it('is null when nothing is live, and throws when a read fails', async () => {
    expect(await clausePaperOf(fakeAdmin({ paper: { ...PAPER, clauses: [], exhibit: [] } }).admin, SOW, 'en')).toBeNull()
    await expect(clausePaperOf(fakeAdmin({ gateError: true }).admin, SOW, 'en')).rejects.toThrow()
    await expect(clausePaperOf(fakeAdmin({ rpcError: true }).admin, SOW, 'en')).rejects.toThrow()
  })
})

describe('clausePaperPair', () => {
  const SOW = { paperId: 'doc-sow', trades: ['Electrical'], betweenName: 'Sample Electric Co.' }
  const inLang = (args: Record<string, unknown>) => ({ ...PAPER, lang: args.p_lang })

  it('reads the paper in English and Spanish at one revision, each with its own between line', async () => {
    const pair = await clausePaperPair(fakeAdmin({ paperFor: inLang }).admin, SOW)
    expect(pair?.revision).toBe(3)
    expect(pair?.en).toEqual({ ...PAPER, between: 'Click Construction and Sample Electric Co.' })
    expect(pair?.es).toEqual({ ...PAPER, lang: 'es', between: 'Click Construction y Sample Electric Co.' })
  })

  it('is null when a publish lands between the two reads, or when the paper is not built from clauses', async () => {
    const moved = (args: Record<string, unknown>) => ({ ...inLang(args), revision: args.p_lang === 'es' ? 4 : 3 })
    expect(await clausePaperPair(fakeAdmin({ paperFor: moved }).admin, SOW)).toBeNull()
    expect(await clausePaperPair(fakeAdmin({ clauseRows: 0 }).admin, SOW)).toBeNull()
  })

  it('reads back as the page carries it, and nothing that is not a pair at one revision', () => {
    const en = { ...PAPER, between: 'Click Construction and Sample Electric Co.' }
    const es = { ...PAPER, lang: 'es', between: 'Click Construction y Sample Electric Co.' }
    expect(readClausePaperPair({ revision: 3, en, es })).toEqual({ revision: 3, en, es })
    expect(readClausePaperPair({ revision: 4, en, es })).toBeNull()
    expect(readClausePaperPair({ revision: 3, en, es: en })).toBeNull()
    expect(readClausePaperPair({ revision: 3, en })).toBeNull()
    expect(readClausePaperPair(null)).toBeNull()
    expect(readClausePaperPair('paper')).toBeNull()
  })
})

describe('clauseFreeze', () => {
  const paper = { ...readClausePaper(PAPER)!, between: 'Click Construction and Hillside Excavation' }

  it('signs a paper not built from clauses as before', () => {
    expect(clauseFreeze(null, undefined, 'W-9')).toEqual({ ok: true, update: {} })
  })

  it('refuses a paper that moved on since the page showed it', () => {
    expect(clauseFreeze(paper, 2, 'Master services agreement')).toEqual({ ok: false, error: PAPER_CHANGED, code: 'paper_changed' })
    expect(clauseFreeze(paper, undefined, 'Master services agreement').ok).toBe(false)
    expect(clauseFreeze(paper, '3', 'Master services agreement').ok).toBe(false)
  })

  it('freezes the words, the revision, each clause’s version, the heading and the between line', () => {
    const freeze = clauseFreeze(paper, 3, 'Master services agreement')
    expect(freeze).toEqual({ ok: true, update: { paper_revision: 3, clause_versions: { ...paper, title: 'Master services agreement' } } })
    const kept = freeze.ok ? readSignedClauses(freeze.update.clause_versions) : null
    expect(kept?.title).toBe('Master services agreement')
    expect(kept?.exhibit.map((c) => [c.id, c.v])).toEqual([['msa-6', 1]])
  })

  it('reads nothing from a copy that kept no clauses', () => {
    expect(readSignedClauses(null)).toBeNull()
    expect(readSignedClauses(PAPER)).toBeNull()
  })

  it('says the refusal in plain words', () => {
    expect(plainWordsFailures(PAPER_CHANGED)).toEqual([])
    expect(clauseBetween('  ')).toBeNull()
    expect(clauseBetween('Tejas Power')).toBe('Click Construction and Tejas Power')
  })
})
