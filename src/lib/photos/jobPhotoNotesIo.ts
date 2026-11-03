/**
 * The reads and writes behind a job's photos (punch list #244). The bytes go to the private `job-photo-notes` bucket
 * as `<job_id>/<photo_id>.jpg` and a row in `job_photo_notes` follows; the press writes the words, the stage and
 * `added_at` on each row; a window closed without the press discards its rows and objects; the viewer edits the words
 * later. Browser io, not pure. The table is not in the generated types until the push and the types PR, so the client
 * is cast once here, and a database ahead of the push answers a refusal in words.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { errorKindOf, formatErrorMessage, type DatabaseErrorKind } from '../../utils/errorHandling'
import { JOB_PHOTO_NOTES_BUCKET, jobPhotoCaption, jobPhotoNotePath, type JobPhotoAddWrite, type JobPhotoNoteRow } from './jobPhotoNotes'
import { UPLOADED_PHOTOS_SELECT, type UploadedPhotoRow } from './uploadedPhotos'

const db = supabase as unknown as SupabaseClient

/** Why a shot did not send, with its class: a `network` failure is the phone with no signal. */
export class PhotoSendError extends Error {
  kind: DatabaseErrorKind
  constructor(message: string, kind: DatabaseErrorKind) {
    super(message)
    this.name = 'PhotoSendError'
    this.kind = kind
  }
}

export type SendShotInput = {
  id: string
  jobId: string
  blob: Blob
  byUserId: string
  byName: string
  takenAt: string
  originalBytes: number
  width: number
  height: number
}

/** The io a shot-tile host mounts: where the bytes and the row go, and how an unadded shot is taken back. */
export interface ShotIo {
  send: (input: SendShotInput) => Promise<{ storagePath: string }>
  discard: (photos: ReadonlyArray<{ id: string; storagePath: string | null }>) => Promise<void>
}

/**
 * The bytes to the bucket, then the row. Throws with the reason when the phone has no signal or the bucket refuses
 * (over 2 MB, no door to the job); the caller keeps the tile with Retry.
 */
export async function sendJobPhotoNote(input: SendShotInput): Promise<{ storagePath: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new PhotoSendError('The phone has no signal.', 'network')
  const storagePath = jobPhotoNotePath(input.jobId, input.id)
  const { error } = await db.storage.from(JOB_PHOTO_NOTES_BUCKET).upload(storagePath, input.blob, { contentType: input.blob.type || 'image/jpeg', upsert: true })
  if (error) throw new PhotoSendError(formatErrorMessage(error, 'The photo did not send.'), errorKindOf(error))
  const { error: rowError } = await db.from('job_photo_notes').upsert(
    {
      id: input.id,
      job_id: input.jobId,
      by_user_id: input.byUserId,
      by_name: input.byName,
      taken_at: input.takenAt,
      bytes: input.blob.size,
      original_bytes: input.originalBytes,
      width: input.width,
      height: input.height,
      storage_path: storagePath,
    },
    { onConflict: 'id' },
  )
  if (rowError) {
    // The bytes without a row would wait forever; take them back.
    await db.storage.from(JOB_PHOTO_NOTES_BUCKET).remove([storagePath]).catch(() => undefined)
    throw new PhotoSendError(formatErrorMessage(rowError, 'The photo did not send.'), errorKindOf(rowError))
  }
  return { storagePath }
}

/** A window closed without the press: its sent shots leave the bucket and the table. Best-effort. */
export async function discardJobPhotoNotes(photos: ReadonlyArray<{ id: string; storagePath: string | null }>): Promise<void> {
  const paths = photos.map((p) => p.storagePath).filter((p): p is string => Boolean(p))
  if (paths.length) await db.storage.from(JOB_PHOTO_NOTES_BUCKET).remove(paths).catch(() => undefined)
  const ids = photos.map((p) => p.id)
  if (ids.length) await db.from('job_photo_notes').delete().in('id', ids).is('added_at', null)
}

export const jobPhotoNotesShotIo: ShotIo = { send: sendJobPhotoNote, discard: discardJobPhotoNotes }

/**
 * The press: each sent shot takes its words, its stage, its caption and `added_at`, one update a row, best-effort.
 * `failedIds` names the shots that did not add, so the window keeps their tiles.
 */
export async function addJobPhotoNotes(writes: ReadonlyArray<JobPhotoAddWrite>): Promise<{ added: number; failed: string[]; failedIds: string[] }> {
  let added = 0
  const failed: string[] = []
  const failedIds: string[] = []
  const addedAt = new Date().toISOString()
  for (const w of writes) {
    const { error } = await db
      .from('job_photo_notes')
      .update({ description: w.description, fixture_id: w.fixtureId, stage_name: w.stageName ?? '', caption: w.caption, added_at: addedAt })
      .eq('id', w.id)
    if (error) {
      failed.push(formatErrorMessage(error, 'A photo did not add.'))
      failedIds.push(w.id)
    } else added += 1
  }
  return { added, failed, failedIds }
}

/** The viewer's Edit the words: the description and the caption it names; the sweep renames the Drive file on its next pass. Throws with the reason. */
export async function editJobPhotoNoteWords(id: string, input: { description: string; stageName: string | null }): Promise<void> {
  const { error } = await db
    .from('job_photo_notes')
    .update({ description: input.description, caption: jobPhotoCaption(input) })
    .eq('id', id)
  if (error) throw new Error(formatErrorMessage(error, 'The words did not save.'))
}

export type JobPhotoNoteForGrid = JobPhotoNoteRow & { previewUrl: string | null }

/** A job's added photos, newest first, with a signed URL for each shot still waiting in the bucket. Throws with the reason. */
export async function loadJobPhotoNotes(jobId: string): Promise<JobPhotoNoteForGrid[]> {
  const { data, error } = await db
    .from('job_photo_notes')
    .select('id, job_id, fixture_id, stage_name, description, caption, by_user_id, by_name, taken_at, added_at, bytes, original_bytes, storage_path, drive_file_id, filed_at, fail_why')
    .eq('job_id', jobId)
    .not('added_at', 'is', null)
    .order('taken_at', { ascending: false })
  if (error) throw new Error(formatErrorMessage(error, 'The photos did not read.'))
  const rows = (data ?? []) as JobPhotoNoteRow[]
  const out: JobPhotoNoteForGrid[] = []
  for (const r of rows) {
    let previewUrl: string | null = null
    if (!r.drive_file_id && r.storage_path) {
      const { data: signed } = await db.storage.from(JOB_PHOTO_NOTES_BUCKET).createSignedUrl(r.storage_path, 3600)
      previewUrl = signed?.signedUrl ?? null
    }
    out.push({ ...r, previewUrl })
  }
  return out
}

/** The rows the view holds for one job, every source, newest first, at most `limit`. Throws with the reason. */
export async function loadJobUploadedPhotos(jobId: string, limit = 500): Promise<UploadedPhotoRow[]> {
  const { data, error } = await db.from('uploaded_photos').select(UPLOADED_PHOTOS_SELECT).eq('job_id', jobId).order('taken_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
  if (error) throw new Error(formatErrorMessage(error, 'The photos did not read.'))
  return (data ?? []) as UploadedPhotoRow[]
}
