import { describe, expect, it } from 'vitest'
import { PAPER_CHANGED, clauseBetween, clauseFreeze, clausePaperFor, readClausePaper, readSignedClauses, type ClauseAdmin } from '../../../supabase/functions/_shared/clausePaper'
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

function fakeAdmin(over: { company?: { name: string; trades: string[] } | null; companyError?: boolean; paper?: unknown; rpcError?: boolean } = {}) {
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
        }),
      }),
    }),
    rpc: (fn, args) => {
      calls.push({ fn, args })
      return Promise.resolve(over.rpcError ? { data: null, error: { message: 'no' } } : { data: over.paper === undefined ? PAPER : over.paper, error: null })
    },
  }
  return { admin, calls, reads }
}

const DOC = { applied_contract_template_document_id: 'doc-msa', company_id: 'co-hillside', form_template_id: null }

describe('clausePaperFor', () => {
  it('puts a company’s paper together with its trades, in the language asked, with its between line', async () => {
    const { admin, calls, reads } = fakeAdmin({ company: { name: 'Hillside Excavation', trades: ['Sitework'] } })
    const paper = await clausePaperFor(admin, DOC, 'es')
    expect(reads).toEqual(['gc_companies:name, trades:co-hillside'])
    expect(calls).toEqual([{ fn: 'contract_paper_clauses', args: { p_paper_id: 'doc-msa', p_trades: ['Sitework'], p_lang: 'es' } }])
    expect(paper).toEqual({ ...PAPER, between: 'Click Construction y Hillside Excavation' })
  })

  it('reads a person’s paper with no trades and no between line', async () => {
    const { admin, calls, reads } = fakeAdmin()
    expect(await clausePaperFor(admin, { ...DOC, company_id: null }, 'en')).toEqual({ ...PAPER, between: null })
    expect(reads).toEqual([])
    expect(calls[0]?.args.p_trades).toEqual([])
  })

  it('is null for a copy not built from clauses: no library document, a form, nothing published, no clause live', async () => {
    expect(await clausePaperFor(fakeAdmin().admin, { ...DOC, applied_contract_template_document_id: null }, 'en')).toBeNull()
    expect(await clausePaperFor(fakeAdmin().admin, { ...DOC, form_template_id: 'form-w9' }, 'en')).toBeNull()
    expect(await clausePaperFor(fakeAdmin({ paper: { ...PAPER, revision: 0 } }).admin, DOC, 'en')).toBeNull()
    expect(await clausePaperFor(fakeAdmin({ paper: { ...PAPER, clauses: [], exhibit: [] } }).admin, DOC, 'en')).toBeNull()
    expect(await clausePaperFor(fakeAdmin({ paper: { nonsense: true } }).admin, DOC, 'en')).toBeNull()
  })

  it('throws when a read fails, so a signing fails closed', async () => {
    await expect(clausePaperFor(fakeAdmin({ rpcError: true }).admin, DOC, 'en')).rejects.toThrow()
    await expect(clausePaperFor(fakeAdmin({ companyError: true }).admin, DOC, 'en')).rejects.toThrow()
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
