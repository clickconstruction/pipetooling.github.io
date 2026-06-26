import { describe, expect, it } from 'vitest'
import {
  buildContractRichTextDocument,
  contractDocFilename,
  type ContractBookExportEntry,
} from './contractRichTextDocument'

function entry(overrides: Partial<ContractBookExportEntry> = {}): ContractBookExportEntry {
  return {
    document_name: 'Non-disclosure agreement',
    book_body_html: 'Hello there',
    book_body_format: 'plain',
    ...overrides,
  }
}

describe('contractDocFilename', () => {
  it('appends .doc and keeps a normal name', () => {
    expect(contractDocFilename('Non-disclosure agreement')).toBe('Non-disclosure agreement.doc')
  })
  it('replaces filesystem-illegal characters with spaces', () => {
    expect(contractDocFilename('a/b:c*?"<>|d')).toBe('a b c d.doc')
  })
  it('collapses whitespace and falls back to contract.doc when empty', () => {
    expect(contractDocFilename('   ')).toBe('contract.doc')
    expect(contractDocFilename('////')).toBe('contract.doc')
  })
})

describe('buildContractRichTextDocument', () => {
  it('returns the Word MIME type and a .doc filename', () => {
    const doc = buildContractRichTextDocument(entry())
    expect(doc.mime).toBe('application/msword')
    expect(doc.filename).toBe('Non-disclosure agreement.doc')
  })

  it('wraps the body in an Office HTML envelope with a UTF-8 BOM', () => {
    const doc = buildContractRichTextDocument(entry())
    expect(doc.content.charCodeAt(0)).toBe(0xfeff)
    expect(doc.content).toContain('urn:schemas-microsoft-com:office:office')
    expect(doc.content).toContain('urn:schemas-microsoft-com:office:word')
    expect(doc.content).toContain('charset=utf-8')
    // title heading + rendered plain body
    expect(doc.content).toContain('<h1>Non-disclosure agreement</h1>')
    expect(doc.content).toContain('Hello there')
  })

  it('escapes the document name in the title and heading', () => {
    const doc = buildContractRichTextDocument(entry({ document_name: 'A <b> & "C"' }))
    expect(doc.content).toContain('<title>A &lt;b&gt; &amp; &quot;C&quot;</title>')
    expect(doc.content).toContain('<h1>A &lt;b&gt; &amp; &quot;C&quot;</h1>')
  })

  it('falls back to a Contract title when the name is blank', () => {
    const doc = buildContractRichTextDocument(entry({ document_name: '   ' }))
    expect(doc.content).toContain('<h1>Contract</h1>')
    expect(doc.filename).toBe('Contract.doc')
  })
})
