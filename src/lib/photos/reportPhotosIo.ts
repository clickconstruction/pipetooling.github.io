/**
 * The reads and writes behind a report's photos (punch list #189, PR 5b). The bytes go to the private
 * `report-photos` bucket as `<job_id>/<photo_id>.jpg` and a row in `report_photos` follows; Save writes the report's
 * id and the stage on each row; a form closed without saving discards its rows and objects; a card reads a report's
 * rows, with a short-lived signed URL for a shot still waiting in the bucket. Browser io, not pure. The table is not
 * in the generated types until the push and the types PR, so the client is cast once here.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { errorKindOf, formatErrorMessage, type DatabaseErrorKind } from '../../utils/errorHandling'
import { REPORT_PHOTOS_BUCKET, reportPhotoPath, type ReportPhotoRow } from './reportPhotos'
import { REPORT_PHOTO_SIZE_SETTING_KEY, photoSizeFromSetting, type ReportPhotoSize } from './shrink'

const db = supabase as unknown as SupabaseClient

/** The office's size, Medium when the row is missing or the read fails (the form must never wait on it). */
export async function loadReportPhotoSize(): Promise<ReportPhotoSize> {
  try {
    const { data } = await db.from('app_settings').select('value_text').eq('key', REPORT_PHOTO_SIZE_SETTING_KEY).maybeSingle()
    return photoSizeFromSetting((data as { value_text?: string | null } | null)?.value_text ?? null)
  } catch {
    return photoSizeFromSetting(null)
  }
}

/** A master or a dev sets the size (the key-scoped policy); an upsert so a missing row is made. */
export async function setReportPhotoSize(size: ReportPhotoSize): Promise<void> {
  const { error } = await db.from('app_settings').upsert({ key: REPORT_PHOTO_SIZE_SETTING_KEY, value_text: size }, { onConflict: 'key' })
  if (error) throw new Error(formatErrorMessage(error, 'The size did not save.'))
}

/** Why a shot did not send, with its class (punch list #229, PR 6): a `network` failure keeps the shot on the phone. */
export class ReportPhotoSendError extends Error {
  kind: DatabaseErrorKind
  constructor(message: string, kind: DatabaseErrorKind) {
    super(message)
    this.name = 'ReportPhotoSendError'
    this.kind = kind
  }
}

export type SendReportPhotoInput = {
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

/**
 * The bytes to the bucket, then the row. Throws with the reason when the phone has no signal or the bucket refuses
 * (over 2 MB, no door to the job); the caller keeps the tile with Retry.
 */
export async function sendReportPhoto(input: SendReportPhotoInput): Promise<{ storagePath: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ReportPhotoSendError('The phone has no signal.', 'network')
  const storagePath = reportPhotoPath(input.jobId, input.id)
  const { error } = await db.storage.from(REPORT_PHOTOS_BUCKET).upload(storagePath, input.blob, { contentType: input.blob.type || 'image/jpeg', upsert: true })
  if (error) throw new ReportPhotoSendError(formatErrorMessage(error, 'The photo did not send.'), errorKindOf(error))
  const { error: rowError } = await db.from('report_photos').upsert(
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
    await db.storage.from(REPORT_PHOTOS_BUCKET).remove([storagePath]).catch(() => undefined)
    throw new ReportPhotoSendError(formatErrorMessage(rowError, 'The photo did not send.'), errorKindOf(rowError))
  }
  return { storagePath }
}

export type AttachReportPhoto = { id: string; fixtureId: string | null; stageName: string | null; caption: string }

/** Save: each sent shot takes the report's id, its stage and its caption, one update a row, best-effort. `failedIds` names the shots that did not, so nothing else builds on them. */
export async function attachReportPhotos(reportId: string, photos: ReadonlyArray<AttachReportPhoto>): Promise<{ attached: number; failed: string[]; failedIds?: string[] }> {
  let attached = 0
  const failed: string[] = []
  const failedIds: string[] = []
  for (const p of photos) {
    const { error } = await db
      .from('report_photos')
      .update({ report_id: reportId, fixture_id: p.fixtureId, stage_name: p.stageName ?? '', caption: p.caption })
      .eq('id', p.id)
    if (error) {
      failed.push(formatErrorMessage(error, 'A photo did not attach.'))
      failedIds.push(p.id)
    } else attached += 1
  }
  return { attached, failed, failedIds }
}

/** A form closed without saving: its sent shots leave the bucket and the table. Best-effort. */
export async function discardReportPhotos(photos: ReadonlyArray<{ id: string; storagePath: string | null }>): Promise<void> {
  const paths = photos.map((p) => p.storagePath).filter((p): p is string => Boolean(p))
  if (paths.length) await db.storage.from(REPORT_PHOTOS_BUCKET).remove(paths).catch(() => undefined)
  const ids = photos.map((p) => p.id)
  if (ids.length) await db.from('report_photos').delete().in('id', ids).is('report_id', null)
}

/** Whether the job has a Drive folder for the sweep to file into; null when the read fails. */
export async function jobHasDriveFolder(jobId: string): Promise<boolean | null> {
  try {
    const { data } = await db.from('jobs_ledger').select('google_drive_link, job_pictures_link').eq('id', jobId).maybeSingle()
    const row = data as { google_drive_link?: string | null; job_pictures_link?: string | null } | null
    if (!row) return null
    return Boolean((row.google_drive_link ?? '').trim() || (row.job_pictures_link ?? '').trim())
  } catch {
    return null
  }
}

export type ReportPhotoForCard = ReportPhotoRow & { previewUrl: string | null }

/** A saved report's photos, oldest first, with a signed URL for each shot still waiting in the bucket. */
export async function loadReportPhotos(reportId: string): Promise<ReportPhotoForCard[]> {
  const { data, error } = await db
    .from('report_photos')
    .select('id, job_id, report_id, fixture_id, stage_name, caption, by_name, taken_at, bytes, original_bytes, storage_path, drive_file_id, filed_at, fail_why')
    .eq('report_id', reportId)
    .order('taken_at', { ascending: true })
  if (error) throw new Error(formatErrorMessage(error, 'The photos did not read.'))
  const rows = (data ?? []) as ReportPhotoRow[]
  const out: ReportPhotoForCard[] = []
  for (const r of rows) {
    let previewUrl: string | null = null
    if (!r.drive_file_id && r.storage_path) {
      const { data: signed } = await db.storage.from(REPORT_PHOTOS_BUCKET).createSignedUrl(r.storage_path, 3600)
      previewUrl = signed?.signedUrl ?? null
    }
    out.push({ ...r, previewUrl })
  }
  return out
}
