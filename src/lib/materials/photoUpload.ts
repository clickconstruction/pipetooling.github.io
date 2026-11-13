/**
 * Materials on site (punch list #209): sending a shrunk shot off the phone. The bytes go to the private
 * `box-photos` bucket as `<job_id>/<photo_id>.jpg`; the row in `job_box_photos` follows (`addPhoto`), and
 * the photo sweep files the shot in the job's Drive folder, writes the Drive id and deletes the bucket
 * copy. The bytes are kept on the phone first (`photoBlobs`), so a shot with no signal is not lost and
 * the box screen can draw a thumbnail. Browser io, not pure.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage, withOperationTimeout } from '../../utils/errorHandling'
import { bytesAlreadyThere } from '../photos/shotTiles'
import { putPhotoBlob } from './photoBlobs'

const db = supabase as unknown as SupabaseClient

export const BOX_PHOTOS_BUCKET = 'box-photos'

export type SendBoxPhotoInput = { id: string; jobId: string; containerId: string; blob: Blob; fileName: string }

/** Where the shot sits in the bucket until the sweep files it. */
export function boxPhotoPath(jobId: string, photoId: string): string {
  return `${jobId}/${photoId}.jpg`
}

/** How long one send of a shot may take before the phone stops waiting: the shot is kept, and **Send now** tries again. */
export const BOX_PHOTO_SEND_TIMEOUT_MS = 30_000

/**
 * The shot did not send and the phone could not keep it either (its own store is full or shut, as in a private
 * window). Said apart from an ordinary failed send, whose shot waits on the phone for **Send now**: this one is gone,
 * and the person takes it again.
 */
export class BoxPhotoNotKeptError extends Error {
  constructor(why: string) {
    super(why)
    this.name = 'BoxPhotoNotKeptError'
  }
}

/**
 * Keeps the bytes on the phone, then sends them. Throws when the phone has no signal, the send runs out of time or
 * the bucket refuses; the bytes stay kept, and a later send of the same shot is safe.
 *
 * A send whose answer was lost has still put its file in the bucket. The next send of that shot meets it, and the
 * bucket answers *already exists* (v2.7178, punch list #344 PR 2, the fault of #338 in its 409 form): the path
 * carries the shot's own id, minted on the phone, so what is there is this shot, and the send is a landing. Before
 * this the answer was a refusal on every later try, so the shot never reached the job's folder.
 */
export async function sendBoxPhoto(input: SendBoxPhotoInput): Promise<{ storagePath: string }> {
  const kept = await putPhotoBlob(input.id, input.blob).then(
    () => true,
    () => false,
  )
  const failed = (why: string): Error => (kept ? new Error(why) : new BoxPhotoNotKeptError(why))
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw failed('The phone has no signal.')
  const storagePath = boxPhotoPath(input.jobId, input.id)
  let error: unknown
  try {
    const res = await withOperationTimeout(
      db.storage.from(BOX_PHOTOS_BUCKET).upload(storagePath, input.blob, { contentType: input.blob.type || 'image/jpeg', upsert: false }),
      BOX_PHOTO_SEND_TIMEOUT_MS,
      'Send the photo',
    )
    error = res.error
  } catch (e) {
    throw failed(formatErrorMessage(e, 'The photo did not send.'))
  }
  if (error && !bytesAlreadyThere(error)) throw failed(formatErrorMessage(error, 'The photo did not send.'))
  return { storagePath }
}
