/**
 * Materials on site: a box photo's picture as an object URL, from the place that holds it (`boxPhotoSource.ts`). A
 * filed shot comes from the job's Drive folder through the job gallery's function (its queue keeps the bytes, so a
 * second square for the same file asks once), and this phone's copy of it is deleted on the way. A shot that waits
 * comes from this phone's own store, else from the bucket while the sweep has not filed it yet. A thumbnail of this
 * phone's bytes is a small copy (`thumbOfPhoto`), never the shot itself: a page of ninety squares that each drew a
 * whole 1,200 by 1,600 picture took an iPhone's Safari down. Null when no place answers. The caller revokes the URL.
 * Browser io, not pure.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { jobPhotoFull, jobPhotoThumb } from '../photos/jobPhotosIo'
import { boxPhotoIsFiled, boxPhotoSource, type BoxPhotoSource } from './boxPhotoSource'
import type { PhotoNote } from './photo'
import { deletePhotoBlob, getPhotoBlob } from './photoBlobs'
import { thumbOfPhoto } from './photoShrink'
import { BOX_PHOTOS_BUCKET } from './photoUpload'

const db = supabase as unknown as SupabaseClient

export type BoxPhotoBytes = {
  /** The picture to draw. Null only for a thumbnail of this phone's bytes that the browser could not make small: the bytes are still handed back. */
  url: string | null
  /** The bytes themselves when this phone or the bucket gave them: Send now and Share instead need them. Always the shot whole, never the thumbnail. */
  blob: Blob | null
  source: BoxPhotoSource
}

/** `thumbCssEdge` is the side of the square the thumbnail fills, in CSS pixels; it sizes the small copy of a shot this phone holds. */
export async function readBoxPhotoBytes(p: PhotoNote, size: 'thumb' | 'full', thumbCssEdge?: number): Promise<BoxPhotoBytes | null> {
  const local = await getPhotoBlob(p.id).catch(() => null)
  // The job's folder holds a filed shot, so this phone's copy goes. Not waited on: the draw never hangs on the delete.
  if (local && boxPhotoIsFiled(p)) void deletePhotoBlob(p.id).catch(() => undefined)
  const source = boxPhotoSource(p, local != null)
  if (source === 'phone' && local) {
    if (size === 'full') return { url: URL.createObjectURL(local), blob: local, source }
    const small = await thumbOfPhoto(local, thumbCssEdge)
    return { url: small ? URL.createObjectURL(small) : null, blob: local, source }
  }
  if (source === 'drive' && p.driveFileId) {
    const url = await (size === 'thumb' ? jobPhotoThumb : jobPhotoFull)(p.jobId, p.driveFileId).catch(() => null)
    return url ? { url, blob: null, source } : null
  }
  if (source === 'bucket' && p.storagePath) {
    const { data, error } = await db.storage.from(BOX_PHOTOS_BUCKET).download(p.storagePath)
    if (error || !data) return null
    if (size === 'full') return { url: URL.createObjectURL(data), blob: data, source }
    const small = await thumbOfPhoto(data, thumbCssEdge)
    return { url: small ? URL.createObjectURL(small) : null, blob: data, source }
  }
  return null
}
