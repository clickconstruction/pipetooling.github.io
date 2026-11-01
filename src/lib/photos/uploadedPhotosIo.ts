/**
 * Every photo uploaded, one list (punch list #232): the reads behind Documents → Photos. The `uploaded_photos` view
 * is read newest first with the chips and the search asked of the server; a thumbnail's bytes come from a signed URL
 * on the shot's bucket while it waits, or through `job-photos` on its Drive id once filed (`thumbSource`). Browser io,
 * not pure; the rules are `uploadedPhotos.ts`. The view is not in the generated types until the push and the types PR,
 * so the client is cast once here, and a database ahead of the push answers a refusal in words.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { jobPhotoThumb, jobPhotoFull } from './jobPhotosIo'
import { PHOTOS_PAGE, UPLOADED_PHOTOS_SELECT, photoSearchFilter, thumbSource, type UploadedPhotoRow, type UploadedPhotosQuery } from './uploadedPhotos'

const db = supabase as unknown as SupabaseClient

/** Whether a read is a refusal to answer the list (the view missing, no sign-in), with its words, or null. */
export type UploadedPhotosRead = { rows: UploadedPhotoRow[]; more: boolean }

function applyFilters<T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T; not: (c: string, op: string, v: null) => T; or: (f: string) => T }>(q: T, query: UploadedPhotosQuery): T {
  let out = q
  if (query.source !== 'all') out = out.eq('source', query.source)
  if (query.where === 'drive') out = out.not('drive_file_id', 'is', null)
  if (query.where === 'waiting') out = out.is('drive_file_id', null)
  const search = photoSearchFilter(query.typed)
  if (search) out = out.or(search)
  return out
}

/** The list, newest first, `limit` rows; `more` says another page may follow. Throws with the reason. */
export async function loadUploadedPhotos(query: UploadedPhotosQuery): Promise<UploadedPhotosRead> {
  const limit = Math.max(1, query.limit || PHOTOS_PAGE)
  const base = db.from('uploaded_photos').select(UPLOADED_PHOTOS_SELECT)
  const { data, error } = await applyFilters(base, query).order('taken_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
  if (error) throw new Error(formatErrorMessage(error, 'The photos did not read.'))
  const rows = (data ?? []) as UploadedPhotoRow[]
  return { rows, more: rows.length >= limit }
}

/** How many photos are not in Drive, for the chip; null when the count cannot be read. */
export async function countPhotosWaiting(): Promise<number | null> {
  try {
    const { count, error } = await db.from('uploaded_photos').select('id', { count: 'exact', head: true }).is('drive_file_id', null)
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

/** An object URL or a signed URL for the thumbnail, or null; the caller revokes an object URL (`blob:`) when the tile goes. */
export async function uploadedPhotoThumb(row: UploadedPhotoRow): Promise<string | null> {
  const src = thumbSource(row)
  if (src.kind === 'none') return null
  if (src.kind === 'drive') return jobPhotoThumb(src.jobId, src.fileId)
  const { data } = await db.storage.from(src.bucket).createSignedUrl(src.path, 3600)
  return data?.signedUrl ?? null
}

/** The picture at full size: the same two paths, the Drive read streaming the whole file. */
export async function uploadedPhotoFull(row: UploadedPhotoRow): Promise<string | null> {
  const src = thumbSource(row)
  if (src.kind === 'none') return null
  if (src.kind === 'drive') return jobPhotoFull(src.jobId, src.fileId)
  const { data } = await db.storage.from(src.bucket).createSignedUrl(src.path, 3600)
  return data?.signedUrl ?? null
}

export interface UploadedPhotosIo {
  list: (query: UploadedPhotosQuery) => Promise<UploadedPhotosRead>
  waiting: () => Promise<number | null>
  thumb: (row: UploadedPhotoRow) => Promise<string | null>
  full: (row: UploadedPhotoRow) => Promise<string | null>
}

export function supabaseUploadedPhotosIo(): UploadedPhotosIo {
  return { list: loadUploadedPhotos, waiting: countPhotosWaiting, thumb: uploadedPhotoThumb, full: uploadedPhotoFull }
}
