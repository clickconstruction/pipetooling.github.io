/**
 * Materials on site (punch list #209): sending a shrunk shot off the phone. The bytes go to the private
 * `box-photos` bucket as `<job_id>/<photo_id>.jpg`; the row in `job_box_photos` follows (`addPhoto`), and
 * the photo sweep files the shot in the job's Drive folder, writes the Drive id and deletes the bucket
 * copy. The bytes are kept on the phone first (`photoBlobs`), so a shot with no signal is not lost and
 * the box screen can draw a thumbnail. Browser io, not pure.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { putPhotoBlob } from './photoBlobs'

const db = supabase as unknown as SupabaseClient

export const BOX_PHOTOS_BUCKET = 'box-photos'

export type SendBoxPhotoInput = { id: string; jobId: string; containerId: string; blob: Blob; fileName: string }

/** Where the shot sits in the bucket until the sweep files it. */
export function boxPhotoPath(jobId: string, photoId: string): string {
  return `${jobId}/${photoId}.jpg`
}

/** Keeps the bytes on the phone, then sends them. Throws when the phone has no signal or the bucket refuses; the bytes stay kept. */
export async function sendBoxPhoto(input: SendBoxPhotoInput): Promise<{ storagePath: string }> {
  await putPhotoBlob(input.id, input.blob)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('The phone has no signal.')
  const storagePath = boxPhotoPath(input.jobId, input.id)
  const { error } = await db.storage.from(BOX_PHOTOS_BUCKET).upload(storagePath, input.blob, { contentType: input.blob.type || 'image/jpeg', upsert: false })
  if (error) throw new Error(formatErrorMessage(error, 'The photo did not send.'))
  return { storagePath }
}
