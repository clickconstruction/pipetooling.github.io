import { describe, expect, it } from 'vitest'
import { documentHostWord, documentLinkWords, filingDocumentPayload, normalizeDocumentUrl } from './lienFilingDocumentLink'

describe('the saved copy on a lien filing (v2.3763)', () => {
  it('takes a Drive link as typed, gives a bare host a scheme, and refuses a note as a link', () => {
    expect(normalizeDocumentUrl(' https://drive.google.com/file/d/abc/view ')).toBe('https://drive.google.com/file/d/abc/view')
    expect(normalizeDocumentUrl('drive.google.com/file/d/abc/view')).toBe('https://drive.google.com/file/d/abc/view')
    expect(normalizeDocumentUrl('in the Dudley folder')).toBe('')
    expect(normalizeDocumentUrl('')).toBe('')
    expect(normalizeDocumentUrl(null)).toBe('')
  })
  it('names the host, and words the line', () => {
    expect(documentHostWord('https://drive.google.com/file/d/abc/view')).toBe('Drive')
    expect(documentHostWord('https://docs.google.com/document/d/x')).toBe('Drive')
    expect(documentHostWord('https://www.dropbox.com/s/x')).toBe('Dropbox')
    expect(documentHostWord('https://clickconstruction.sharepoint.com/x')).toBe('OneDrive')
    expect(documentHostWord('https://files.example.com/a.pdf')).toBe('files.example.com')
    expect(documentLinkWords({ document_url: 'https://drive.google.com/file/d/abc/view', document_note: 'the scan with the green card' })).toBe('Saved copy · Drive — the scan with the green card')
    expect(documentLinkWords({ document_url: 'https://drive.google.com/file/d/abc/view' })).toBe('Saved copy · Drive')
    expect(documentLinkWords({ document_url: '', document_note: 'mailed from the office, no scan' })).toBe('Note: mailed from the office, no scan')
    expect(documentLinkWords({})).toBe('')
    expect(documentLinkWords(null)).toBe('')
  })
  it('sends only the keys that carry a value, unless asked to clear', () => {
    expect(filingDocumentPayload({ url: '', note: '' })).toEqual({})
    expect(filingDocumentPayload({ url: 'drive.google.com/x', note: ' the scan ' })).toEqual({ document_url: 'https://drive.google.com/x', document_note: 'the scan' })
    expect(filingDocumentPayload({ url: 'not a link', note: '' })).toEqual({})
    expect(filingDocumentPayload({ url: '', note: '' }, { clear: true })).toEqual({ document_url: '', document_note: '' })
  })
})
