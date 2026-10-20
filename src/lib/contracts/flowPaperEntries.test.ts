import { describe, expect, it } from 'vitest'
import { contractEditAction, contractSourceLine, resolveContractTexts, type ContractCatalogData } from './customerContractCatalog'
import { contractSourceRef } from './contractTextHistory'
import { flowClauseText, flowPaperEntries, flowPaperEntryId, type FlowPaperClause, type FlowPaperDoc } from './flowPaperEntries'

const EMPTY: ContractCatalogData = { settings: new Map(), bookDocs: [] }

const BOND = '00000000-0000-0000-0000-0000000f1b01'
const SAFETY = '00000000-0000-0000-0000-0000000f1b02'
const START = '00000000-0000-0000-0000-0000000f1b03'
const WARRANTY = '00000000-0000-0000-0000-0000000f1b04'

const doc = (over: Partial<FlowPaperDoc> & Pick<FlowPaperDoc, 'id' | 'document_name' | 'flow_kind'>): FlowPaperDoc => ({
  name_es: null,
  audience: 'customer',
  renew_ask_days: null,
  book_body_html: null,
  book_body_es: null,
  book_body_format: 'plain',
  book_version_date: '2026-10-12',
  updated_at: '2026-10-12T15:00:00Z',
  revision: null,
  ...over,
})

const DOCS: FlowPaperDoc[] = [
  doc({ id: START, document_name: 'Start letter', name_es: 'Carta de inicio', flow_kind: 'notice', book_body_html: 'We start on Monday.', book_body_es: 'Empezamos el lunes.' }),
  doc({ id: SAFETY, document_name: 'Site safety agreement', flow_kind: 'contract', revision: 1 }),
  doc({ id: BOND, document_name: 'Bond', name_es: 'Fianza', flow_kind: 'upload', audience: 'sub', renew_ask_days: 45 }),
  doc({ id: WARRANTY, document_name: 'Warranty', name_es: 'warranty', flow_kind: 'contract' }),
]
const CLAUSES: FlowPaperClause[] = [
  { paper_id: SAFETY, sequence_order: 1, text_en: 'Call in a locate before digging.', text_es: '', scope: ['Sitework'] },
  { paper_id: SAFETY, sequence_order: 0, text_en: 'Keep the site gate closed.', text_es: 'Mantenga cerrada la puerta.', scope: ['all'] },
]

const entries = flowPaperEntries(DOCS, CLAUSES)
const byId = (id: string) => entries.find((e) => e.id === flowPaperEntryId(id))!

describe('flowPaperEntries', () => {
  it('makes a line per paper on the flows, the trade partners first, then by name, and none for a row with no kind', () => {
    expect(entries.map((e) => e.name)).toEqual(['Bond · Fianza', 'Site safety agreement', 'Start letter · Carta de inicio', 'Warranty'])
    expect(entries.every((e) => e.area === 'flows' && e.seenOn.length === 0)).toBe(true)
    expect(byId(BOND).id).toBe(`flow-paper-${BOND}`)
    expect(flowPaperEntries([{ ...DOCS[0]!, flow_kind: undefined as never }, { ...DOCS[0]!, id: 'x', flow_kind: 'constructor' as never }], [])).toEqual([])
  })

  it('reads an upload as their paper, with the days it asks ahead when it runs out', () => {
    const bond = byId(BOND)
    expect(bond).toMatchObject({ group: 'theirs', audience: 'trade', copyKept: 'Their file, one for each person, on their papers.' })
    expect(bond.what).toContain('the trade partner gives us')
    expect(bond.what).toContain('also needs its date ahead of today')
    expect(bond.customerAction).toBe('Uploads it on their page, or the office files it by hand. We ask for the next one 45 days before it runs out.')
    expect(resolveContractTexts(bond, EMPTY)).toMatchObject([{ key: bond.id, title: 'Bond · Fianza', text: '', status: 'theirs', versionLabel: null, doc: { id: BOND } }])
    const kept = flowPaperEntries([{ ...DOCS[2]!, renew_ask_days: null }], [])[0]!
    expect(kept.customerAction).toBe('Uploads it on their page, or the office files it by hand.')
    expect(kept.what).not.toContain('runs out')
    expect(contractEditAction(bond, resolveContractTexts(bond, EMPTY)[0]!, 'dev')).toMatchObject({ kind: 'note' })
  })

  it('reads a contract as its published clauses, a trade’s clause saying so, the Spanish after; none is nothing set', () => {
    const safety = byId(SAFETY)
    const [t] = resolveContractTexts(safety, EMPTY)
    expect(t).toMatchObject({ status: 'yours', versionLabel: 'version 1', format: 'plain' })
    expect(t?.text).toBe(
      ['1. Keep the site gate closed.', '2. Call in a locate before digging. (Sitework only, on its exhibit)', '', 'In Spanish', '1. Mantenga cerrada la puerta.', '2. Call in a locate before digging.'].join('\n'),
    )
    expect(safety).toMatchObject({ group: 'signed', audience: 'flow_customer', edit: { kind: 'clauses', paperId: SAFETY } })
    expect(resolveContractTexts(byId(WARRANTY), EMPTY)).toMatchObject([{ text: '', status: 'blank', versionLabel: null }])
    // The Spanish name that only repeats the English adds nothing to the title.
    expect(byId(WARRANTY).name).toBe('Warranty')
  })

  it('opens a contract’s clauses for the office that edits them, and says where for anyone else', () => {
    const safety = byId(SAFETY)
    const t = resolveContractTexts(safety, EMPTY)[0]!
    expect(contractEditAction(safety, t, 'assistant')).toEqual({ kind: 'settings', label: 'Open its clauses', tabId: 'settings-clauses', anchorId: `settings-clause-paper-${SAFETY}` })
    expect(contractEditAction(safety, t, null)).toEqual({ kind: 'note', text: 'The office changes its clauses in Settings → Contracts and clauses.' })
  })

  it('reads a notice as its words in both languages, dated the day it was written', () => {
    const start = byId(START)
    expect(start.group).toBe('notice')
    expect(resolveContractTexts(start, EMPTY)).toMatchObject([{ text: 'We start on Monday.\n\nIn Spanish\nEmpezamos el lunes.', status: 'yours', versionLabel: 'Oct 12' }])
    const html = flowPaperEntries([{ ...DOCS[0]!, book_body_format: 'html', book_body_html: '<p>We start on Monday.</p>' }], [])[0]!
    expect(resolveContractTexts(html, EMPTY)[0]).toMatchObject({ text: '<p>We start on Monday.</p>', format: 'html' })
    expect(resolveContractTexts(flowPaperEntries([{ ...DOCS[0]!, book_body_html: '  ' }], [])[0]!, EMPTY)[0]?.status).toBe('blank')
  })

  it('says where it is kept, and its history is the library document’s', () => {
    const start = byId(START)
    expect(contractSourceLine(start)).toBe('The Contract library, in a Flow papers packet. The New paper window added it to a step of a flow.')
    expect(contractSourceRef(start, resolveContractTexts(start, EMPTY)[0]!)).toEqual({ kind: 'contract_book', key: START })
  })

  it('numbers the clauses in their order and reads an empty Spanish clause as the English', () => {
    expect(flowClauseText([])).toBe('')
    expect(flowClauseText([{ paper_id: 'p', sequence_order: 0, text_en: ' One. ', text_es: '', scope: ['all'] }])).toBe('1. One.')
  })
})
