import { describe, expect, it } from 'vitest'
import {
  buildContractBookPreviewHtml,
  CONTRACT_BOOK_DOWNLOAD_BUTTON_ID,
  type ContractBookExportEntry,
} from './contractBookPreview'

function entry(overrides: Partial<ContractBookExportEntry> = {}): ContractBookExportEntry {
  return {
    document_name: 'Non-disclosure agreement',
    book_body_html: 'Hello there',
    book_body_format: 'plain',
    ...overrides,
  }
}

describe('buildContractBookPreviewHtml', () => {
  it('is a standalone HTML document with the name as title and heading', () => {
    const html = buildContractBookPreviewHtml(entry())
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<title>Non-disclosure agreement</title>')
    expect(html).toContain('Non-disclosure agreement</h1>')
  })

  it('renders the entry body', () => {
    const html = buildContractBookPreviewHtml(entry())
    expect(html).toContain('Hello there')
    expect(html).toContain('white-space:pre-wrap')
  })

  it('includes a Download button with the wired id', () => {
    const html = buildContractBookPreviewHtml(entry())
    expect(html).toContain(`id="${CONTRACT_BOOK_DOWNLOAD_BUTTON_ID}"`)
    expect(html).toContain('>Download</button>')
  })

  it('shows an empty-state when there is no library body', () => {
    const html = buildContractBookPreviewHtml(entry({ book_body_html: null }))
    expect(html).toContain('No library body yet.')
  })

  it('escapes the document name', () => {
    const html = buildContractBookPreviewHtml(entry({ document_name: 'A <b> & "C"' }))
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;C&quot;</title>')
    expect(html).not.toContain('<b> &')
  })

  it('hides the toolbar when printing', () => {
    const html = buildContractBookPreviewHtml(entry())
    expect(html).toContain('@media print')
    expect(html).toContain('.cb-toolbar{display:none;}')
  })
})
