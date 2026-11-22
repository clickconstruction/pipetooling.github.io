/**
 * Write someone up, the photos (punch list #410, PR 5): the sends and the reads. A photo goes to the private
 * `person-report-photos` bucket under the writer's own folder, with a `person_report_photos` row keyed to the
 * write-up's press. The same send is safe to repeat: bytes already there and a row already there both count as sent,
 * which is what lets the replay try again after a lost answer. A dev reads a report's photos by its press. The rules
 * and the words are `writeUpPhotos.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { errorKindOf, formatErrorMessage } from '../../utils/errorHandling'
import { PhotoSendError } from '../photos/jobPhotoNotesIo'
import { bytesAlreadyThere } from '../photos/shotTiles'
import { WRITE_UP_PHOTOS_BUCKET, writeUpPhotoPath } from './writeUpPhotos'

const db = supabase as unknown as SupabaseClient

export interface SendWriteUpPhotoInput {
  id: string
  pressId: string
  blob: Blob
  byUserId: string
  takenAt: string
  width: number
  height: number
}

/** Sends one photo: the bytes, then its row. A second send of the same photo changes nothing. */
export async function sendWriteUpPhoto(input: SendWriteUpPhotoInput): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new PhotoSendError('The phone has no signal.', 'network')
  const storagePath = writeUpPhotoPath(input.byUserId, input.pressId, input.id)
  const { error } = await db.storage.from(WRITE_UP_PHOTOS_BUCKET).upload(storagePath, input.blob, { contentType: input.blob.type || 'image/jpeg', upsert: false })
  if (error && !bytesAlreadyThere(error)) throw new PhotoSendError(formatErrorMessage(error, 'The photo did not send.'), errorKindOf(error))
  const { error: rowError } = await db.from('person_report_photos').insert({
    id: input.id,
    press_id: input.pressId,
    author_user_id: input.byUserId,
    storage_path: storagePath,
    taken_at: input.takenAt,
    bytes: input.blob.size,
    // A shot the phone could not decode goes as it came, with no size known.
    width: input.width > 0 ? input.width : null,
    height: input.height > 0 ? input.height : null,
  })
  // 23505: the row landed on an earlier try whose answer was lost.
  if (rowError && rowError.code !== '23505') throw new PhotoSendError(formatErrorMessage(rowError, 'The photo did not send.'), errorKindOf(rowError))
}

export interface ReportPhotoRow {
  id: string
  press_id: string
  storage_path: string
  taken_at: string
}

export interface ReportPhoto extends ReportPhotoRow {
  /** A link that opens the photo for an hour, or null when it could not be signed. */
  url: string | null
}

/** The photos of the given presses, oldest first, each with a link to look at it. Empty when none or on any failure. */
export async function loadReportPhotos(pressIds: ReadonlyArray<string>): Promise<ReportPhoto[]> {
  const ids = [...new Set(pressIds.filter(Boolean))]
  if (ids.length === 0) return []
  const { data, error } = await db.from('person_report_photos').select('id, press_id, storage_path, taken_at').in('press_id', ids).order('taken_at', { ascending: true })
  if (error || !data || data.length === 0) return []
  const rows = data as ReportPhotoRow[]
  const signed = await db.storage.from(WRITE_UP_PHOTOS_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600)
  const urlByPath = new Map<string, string>()
  for (const s of signed.data ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  return rows.map((r) => ({ ...r, url: urlByPath.get(r.storage_path) ?? null }))
}

/** A report's photos as files, for the evidence record made when it is filed. A photo that cannot be read is left out. */
export async function reportPhotoFiles(pressId: string): Promise<File[]> {
  const { data, error } = await db.from('person_report_photos').select('id, press_id, storage_path, taken_at').eq('press_id', pressId).order('taken_at', { ascending: true })
  if (error || !data) return []
  const files: File[] = []
  let n = 0
  for (const r of data as ReportPhotoRow[]) {
    const got = await db.storage.from(WRITE_UP_PHOTOS_BUCKET).download(r.storage_path)
    if (got.error || !got.data) continue
    n += 1
    files.push(new File([got.data], `write-up-photo-${n}.jpg`, { type: got.data.type || 'image/jpeg' }))
  }
  return files
}
