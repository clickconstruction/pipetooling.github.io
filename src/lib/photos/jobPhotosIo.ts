/**
 * A job's Drive photos in the app (punch list #164, PR 5): the reads behind the job window's gallery, through the
 * `job-photos` function, which lists the customer's folder and streams each thumbnail and each full picture with the
 * service account. Nothing is kept: a thumbnail is an object URL the strip revokes when it unmounts. The screens take
 * this io so their tests run over a fake.
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import type { JobPhoto, JobPhotosRead } from './jobPhotos'

const FN = 'job-photos'

export async function listJobPhotos(jobId: string): Promise<JobPhotosRead> {
  const r = (await supabase.functions.invoke(FN, { body: { action: 'list', job_id: jobId } })) as FnResult
  const problem = await fnProblem(r, 'The job’s photos did not read.')
  if (problem) throw new Error(problem)
  const d = (r.data ?? {}) as Partial<JobPhotosRead>
  const photos = Array.isArray(d.photos) ? (d.photos as JobPhoto[]) : []
  return {
    folder: { kind: d.folder?.kind === 'pictures' || d.folder?.kind === 'photos' ? d.folder.kind : 'none', url: d.folder?.url ?? null },
    photos,
    capped: d.capped === true,
    waiting: Number(d.waiting ?? 0) || 0,
  }
}

/**
 * The bytes of a thumbnail or a full picture as an object URL, or null when the function refuses. A plain fetch under
 * the caller's sign-in, not `functions.invoke`: invoke makes a Blob only of an octet-stream or PDF answer and reads
 * every other type as text, so the function's image/jpeg came back a string and every tile stayed grey (v2.6128).
 */
async function photoBytes(jobId: string, fileId: string, action: 'thumb' | 'full'): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) return null
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ action, job_id: jobId, file_id: fileId }),
  })
  if (!res.ok) return null
  const bytes = await res.blob()
  return bytes.size > 0 ? URL.createObjectURL(bytes) : null
}

export const jobPhotoThumb = (jobId: string, fileId: string) => photoBytes(jobId, fileId, 'thumb')
export const jobPhotoFull = (jobId: string, fileId: string) => photoBytes(jobId, fileId, 'full')

export interface JobPhotosIo {
  list: (jobId: string) => Promise<JobPhotosRead>
  /** An object URL for the thumbnail, or null; the caller revokes it. */
  thumb: (jobId: string, fileId: string) => Promise<string | null>
  full: (jobId: string, fileId: string) => Promise<string | null>
}

export function supabaseJobPhotosIo(): JobPhotosIo {
  return { list: listJobPhotos, thumb: jobPhotoThumb, full: jobPhotoFull }
}
