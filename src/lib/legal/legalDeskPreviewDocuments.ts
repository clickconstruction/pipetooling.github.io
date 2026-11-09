import { legalPortalDocumentFromRow, type LegalPortalDocument } from './legalMatterDocuments'
import type { LegalMatterDocumentRow } from './legalMatterDocumentsIo'

/**
 * The firm's documents as the desk's *Preview what the firm sees* draws them (v2.6770, punch list #288): the rows the
 * firm would hold, a held one left out and counted, each built by the portal's own shaper. A text document carries its
 * words when the desk has read them (`texts`, by `text_document_id`), so the preview shows **Read here** as the firm's
 * page does; the counsel-only mark rides on the row. Pure: the read is the caller's.
 */
export function previewDocumentsForFirm(
  rows: ReadonlyArray<LegalMatterDocumentRow>,
  users: ReadonlyArray<{ id: string; name: string | null }>,
  dayOf: (iso: string) => string,
  texts: Readonly<Record<string, string>> = {},
): { documents: LegalPortalDocument[]; heldDocumentCount: number } {
  const nameOf = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? '' : '')
  return {
    documents: rows
      .filter((r) => !r.held_reason.trim())
      .map((r) => legalPortalDocumentFromRow(r, nameOf(r.added_by), '', dayOf, r.text_document_id ? texts[r.text_document_id] ?? '' : '')),
    heldDocumentCount: rows.filter((r) => r.held_reason.trim()).length,
  }
}

/** The text documents the preview needs words for: the travelling rows that point at one. */
export function previewTextIds(rows: ReadonlyArray<Pick<LegalMatterDocumentRow, 'held_reason' | 'text_document_id'>>): string[] {
  return [...new Set(rows.filter((r) => !r.held_reason.trim() && r.text_document_id).map((r) => r.text_document_id as string))]
}
