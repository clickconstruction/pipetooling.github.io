import { describe, expect, it } from 'vitest'
import { PERSON_DOCUMENT_MAX_CHARS, archiveConfirmWords, archiveOutcomeWords, archivedDocumentWords, archivedFoldWords, checkDocumentFile, cleanDocumentTitle, documentFileIsText, documentKeptByWords, documentSizeWords, documentsTabCount, sortDocumentsNewestFirst, splitDocumentsByArchive, titleFromFileName } from './personDocuments'

describe('personDocuments (named documents on the HR file, v2.6614)', () => {
  it('sorts newest first and leaves archived ones out', () => {
    const rows = [
      { id: 'a', updated_at: '2026-11-01T00:00:00Z', archived_at: null },
      { id: 'b', updated_at: '2026-11-07T00:00:00Z', archived_at: null },
      { id: 'c', updated_at: '2026-11-09T00:00:00Z', archived_at: '2026-11-10T00:00:00Z' },
    ]
    expect(sortDocumentsNewestFirst(rows).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('splits the kept from the archived (v2.6693): kept newest first, archived by the day they were archived, newest first', () => {
    const rows = [
      { id: 'a', updated_at: '2026-11-01T00:00:00Z', archived_at: null },
      { id: 'b', updated_at: '2026-11-07T00:00:00Z', archived_at: null },
      { id: 'c', updated_at: '2026-11-09T00:00:00Z', archived_at: '2026-11-10T00:00:00Z' },
      { id: 'd', updated_at: '2026-10-01T00:00:00Z', archived_at: '2026-11-12T00:00:00Z' },
    ]
    const split = splitDocumentsByArchive(rows)
    expect(split.kept.map((r) => r.id)).toEqual(['b', 'a'])
    expect(split.archived.map((r) => r.id)).toEqual(['d', 'c'])
    expect(splitDocumentsByArchive([])).toEqual({ kept: [], archived: [] })
  })

  it('the archive words: the fold, the confirm with a button that names the act, the open line and the toast', () => {
    expect(archivedFoldWords(2)).toBe('Archived (2)')
    const confirm = archiveConfirmWords('Interview guide')
    expect(confirm.title).toBe('Archive this document?')
    expect(confirm.body).toContain('Interview guide leaves the Named documents list')
    expect(confirm.body).toContain('Nothing is deleted')
    expect(confirm.confirmLabel).toBe('Archive the document')
    expect(archivedDocumentWords('Nov 8, 2026')).toBe('Archived Nov 8, 2026 · read-only until Unarchive')
    expect(archiveOutcomeWords('Interview guide', true)).toBe('Interview guide is archived.')
    expect(archiveOutcomeWords('Interview guide', false)).toBe('Interview guide is back on the list.')
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
})
