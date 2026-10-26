import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert, TablesUpdate } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { LEGAL_MATTER_DOCUMENTS_BUCKET, legalDocumentMime, legalDocumentStoragePath, type LegalDocumentDraft, type LegalDocumentSentDraft } from './legalMatterDocuments'

/** The office's documents on a matter (v2.4810): list, add (upload then row), hold, release, retire. */

/** A live row. Since v2.5846 (punch list #168) it carries the paper's own day and its state. */
export type LegalMatterDocumentRow = Pick<
  Tables<'legal_matter_documents'>,
  | 'id' | 'matter_id' | 'title' | 'shows' | 'storage_path' | 'mime' | 'size_bytes' | 'original_name' | 'added_by' | 'added_at' | 'held_reason' | 'voided_at'
  | 'dated_on' | 'state' | 'sent_on' | 'sent_how' | 'sent_to' | 'proof_document_id' | 'received_on'
>

const COLUMNS = 'id, matter_id, title, shows, storage_path, mime, size_bytes, original_name, added_by, added_at, held_reason, voided_at, dated_on, state, sent_on, sent_how, sent_to, proof_document_id, received_on'

function table(db: SupabaseClient<Database>) {
  return db.from('legal_matter_documents')
}

/** The live rows. */
export async function listLegalMatterDocuments(db: SupabaseClient<Database>): Promise<LegalMatterDocumentRow[]> {
  const res = await table(db).select(COLUMNS).is('voided_at', null).order('added_at')
  checkSupabaseError(res, 'load the documents for the firm')
  return res.data ?? []
}

/** Upload the file under the matter's folder, then the row. A failed row write removes the file again. */
/** Who added it is stamped by the database from the session (`legal_matter_documents_stamp`). */
export async function addLegalMatterDocument(db: SupabaseClient<Database>, matterId: string, draft: LegalDocumentDraft, file: File): Promise<string> {
  const id = crypto.randomUUID()
  const mime = legalDocumentMime(file) || 'application/octet-stream'
  const path = legalDocumentStoragePath(matterId, id, file.name)
  const up = await db.storage.from(LEGAL_MATTER_DOCUMENTS_BUCKET).upload(path, file, { contentType: mime, upsert: false })
  if (up.error) throw new Error(`Could not store ${file.name}: ${up.error.message}`)
  // v2.5846: the paper's own day and its state ride on the row when the draft names them.
  const dated: Pick<TablesInsert<'legal_matter_documents'>, 'dated_on' | 'state' | 'received_on'> = {}
  if (draft.datedOn) dated.dated_on = draft.datedOn
  if (draft.state && draft.state !== 'final') dated.state = draft.state
  if (draft.state === 'received') dated.received_on = draft.receivedOn || draft.datedOn || null
  const res = await table(db).insert({ id, matter_id: matterId, title: draft.title.trim(), shows: draft.shows.trim(), storage_path: path, mime, size_bytes: file.size, original_name: file.name, ...dated })
  try {
    checkSupabaseError(res, 'save the document')
  } catch (e) {
    await db.storage.from(LEGAL_MATTER_DOCUMENTS_BUCKET).remove([path])
    throw e
  }
  return id
}

export async function updateLegalMatterDocument(db: SupabaseClient<Database>, id: string, patch: Partial<LegalDocumentDraft> & { held_reason?: string }): Promise<void> {
  const fields: TablesUpdate<'legal_matter_documents'> = {}
  if (patch.title != null) fields.title = patch.title.trim()
  if (patch.shows != null) fields.shows = patch.shows.trim()
  if (patch.held_reason != null) fields.held_reason = patch.held_reason.trim()
  const res = await table(db).update(fields).eq('id', id)
  checkSupabaseError(res, 'change the document')
}

/** *Mark sent…* (v2.5846): the paper went out — the day, how, to whom, and the document that proves it. */
export async function markLegalMatterDocumentSent(db: SupabaseClient<Database>, id: string, sent: LegalDocumentSentDraft): Promise<void> {
  const res = await table(db).update({ state: 'sent', sent_on: sent.sentOn, sent_how: sent.sentHow, sent_to: sent.sentTo.trim(), proof_document_id: sent.proofDocumentId || null }).eq('id', id)
  checkSupabaseError(res, 'mark the document sent')
}

/** The paper came in (v2.5846): received on a day. */
export async function markLegalMatterDocumentReceived(db: SupabaseClient<Database>, id: string, receivedOn: string): Promise<void> {
  const res = await table(db).update({ state: 'received', received_on: receivedOn }).eq('id', id)
  checkSupabaseError(res, 'mark the document received')
}

/** Back to draft or final (v2.5846): a send marked by mistake, or a draft that is now the paper. Clears the send record. */
export async function setLegalMatterDocumentState(db: SupabaseClient<Database>, id: string, state: 'draft' | 'final'): Promise<void> {
  const res = await table(db).update({ state, sent_on: null, sent_how: '', sent_to: '', proof_document_id: null, received_on: null }).eq('id', id)
  checkSupabaseError(res, 'change the document’s state')
}

/** The paper's own day (v2.5846), changed after the fact. */
export async function setLegalMatterDocumentDatedOn(db: SupabaseClient<Database>, id: string, datedOn: string | null): Promise<void> {
  const res = await table(db).update({ dated_on: datedOn }).eq('id', id)
  checkSupabaseError(res, 'change the document’s day')
}

/** Retire, never delete: the file stays in the bucket; the firm stops seeing it on its next open. */
export async function retireLegalMatterDocument(db: SupabaseClient<Database>, id: string): Promise<void> {
  const res = await table(db).update({ voided_at: new Date().toISOString() }).eq('id', id)
  checkSupabaseError(res, 'remove the document')
}

/** The office's own look at a file: a short signed link from the client's own session. */
export async function legalMatterDocumentLink(db: SupabaseClient<Database>, storagePath: string): Promise<string> {
  const { data, error } = await db.storage.from(LEGAL_MATTER_DOCUMENTS_BUCKET).createSignedUrl(storagePath, 15 * 60)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not open the document')
  return data.signedUrl
}
