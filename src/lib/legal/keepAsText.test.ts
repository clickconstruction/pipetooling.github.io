import { describe, expect, it } from 'vitest'
import { KEEP_AS_TEXT_WORDS, keepAsTextBatchLabel, keepAsTextBatchShows, keepAsTextOutcome, keepAsTextProblem, legalDocumentCanKeepAsText, legalDocumentsToKeepAsText } from './keepAsText'
import { LEGAL_TEXT_DOCUMENT_MAX_CHARS } from './legalMatterDocuments'

describe('keep an old text file’s words as text · which rows', () => {
  it('a text file with no text document qualifies', () => {
    expect(legalDocumentCanKeepAsText({ mime: 'text/plain', text_document_id: null })).toBe(true)
    expect(legalDocumentCanKeepAsText({ mime: 'text/markdown' })).toBe(true)
  })

  it('a text document already kept does not', () => {
    expect(legalDocumentCanKeepAsText({ mime: 'text/plain', text_document_id: 't-1' })).toBe(false)
  })

  it('a PDF, a picture or an email never does: it is not text', () => {
    for (const mime of ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'message/rfc822', 'application/octet-stream', '']) {
      expect(legalDocumentCanKeepAsText({ mime, text_document_id: null })).toBe(false)
    }
  })

  it('the rows the press acts on keep their order', () => {
    const rows = [
      { id: 'a', mime: 'text/plain', text_document_id: null },
      { id: 'b', mime: 'application/pdf', text_document_id: null },
      { id: 'c', mime: 'text/markdown', text_document_id: 't-c' },
      { id: 'd', mime: 'text/markdown', text_document_id: null },
    ]
    expect(legalDocumentsToKeepAsText(rows).map((r) => r.id)).toEqual(['a', 'd'])
    expect(legalDocumentsToKeepAsText([])).toEqual([])
  })
})

describe('keep an old text file’s words as text · the words', () => {
  it('the menu line', () => {
    expect(KEEP_AS_TEXT_WORDS.menu).toBe('Keep its words as text')
  })

  it('the counted press shows past one row and says its count', () => {
    expect(keepAsTextBatchShows(0)).toBe(false)
    expect(keepAsTextBatchShows(1)).toBe(false)
    expect(keepAsTextBatchShows(2)).toBe(true)
    expect(keepAsTextBatchLabel(2)).toBe('Keep 2 as text')
    expect(keepAsTextBatchLabel(14)).toBe('Keep 14 as text')
  })

  it('a file with no words, or too many, is refused in words', () => {
    expect(keepAsTextProblem('Dear Pat,\n\nThank you.')).toBeNull()
    expect(keepAsTextProblem('')).toBe('The stored file has no words to keep.')
    expect(keepAsTextProblem(' \n\t\n')).toBe('The stored file has no words to keep.')
    expect(keepAsTextProblem('x'.repeat(LEGAL_TEXT_DOCUMENT_MAX_CHARS))).toBeNull()
    expect(keepAsTextProblem('x'.repeat(LEGAL_TEXT_DOCUMENT_MAX_CHARS + 1))).toBe('The text is longer than 1,000,000 characters.')
  })

  it('every paper took', () => {
    expect(keepAsTextOutcome(3, 0)).toEqual({ line: 'Kept 3 papers as text.', head: null, tone: 'success' })
    expect(keepAsTextOutcome(1, 0)).toEqual({ line: 'Kept 1 paper as text.', head: null, tone: 'success' })
  })

  it('some took: the toast says both, the head names the ones that stay', () => {
    expect(keepAsTextOutcome(2, 1)).toEqual({ line: 'Kept 2 papers as text. 1 did not keep.', head: '1 paper did not keep. It stays here with the reason.', tone: 'warning' })
  })

  it('none took', () => {
    expect(keepAsTextOutcome(0, 2)).toEqual({ line: 'Nothing kept. 2 did not keep.', head: '2 papers did not keep. They stay here with the reason.', tone: 'error' })
  })
})
