/**
 * Reads and writes for the giver's photo of the spot (punch list #328, PR 6). The bucket and the
 * column are younger than the generated types, hence the casts. Every read stands alone and fails to
 * "no photo", so a photo that cannot be read never costs the card or the window that asked.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { TASK_SPOT_PHOTOS_BUCKET, isTaskSpotPhotoPath, taskSpotPhotoPath, taskSpotPhotoTable, type TaskSpotPhotoOwner } from './taskSpotPhoto'

type PathRead<T> = { data: T[] | null; error: { message: string } | null }

/** Puts the shrunk picture in the bucket under the task's name. The path on success, the reason in words on failure. */
export async function uploadTaskSpotPhoto(owner: TaskSpotPhotoOwner, photoId: string, blob: Blob): Promise<{ path: string } | { error: string }> {
  const path = taskSpotPhotoPath(owner, photoId)
  try {
    const { error } = await supabase.storage.from(TASK_SPOT_PHOTOS_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    return error ? { error: formatErrorMessage(error, 'The photo did not upload.') } : { path }
  } catch (e) {
    return { error: formatErrorMessage(e, 'The photo did not upload.') }
  }
}

/** Writes the task's photo path, or null to take the photo off. Null when it landed, the reason when it did not. */
export async function saveTaskSpotPhotoPath(owner: TaskSpotPhotoOwner, path: string | null): Promise<string | null> {
  try {
    const { error } = await supabase
      .from(taskSpotPhotoTable(owner))
      .update({ spot_photo_path: path } as never)
      .eq('id', owner.id)
    return error ? formatErrorMessage(error, 'The photo did not save.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The photo did not save.')
  }
}

/** Uploads a new picture and points the task at it: the two writes a giver's press makes. */
export async function putTaskSpotPhoto(owner: TaskSpotPhotoOwner, photoId: string, blob: Blob): Promise<{ path: string } | { error: string }> {
  const up = await uploadTaskSpotPhoto(owner, photoId, blob)
  if ('error' in up) return up
  const why = await saveTaskSpotPhotoPath(owner, up.path)
  if (why) {
    void removeTaskSpotPhotoFile(up.path)
    return { error: why }
  }
  return up
}

/** Takes a picture out of the bucket. Best effort: a file left behind is only a file, the task no longer points at it. */
export async function removeTaskSpotPhotoFile(path: string | null | undefined): Promise<void> {
  if (!isTaskSpotPhotoPath(path)) return
  try {
    await supabase.storage.from(TASK_SPOT_PHOTOS_BUCKET).remove([path])
  } catch {
    // Left behind.
  }
}

/** One task's photo path, for its window. Null for a task with none, and for a read that failed. */
export async function loadTaskSpotPhotoPath(owner: TaskSpotPhotoOwner): Promise<string | null> {
  try {
    const res = (await supabase
      .from(taskSpotPhotoTable(owner))
      .select('spot_photo_path' as '*')
      .eq('id', owner.id)
      .limit(1)) as unknown as PathRead<{ spot_photo_path?: string | null }>
    const path = res.error || !res.data ? null : (res.data[0]?.spot_photo_path ?? null)
    return isTaskSpotPhotoPath(path) ? path : null
  } catch {
    return null
  }
}

/**
 * The photo paths of the tasks on a screen, by task id. A task's own photo first. A task with none
 * and a roadmap task behind it takes the roadmap task's, read second and on its own, as its place is.
 */
export async function loadTaskSpotPhotoPathsForItems(itemIds: ReadonlyArray<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = [...new Set(itemIds.filter(Boolean))]
  if (ids.length === 0) return out
  const roadmapTaskOf = new Map<string, string>()
  try {
    const res = (await supabase
      .from('checklist_items')
      .select('id,roadmap_group_task_id,spot_photo_path' as '*')
      .in('id', ids)) as unknown as PathRead<{ id: string; roadmap_group_task_id?: string | null; spot_photo_path?: string | null }>
    if (res.error || !res.data) return out
    for (const row of res.data) {
      if (isTaskSpotPhotoPath(row.spot_photo_path)) out.set(row.id, row.spot_photo_path)
      else if (row.roadmap_group_task_id) roadmapTaskOf.set(row.id, row.roadmap_group_task_id)
    }
  } catch {
    return out
  }
  if (roadmapTaskOf.size === 0) return out
  try {
    const res = (await supabase
      .from('checklist_tech_tree_group_tasks')
      .select('id,spot_photo_path' as '*')
      .in('id', [...new Set(roadmapTaskOf.values())])
      .not('spot_photo_path' as 'id', 'is', null)) as unknown as PathRead<{ id: string; spot_photo_path?: string | null }>
    if (res.error || !res.data) return out
    const byTask = new Map<string, string>()
    for (const row of res.data) if (isTaskSpotPhotoPath(row.spot_photo_path)) byTask.set(row.id, row.spot_photo_path)
    for (const [itemId, taskId] of roadmapTaskOf) {
      const path = byTask.get(taskId)
      if (path) out.set(itemId, path)
    }
  } catch {
    // The roadmap's photos could not be read; the tasks' own stand.
  }
  return out
}

/** Signed addresses for the pictures, an hour each. A path that will not sign is simply absent. */
export async function taskSpotPhotoUrls(paths: ReadonlyArray<string>): Promise<Map<string, string>> {
  const list = [...new Set(paths.filter((p) => isTaskSpotPhotoPath(p)))]
  const out = new Map<string, string>()
  if (list.length === 0) return out
  try {
    const { data } = await supabase.storage.from(TASK_SPOT_PHOTOS_BUCKET).createSignedUrls(list, 3600)
    for (const r of (data ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
      if (r.path && r.signedUrl) out.set(r.path, r.signedUrl)
    }
  } catch {
    // No picture; the place stands.
  }
  return out
}
