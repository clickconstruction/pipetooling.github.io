/**
 * Documents → Agreements, sending a paper from the tab: which Book papers the paper step offers, what a typed word
 * keeps, and who can be picked. Every name here is made up.
 */
import { describe, expect, it } from 'vitest'
import { papersMatching, sendablePapers, sendRoster, sendRosterNames } from './agreementsSend'
import { quickSendNoContentWords, quickSendPickPlan, type QuickSendPersonRow } from '../contractsQuickSend'

const bookRow = (over: Record<string, unknown>) => ({
  id: 'b1',
  document_name: 'Subcontractor Handbook',
  book_body_html: '<p>Rules</p>',
  book_body_format: 'html',
  canonical_document_url: null,
  form_template_id: null,
  book_version_date: null,
  updated_at: '2026-10-01T00:00:00Z',
  audience: 'sub',
  flow_kind: null,
  ...over,
})

describe('sendablePapers', () => {
  it('offers one entry per named paper, and leaves out the customer’s contracts and the flows’ papers', () => {
    const papers = sendablePapers([
      bookRow({}),
      bookRow({ id: 'b2', document_name: 'W-9', book_body_html: null, form_template_id: 'f1' }),
      bookRow({ id: 'b3', document_name: 'Residential contract', audience: 'customer' }),
      bookRow({ id: 'b4', document_name: 'Trade upload terms', flow_kind: 'upload' }),
      bookRow({ id: 'b5', document_name: 'Empty shell', book_body_html: '  ' }),
    ])
    expect(papers.map((p) => [p.paperName, p.hasWords, p.from])).toEqual([
      ['Empty shell', false, 'No words yet. Write it in the Contract Book first.'],
      ['Subcontractor Handbook', true, 'From the Contract Book'],
      ['W-9', true, 'A form from the Contract Book'],
    ])
  })
})

describe('papersMatching', () => {
  const papers = sendablePapers([bookRow({}), bookRow({ id: 'b2', document_name: 'Master Subcontract Agreement' }), bookRow({ id: 'b3', document_name: 'W-9' })])
  it('keeps the papers whose name holds every typed word, without case', () => {
    expect(papersMatching(papers, 'sub hand').map((p) => p.paperName)).toEqual(['Subcontractor Handbook'])
    expect(papersMatching(papers, 'SUB').map((p) => p.paperName)).toEqual(['Master Subcontract Agreement', 'Subcontractor Handbook'])
    expect(papersMatching(papers, 'zebra')).toEqual([])
  })
  it('keeps every paper with nothing typed', () => {
    expect(papersMatching(papers, '   ').length).toBe(3)
  })
})

describe('sendRosterNames', () => {
  it('is each living person once, A to Z, by the name their papers are filed under', () => {
    expect(
      sendRosterNames([
        { account_kind: 'person', is_archived: false, roster_name: 'Priya Nair', account_name: 'Priya N', pay_name: 'Priya Nair' },
        { account_kind: 'person', is_archived: false, roster_name: null, account_name: 'Bryce Tolland', pay_name: 'Bryce Tolland' },
        { account_kind: 'person', is_archived: false, roster_name: ' priya nair ', account_name: null, pay_name: 'priya nair' },
        { account_kind: 'person', is_archived: true, roster_name: 'Gone Away', account_name: null, pay_name: 'Gone Away' },
        { account_kind: 'twin', is_archived: false, roster_name: null, account_name: 'Twin Estimator', pay_name: 'Twin Estimator' },
        { account_kind: 'sample', is_archived: false, roster_name: null, account_name: 'Sample Helper', pay_name: 'Sample Helper' },
        { account_kind: 'person', is_archived: false, roster_name: null, account_name: null, pay_name: '  ' },
      ]),
    ).toEqual(['Bryce Tolland', 'Priya Nair'])
  })
})

describe('sendRoster', () => {
  it('is the same people, each with whether the roster says sub', () => {
    const roster = [
      { account_kind: 'person' as const, is_archived: false, roster_name: 'Priya Nair', account_name: 'Priya N', pay_name: 'Priya Nair', kind: 'helper' },
      { account_kind: 'person' as const, is_archived: false, roster_name: 'Ortega Mechanical', account_name: null, pay_name: 'Ortega Mechanical', kind: 'sub' },
      { account_kind: 'person' as const, is_archived: true, roster_name: 'Gone Away', account_name: null, pay_name: 'Gone Away', kind: 'sub' },
      { account_kind: 'twin' as const, is_archived: false, roster_name: null, account_name: 'Twin Estimator', pay_name: 'Twin Estimator', kind: null },
    ]
    expect(sendRoster(roster)).toEqual([
      { name: 'Ortega Mechanical', sub: true },
      { name: 'Priya Nair', sub: false },
    ])
    expect(sendRoster(roster).map((p) => p.name)).toEqual(sendRosterNames(roster))
  })
})

describe('quickSendPickPlan', () => {
  const personRow = (over: Partial<QuickSendPersonRow>): QuickSendPersonRow => ({
    id: 'd1',
    person_name: 'Priya Nair',
    document_name: 'Subcontractor Handbook',
    status: 'sent',
    lineage_version: 1,
    sent_at: '2026-11-01T00:00:00Z',
    signer_last_viewed_at: null,
    signed_at: null,
    url: null,
    signing_body_html: '<p>Rules</p>',
    signing_body_format: 'html',
    canonical_document_url: null,
    ...over,
  })
  const book = [bookRow({})]
  it('makes a new copy from the Book for a person who has none', () => {
    const { existing, plan } = quickSendPickPlan({ documentName: 'Subcontractor Handbook', personName: 'Bryce Tolland', templateDocuments: book, personDocuments: [personRow({})] })
    expect(existing).toBeNull()
    expect(plan).toEqual({ kind: 'insert', source: { kind: 'book', appliedTemplateDocumentId: 'b1', signingBodyHtml: '<p>Rules</p>', signingBodyFormat: 'html', canonicalDocumentUrl: null } })
  })
  it('reuses the copy a person already has out, so picking them sends it again', () => {
    const { existing, plan } = quickSendPickPlan({ documentName: 'Subcontractor Handbook', personName: 'Priya Nair', templateDocuments: book, personDocuments: [personRow({})] })
    expect(existing?.status).toBe('sent')
    expect(plan).toEqual({ kind: 'reuse', docId: 'd1' })
  })
  it('never reuses a signed copy, and says so when nothing anywhere can be signed', () => {
    const signed = quickSendPickPlan({ documentName: 'Subcontractor Handbook', personName: 'Priya Nair', templateDocuments: book, personDocuments: [personRow({ status: 'signed' })] })
    expect(signed.existing).toBeNull()
    expect(signed.plan.kind).toBe('insert')
    const none = quickSendPickPlan({ documentName: 'Ghost paper', personName: 'Priya Nair', templateDocuments: book, personDocuments: [] })
    expect(none.plan).toEqual({ kind: 'no-content' })
    expect(quickSendNoContentWords('Ghost paper')).toBe('No signable content found for “Ghost paper” — add contract text to its Contract Book entry first.')
  })
})
