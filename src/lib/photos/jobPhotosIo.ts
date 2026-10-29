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

/** The bytes of a thumbnail or a full picture as an object URL, or null when the function refuses. */
async function photoBytes(jobId: string, fileId: string, action: 'thumb' | 'full'): Promise<string | null> {
  const r = (await supabase.functions.invoke(FN, { body: { action, job_id: jobId, file_id: fileId } })) as FnResult
  if (r.error) return null
  const data = r.data as unknown
  if (data instanceof Blob) return URL.createObjectURL(data)
  return null
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
