/**
 * Materials on site: a box photo's picture as an object URL, from the first place that holds it (`boxPhotoSource.ts`).
 * This phone's own store, then the job's Drive folder through the job gallery's function (its queue keeps the bytes,
 * so a second square for the same file asks once), then the bucket while the sweep has not filed the shot yet. Null
 * when no place answers. The caller revokes the URL. Browser io, not pure.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { jobPhotoFull, jobPhotoThumb } from '../photos/jobPhotosIo'
import { boxPhotoSource, type BoxPhotoSource } from './boxPhotoSource'
import type { PhotoNote } from './photo'
import { getPhotoBlob } from './photoBlobs'
import { BOX_PHOTOS_BUCKET } from './photoUpload'

const db = supabase as unknown as SupabaseClient

export type BoxPhotoBytes = { url: string; /** The bytes themselves when this phone or the bucket gave them: Send now and Share instead need them. */ blob: Blob | null; source: BoxPhotoSource }

export async function readBoxPhotoBytes(p: PhotoNote, size: 'thumb' | 'full'): Promise<BoxPhotoBytes | null> {
  const local = await getPhotoBlob(p.id).catch(() => null)
  const source = boxPhotoSource(p, local != null)
  if (source === 'phone' && local) return { url: URL.createObjectURL(local), blob: local, source }
  if (source === 'drive' && p.driveFileId) {
    const url = await (size === 'thumb' ? jobPhotoThumb : jobPhotoFull)(p.jobId, p.driveFileId).catch(() => null)
    return url ? { url, blob: null, source } : null
  }
  if (source === 'bucket' && p.storagePath) {
    const { data, error } = await db.storage.from(BOX_PHOTOS_BUCKET).download(p.storagePath)
    return !error && data ? { url: URL.createObjectURL(data), blob: data, source } : null
  }
  return null
}
