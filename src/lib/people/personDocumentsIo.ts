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

const INDEX_COLUMNS = 'id,person_id,title,counsel_only,author_label,updated_by,created_at,updated_at,archived_at,chars,sections,evidence_id'
/** Before migration 20261108193000 is pushed the column is not there (42703); the list reads without it and every document transcribes nothing. */
const INDEX_COLUMNS_BEFORE_EVIDENCE = 'id,person_id,title,counsel_only,author_label,updated_by,created_at,updated_at,archived_at,chars,sections'
const DOC_COLUMNS = 'id,person_id,title,content,counsel_only,author_label,updated_by,created_at,updated_at,archived_at,evidence_id'
const DOC_COLUMNS_BEFORE_EVIDENCE = 'id,person_id,title,content,counsel_only,author_label,updated_by,created_at,updated_at,archived_at'

type Res<T> = { data: T | null; error: { code?: string; message: string } | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function loadPersonDocuments(personId: string): Promise<{ documents: PersonDocumentIndexRow[]; heldWhy: string | null }> {
  const read = async (columns: string) => (await db.from('person_document_index').select(columns).eq('person_id', personId)) as Res<Partial<PersonDocumentIndexRow>[]>
  let res = await read(INDEX_COLUMNS)
  if (res.error && res.error.code === '42703') res = await read(INDEX_COLUMNS_BEFORE_EVIDENCE)
  if (res.error) {
    if (res.error.code === '42P01' || /does not exist/i.test(res.error.message)) return { documents: [], heldWhy: null }
    return { documents: [], heldWhy: res.error.message }
  }
  const rows = (res.data ?? []).map((r) => ({ ...r, evidence_id: r.evidence_id ?? null }) as PersonDocumentIndexRow)
  return { documents: sortDocumentsNewestFirst(rows), heldWhy: null }
}

export async function loadPersonDocument(id: string): Promise<{ document: PersonDocumentRow | null; why: string | null }> {
  type DocRes = Res<Omit<PersonDocumentRow, 'chars' | 'sections' | 'evidence_id'> & { evidence_id?: string | null }>
  const read = async (columns: string) => (await db.from('person_documents').select(columns).eq('id', id).maybeSingle()) as DocRes
  let res = await read(DOC_COLUMNS)
  if (res.error && res.error.code === '42703') res = await read(DOC_COLUMNS_BEFORE_EVIDENCE)
  if (res.error) return { document: null, why: res.error.message }
  if (!res.data) return { document: null, why: 'That document is not on the file any more.' }
  return { document: { ...res.data, evidence_id: res.data.evidence_id ?? null, chars: res.data.content.length, sections: 0 }, why: null }
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

export type TieDocumentArgs = {
  personId: string
  docId: string
  /** The record the document transcribes; null unties it. */
  evidenceId: string | null
  /** The updated_at the reader loaded, so a tie over a version kept since is refused. */
  expectUpdatedAt: string | null
}

/**
 * v2.6713 (punch list #287): the one section-free write — `{ doc_id, evidence_id }` to `dev_person_doc_write`, as the
 * seat's `plan_person_doc` sends it. The function refuses a record on another person and a counsel-only record under a
 * document not so marked; its reason comes back as it wrote it.
 */
export async function tieDocumentToEvidence(args: TieDocumentArgs): Promise<SavePersonDocumentOutcome> {
  const p: Record<string, unknown> = { person_id: args.personId, doc_id: args.docId, evidence_id: args.evidenceId }
  if (args.expectUpdatedAt) p.expect_updated_at = args.expectUpdatedAt
  try {
    const { data, error } = (await db.rpc('dev_person_doc_write', { p, p_dry_run: false })) as Res<{ ok?: boolean; document?: { id?: string }; updated_at?: string }>
    if (error) return { ok: false, why: formatErrorMessage(error, 'the record was not tied') }
    return { ok: true, docId: data?.document?.id ?? args.docId, updatedAt: data?.updated_at ?? null }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e, 'the record was not tied') }
  }
}
