import { describe, expect, it } from 'vitest'
import { BILL, GREG, MARIA, MSA, MSA_CLAUSES, PRIYA, SOW, SOW_CLAUSES, CONTRACT, CONTRACT_CLAUSES, TOM, idsFrom } from '../../test/fixtures/clauseBookDemo'
import { plainWordsFailures } from '../plainWords'
import { publishChange } from './approval'
import {
  andList,
  assemblePaper,
  betweenLine,
  clauseLabel,
  clauseText,
  clauseVersionsOf,
  exhibitHeading,
  liveClauses,
  scopeWords,
  settingsView,
  signedCopyOf,
  tradeKey,
  versionLine,
  type AssembleFor,
  type Clause,
} from './assemble'

const forGreg: AssembleFor = { company: GREG.company, trades: GREG.trades, job: null, lang: 'en' }
const texts = (list: { n: number; text: string }[]) => list.map((c) => `${c.n}. ${c.text}`)

describe('assemblePaper: the base plus the trade exhibit', () => {
  it("gives Greg's master agreement the five clauses for everyone, then the Sitework exhibit numbered on from them", () => {
    const paper = assemblePaper(MSA, MSA_CLAUSES, forGreg)
    expect(paper.between).toBe('Click Construction and Hillside Excavation')
    expect(paper.clauses.map((c) => c.n)).toEqual([1, 2, 3, 4, 5])
    expect(texts(paper.exhibit)).toEqual(['6. Utilities: a locate is called in before any dig; spoils go to the yard named on the statement of work.'])
    expect(paper.exhibitFor).toEqual(['Sitework'])
    expect(versionLine(paper)).toBe('Version 1, with the Sitework exhibit.')
    expect(exhibitHeading(paper)).toBe('Exhibit for Sitework')
    expect(paper.problem).toBeNull()
  })

  it("gives Tom the Structural steel exhibit and nobody else's", () => {
    const paper = assemblePaper(MSA, MSA_CLAUSES, { company: TOM.company, trades: TOM.trades, job: null, lang: 'en' })
    expect(paper.exhibit.map((c) => c.id)).toEqual(['msa-8'])
  })

  it('gives Bill no exhibit: Electrical, low voltage inherits nothing from Electrical', () => {
    const paper = assemblePaper(MSA, MSA_CLAUSES, { company: BILL.company, trades: BILL.trades, job: null, lang: 'en' })
    expect(paper.exhibit).toEqual([])
    expect(paper.exhibitFor).toEqual([])
    expect(versionLine(paper)).toBe('Version 1.')
  })

  it('puts a clause on Bill’s paper once the office names his trade on it too', () => {
    const both = MSA_CLAUSES.map((c) => (c.id === 'msa-7' ? { ...c, scope: ['Electrical', 'Electrical, low voltage'] } : c))
    const paper = assemblePaper(MSA, both, { company: BILL.company, trades: BILL.trades, job: null, lang: 'en' })
    expect(paper.exhibit.map((c) => c.id)).toEqual(['msa-7'])
    expect(paper.exhibitFor).toEqual(['Electrical, low voltage'])
  })

  it('matches a trade trimmed and case-blind, on the whole name only', () => {
    expect(assemblePaper(MSA, MSA_CLAUSES, { ...forGreg, trades: ['  sitework '] }).exhibit.map((c) => c.id)).toEqual(['msa-6'])
    expect(assemblePaper(MSA, MSA_CLAUSES, { ...forGreg, trades: ['Site'] }).exhibit).toEqual([])
    expect(assemblePaper(MSA, MSA_CLAUSES, { ...forGreg, trades: ['Electrical, low  voltage'] }).exhibit).toEqual([])
    expect(tradeKey(' Electrical,  Low Voltage ')).toBe('electrical, low voltage')
  })

  it('gives a company with two trades both exhibits on its master agreement, each clause once, in the company’s order', () => {
    const shared = [...MSA_CLAUSES, { ...MSA_CLAUSES[0]!, id: 'msa-9', order: 9, en: 'Both trades: one superintendent of record.', scope: ['Electrical', 'Sitework'] } satisfies Clause]
    const paper = assemblePaper(MSA, shared, { ...forGreg, trades: ['Electrical', 'Sitework'] })
    expect(paper.exhibit.map((c) => [c.id, c.n])).toEqual([
      ['msa-6', 6],
      ['msa-7', 7],
      ['msa-9', 8],
    ])
    expect(paper.exhibitFor).toEqual(['Electrical', 'Sitework'])
    expect(exhibitHeading(paper)).toBe('Exhibit for Electrical and Sitework')
    expect(versionLine(paper)).toBe('Version 1, with the Electrical and Sitework exhibit.')
  })

  it("fills the job on Greg's statement of work and adds its Sitework clause after the job's four", () => {
    const paper = assemblePaper(SOW, SOW_CLAUSES, { ...forGreg, job: 'Stone Oak Pharmacy' })
    expect(paper.between).toBe('Click Construction and Hillside Excavation, for Stone Oak Pharmacy')
    expect(texts(paper.exhibit)).toEqual(['5. Haul-off and dust control are in the scope; rock is a change order.'])
  })

  it('reads a customer’s contract with no exhibit, since a customer has no trade', () => {
    const paper = assemblePaper(CONTRACT, CONTRACT_CLAUSES, { company: PRIYA.company, trades: PRIYA.trades, job: PRIYA.job, lang: 'en' })
    expect(paper.clauses).toHaveLength(5)
    expect(paper.exhibit).toEqual([])
    expect(paper.between).toBe('Click Construction and Helotes Dental Office, for Helotes Dental Office')
  })
})

describe('assemblePaper: what stops a paper going', () => {
  it('holds a statement of work with no job, and drops the job from its between line rather than leave it cut off', () => {
    const paper = assemblePaper(SOW, SOW_CLAUSES, forGreg)
    expect(paper.problem).toBe('Pick the job the statement of work is for.')
    expect(paper.between).toBe('Click Construction and Hillside Excavation')
    expect(betweenLine('Click Construction and {company}, for {job}', 'Tejas Power', 'Boerne Retail Shell')).toBe('Click Construction and Tejas Power, for Boerne Retail Shell')
    expect(betweenLine('Click Construction and {company}', 'Tejas Power', null)).toBe('Click Construction and Tejas Power')
  })

  it('holds a draft paper, which never goes', () => {
    expect(assemblePaper({ ...MSA, revision: 0 }, MSA_CLAUSES, forGreg).problem).toBe('The master agreement is a draft. Publish it before it goes.')
  })

  it('holds a paper with every clause retired', () => {
    const retired = MSA_CLAUSES.map((c) => ({ ...c, retiredAt: '2026-10-12T15:00:00Z', retiredBy: 'Maria' }))
    expect(assemblePaper(MSA, retired, forGreg).problem).toBe('The master agreement has no clauses yet.')
  })
})

describe('the one numbering', () => {
  it('reads the clauses by their order, never by where they sit in the list', () => {
    const shuffled = [...MSA_CLAUSES].reverse()
    expect(assemblePaper(MSA, shuffled, forGreg)).toEqual(assemblePaper(MSA, MSA_CLAUSES, forGreg))
  })

  it('numbers a clause for everyone added after the exhibits with the base, and the exhibit moves on by one', () => {
    const added = [...MSA_CLAUSES, { id: 'msa-9', order: 9, en: 'Notices: by email to the address on file.', es: '', scope: 'all', v: 1, retiredAt: null, retiredBy: null } satisfies Clause]
    const paper = assemblePaper(MSA, added, forGreg)
    expect(paper.clauses.map((c) => [c.id, c.n]).slice(-1)[0]).toEqual(['msa-9', 6])
    expect(paper.exhibit.map((c) => [c.id, c.n])).toEqual([['msa-6', 7]])
    const view = settingsView(added)
    expect(view.base.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6])
    expect(view.exhibits.find((x) => x.trade === 'Sitework')?.rows.map((r) => r.n)).toEqual([7])
  })

  it('closes up the numbers when a clause is retired', () => {
    const retired = MSA_CLAUSES.map((c) => (c.id === 'msa-2' ? { ...c, retiredAt: '2026-10-12T15:00:00Z', retiredBy: 'Maria' } : c))
    const paper = assemblePaper(MSA, retired, forGreg)
    expect(paper.clauses.map((c) => [c.id, c.n])).toEqual([
      ['msa-1', 1],
      ['msa-3', 2],
      ['msa-4', 3],
      ['msa-5', 4],
    ])
    expect(paper.exhibit.map((c) => c.n)).toEqual([5])
    expect(liveClauses(retired).map((c) => c.id)).not.toContain('msa-2')
  })

  it('lays Settings out with the numbers each trade’s paper shows, one exhibit per trade from A to Z', () => {
    const view = settingsView(MSA_CLAUSES)
    expect(view.base.map((r) => [r.clause.id, r.n])).toEqual([
      ['msa-1', 1],
      ['msa-2', 2],
      ['msa-3', 3],
      ['msa-4', 4],
      ['msa-5', 5],
    ])
    expect(view.exhibits.map((x) => [x.trade, x.rows.map((r) => [r.clause.id, r.n])])).toEqual([
      ['Electrical', [['msa-7', 6]]],
      ['Sitework', [['msa-6', 6]]],
      ['Structural steel', [['msa-8', 6]]],
    ])
    for (const x of view.exhibits) {
      const paper = assemblePaper(MSA, MSA_CLAUSES, { ...forGreg, trades: [x.trade] })
      expect(paper.exhibit.map((c) => [c.id, c.n])).toEqual(x.rows.map((r) => [r.clause.id, r.n]))
    }
    expect(view.retired).toEqual([])
  })

  it('keeps retired clauses in Settings, newest first, off every exhibit', () => {
    const retired = MSA_CLAUSES.map((c) =>
      c.id === 'msa-6' ? { ...c, retiredAt: '2026-10-10T15:00:00Z', retiredBy: 'Maria' } : c.id === 'msa-2' ? { ...c, retiredAt: '2026-10-12T15:00:00Z', retiredBy: 'Robert' } : c,
    )
    const view = settingsView(retired)
    expect(view.retired.map((c) => c.id)).toEqual(['msa-2', 'msa-6'])
    expect(view.exhibits.map((x) => x.trade)).toEqual(['Electrical', 'Structural steel'])
  })

  it('names a clause in a sentence by the same numbers', () => {
    const both = MSA_CLAUSES.map((c) => (c.id === 'msa-7' ? { ...c, scope: ['Electrical', 'Electrical, low voltage'] } : c))
    expect(clauseLabel(MSA_CLAUSES, 'msa-2')).toBe('clause 2')
    expect(clauseLabel(MSA_CLAUSES, 'msa-6')).toBe('clause 6 on the Sitework exhibit')
    expect(clauseLabel(both, 'msa-7')).toBe('a clause on the Electrical and Electrical, low voltage exhibits')
    expect(clauseLabel(MSA_CLAUSES.map((c) => ({ ...c, retiredAt: 'x' })), 'msa-2')).toBe('a retired clause')
  })
})

describe('Spanish', () => {
  it('shows a clause’s Spanish where it has one and its English until then', () => {
    const one = MSA_CLAUSES.map((c) => (c.id === 'msa-1' ? { ...c, es: 'Plazo: un año desde la firma.' } : c))
    const paper = assemblePaper(MSA, one, { ...forGreg, lang: 'es' })
    expect(paper.clauses[0]?.text).toBe('Plazo: un año desde la firma.')
    expect(paper.clauses[1]?.text).toBe(MSA_CLAUSES[1]?.en)
    expect(versionLine(paper)).toBe('Versión 1, con el anexo de Sitework.')
    expect(exhibitHeading(paper)).toBe('Anexo de Sitework')
    expect(clauseText({ en: 'English', es: '   ' }, 'es')).toBe('English')
  })

  it('says a list of trades the way each language does', () => {
    expect(andList(['A', 'B', 'C'])).toBe('A, B and C')
    expect(andList(['A', 'B'], 'es')).toBe('A y B')
    expect(andList([])).toBe('')
  })
})

describe('the signed copy', () => {
  it('keeps its words, its revision and each clause’s version after a clause changes and another is retired', () => {
    const newId = idsFrom('clause')
    const signed = signedCopyOf(assemblePaper(MSA, MSA_CLAUSES, forGreg), '2026-10-12T16:00:00Z')
    const before = JSON.parse(JSON.stringify(signed)) as unknown

    const book1 = publishChange({ paper: MSA, clauses: MSA_CLAUSES }, { kind: 'edit', clauseId: 'msa-2', en: 'Insurance: general liability of $2,000,000 per occurrence.', es: '', scope: 'all' }, { name: MARIA.name, at: '2026-10-13T15:00:00Z', why: 'the insurer asked for it', newId })
    const book2 = publishChange(book1.book, { kind: 'retire', clauseId: 'msa-6' }, { name: MARIA.name, at: '2026-10-13T16:00:00Z', why: '', newId })
    const today = assemblePaper(book2.book.paper, book2.book.clauses, forGreg)

    expect(today.revision).toBe(3)
    expect(today.clauses[1]).toEqual({ id: 'msa-2', v: 2, n: 2, text: 'Insurance: general liability of $2,000,000 per occurrence.' })
    expect(today.exhibit).toEqual([])
    expect(JSON.parse(JSON.stringify(signed))).toEqual(before)
    expect(signed.revision).toBe(1)
    expect(signed.clauses[1]?.text).toBe(MSA_CLAUSES[1]?.en)
    expect(signed.exhibit.map((c) => c.id)).toEqual(['msa-6'])
    expect(signed.clauseVersions).toEqual([
      { id: 'msa-1', v: 1 },
      { id: 'msa-2', v: 1 },
      { id: 'msa-3', v: 1 },
      { id: 'msa-4', v: 1 },
      { id: 'msa-5', v: 1 },
      { id: 'msa-6', v: 1 },
    ])
  })

  it('shares nothing with the clauses it came from, so an edit made in place cannot reach it', () => {
    const clauses = MSA_CLAUSES.map((c) => ({ ...c }))
    const paper = assemblePaper(MSA, clauses, forGreg)
    const signed = signedCopyOf(paper, '2026-10-12T16:00:00Z')
    clauses[0]!.en = 'Changed in place.'
    paper.clauses[0]!.text = 'Changed on the paper.'
    expect(signed.clauses[0]?.text).toBe(MSA_CLAUSES[0]?.en)
    expect(Object.isFrozen(signed)).toBe(true)
    expect(Object.isFrozen(signed.clauses[0])).toBe(true)
  })

  it('lists the ids and versions a paper carries, base then exhibit', () => {
    expect(clauseVersionsOf(assemblePaper(SOW, SOW_CLAUSES, { ...forGreg, job: 'Stone Oak Pharmacy' })).map((x) => x.id)).toEqual(['sow-1', 'sow-2', 'sow-3', 'sow-4', 'sow-5'])
  })

  it('refuses to sign a paper that cannot go', () => {
    expect(() => signedCopyOf(assemblePaper(SOW, SOW_CLAUSES, forGreg), '2026-10-12T16:00:00Z')).toThrow(/Pick the job/)
  })
})

describe('plain words', () => {
  it('keeps every sentence the papers add in plain words', () => {
    const sentences = [
      assemblePaper(SOW, SOW_CLAUSES, forGreg).problem,
      assemblePaper({ ...MSA, revision: 0 }, MSA_CLAUSES, forGreg).problem,
      assemblePaper(MSA, [], forGreg).problem,
      versionLine(assemblePaper(MSA, MSA_CLAUSES, forGreg)),
      versionLine(assemblePaper(MSA, MSA_CLAUSES, { ...forGreg, lang: 'es' })),
      exhibitHeading(assemblePaper(MSA, MSA_CLAUSES, forGreg)),
      ...scopeWords('all'),
    ]
    for (const s of sentences) expect(plainWordsFailures(s ?? '')).toEqual([])
  })
})
