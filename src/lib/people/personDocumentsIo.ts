import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { sortDocumentsNewestFirst, type PersonDocumentIndexRow, type PersonDocumentRow } from './personDocuments'

/**
 * Named documents on a person's HR file (v2.6614): the list from `person_document_index`, one document whole from
 * `person_documents`, and the one write through `dev_person_doc_write` — the function the dev seat and the
 * summary / narrative editor save through (20261107040000). Until that migration is pushed the view and the table do
 * not exist: the list reads that as no documents, so the rest of the file still draws; a save says why it could not.
 * The generated types learn the two names on the next regeneration, so the reads go through the untyped client.
 */

const INDEX_COLUMNS = 'id,person_id,title,counsel_only,author_label,updated_by,created_at,updated_at,archived_at,chars,sections'

type Res<T> = { data: T | null; error: { code?: string; message: string } | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function loadPersonDocuments(personId: string): Promise<{ documents: PersonDocumentIndexRow[]; heldWhy: string | null }> {
  const res = (await db.from('person_document_index').select(INDEX_COLUMNS).eq('person_id', personId)) as Res<PersonDocumentIndexRow[]>
  if (res.error) {
    if (res.error.code === '42P01' || /does not exist/i.test(res.error.message)) return { documents: [], heldWhy: null }
    return { documents: [], heldWhy: res.error.message }
  }
  return { documents: sortDocumentsNewestFirst(res.data ?? []), heldWhy: null }
}

export async function loadPersonDocument(id: string): Promise<{ document: PersonDocumentRow | null; why: string | null }> {
  const res = (await db.from('person_documents').select('id,person_id,title,content,counsel_only,author_label,updated_by,created_at,updated_at,archived_at').eq('id', id).maybeSingle()) as Res<Omit<PersonDocumentRow, 'chars' | 'sections'>>
  if (res.error) return { document: null, why: res.error.message }
  if (!res.data) return { document: null, why: 'That document is not on the file any more.' }
  return { document: { ...res.data, chars: res.data.content.length, sections: 0 }, why: null }
}

export type SavePersonDocumentArgs = {
  personId: string
  /** An existing document's id, or none with `title` for a new one. */
  docId: string | null
  title: string | null
  markdown: string
  /** The updated_at the editor loaded, so a save over a version kept since is refused. */
  expectUpdatedAt: string | null
  counselOnly?: boolean
}

export type SavePersonDocumentOutcome = { ok: true; docId: string | null; updatedAt: string | null } | { ok: false; why: string }

/** `{ p, p_dry_run: false }` to the function, as the seat sends it; the reason comes back as the function wrote it. */
export async function savePersonDocument(args: SavePersonDocumentArgs): Promise<SavePersonDocumentOutcome> {
  const p: Record<string, unknown> = { person_id: args.personId, markdown: args.markdown }
  if (args.docId) p.doc_id = args.docId
  else p.title = args.title
  if (args.expectUpdatedAt) p.expect_updated_at = args.expectUpdatedAt
  if (typeof args.counselOnly === 'boolean') p.counsel_only = args.counselOnly
  try {
    const { data, error } = (await db.rpc('dev_person_doc_write', { p, p_dry_run: false })) as Res<{ ok?: boolean; document?: { id?: string }; updated_at?: string }>
    if (error) return { ok: false, why: formatErrorMessage(error, 'the save was refused') }
    return { ok: true, docId: data?.document?.id ?? args.docId, updatedAt: data?.updated_at ?? null }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e, 'the save was refused') }
  }
}
