import { describe, expect, it } from 'vitest'
import {
  listQuickAddBookDocuments,
  quickSendPlan,
  quickSendPlanWrites,
  quickSendReusablePersonRow,
  quickSendRosterSplit,
  resolveQuickSendSource,
  type QuickSendBookRow,
  type QuickSendPersonRow,
} from './contractsQuickSend'

function bookRow(overrides: Partial<QuickSendBookRow> & { id: string; document_name: string }): QuickSendBookRow {
  return {
    book_body_html: '<p>body</p>',
    book_body_format: 'html',
    canonical_document_url: null,
    book_version_date: null,
    updated_at: '2026-08-01T12:00:00Z',
    ...overrides,
  }
}

function personRow(
  overrides: Partial<QuickSendPersonRow> & { id: string; person_name: string; document_name: string },
): QuickSendPersonRow {
  return {
    status: 'unsent',
    lineage_version: 1,
    sent_at: null,
    signer_last_viewed_at: null,
    signed_at: null,
    url: null,
    signing_body_html: null,
    signing_body_format: 'html',
    canonical_document_url: null,
    ...overrides,
  }
}

describe('resolveQuickSendSource', () => {
  it('prefers the newest book copy with content and pins it', () => {
    const source = resolveQuickSendSource({
      documentName: 'Handbook',
      templateDocuments: [
        bookRow({ id: 'old', document_name: 'Handbook', updated_at: '2026-01-01T12:00:00Z' }),
        bookRow({ id: 'new', document_name: 'Handbook', updated_at: '2026-08-01T12:00:00Z' }),
        bookRow({ id: 'other-doc', document_name: 'Other', updated_at: '2026-12-01T12:00:00Z' }),
      ],
      personDocuments: [],
    })
    expect(source).toMatchObject({ kind: 'book', appliedTemplateDocumentId: 'new', signingBodyHtml: '<p>body</p>' })
  })

  it('a manually set book_version_date beats a newer edit date', () => {
    const source = resolveQuickSendSource({
      documentName: 'Handbook',
      templateDocuments: [
        bookRow({ id: 'edited', document_name: 'Handbook', updated_at: '2026-08-01T12:00:00Z' }),
        bookRow({ id: 'pinned', document_name: 'Handbook', updated_at: '2026-01-01T12:00:00Z', book_version_date: '2026-09-01' }),
      ],
      personDocuments: [],
    })
    expect(source).toMatchObject({ kind: 'book', appliedTemplateDocumentId: 'pinned' })
  })

  it('skips book copies without signing content', () => {
    const source = resolveQuickSendSource({
      documentName: 'Handbook',
      templateDocuments: [bookRow({ id: 'empty', document_name: 'Handbook', book_body_html: '  ' })],
      personDocuments: [
        personRow({ id: 'p1', person_name: 'Darren', document_name: 'Handbook', status: 'signed', signing_body_html: '<p>agreed</p>' }),
      ],
    })
    expect(source).toMatchObject({ kind: 'person', signingBodyHtml: '<p>agreed</p>' })
  })

  it('a canonical URL alone is signing content for a book copy', () => {
    const source = resolveQuickSendSource({
      documentName: 'Handbook',
      templateDocuments: [
        bookRow({ id: 'canon', document_name: 'Handbook', book_body_html: null, canonical_document_url: 'https://docs.example/handbook' }),
      ],
      personDocuments: [],
    })
    expect(source).toMatchObject({ kind: 'book', canonicalDocumentUrl: 'https://docs.example/handbook' })
  })

  it('best person copy wins by status then lineage; null when nothing has content', () => {
    const source = resolveQuickSendSource({
      documentName: 'Handbook',
      templateDocuments: [],
      personDocuments: [
        personRow({ id: 'v1', person_name: 'Darren', document_name: 'Handbook', status: 'sent', lineage_version: 1, signing_body_html: '<p>v1</p>' }),
        personRow({ id: 'v2', person_name: 'Bryan', document_name: 'Handbook', status: 'signed', lineage_version: 1, signing_body_html: '<p>signed</p>' }),
      ],
    })
    expect(source).toMatchObject({ kind: 'person', signingBodyHtml: '<p>signed</p>' })
    expect(
      resolveQuickSendSource({ documentName: 'Handbook', templateDocuments: [], personDocuments: [] }),
    ).toBeNull()
  })
})

describe('quickSendRosterSplit', () => {
  const docs = [
    personRow({ id: 'a', person_name: 'Darren', document_name: 'Handbook', status: 'sent', sent_at: '2026-08-01T00:00:00Z' }),
    personRow({ id: 'b', person_name: 'Bryan', document_name: 'Handbook', status: 'signed' }),
    personRow({ id: 'c', person_name: 'Grace', document_name: 'Handbook', status: 'unsent' }),
    personRow({ id: 'd', person_name: 'Darren', document_name: 'Other', status: 'unsent' }),
  ]

  it('splits roster into needs-it / resend and counts signed', () => {
    const split = quickSendRosterSplit({
      documentName: 'Handbook',
      rosterNames: ['Abraham', 'Bryan', 'Darren', 'Grace'],
      personDocuments: docs,
    })
    expect(split.needsIt).toEqual(['Abraham', 'Grace'])
    expect(split.resend).toEqual([{ personName: 'Darren', sentAt: '2026-08-01T00:00:00Z' }])
    expect(split.signedCount).toBe(1)
  })

  it('a signed best row wins over an older unsent duplicate', () => {
    const split = quickSendRosterSplit({
      documentName: 'Handbook',
      rosterNames: ['Darren'],
      personDocuments: [
        personRow({ id: 'x', person_name: 'Darren', document_name: 'Handbook', status: 'unsent', lineage_version: 1 }),
        personRow({ id: 'y', person_name: 'Darren', document_name: 'Handbook', status: 'signed', lineage_version: 2 }),
      ],
    })
    expect(split.needsIt).toEqual([])
    expect(split.signedCount).toBe(1)
  })
})

describe('quickSendReusablePersonRow', () => {
  it('reuses the best unsent/sent row and never a signed one', () => {
    const unsent = personRow({ id: 'u', person_name: 'Darren', document_name: 'Handbook', status: 'unsent' })
    const signed = personRow({ id: 's', person_name: 'Darren', document_name: 'Handbook', status: 'signed', lineage_version: 2 })
    expect(
      quickSendReusablePersonRow({ documentName: 'Handbook', personName: 'Darren', personDocuments: [unsent, signed] })?.id,
    ).toBe('u')
    expect(
      quickSendReusablePersonRow({ documentName: 'Handbook', personName: 'Darren', personDocuments: [signed] }),
    ).toBeNull()
  })
})

describe('listQuickAddBookDocuments', () => {
  it('dedupes by name (newest effective copy) and sorts alphabetically', () => {
    const rows = listQuickAddBookDocuments([
      bookRow({ id: 'h-old', document_name: 'Handbook', updated_at: '2026-01-01T12:00:00Z' }),
      bookRow({ id: 'h-new', document_name: 'Handbook', updated_at: '2026-08-01T12:00:00Z' }),
      bookRow({ id: 'a', document_name: 'Agreement', updated_at: '2026-05-01T12:00:00Z' }),
    ])
    expect(rows.map((r) => r.documentName)).toEqual(['Agreement', 'Handbook'])
    expect(rows[1]?.row.id).toBe('h-new')
  })
})

describe('quickSendPlan (decision 17: the pick decides, Send writes)', () => {
  const source = { kind: 'person' as const, signingBodyHtml: '<p>x</p>', signingBodyFormat: 'html', canonicalDocumentUrl: null }

  it('reuse — an existing row with signing content is the target and nothing is written', () => {
    const existing = personRow({ id: 'r1', person_name: 'A', document_name: 'D', signing_body_html: '<p>hi</p>' })
    const plan = quickSendPlan({ existing, source })
    expect(plan).toEqual({ kind: 'reuse', docId: 'r1' })
    expect(quickSendPlanWrites(plan)).toBe(false)
  })

  it('reuse wins even when no source resolves (the row is its own content)', () => {
    const existing = personRow({ id: 'r1', person_name: 'A', document_name: 'D', canonical_document_url: 'https://x/doc.pdf' })
    expect(quickSendPlan({ existing, source: null })).toEqual({ kind: 'reuse', docId: 'r1' })
  })

  it('fill — an empty placeholder is filled from the source at Send', () => {
    const existing = personRow({ id: 'p1', person_name: 'A', document_name: 'D' })
    const plan = quickSendPlan({ existing, source })
    expect(plan).toEqual({ kind: 'fill', docId: 'p1', source })
    expect(quickSendPlanWrites(plan)).toBe(true)
  })

  it('insert — no non-signed copy means Send creates the unsent row', () => {
    const plan = quickSendPlan({ existing: null, source })
    expect(plan).toEqual({ kind: 'insert', source })
    expect(quickSendPlanWrites(plan)).toBe(true)
  })

  it('no-content — nothing to send and nothing to write', () => {
    const plan = quickSendPlan({ existing: null, source: null })
    expect(plan).toEqual({ kind: 'no-content' })
    expect(quickSendPlanWrites(plan)).toBe(false)
    expect(quickSendPlan({ existing: personRow({ id: 'p1', person_name: 'A', document_name: 'D' }), source: null })).toEqual({ kind: 'no-content' })
  })
})
