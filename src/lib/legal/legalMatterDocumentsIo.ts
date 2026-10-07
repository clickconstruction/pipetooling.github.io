import type { SupabaseClient } from '@supabase/supabase-js'
import { checkSupabaseError } from '../../utils/errorHandling'
import { LEGAL_MATTER_DOCUMENTS_BUCKET, legalDocumentMime, legalDocumentStoragePath, type LegalDocumentDraft } from './legalMatterDocuments'

/** The office's documents on a matter (v2.4810): list, add (upload then row), hold, release, retire. The table is cast until the types regenerate. */

export type LegalMatterDocumentRow = { id: string; matter_id: string; title: string; shows: string; storage_path: string; mime: string; size_bytes: number; original_name: string; added_by: string | null; added_at: string; held_reason: string; voided_at: string | null }

function table(db: SupabaseClient) {
  return db.from('legal_matter_documents')
}

export async function listLegalMatterDocuments(db: SupabaseClient): Promise<LegalMatterDocumentRow[]> {
  const res = (await table(db).select('id, matter_id, title, shows, storage_path, mime, size_bytes, original_name, added_by, added_at, held_reason, voided_at').is('voided_at', null).order('added_at')) as unknown as { data: LegalMatterDocumentRow[] | null; error: null }
  checkSupabaseError(res, 'load the documents for the firm')
  return res.data ?? []
}

/** Upload the file under the matter's folder, then the row. A failed row write removes the file again. */
/** Who added it is stamped by the database from the session (`legal_matter_documents_stamp`). */
export async function addLegalMatterDocument(db: SupabaseClient, matterId: string, draft: LegalDocumentDraft, file: File): Promise<string> {
  const id = crypto.randomUUID()
  const mime = legalDocumentMime(file) || 'application/octet-stream'
  const path = legalDocumentStoragePath(matterId, id, file.name)
  const up = await db.storage.from(LEGAL_MATTER_DOCUMENTS_BUCKET).upload(path, file, { contentType: mime, upsert: false })
  if (up.error) throw new Error(`Could not store ${file.name}: ${up.error.message}`)
  const res = (await table(db).insert({ id, matter_id: matterId, title: draft.title.trim(), shows: draft.shows.trim(), storage_path: path, mime, size_bytes: file.size, original_name: file.name })) as unknown as { data: unknown; error: null }
  try {
    checkSupabaseError(res, 'save the document')
  } catch (e) {
    await db.storage.from(LEGAL_MATTER_DOCUMENTS_BUCKET).remove([path])
    throw e
  }
  return id
}

export async function updateLegalMatterDocument(db: SupabaseClient, id: string, patch: Partial<LegalDocumentDraft> & { held_reason?: string }): Promise<void> {
  const fields: Record<string, unknown> = {}
  if (patch.title != null) fields.title = patch.title.trim()
  if (patch.shows != null) fields.shows = patch.shows.trim()
  if (patch.held_reason != null) fields.held_reason = patch.held_reason.trim()
  const res = (await table(db).update(fields).eq('id', id)) as unknown as { data: unknown; error: null }
  checkSupabaseError(res, 'change the document')
}

/** Retire, never delete: the file stays in the bucket; the firm stops seeing it on its next open. */
export async function retireLegalMatterDocument(db: SupabaseClient, id: string): Promise<void> {
  const res = (await table(db).update({ voided_at: new Date().toISOString() }).eq('id', id)) as unknown as { data: unknown; error: null }
  checkSupabaseError(res, 'remove the document')
}

/** The office's own look at a file: a short signed link from the client's own session. */
export async function legalMatterDocumentLink(db: SupabaseClient, storagePath: string): Promise<string> {
  const { data, error } = await db.storage.from(LEGAL_MATTER_DOCUMENTS_BUCKET).createSignedUrl(storagePath, 15 * 60)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not open the document')
  return data.signedUrl
}
