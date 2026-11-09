import { describe, expect, it } from 'vitest'
import { PERSON_DOCUMENT_MAX_CHARS, checkDocumentFile, cleanDocumentTitle, documentFileIsText, documentKeptByWords, documentSizeWords, documentsByEvidenceId, documentsTabCount, recordPickWords, sortDocumentsNewestFirst, tieToRecordProblem, titleFromFileName, transcribedRecordWords } from './personDocuments'

describe('personDocuments (named documents on the HR file, v2.6614)', () => {
  it('sorts newest first and leaves archived ones out', () => {
    const rows = [
      { id: 'a', updated_at: '2026-11-01T00:00:00Z', archived_at: null },
      { id: 'b', updated_at: '2026-11-07T00:00:00Z', archived_at: null },
      { id: 'c', updated_at: '2026-11-09T00:00:00Z', archived_at: '2026-11-10T00:00:00Z' },
    ]
    expect(sortDocumentsNewestFirst(rows).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('the size words, the kept-by words and the tab count', () => {
    expect(documentSizeWords({ chars: 184_320, sections: 24 })).toBe('24 sections · 180 KB')
    expect(documentSizeWords({ chars: 2_048, sections: 1 })).toBe('1 section · 2 KB')
    expect(documentSizeWords({ chars: 900, sections: 0 })).toBe('900 characters')
    expect(documentKeptByWords({ author_label: ' Dana ' })).toBe('Kept by Dana')
    expect(documentKeptByWords({ author_label: null })).toBe('Kept by the agent')
    expect(documentsTabCount({ hasSummary: true, hasNarrative: false, named: 3 })).toBe(4)
  })

  it('a file: markdown or plain text by name, with words, under the limit; the title from the name', () => {
    expect(documentFileIsText('Company-History_v3.md')).toBe(true)
    expect(documentFileIsText('notes.TXT')).toBe(true)
    expect(documentFileIsText('scan.pdf')).toBe(false)
    expect(titleFromFileName('/Users/d/Desktop/Company-History_v3.md')).toBe('Company History v3')
    expect(checkDocumentFile('scan.pdf', 'x')).toEqual({ ok: false, why: 'scan.pdf is not a markdown or plain text file. Pick a .md or .txt file.' })
    expect(checkDocumentFile('empty.md', '  \n')).toEqual({ ok: false, why: 'empty.md has no words in it.' })
    expect(checkDocumentFile('big.md', 'a'.repeat(PERSON_DOCUMENT_MAX_CHARS + 1))).toMatchObject({ ok: false, why: expect.stringContaining('at most 1,000,000') })
    expect(checkDocumentFile('Interview guide.md', '## Before the call')).toEqual({ ok: true, title: 'Interview guide', text: '## Before the call' })
    expect(checkDocumentFile('.md', '## x')).toEqual({ ok: true, title: 'Untitled document', text: '## x' })
    expect(cleanDocumentTitle('  Counsel   memo ')).toBe('Counsel memo')
    expect(cleanDocumentTitle('t'.repeat(200)).length).toBe(160)
  })

  it('a document names the record it transcribes (v2.6713): the chip words, the pair by record, the counsel rule and the picker rows', () => {
    const day = (ymd: string) => `day ${ymd}`
    const hash = '3f9a1c2b4d5e' + '0'.repeat(52)
    const record = { id: 'r1', title: ' Recording of the call ', dated_on: '2026-10-28', files: [{ sha256: null }, { sha256: hash.toUpperCase() }] }
    expect(transcribedRecordWords(record, day)).toBe('Transcribes Recording of the call · day 2026-10-28 · sha256 3f9a1c2b4d5e…')
    expect(transcribedRecordWords({ ...record, title: '', files: [] }, day)).toBe('Transcribes a record · day 2026-10-28')
    const docs = [
      { id: 'd-old', title: 'Old transcript', evidence_id: 'r1', archived_at: null, updated_at: '2026-10-01T00:00:00Z' },
      { id: 'd-new', title: 'Transcript', evidence_id: 'r1', archived_at: null, updated_at: '2026-11-01T00:00:00Z' },
      { id: 'd-gone', title: 'Retired', evidence_id: 'r2', archived_at: '2026-11-02T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' },
      { id: 'd-none', title: 'Memo', evidence_id: null, archived_at: null, updated_at: '2026-11-03T00:00:00Z' },
    ]
    const byRecord = documentsByEvidenceId(docs)
    expect([...byRecord.keys()]).toEqual(['r1'])
    expect(byRecord.get('r1')?.id).toBe('d-new')
    expect(tieToRecordProblem({ counsel_only: false }, { counsel_only: true })).toBe('That record is counsel-only, so its transcript is counsel-only too. Mark the document counsel-only first.')
    expect(tieToRecordProblem({ counsel_only: true }, { counsel_only: true })).toBeNull()
    expect(tieToRecordProblem({ counsel_only: false }, { counsel_only: false })).toBeNull()
    expect(tieToRecordProblem({ counsel_only: false }, null)).toBeNull()
    expect(recordPickWords({ title: 'Call K', dated_on: '2026-10-28', counsel_only: true }, day, { title: 'Transcript' })).toBe('day 2026-10-28 · Call K · 🔒 counsel-only · transcript: Transcript')
    expect(recordPickWords({ title: '  ', dated_on: '2026-10-28' }, day, null)).toBe('day 2026-10-28 · untitled')
  })
})
