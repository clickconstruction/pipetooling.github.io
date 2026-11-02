/**
 * A job's Drive photos in the app (punch list #164, PR 5): the reads behind the job window's gallery, through the
 * `job-photos` function, which lists the customer's folder and streams each thumbnail and each full picture with the
 * service account. Nothing is kept: a thumbnail is an object URL the strip revokes when it unmounts. The screens take
 * this io so their tests run over a fake.
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import type { JobPhoto, JobPhotosRead } from './jobPhotos'
import { makeBytesQueue, type BytesQueue } from './photoBytesQueue'

const FN = 'job-photos'

/**
 * Every thumbnail and full picture comes through a queue (the Documents spike of 2026-11-01): six thumbnails in flight
 * at a time and two full pictures, a 429 waited out and asked again, the bytes kept so a second tile, a remount or the
 * viewer never ask the function twice. Documents → Photos drew a hundred tiles at once and the gateway refused the burst.
 */
let thumbQueue: BytesQueue = makeBytesQueue({ concurrency: 6, retries: 4, cacheSize: 400 })
let fullQueue: BytesQueue = makeBytesQueue({ concurrency: 2, retries: 4, cacheSize: 6 })

/** Forget every kept picture, with a sleep of the test's own when given. */
export function resetPhotoBytes(sleep?: (ms: number) => Promise<void>): void {
  thumbQueue = makeBytesQueue({ concurrency: 6, retries: 4, cacheSize: 400, sleep })
  fullQueue = makeBytesQueue({ concurrency: 2, retries: 4, cacheSize: 6, sleep })
}

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
 * Each caller gets its own object URL over the kept bytes and revokes its own; the bytes stay kept.
 */
async function photoBytes(jobId: string, fileId: string, action: 'thumb' | 'full'): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) return null
  const queue = action === 'thumb' ? thumbQueue : fullQueue
  const bytes = await queue.get(`${action}:${jobId}:${fileId}`, async () => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ action, job_id: jobId, file_id: fileId }),
    })
    const retryAfter = Number(res.headers?.get?.('Retry-After') ?? '')
    return { status: res.status, blob: res.ok ? await res.blob() : null, retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : null }
  })
  return bytes ? URL.createObjectURL(bytes) : null
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
