/**
 * A checklist per stage (punch list #164, PR 3): the crew's side of the io. A job's stages come through
 * `list_job_stage_progress` (SECURITY DEFINER, v2.3192: field roles cannot read line items, and no price leaves it);
 * the answers are `stage_checklist_answers` rows, one per stage and question, written as each press lands so a sheet
 * closed early keeps what was answered. A photo is shrunk on the phone, put in the `stage-checklist-photos` bucket as
 * `<job_id>/<answer_id>-<ms>.jpg`, and named on the row; the `photo-save` sweep files it in the customer's Drive folder.
 * A signature (#237 PR 2, migration 20261106040000) is the row's own six columns, written with the pick in one update
 * (`signAnswer`); a drawn mark's PNG goes in the same bucket under `<job_id>/sig/`, which the sweep never reads. *Take
 * it back* voids the row (`takeBackAnswer`), and the next press makes a new live row for the stage and question, so a
 * read carries the voided rows beside the live ones and every reader takes the live one (`liveAnswersById`). The rules
 * are `stageChecklist.ts` and `stageChecklistSignature.ts`; the screens take this io so their tests run over a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError, formatErrorMessage } from '../../utils/errorHandling'
import { REPORT_PHOTOS_BUCKET, reportPhotoPath } from '../photos/reportPhotos'
import { stageProgressRowsFromRpc } from '../reports/stageProgressReport'
import { trimSignatureInk } from '../signatureInkTrim'
import { checklistAnswerHash, type ChecklistSignatureMode, type JobStageRef, type StageChecklistAnswer, type StageChecklistPick, type StageChecklistQuestion } from './stageChecklist'
import { PRINTED_NAME_MAX_CHARS, TAKE_BACK_WORDS, VOID_WHY_MAX_CHARS, signaturePngPath } from './stageChecklistSignature'
import { supabaseStageCheckDispatchIo, type StageCheckDispatchIo } from './stageCheckDispatchIo'
import { addJobItem, loadQuestionsForJob, mayAuthorOnJob, promoteJobItem, putBackQuestion, reorderJobItems, retireJobItem, skipQuestion, supabaseStageChecklistCompanyIo, type AddJobItemInput, type QuestionSkip, type SkipQuestionInput, type StageChecklistCompanyIo } from './stageChecklistIo'
import type { ChecklistRecord } from './stageChecklistRecord'
import { amendRecord, loadJobRecords } from './stageChecklistRecordIo'

// The tables are younger than the generated types; the types PR after the push removes this cast.
const db = supabase as unknown as SupabaseClient

export const STAGE_CHECKLIST_PHOTOS_BUCKET = 'stage-checklist-photos'

/** An answer row as the table keeps it. */
export interface AnswerRow {
  id: string
  fixture_id: string
  question_id: string
  pick: string | null
  note: string | null
  answered_by_name?: string | null
  answered_at?: string | null
  photo_file_name: string | null
  photo_taken_at: string | null
  photo_storage_path: string | null
  photo_drive_file_id: string | null
  photo_filed_at: string | null
  photo_fail_why: string | null
  /** The report photo that is the answer's photo (punch list #189 PR 6, migration 20261031150000); absent before the push. */
  report_photo_id?: string | null
  /** The signature and the void (#237 PR 2, migration 20261106040000). */
  signed_at?: string | null
  signed_by?: string | null
  signer_printed_name?: string | null
  signer_signature_mode?: string | null
  signer_signature_storage_path?: string | null
  signed_answer_hash?: string | null
  voided_at?: string | null
  voided_by?: string | null
  voided_by_name?: string | null
  void_why?: string | null
}

/** The kernel's answer from a row. */
export function answerFromRow(r: AnswerRow): StageChecklistAnswer & { id: string; fixtureId: string; storagePath: string | null; reportPhotoId: string | null } {
  const pick = r.pick === 'yes' || r.pick === 'no' || r.pick === 'not_here' ? r.pick : null
  const photo = r.photo_file_name
    ? {
        fileName: r.photo_file_name,
        takenAt: r.photo_taken_at ?? '',
        state: r.photo_filed_at ? ('filed' as const) : r.photo_fail_why ? ('failed' as const) : ('waiting' as const),
        driveFileId: r.photo_drive_file_id,
        failWhy: r.photo_fail_why,
      }
    : null
  const signature = r.signed_at
    ? { mode: (r.signer_signature_mode === 'draw' ? 'draw' : 'type') as ChecklistSignatureMode, printedName: r.signer_printed_name ?? '', storagePath: r.signer_signature_storage_path ?? null, signedAt: r.signed_at, signedById: r.signed_by ?? null, hash: r.signed_answer_hash ?? '' }
    : null
  const voided = r.voided_at ? { at: r.voided_at, by: r.voided_by_name ?? '', byId: r.voided_by ?? null, why: r.void_why ?? '' } : null
  return { id: r.id, fixtureId: r.fixture_id, questionId: r.question_id, pick, note: r.note ?? '', photo, answeredBy: r.answered_by_name ?? '', answeredAt: r.answered_at ?? null, storagePath: r.photo_storage_path, reportPhotoId: r.report_photo_id ?? null, signature, voided }
}

export type JobAnswer = ReturnType<typeof answerFromRow>

// Every column: `report_photo_id` (PR 6 of #189) is read when the push has made it and null before, so the read never
// names a column prod does not have yet.
const ANSWER_COLS = '*'

type UntypedRpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

/** The job's stages, as the report picker reads them. A refused or missing RPC reads as no stages. */
export async function loadJobStages(jobId: string): Promise<JobStageRef[]> {
  const client = supabase as unknown as { rpc: UntypedRpc }
  const { data, error } = await client.rpc('list_job_stage_progress', { p_job_id: jobId })
  if (error || !Array.isArray(data)) return []
  return stageProgressRowsFromRpc(data as Parameters<typeof stageProgressRowsFromRpc>[0]).map((r) => ({ fixtureId: r.fixtureId, name: r.name, sequenceOrder: r.sequenceOrder }))
}

export async function loadJobAnswers(jobId: string): Promise<JobAnswer[]> {
  const result = await db.from('stage_checklist_answers').select(ANSWER_COLS).eq('job_id', jobId)
  checkSupabaseError(result, 'read the checklist answers')
  return ((result.data ?? []) as AnswerRow[]).map(answerFromRow)
}

export interface AnswerKey {
  jobId: string
  fixtureId: string
  questionId: string
}

export interface AnswerWho {
  userId: string | null
  name: string
}

/** The live row for a stage and question (a row taken back is the record, never the answer), made when there is none yet. */
async function ensureAnswerRow(key: AnswerKey, who: AnswerWho): Promise<JobAnswer> {
  const found = await db.from('stage_checklist_answers').select(ANSWER_COLS).eq('fixture_id', key.fixtureId).eq('question_id', key.questionId).is('voided_at', null).maybeSingle()
  checkSupabaseError(found, 'read the answer')
  if (found.data) return answerFromRow(found.data as AnswerRow)
  const made = await db
    .from('stage_checklist_answers')
    .insert({ job_id: key.jobId, fixture_id: key.fixtureId, question_id: key.questionId, answered_by: who.userId, answered_by_name: who.name })
    .select(ANSWER_COLS)
    .single()
  // Another press made the row first, a note saving as a pick lands or a second phone: the row is there, so read it.
  if (made.error?.code === '23505') {
    const again = await db.from('stage_checklist_answers').select(ANSWER_COLS).eq('fixture_id', key.fixtureId).eq('question_id', key.questionId).is('voided_at', null).single()
    checkSupabaseError(again, 'read the answer')
    return answerFromRow(again.data as AnswerRow)
  }
  checkSupabaseError(made, 'save the answer')
  return answerFromRow(made.data as AnswerRow)
}

export async function saveAnswerPick(key: AnswerKey, pick: StageChecklistPick, who: AnswerWho): Promise<JobAnswer> {
  const row = await ensureAnswerRow(key, who)
  const now = new Date().toISOString()
  const result = await db
    .from('stage_checklist_answers')
    .update({ pick, answered_by: who.userId, answered_by_name: who.name, answered_at: now, updated_at: now })
    .eq('id', row.id)
    .select(ANSWER_COLS)
    .single()
  checkSupabaseError(result, 'save the answer')
  return answerFromRow(result.data as AnswerRow)
}

export async function saveAnswerNote(key: AnswerKey, note: string, who: AnswerWho): Promise<JobAnswer> {
  const row = await ensureAnswerRow(key, who)
  const now = new Date().toISOString()
  const result = await db.from('stage_checklist_answers').update({ note: note.trim().slice(0, 500), updated_at: now }).eq('id', row.id).select(ANSWER_COLS).single()
  checkSupabaseError(result, 'save the note')
  return answerFromRow(result.data as AnswerRow)
}

export interface SignAnswerInput extends AnswerKey {
  /** The question's words as the sheet shows them: the hash binds the signature to them. */
  questionWords: string
  pick: StageChecklistPick
  note: string
  printedName: string
  mode: ChecklistSignatureMode
  /** The drawn mark as a data URL; null for a typed signature. */
  pngDataUrl: string | null
  /** The press's moment, ISO: now for a live press, the pressed time for one that waited on the phone. */
  signedAt?: string
}

/**
 * The pick and the signature in one write (#237 PR 2): the live row is made or found, a drawn mark is trimmed to its
 * strokes and put in the bucket under `sig/`, and the row takes the pick, the note, the stamp and the six signature
 * columns, with the hash of the answer as given. The database holds the signature to the signer's own sign-in and locks
 * the row after. A row already signed by this signer with this hash (a resend from the outbox whose first try landed)
 * is answered as it stands, so a send that lands twice counts once.
 */
export async function signAnswer(input: SignAnswerInput, who: AnswerWho): Promise<JobAnswer> {
  const row = await ensureAnswerRow(input, who)
  const hash = checklistAnswerHash({ questionWords: input.questionWords, pick: input.pick, note: input.note })
  if (row.signature && row.signature.hash === hash && row.signature.signedById === who.userId) return row
  const signedAt = input.signedAt ?? new Date().toISOString()
  let path: string | null = null
  if (input.mode === 'draw') {
    if (!input.pngDataUrl) throw new Error('A drawn signature needs its mark.')
    const ink = await trimSignatureInk(input.pngDataUrl)
    const bytes = await (await fetch(ink)).blob()
    path = signaturePngPath(input.jobId, row.id, Date.parse(signedAt) || Date.now())
    const up = await db.storage.from(STAGE_CHECKLIST_PHOTOS_BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: false })
    if (up.error) throw new Error(formatErrorMessage(up.error, 'The signature did not send.'))
  }
  const now = new Date().toISOString()
  const result = await db
    .from('stage_checklist_answers')
    .update({
      pick: input.pick,
      note: input.note.trim().slice(0, 500),
      answered_by: who.userId,
      answered_by_name: who.name,
      answered_at: signedAt,
      signed_at: signedAt,
      signed_by: who.userId,
      signer_printed_name: input.printedName.trim().slice(0, PRINTED_NAME_MAX_CHARS),
      signer_signature_mode: input.mode,
      signer_signature_storage_path: path,
      signed_answer_hash: hash,
      updated_at: now,
    })
    .eq('id', row.id)
    .select(ANSWER_COLS)
    .single()
  checkSupabaseError(result, 'sign the answer')
  return answerFromRow(result.data as AnswerRow)
}

/** *Take it back*: the row is voided with who, when and why, and stays; the next press writes a new live row. */
export async function takeBackAnswer(answerId: string, why: string, who: AnswerWho): Promise<JobAnswer> {
  const now = new Date().toISOString()
  const result = await db
    .from('stage_checklist_answers')
    .update({ voided_at: now, voided_by: who.userId, voided_by_name: who.name.slice(0, 120), void_why: why.trim().slice(0, VOID_WHY_MAX_CHARS), updated_at: now })
    .eq('id', answerId)
    .is('voided_at', null)
    .select(ANSWER_COLS)
  checkSupabaseError(result, 'take the answer back')
  // The database's rule filters a write it refuses: no error and no row. That is a refusal, not a save.
  const rows = (result.data ?? []) as AnswerRow[]
  if (rows.length === 0) throw new Error(TAKE_BACK_WORDS.refused)
  return answerFromRow(rows[0]!)
}

/** A link to a drawn mark's PNG in the bucket, for the row's ink; null for a typed signature or when the bucket will not say. */
export async function signatureInkUrl(storagePath: string | null | undefined): Promise<string | null> {
  if (!storagePath) return null
  const { data } = await db.storage.from(STAGE_CHECKLIST_PHOTOS_BUCKET).createSignedUrl(storagePath, 3600)
  return data?.signedUrl ?? null
}

/** Where the shot waits in the bucket until the sweep files it. */
export function checklistPhotoPath(jobId: string, answerId: string, takenAtMs: number): string {
  return `${jobId}/${answerId}-${takenAtMs}.jpg`
}

export interface AttachPhotoInput extends AnswerKey {
  blob: Blob
  fileName: string
  takenAt: string
}

/** The shrunk shot into the bucket, then named on the row. Throws when the phone has no signal or the bucket refuses. */
export async function attachAnswerPhoto(input: AttachPhotoInput, who: AnswerWho): Promise<JobAnswer> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('The phone has no signal.')
  const row = await ensureAnswerRow(input, who)
  const path = checklistPhotoPath(input.jobId, row.id, Date.parse(input.takenAt) || Date.now())
  const up = await db.storage.from(STAGE_CHECKLIST_PHOTOS_BUCKET).upload(path, input.blob, { contentType: input.blob.type || 'image/jpeg', upsert: false })
  if (up.error) throw new Error(formatErrorMessage(up.error, 'The photo did not send.'))
  const now = new Date().toISOString()
  const result = await db
    .from('stage_checklist_answers')
    .update({
      photo_file_name: input.fileName.slice(0, 200),
      photo_taken_at: input.takenAt,
      photo_bytes: input.blob.size,
      photo_storage_path: path,
      photo_drive_file_id: null,
      photo_filed_at: null,
      photo_fail_why: null,
      updated_at: now,
    })
    .eq('id', row.id)
    .select(ANSWER_COLS)
    .single()
  checkSupabaseError(result, 'save the photo')
  return answerFromRow(result.data as AnswerRow)
}

export interface ReportPhotoAnswerInput extends AnswerKey {
  /** The `report_photos` row that is the answer's photo. */
  reportPhotoId: string
  fileName: string
  takenAt: string
  bytes: number
}

/**
 * A photo answers a checklist question (punch list #189, PR 6): the report photo onto the answer row for the stage
 * and question. The bytes stay in the report-photos bucket, so `photo_storage_path` is cleared and the report sweep
 * files the one copy; the row's trigger reads the photo's Drive standing and keeps it in step (`20261031150000`).
 */
export async function answerWithReportPhoto(input: ReportPhotoAnswerInput, who: AnswerWho): Promise<JobAnswer> {
  const row = await ensureAnswerRow(input, who)
  const now = new Date().toISOString()
  const result = await db
    .from('stage_checklist_answers')
    .update({
      report_photo_id: input.reportPhotoId,
      photo_file_name: input.fileName.slice(0, 200),
      photo_taken_at: input.takenAt,
      photo_bytes: input.bytes,
      photo_storage_path: null,
      photo_drive_file_id: null,
      photo_filed_at: null,
      photo_fail_why: null,
      updated_at: now,
    })
    .eq('id', row.id)
    .select(ANSWER_COLS)
    .single()
  checkSupabaseError(result, 'answer the question with the photo')
  return answerFromRow(result.data as AnswerRow)
}

/** Save's writes, one a question, best-effort: the ones that failed say why and the report stands saved. */
export async function answerQuestionsWithReportPhotos(writes: ReadonlyArray<ReportPhotoAnswerInput>, who: AnswerWho): Promise<{ answered: number; failed: string[] }> {
  let answered = 0
  const failed: string[] = []
  for (const w of writes) {
    try {
      await answerWithReportPhoto(w, who)
      answered += 1
    } catch (e) {
      failed.push(formatErrorMessage(e, 'The answer did not write.'))
    }
  }
  return { answered, failed }
}

/** What the sheet needs to show a photo still on its way: where it waits, in the checklist bucket or the report's. */
export interface WaitingPhotoRef {
  storagePath: string | null
  reportPhotoId: string | null
  jobId: string
}

/**
 * A link to a waiting shot, for the sheet's thumbnail: from the checklist bucket by its path, or from the report
 * bucket for a photo taken on a field report (PR 6); null once Drive has it or when the bucket will not say.
 */
export async function waitingPhotoUrl(photo: WaitingPhotoRef): Promise<string | null> {
  if (photo.storagePath) {
    const { data } = await db.storage.from(STAGE_CHECKLIST_PHOTOS_BUCKET).createSignedUrl(photo.storagePath, 3600)
    return data?.signedUrl ?? null
  }
  if (photo.reportPhotoId) {
    const { data } = await db.storage.from(REPORT_PHOTOS_BUCKET).createSignedUrl(reportPhotoPath(photo.jobId, photo.reportPhotoId), 3600)
    return data?.signedUrl ?? null
  }
  return null
}

/** The sheet's, the strip's and the Documents read-out's io. */
export interface StageChecklistSheetIo {
  stages: (jobId: string) => Promise<JobStageRef[]>
  /** The company's questions and the items added on this job (#237). */
  questions: (jobId: string) => Promise<StageChecklistQuestion[]>
  answers: (jobId: string) => Promise<JobAnswer[]>
  pick: (key: AnswerKey, pick: StageChecklistPick, who: AnswerWho) => Promise<JobAnswer>
  note: (key: AnswerKey, note: string, who: AnswerWho) => Promise<JobAnswer>
  photo: (input: AttachPhotoInput, who: AnswerWho) => Promise<JobAnswer>
  photoUrl: (photo: WaitingPhotoRef) => Promise<string | null>
  /** The pick and the signature in one write (#237 PR 2). */
  sign: (input: SignAnswerInput, who: AnswerWho) => Promise<JobAnswer>
  /** A signed answer taken back with a reason; the voided row comes back and stays. */
  takeBack: (answerId: string, why: string, who: AnswerWho) => Promise<JobAnswer>
  /** A link to a drawn mark, for the row's ink. */
  inkUrl: (storagePath: string | null | undefined) => Promise<string | null>
  /** A check added for one of the job's stages (#237). */
  addItem: (input: AddJobItemInput, who: AnswerWho) => Promise<StageChecklistQuestion>
  /** A job item taken off; its answer stays. */
  retireItem: (itemId: string, who: AnswerWho) => Promise<void>
  /** The database's answer to who authors on this job (PR 1b). */
  mayAuthor: (jobId: string) => Promise<boolean>
  /** A company question left off this job's stage, with its reason. */
  skip: (input: SkipQuestionInput, who: AnswerWho) => Promise<QuestionSkip>
  /** A skipped question put back. */
  putBack: (skipId: string, who: AnswerWho) => Promise<void>
  /** A stage's own checks in the order given. */
  reorder: (fixtureId: string, ids: readonly string[]) => Promise<void>
  /** One job item added to the company's list; returns the company's row. */
  promote: (itemId: string) => Promise<StageChecklistQuestion>
  /** The job's filed records, every version (#237 PR 3); the database files one by itself at the last answer. */
  records: (jobId: string) => Promise<ChecklistRecord[]>
  /** The office's Amend: the filed record reads amended with its reason, and the stage is open again. */
  amend: (recordId: string, why: string) => Promise<ChecklistRecord>
  /** Send a check to Dispatch (punch list #245): the job, the open requests and the send. The sheet draws no press without it. */
  dispatch?: StageCheckDispatchIo
  /** The company's list written from the job's Documents tab (#237 PR 4): add, take off with a reason, reorder. The read-out draws no company press without it. */
  company?: StageChecklistCompanyIo
}

export function supabaseStageChecklistSheetIo(): StageChecklistSheetIo {
  return { stages: loadJobStages, questions: loadQuestionsForJob, answers: loadJobAnswers, pick: saveAnswerPick, note: saveAnswerNote, photo: attachAnswerPhoto, photoUrl: waitingPhotoUrl, sign: signAnswer, takeBack: takeBackAnswer, inkUrl: signatureInkUrl, records: loadJobRecords, amend: amendRecord, addItem: addJobItem, retireItem: retireJobItem, mayAuthor: mayAuthorOnJob, skip: skipQuestion, putBack: putBackQuestion, reorder: reorderJobItems, promote: promoteJobItem, dispatch: supabaseStageCheckDispatchIo(), company: supabaseStageChecklistCompanyIo() }
}
