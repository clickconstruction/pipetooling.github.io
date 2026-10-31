/**
 * A checklist per stage (punch list #164, PR 3): the crew's side of the io. A job's stages come through
 * `list_job_stage_progress` (SECURITY DEFINER, v2.3192: field roles cannot read line items, and no price leaves it);
 * the answers are `stage_checklist_answers` rows, one per stage and question, written as each press lands so a sheet
 * closed early keeps what was answered. A photo is shrunk on the phone, put in the `stage-checklist-photos` bucket as
 * `<job_id>/<answer_id>-<ms>.jpg`, and named on the row; the `photo-save` sweep files it in the customer's Drive folder.
 * The rules are `stageChecklist.ts`; the screens take this io so their tests run over a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError, formatErrorMessage } from '../../utils/errorHandling'
import { REPORT_PHOTOS_BUCKET, reportPhotoPath } from '../photos/reportPhotos'
import { stageProgressRowsFromRpc } from '../reports/stageProgressReport'
import { type JobStageRef, type StageChecklistAnswer, type StageChecklistPick, type StageChecklistQuestion } from './stageChecklist'
import { loadQuestions } from './stageChecklistIo'

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
  photo_file_name: string | null
  photo_taken_at: string | null
  photo_storage_path: string | null
  photo_drive_file_id: string | null
  photo_filed_at: string | null
  photo_fail_why: string | null
  /** The report photo that is the answer's photo (punch list #189 PR 6, migration 20261031150000); absent before the push. */
  report_photo_id?: string | null
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
  return { id: r.id, fixtureId: r.fixture_id, questionId: r.question_id, pick, note: r.note ?? '', photo, storagePath: r.photo_storage_path, reportPhotoId: r.report_photo_id ?? null }
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

/** The row for a stage and question, made when there is none yet. */
async function ensureAnswerRow(key: AnswerKey, who: AnswerWho): Promise<JobAnswer> {
  const found = await db.from('stage_checklist_answers').select(ANSWER_COLS).eq('fixture_id', key.fixtureId).eq('question_id', key.questionId).maybeSingle()
  checkSupabaseError(found, 'read the answer')
  if (found.data) return answerFromRow(found.data as AnswerRow)
  const made = await db
    .from('stage_checklist_answers')
    .insert({ job_id: key.jobId, fixture_id: key.fixtureId, question_id: key.questionId, answered_by: who.userId, answered_by_name: who.name })
    .select(ANSWER_COLS)
    .single()
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

/** The sheet's and the strip's io. */
export interface StageChecklistSheetIo {
  stages: (jobId: string) => Promise<JobStageRef[]>
  questions: () => Promise<StageChecklistQuestion[]>
  answers: (jobId: string) => Promise<JobAnswer[]>
  pick: (key: AnswerKey, pick: StageChecklistPick, who: AnswerWho) => Promise<JobAnswer>
  note: (key: AnswerKey, note: string, who: AnswerWho) => Promise<JobAnswer>
  photo: (input: AttachPhotoInput, who: AnswerWho) => Promise<JobAnswer>
  photoUrl: (photo: WaitingPhotoRef) => Promise<string | null>
}

export function supabaseStageChecklistSheetIo(): StageChecklistSheetIo {
  return { stages: loadJobStages, questions: loadQuestions, answers: loadJobAnswers, pick: saveAnswerPick, note: saveAnswerNote, photo: attachAnswerPhoto, photoUrl: waitingPhotoUrl }
}
