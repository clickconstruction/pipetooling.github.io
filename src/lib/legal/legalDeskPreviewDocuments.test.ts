import { describe, expect, it } from 'vitest'
import { previewDocumentsForFirm, previewTextIds } from './legalDeskPreviewDocuments'
import type { LegalMatterDocumentRow } from './legalMatterDocumentsIo'

const row = (over: Partial<LegalMatterDocumentRow>): LegalMatterDocumentRow =>
  ({
    id: 'd', matter_id: 'm', title: 'T', shows: 'S', storage_path: 'm/d-t.md', mime: 'text/markdown', size_bytes: 10, original_name: 't.md',
    added_by: 'u1', added_at: '2026-11-08T15:00:00Z', held_reason: '', voided_at: null, dated_on: null, state: 'final', sent_on: null, sent_how: '',
    sent_to: '', proof_document_id: null, received_on: null, whose: null, text_document_id: null, counsel_only: false, ...over,
  }) as LegalMatterDocumentRow

describe('the desk preview of the firm\'s documents (v2.6770, punch list #288)', () => {
  it('carries a text document\'s words, so the preview shows Read here as the firm\'s page does; a file alone has none', () => {
    const rows = [row({ id: 'a', text_document_id: 't1' }), row({ id: 'b', mime: 'application/pdf', text_document_id: null })]
    const out = previewDocumentsForFirm(rows, [{ id: 'u1', name: 'Robin' }], (iso) => iso.slice(0, 10), { t1: '## One\n\nWords.' })
    expect(out.documents.map((d) => [d.id, d.text])).toEqual([['a', '## One\n\nWords.'], ['b', '']])
    expect(out.documents[0]).toMatchObject({ addedByName: 'Robin', addedOn: '2026-11-08' })
  })

  it('leaves a held paper out and counts it, keeps the counsel-only mark, and asks words only for the travelling text documents', () => {
    const rows = [row({ id: 'a', text_document_id: 't1', counsel_only: true }), row({ id: 'h', text_document_id: 't2', held_reason: 'internal' }), row({ id: 'c', text_document_id: 't1' })]
    const out = previewDocumentsForFirm(rows, [], (iso) => iso.slice(0, 10))
    expect(out.heldDocumentCount).toBe(1)
    expect(out.documents.map((d) => [d.id, d.counselOnly, d.text])).toEqual([['a', true, ''], ['c', false, '']])
    expect(previewTextIds(rows)).toEqual(['t1'])
  })
})
