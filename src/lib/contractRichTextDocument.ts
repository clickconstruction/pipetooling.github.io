import { escapeHtmlText, renderContractBodyToSafeHtml } from './renderContractBodyToSafeHtml'

/** Minimal Contract Book entry shape needed to preview / export a single entry. */
export type ContractBookExportEntry = {
  document_name: string
  book_body_html: string | null
  book_body_format: string
}

export type ContractRichTextDocument = {
  content: string
  mime: string
  filename: string
}

/** Filesystem-safe `.doc` filename from a document name (fallback `contract.doc`). */
export function contractDocFilename(documentName: string): string {
  const base = documentName
    .replace(/[\\/:*?"<>|]+/g, ' ') // characters illegal on common filesystems
    .replace(/\s+/g, ' ')
    .trim()
  return `${base || 'contract'}.doc`
}

/**
 * Build a Word-compatible (".doc") rich-text document for a Contract Book entry.
 *
 * Wraps the same safe body HTML used by the on-screen preview in a minimal
 * Office HTML envelope. Saved with the `application/msword` MIME type and a
 * `.doc` extension it opens in Word / Pages / Google Docs with formatting
 * (bold, italic, lists, headings, tables, links) preserved and editable — no
 * extra dependencies and no lossy HTML→RTF conversion. A leading BOM plus the
 * charset meta tags keep non-ASCII text intact across Word versions.
 */
export function buildContractRichTextDocument(entry: ContractBookExportEntry): ContractRichTextDocument {
  const title = entry.document_name.trim() || 'Contract'
  const bodyHtml = renderContractBodyToSafeHtml(entry.book_body_html, entry.book_body_format)
  const content =
    '﻿' + // UTF-8 BOM so Word detects the encoding
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
    'xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' +
    `<title>${escapeHtmlText(title)}</title></head>` +
    `<body><h1>${escapeHtmlText(title)}</h1>${bodyHtml}</body></html>`
  return {
    content,
    mime: 'application/msword',
    filename: contractDocFilename(title),
  }
}
