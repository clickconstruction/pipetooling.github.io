/**
 * Task cards: the photos' io (punch list #273, PR 4b, v2.6602). A shot taken on a card goes to the `task-photos` bucket
 * as `<instance_id>/<photo_id>.jpg`, then its `task_photos` row (the kind, the percent it was taken at or the line it
 * proves, who, when, the sizes); the `photo-save` sweep files it in Drive a few minutes later and the row's
 * `drive_file_id` says so. The bucket copy stays, so the card's strip reads its thumbnail from a signed URL whether or
 * not Drive has it yet. The rules are `taskPhotos.ts`; the tables are younger than the generated types, hence the cast.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { TASK_PHOTOS_BUCKET, taskPhotoCaption, taskPhotoPath, type TaskPhotoKind, type TaskPhotoRowShape } from '../taskPhotos'
import { newPhotoId } from './reportPhotos'

const db = supabase as unknown as SupabaseClient

export type TaskPhotoRow = TaskPhotoRowShape & {
  criterion_id: string | null
  caption: string
  by_user_id: string | null
  by_name: string
  width: number
  height: number
}

export const TASK_PHOTO_SELECT = 'id, instance_id, kind, percent_at, criterion_id, caption, by_user_id, by_name, taken_at, bytes, width, height, storage_path, drive_file_id, filed_at, fail_why'

export type SendTaskPhotoInput = {
  instanceId: string
  blob: Blob
  kind: TaskPhotoKind
  percentAt?: number | null
  criterionId?: string | null
  /** The line's words, for the caption of a `line` shot. */
  lineBody?: string | null
  byUserId: string
  byName: string
  takenAt: string
  originalBytes: number
  width: number
  height: number
}

/** The bytes to the bucket, then the row. Throws with the reason when the phone has no signal or the bucket refuses. */
export async function sendTaskPhoto(input: SendTaskPhotoInput): Promise<TaskPhotoRow> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('The phone has no signal.')
  const id = newPhotoId()
  const storagePath = taskPhotoPath(input.instanceId, id)
  const { error } = await db.storage.from(TASK_PHOTOS_BUCKET).upload(storagePath, input.blob, { contentType: input.blob.type || 'image/jpeg', upsert: true })
  if (error) throw new Error(formatErrorMessage(error, 'The photo did not send.'))
  const row = {
    id,
    instance_id: input.instanceId,
    kind: input.kind,
    percent_at: input.kind === 'progress' ? input.percentAt ?? null : null,
    criterion_id: input.criterionId ?? null,
    caption: taskPhotoCaption({ kind: input.kind, percentAt: input.percentAt ?? null, lineBody: input.lineBody ?? null }),
    by_user_id: input.byUserId,
    by_name: input.byName,
    taken_at: input.takenAt,
    bytes: input.blob.size,
    original_bytes: input.originalBytes,
    width: input.width,
    height: input.height,
    storage_path: storagePath,
  }
  const { data, error: rowError } = await db.from('task_photos').insert(row).select(TASK_PHOTO_SELECT).single()
  if (rowError) {
    // The bytes without a row would wait forever; take them back.
    await db.storage.from(TASK_PHOTOS_BUCKET).remove([storagePath]).catch(() => undefined)
    throw new Error(formatErrorMessage(rowError, 'The photo did not send.'))
  }
  return data as TaskPhotoRow
}

/** A screen's cards' photos, newest first. */
export async function loadTaskPhotos(instanceIds: ReadonlyArray<string>): Promise<TaskPhotoRow[]> {
  const ids = Array.from(new Set(instanceIds.filter(Boolean)))
  if (ids.length === 0) return []
  const { data, error } = await db.from('task_photos').select(TASK_PHOTO_SELECT).in('instance_id', ids).order('taken_at', { ascending: false })
  if (error) throw new Error(formatErrorMessage(error, 'The photos did not load.'))
  return (data ?? []) as TaskPhotoRow[]
}

/** Signed URLs for the bucket copies, an hour each; a path that fails answers null. */
export async function taskPhotoPreviewUrls(paths: ReadonlyArray<string>): Promise<Map<string, string>> {
  const list = Array.from(new Set(paths.filter(Boolean)))
  const out = new Map<string, string>()
  if (list.length === 0) return out
  try {
    const { data } = await db.storage.from(TASK_PHOTOS_BUCKET).createSignedUrls(list, 3600)
    for (const r of (data ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
      if (r.path && r.signedUrl) out.set(r.path, r.signedUrl)
    }
  } catch {
    // A thumbnail that will not sign draws as its words instead.
  }
  return out
}

/** The photo that proves a line: written on the tick once both exist. */
export async function attachPhotoToTick(instanceId: string, criterionId: string, photoId: string): Promise<void> {
  await db.from('task_criteria_checks').update({ photo_id: photoId }).eq('instance_id', instanceId).eq('criterion_id', criterionId)
}
