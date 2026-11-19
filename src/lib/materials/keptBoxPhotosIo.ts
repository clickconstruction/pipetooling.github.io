/**
 * Materials on site: a box photo kept on the phone sends by itself (Take from a box, v2.7824). Until now a shot taken
 * with no signal waited for a person's **Send now** on the box's screen, and a take's two photos must never wait on a
 * person. The shot's row says `on-phone` once the outbox lands it; this finds the caller's own such rows, and for
 * each whose bytes this phone still holds (`photoBlobs.ts`), sends the bytes and marks the row `sending`, which is
 * what **Send now** does. A row whose bytes are on another phone is left alone. Browser io, not pure.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { refreshJob } from './onSiteStore'
import { getPhotoBlob } from './photoBlobs'
import { sendBoxPhoto } from './photoUpload'

const db = supabase as unknown as SupabaseClient

/** The most rows one pass looks at: a phone that kept more than this goes again on the next pass. */
export const KEPT_BOX_PHOTOS_BATCH = 20

export type KeptBoxPhotoRow = { id: string; job_id: string; container_id: string; file_name: string }

export interface KeptBoxPhotosIo {
  online: () => boolean
  /** The caller's own rows that still say the shot is on a phone, oldest first. */
  waiting: (userId: string, limit: number) => Promise<KeptBoxPhotoRow[]>
  blob: (id: string) => Promise<Blob | null>
  send: (row: KeptBoxPhotoRow, blob: Blob) => Promise<{ storagePath: string }>
  mark: (id: string, storagePath: string) => Promise<void>
  /** A job's screens read again, so a box that is open stops saying the shot is on the phone. */
  sent: (jobId: string) => void
}

export function supabaseKeptBoxPhotosIo(): KeptBoxPhotosIo {
  return {
    online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
    waiting: async (userId, limit) => {
      const { data, error } = await db.from('job_box_photos').select('id, job_id, container_id, file_name').eq('status', 'on-phone').eq('by_user_id', userId).order('taken_at', { ascending: true }).limit(limit)
      if (error) throw error
      return (data ?? []) as KeptBoxPhotoRow[]
    },
    blob: (id) => getPhotoBlob(id).catch(() => null),
    send: (row, blob) => sendBoxPhoto({ id: row.id, jobId: row.job_id, containerId: row.container_id, blob, fileName: row.file_name }),
    mark: async (id, storagePath) => {
      const { error } = await db.from('job_box_photos').update({ status: 'sending', storage_path: storagePath }).eq('id', id)
      if (error) throw error
    },
    sent: (jobId) => refreshJob(jobId, 0),
  }
}

/**
 * One pass. Never throws: a read that fails or a send that fails leaves the shot for the next pass. Answers how many
 * went and how many of this phone's are still waiting.
 */
export async function sendKeptBoxPhotos(userId: string, io: KeptBoxPhotosIo): Promise<{ sent: number; left: number }> {
  if (!io.online()) return { sent: 0, left: 0 }
  let rows: KeptBoxPhotoRow[]
  try {
    rows = await io.waiting(userId, KEPT_BOX_PHOTOS_BATCH)
  } catch {
    return { sent: 0, left: 0 }
  }
  let sent = 0
  let left = 0
  const jobs = new Set<string>()
  for (const row of rows) {
    const blob = await io.blob(row.id)
    // The bytes are on another phone, or this phone lost them: not this pass's to send.
    if (!blob) continue
    try {
      const { storagePath } = await io.send(row, blob)
      await io.mark(row.id, storagePath)
      sent++
      jobs.add(row.job_id)
    } catch {
      left++
      // One lost signal costs one request: the rest wait for the next pass.
      if (!io.online()) break
    }
  }
  for (const j of jobs) io.sent(j)
  return { sent, left }
}
