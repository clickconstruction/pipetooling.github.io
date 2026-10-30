/**
 * Show on Evidence (v2.6166): a press on a Timeline document line lands the Evidence tab on that
 * paper's row, scrolled into view and lit for a moment, and the address carries the row
 * (`&tab=evidence&doc=<id>`, `legalDeskRoute.ts`) so a reload or a pasted link lands the same way.
 * The owner's ask of 2026-10-30: open the paper from the Timeline without leaving it, and still be
 * able to go to Evidence and find the row lit.
 *
 * This kernel decides what a landing finds — the row, the row behind the open filter (the filter
 * clears to *All* and one line says so), or a paper no longer on the matter — and words the line.
 * The Evidence tab's groups are always open (v2.6108), so a group never hides a row; only a filter
 * can. `LegalMatterDocumentsPanel.tsx` draws the landing; `.legalDocLanded` in `index.css` is the
 * tint, which `prefers-reduced-motion` holds still until the panel lets it go.
 */
import { legalDocumentFilterWords, legalDocumentPassesFilter, type LegalDocumentFilter } from './legalMatterDocuments'

/** How long the landed row stays lit, in ms; the tint fades over it, or holds and then goes under reduced motion. */
export const EVIDENCE_LANDING_LIT_MS = 4000

/** What the landing needs of a row: the filter's shape and the id. */
export type EvidenceLandingRow = { id: string; state: string; held: boolean; addedOn: string }

export type EvidenceLanding =
  /** The row is on the tab as drawn: scroll to it and light it. */
  | { kind: 'shown'; id: string; note: '' }
  /** The row is on the matter but the open filter hides it: clear the filter, then land, and say so. */
  | { kind: 'behind_filter'; id: string; filter: LegalDocumentFilter; note: string }
  /** No live row carries the id: the paper was removed, or the link is stale. */
  | { kind: 'gone'; id: string; note: string }

/** The line under the filters when a filter had to clear: *The Sent filter hid this paper, so every paper shows now.* */
export function evidenceLandingFilterWords(filter: LegalDocumentFilter): string {
  return `The ${legalDocumentFilterWords(filter)} filter hid this paper, so every paper shows now.`
}

/** The line when the row is gone. */
export const EVIDENCE_LANDING_GONE_WORDS = 'That paper is no longer on the matter.'

/** What the landing on `docId` finds among `rows` under `filter`. */
export function evidenceLanding(docId: string, rows: ReadonlyArray<EvidenceLandingRow>, filter: LegalDocumentFilter, weekStartYmd: string): EvidenceLanding {
  const row = rows.find((r) => r.id === docId)
  if (!row) return { kind: 'gone', id: docId, note: EVIDENCE_LANDING_GONE_WORDS }
  if (!legalDocumentPassesFilter(row, filter, weekStartYmd)) return { kind: 'behind_filter', id: docId, filter, note: evidenceLandingFilterWords(filter) }
  return { kind: 'shown', id: docId, note: '' }
}

/** The CSS selector of a row's element on the Evidence tab; the ids are UUIDs, so a quote never appears, but one is escaped all the same. */
export function evidenceRowSelector(docId: string): string {
  return `[data-legal-document="${docId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`
}
