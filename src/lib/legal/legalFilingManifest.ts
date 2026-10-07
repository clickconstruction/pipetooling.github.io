import { legalDocumentMime, legalDocumentProblem } from './legalMatterDocuments'
import { legalNarrativeProblem } from './legalNarrative'

/**
 * The manifest `scripts/legal-file-documents.ts` reads (v2.4814): which matter, which files with a
 * title and one line on what each shows (and a hold reason when one is kept back), and an optional
 * narrative file. Pure: the script reads the files and the matter; this checks what it was given
 * and says what it would do, so a dry run reads the same as the write.
 */

export type LegalFilingDocument = { file: string; title: string; shows: string; hold: string }
export type LegalFilingManifest = { matterId: string; documents: LegalFilingDocument[]; narrativeFile: string | null }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The manifest JSON → what to file, or every problem with it in words. */
export function parseLegalFilingManifest(raw: unknown): { ok: true; manifest: LegalFilingManifest } | { ok: false; problems: string[] } {
  const problems: string[] = []
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
  if (!r) return { ok: false, problems: ['The manifest is not a JSON object.'] }
  const matterId = typeof r.matter_id === 'string' ? r.matter_id.trim() : ''
  if (!UUID_RE.test(matterId)) problems.push('matter_id is missing or is not a legal_matters.id.')
  const docsRaw = Array.isArray(r.documents) ? r.documents : []
  const documents: LegalFilingDocument[] = []
  docsRaw.forEach((d, i) => {
    const o = d && typeof d === 'object' ? (d as Record<string, unknown>) : {}
    const doc = { file: String(o.file ?? '').trim(), title: String(o.title ?? '').trim(), shows: String(o.shows ?? '').trim(), hold: String(o.hold ?? '').trim() }
    if (!doc.file) problems.push(`documents[${i}]: file is missing.`)
    const p = legalDocumentProblem({ title: doc.title, shows: doc.shows })
    if (p) problems.push(`documents[${i}] (${doc.file || 'no file'}): ${p}`)
    if (doc.file && !legalDocumentMime({ type: '', name: doc.file })) problems.push(`documents[${i}]: ${doc.file} is not a kind the portal takes (PDF, an image, .eml or .txt).`)
    documents.push(doc)
  })
  const narrativeFile = typeof r.narrative_file === 'string' && r.narrative_file.trim() ? r.narrative_file.trim() : null
  if (documents.length === 0 && !narrativeFile) problems.push('Nothing to file: no documents and no narrative_file.')
  return problems.length ? { ok: false, problems } : { ok: true, manifest: { matterId, documents, narrativeFile } }
}

/** One file on disk against the limits, once the script has read it. */
export function legalFilingFileProblem(doc: LegalFilingDocument, bytes: number): string | null {
  return legalDocumentProblem({ title: doc.title, shows: doc.shows }, { size: bytes, type: '', name: doc.file })
}

/** A document already on the matter with the same title, file name and size is not filed twice. */
export function legalFilingAlreadyThere(existing: ReadonlyArray<{ title: string; original_name: string; size_bytes: number }>, doc: LegalFilingDocument, bytes: number, fileName: string): boolean {
  return existing.some((e) => e.title.trim() === doc.title && e.original_name === fileName && Number(e.size_bytes) === bytes)
}

export function legalFilingNarrativeProblem(markdown: string): string | null {
  if (!markdown.trim()) return 'The narrative file is empty.'
  return legalNarrativeProblem(markdown)
}
