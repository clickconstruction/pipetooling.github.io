import { describe, expect, it } from 'vitest'
import { MSA_CLAUSES, clauseLibraryRows } from '../../test/fixtures/clauseBookDemo'
import { plainWordsFailures } from '../plainWords'
import { assemblePaper, settingsView } from './assemble'
import {
  approverNames,
  buildablePapers,
  changeFromRow,
  clauseFromRow,
  clauseHistory,
  clausePaperAnchor,
  clausePaperCards,
  clausePaperHref,
  paperFromRow,
  scopeFromRow,
  scopeToRow,
  tradeChoices,
} from './clauseRows'

const when = (at: string) => at.slice(0, 10)

describe('the rows in the kernels’ types', () => {
  it('reads {all} as everyone and anything else as the trades named', () => {
    expect(scopeFromRow(['all'])).toBe('all')
    expect(scopeFromRow(['Electrical', 'Electrical, low voltage'])).toEqual(['Electrical', 'Electrical, low voltage'])
    expect(scopeToRow('all')).toEqual(['all'])
    expect(scopeToRow(['Sitework'])).toEqual(['Sitework'])
  })

  it('maps a clause row, a change row and a library document', () => {
    const rows = clauseLibraryRows()
    expect(clauseFromRow(rows.clauses[5]!)).toEqual({ id: 'msa-6', order: 6, en: MSA_CLAUSES[5]!.en, es: '', scope: ['Sitework'], v: 1, retiredAt: null, retiredBy: null })
    expect(changeFromRow(rows.proposals[1]!)).toMatchObject({ id: 'p-approved', kind: 'edit', clauseId: 'msa-3', baseV: 1, by: 'Rosa', decidedBy: 'Maria', state: 'approved', resultV: 2, paperRevision: 2 })
    expect(paperFromRow(rows.papers[0]!)).toEqual({ id: 'doc-msa', title: 'Master services agreement', name: 'the Master services agreement', between: 'Click Construction and {company}', revision: 2, publishedAt: '2026-10-12T15:00:00Z' })
  })
})

describe('clausePaperCards', () => {
  it('makes a card per document built from clauses, in the library’s order, with its waiting change', () => {
    const cards = clausePaperCards(clauseLibraryRows())
    expect(cards.map((c) => [c.book.paper.id, c.packet, c.book.clauses.length, c.waiting.map((p) => p.id), c.changes.length])).toEqual([
      ['doc-msa', 'Subs', 8, ['p-waiting'], 3],
      ['doc-sow', 'Subs', 6, [], 0],
    ])
  })

  it('assembles a card’s paper as Greg signs it, on the one numbering', () => {
    const [msa] = clausePaperCards(clauseLibraryRows())
    const paper = assemblePaper(msa!.book.paper, msa!.book.clauses, { company: 'Hillside Excavation', trades: ['Sitework'], job: null, lang: 'en' })
    expect(paper.clauses[2]).toEqual({ id: 'msa-3', v: 2, n: 3, text: 'Payment: net forty-five.' })
    expect(paper.exhibit.map((c) => c.n)).toEqual([6])
    expect(settingsView(msa!.book.clauses).exhibits.map((x) => x.trade)).toEqual(['Electrical', 'Sitework', 'Structural steel'])
  })

  it('shows a paper with only a change waiting on it, so its first clause can be approved', () => {
    const rows = clauseLibraryRows()
    const first = { ...rows.proposals[2]!, id: 'p-first', paper_id: 'doc-safety', kind: 'new' as const, clause_id: null, base_v: null }
    const cards = clausePaperCards({ ...rows, proposals: [...rows.proposals, first] })
    expect(cards.map((c) => c.book.paper.id)).toEqual(['doc-msa', 'doc-sow', 'doc-safety'])
    expect(cards[2]?.book.clauses).toEqual([])
    expect(cards[2]?.waiting.map((p) => p.id)).toEqual(['p-first'])
  })
})

describe('buildablePapers', () => {
  it('offers the library documents not built from clauses yet, leaving the forms out', () => {
    expect(buildablePapers(clauseLibraryRows())).toEqual([{ id: 'doc-safety', label: 'Subs · Safety acknowledgment' }])
  })
})

describe('clauseHistory', () => {
  it('lists a clause’s decided changes, the newest first, each with the version it made', () => {
    const changes = clauseLibraryRows().proposals.map(changeFromRow)
    expect(clauseHistory(changes, 'msa-3', when)).toEqual([
      { id: 'p-approved', title: 'Version 2, proposed by Rosa and approved by Maria.', facts: ['2026-10-11', 'the owner pays late'], words: 'Payment: net forty-five.' },
      { id: 'p-declined', title: 'A change, proposed by Rosa and declined by Maria.', facts: ['2026-10-10', 'why not: the owner pays late'], words: 'Payment: net thirty.' },
    ])
  })

  it('leaves a change still waiting out, and names a dev’s own change and a retire', () => {
    const rows = clauseLibraryRows()
    const changes = rows.proposals.map(changeFromRow)
    expect(clauseHistory(changes, 'msa-2', when)).toEqual([])
    const own = changeFromRow({ ...rows.proposals[1]!, id: 'p-own', by_name: 'Robert', decided_by_name: 'Robert', clause_id: 'msa-4', result_v: 2 })
    const retire = changeFromRow({ ...rows.proposals[1]!, id: 'p-retire', kind: 'retire', by_name: 'Maria', decided_by_name: 'Maria', clause_id: 'msa-5', result_v: 1, why: '' })
    expect(clauseHistory([own], 'msa-4', when)[0]?.title).toBe('Version 2, published by Robert.')
    expect(clauseHistory([retire], 'msa-5', when)[0]).toMatchObject({ title: 'Retired, published by Maria.', facts: ['2026-10-11'] })
  })

  it('says every title in plain words', () => {
    const changes = clauseLibraryRows().proposals.map(changeFromRow)
    for (const l of clauseHistory(changes, 'msa-3', when)) expect(plainWordsFailures(l.title)).toEqual([])
  })
})

describe('the trades and the approvers', () => {
  it('offers every trade the app has, each once in its first spelling, A to Z', () => {
    const clauses = clauseLibraryRows().clauses.map(clauseFromRow)
    expect(tradeChoices(['Sitework', 'Electrical, low voltage', 'sitework '], [['Paving'], ['  structural  steel']], clauses)).toEqual([
      'Electrical',
      'Electrical, low voltage',
      'Paving',
      'Sitework',
      'structural steel',
    ])
  })

  it('names the devs and controllers who approve, A to Z', () => {
    expect(
      approverNames([
        { name: 'Robert', role: 'dev' },
        { name: 'Rosa', role: 'assistant' },
        { name: 'Maria', role: 'controller' },
        { name: '  ', role: 'controller' },
      ]),
    ).toEqual(['Maria', 'Robert'])
  })

  it('links a paper’s card on Settings', () => {
    expect(clausePaperAnchor('doc-msa')).toBe('settings-clause-paper-doc-msa')
    expect(clausePaperHref('doc-msa')).toBe('/settings?tab=settings-clauses#settings-clause-paper-doc-msa')
  })
})
