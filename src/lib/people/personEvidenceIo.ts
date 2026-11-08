import { supabase } from '../supabase'
import { driveFileIdFromUrl, evidenceMime, evidenceStoragePath, type PersonEvidenceDraft, type PersonEvidenceFile, type PersonEvidenceLink, type PersonEvidenceRecord } from './personEvidence'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Evidence records on a person's file: the reads and the one write. A record is inserted first, then each file is
 * staged in the private `hr-files` bucket with a `person_file_attachments` row that names the record, then
 * `hr-evidence-drive` is asked to move the bytes into Drive — fail-soft: a function not deployed yet or a Drive refusal
 * leaves the record standing as *on its way* / *not in Drive*, and the sweep tries again. Nothing here updates or deletes.
 *
 * Until the migration `20261102210000_person_file_evidence.sql` is pushed, the table does not exist: `loadPersonEvidence`
 * reads that as no records (42P01), so the rest of the file still draws; a save says why it could not.
 */

const HR_FILES_BUCKET = 'hr-files'
/** The table and the new columns are not in `database.ts` until the migration is pushed and the types regenerated. */
const db = supabase as unknown as import('@supabase/supabase-js').SupabaseClient


type RecordRow = Omit<PersonEvidenceRecord, 'files'>

const RECORD_COLUMNS = 'id, person_id, entry_id, dated_on, title, memo, created_by, author_label, created_at, drive_folder_id, drive_folder_url, filed_at, fail_why, counsel_only, superseded_by_document_id, superseded_at, superseded_by'
/** Before migration 20261108110000 is pushed the superseded columns are not there (42703); the read falls back and no record reads as superseded. */
const RECORD_COLUMNS_BEFORE_SUPERSEDED = 'id, person_id, entry_id, dated_on, title, memo, created_by, author_label, created_at, drive_folder_id, drive_folder_url, filed_at, fail_why, counsel_only'
/** Before migration 20261106020000 is pushed the column is not there; the read falls back and every record reads as not counsel-only. */
const RECORD_COLUMNS_BEFORE_COUNSEL = 'id, person_id, entry_id, dated_on, title, memo, created_by, author_label, created_at, drive_folder_id, drive_folder_url, filed_at, fail_why'
const FILE_COLUMNS = 'id, evidence_id, entry_id, filename, mime_type, size_bytes, storage_path, drive_file_id, drive_url, filed_at, fail_why, created_at, sha256'
const FILE_COLUMNS_BEFORE_HASH = 'id, evidence_id, entry_id, filename, mime_type, size_bytes, storage_path, drive_file_id, drive_url, filed_at, fail_why, created_at'

/** The digest of the bytes as picked (v2.6544), lower-case hex. */
async function sha256HexOf(file: File): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

export type PersonEvidenceLoad = { records: PersonEvidenceRecord[]; /** Why the table could not be read, or null; a missing table reads as no records. */ heldWhy: string | null }

export async function loadPersonEvidence(personId: string): Promise<PersonEvidenceLoad> {
  type RecordsRes = { data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }
  const readRecords = async (columns: string): Promise<RecordsRes> => (await db.from('person_file_evidence').select(columns).eq('person_id', personId)) as unknown as RecordsRes
  let res = await readRecords(RECORD_COLUMNS)
  if (res.error && res.error.code === '42703') res = await readRecords(RECORD_COLUMNS_BEFORE_SUPERSEDED)
  if (res.error && res.error.code === '42703') res = await readRecords(RECORD_COLUMNS_BEFORE_COUNSEL)
  if (res.error) {
    // 42P01: the migration is not pushed yet — nothing to show, nothing to say.
    if (res.error.code === '42P01' || /does not exist/i.test(res.error.message)) return { records: [], heldWhy: null }
    return { records: [], heldWhy: res.error.message }
  }
  const rows = (res.data ?? []) as unknown as RecordRow[]
  if (rows.length === 0) return { records: [], heldWhy: null }
  type FilesRes = { data: unknown[] | null; error: { code?: string; message: string } | null }
  const readFiles = async (columns: string): Promise<FilesRes> => (await db.from('person_file_attachments').select(columns).in('evidence_id', rows.map((r) => r.id))) as unknown as FilesRes
  let filesRes = await readFiles(FILE_COLUMNS)
  // Before the sha256 column is pushed (42703), the files read without it.
  if (filesRes.error && filesRes.error.code === '42703') filesRes = await readFiles(FILE_COLUMNS_BEFORE_HASH)
  const files = (filesRes.error ? [] : ((filesRes.data ?? []) as unknown as PersonEvidenceFile[]))
  const byRecord = new Map<string, PersonEvidenceFile[]>()
  for (const f of files) {
    if (!f.evidence_id) continue
    const list = byRecord.get(f.evidence_id) ?? []
    list.push(f)
    byRecord.set(f.evidence_id, list)
  }
  return { records: rows.map((r) => ({ ...r, files: byRecord.get(r.id) ?? [] })), heldWhy: null }
}

export type SaveEvidenceArgs = {
  personId: string
  draft: PersonEvidenceDraft
  files: File[]
  /** Files already in Drive, linked rather than staged (v2.6541). */
  links?: PersonEvidenceLink[]
  /** The entry it proves, when it was attached to one. */
  entryId?: string | null
  authUserId: string | null
}

export type SaveEvidenceOutcome =
  | { ok: true; recordId: string; staged: number; linked: number; drive: { filed: number; remaining: number; failWhy: string | null } | null }
  | { ok: false; why: string }

/**
 * Insert the record, stage each file, write each link, ask Drive for the staged ones. The record stands even when a file
 * or Drive fails; the words say which. A record of links alone never asks Drive: every file is already there.
 */
export async function savePersonEvidence(args: SaveEvidenceArgs): Promise<SaveEvidenceOutcome> {
  const { personId, draft, files, links = [], entryId = null, authUserId } = args
  const ins = await db
    .from('person_file_evidence')
    .insert({ person_id: personId, entry_id: entryId, dated_on: draft.datedOn, title: draft.title.trim(), memo: draft.memo.trim(), created_by: authUserId, ...(draft.counselOnly ? { counsel_only: true } : {}) })
    .select('id')
    .single()
  if (ins.error && ins.error.code === '42703' && draft.counselOnly) return { ok: false, why: 'Counsel-only is not on this database yet: the migration has not been pushed. The record was not kept.' }
  if (ins.error) {
    if (ins.error.code === '42P01' || /does not exist/i.test(ins.error.message)) return { ok: false, why: 'Evidence records are not on this database yet: the migration has not been pushed.' }
    return { ok: false, why: ins.error.message }
  }
  const recordId = (ins.data as { id: string }).id
  let staged = 0
  const failures: string[] = []
  for (const file of files) {
    const fileId = crypto.randomUUID()
    const path = evidenceStoragePath(personId, recordId, fileId, file.name)
    const mime = evidenceMime(file)
    const up = await supabase.storage.from(HR_FILES_BUCKET).upload(path, file, { contentType: mime, upsert: false })
    if (up.error) {
      failures.push(`${file.name}: ${up.error.message}`)
      continue
    }
    const sha256 = await sha256HexOf(file)
    let row = await db.from('person_file_attachments').insert({
      id: fileId,
      person_id: personId,
      entry_id: entryId,
      evidence_id: recordId,
      storage_path: path,
      filename: file.name,
      mime_type: mime,
      size_bytes: file.size,
      ...(sha256 ? { sha256 } : {}),
      uploaded_by: authUserId,
    })
    // Before the sha256 column is pushed, the row is written without it.
    if (row.error && sha256 && /sha256/.test(row.error.message)) {
      row = await db.from('person_file_attachments').insert({ id: fileId, person_id: personId, entry_id: entryId, evidence_id: recordId, storage_path: path, filename: file.name, mime_type: mime, size_bytes: file.size, uploaded_by: authUserId })
    }
    if (row.error) {
      failures.push(`${file.name}: ${row.error.message}`)
      continue
    }
    staged += 1
  }
  // A linked file (v2.6541): its row carries the link and no staged copy; it reads as in Drive from the start.
  let linked = 0
  for (const l of links) {
    const url = l.driveUrl.trim()
    const row = await db.from('person_file_attachments').insert({
      id: crypto.randomUUID(),
      person_id: personId,
      entry_id: entryId,
      evidence_id: recordId,
      storage_path: null,
      filename: l.name.trim(),
      mime_type: null,
      size_bytes: null,
      drive_file_id: driveFileIdFromUrl(url),
      drive_url: url,
      filed_at: new Date().toISOString(),
      uploaded_by: authUserId,
    })
    if (row.error) {
      failures.push(`${l.name}: ${row.error.message}`)
      continue
    }
    linked += 1
  }
  if (staged === 0 && linked === 0 && files.length + links.length > 0) return { ok: false, why: `The record was kept but no file could be staged or linked. ${failures.join(' ')}` }
  if (staged === 0) return { ok: true, recordId, staged, linked, drive: { filed: linked, remaining: 0, failWhy: null } }
  // Drive: fail-soft. A function not deployed, or a refusal, leaves the record waiting for the sweep.
  // v2.6554: a counsel-only record never asks Drive; the bucket copy is the only copy in the app.
  let drive: { filed: number; remaining: number; failWhy: string | null } | null = null
  if (draft.counselOnly) return { ok: true, recordId, staged, linked, drive: null }
  try {
    const { data, error } = await supabase.functions.invoke('hr-evidence-drive', { body: { evidence_id: recordId } })
    if (!error && data && typeof data === 'object') {
      const d = data as { filed?: number; remaining?: number; fail_why?: string | null }
      drive = { filed: d.filed ?? 0, remaining: d.remaining ?? staged, failWhy: d.fail_why ?? null }
    }
  } catch {
    drive = null
  }
  return { ok: true, recordId, staged, linked, drive }
}

/** Ask Drive again for one record (the foot's *Try Drive again*). */
export async function fileEvidenceToDrive(recordId: string): Promise<{ ok: boolean; why: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('hr-evidence-drive', { body: { evidence_id: recordId } })
    if (error) return { ok: false, why: error.message }
    const d = (data ?? {}) as { fail_why?: string | null; error?: string }
    if (d.error) return { ok: false, why: d.error }
    return { ok: !d.fail_why, why: d.fail_why ?? null }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}

/**
 * Mark a Drive-linked record as superseded by a named document, or lift the mark (v2.6704, punch list #277 open call
 * 2): `person_evidence_supersede` (migration 20261108110000), devs only, which holds the rules — every file a Drive
 * link, the document kept and on the same person. The record stays with its link; the reason comes back as written.
 */
export async function supersedeEvidenceWithDocument(args: { evidenceId: string; documentId: string | null }): Promise<{ ok: true; title: string | null } | { ok: false; why: string }> {
  try {
    const { data, error } = (await db.rpc('person_evidence_supersede', { p_evidence_id: args.evidenceId, p_document_id: args.documentId })) as { data: { document?: { title?: string } } | null; error: { message: string } | null }
    if (error) return { ok: false, why: formatErrorMessage(error, 'the mark was refused') }
    return { ok: true, title: data?.document?.title ?? null }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e, 'the mark was refused') }
  }
}
