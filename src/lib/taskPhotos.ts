/**
 * Task cards: the photos (punch list #273, PR 1, v2.6592; the names shared with the sweep since PR 4). The pure rules
 * over `task_photos`: where a shot waits in the `task-photos` bucket, what the sweep names it in Drive, and the folder a
 * card's photos go under in the Tasks folder (*PipeTooling Tasks › 2026-11-04 · Put the plumbing tools in a neat home*,
 * a roadmap card's under its roadmap and stage). The names live in `supabase/functions/_shared/taskPhotoNames.ts`, one
 * source for `photo-save` and the screens; this file re-exports them beside the app's own rules.
 */
export {
  TASK_NAME_MAX,
  TASK_NAME_SEPARATOR,
  roadmapTaskFolderPath,
  taskFolderName,
  taskPhotoCaption,
  taskPhotoDriveName,
  type RoadmapTaskFolderInput,
  type TaskPhotoKind,
  type TaskPhotoNameInput,
} from '../../supabase/functions/_shared/taskPhotoNames'

export const TASK_PHOTOS_BUCKET = 'task-photos'

/** `<instance_id>/<photo_id>.jpg`: the bucket's gate reads the day row from the first segment. */
export function taskPhotoPath(instanceId: string, photoId: string): string {
  return `${instanceId}/${photoId}.jpg`
}

/** The day row's id off a bucket path, or null for a path that is not one. */
export function instanceIdFromPath(path: string): string | null {
  const first = path.split('/')[0] ?? ''
  return /^[0-9a-f-]{36}$/i.test(first) ? first : null
}

export type TaskPhotoRowShape = {
  id: string
  instance_id: string
  kind: string
  percent_at?: number | null
  taken_at: string
  storage_path?: string | null
  drive_file_id?: string | null
  filed_at?: string | null
  fail_why?: string | null
}

/** *in Drive*, *on its way* or *not in Drive yet*: the strip's word under a thumbnail. */
export function taskPhotoStanding(p: Pick<TaskPhotoRowShape, 'drive_file_id' | 'filed_at' | 'fail_why' | 'storage_path'>): 'filed' | 'waiting' | 'failed' {
  if (p.filed_at || p.drive_file_id) return 'filed'
  if (p.fail_why) return 'failed'
  return 'waiting'
}

export const TASK_PHOTO_STANDING_WORDS: Record<ReturnType<typeof taskPhotoStanding>, string> = {
  filed: 'in Drive',
  waiting: 'on its way',
  failed: 'not in Drive yet',
}

/** A card's photos newest first, the finish ahead of same-moment shots. */
export function sortTaskPhotos<T extends Pick<TaskPhotoRowShape, 'taken_at' | 'kind'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.taken_at.localeCompare(a.taken_at) || (a.kind === 'finish' ? -1 : 0) - (b.kind === 'finish' ? -1 : 0))
}

/**
 * The event a card's strip listens for (`useTaskPhotos`): a photo landed on a card, live from the sheet or from the
 * outbox's replay (v2.6628). `detail` is the photo ids; the strip reads its cards again whatever they are.
 */
export const TASK_PHOTO_ADDED_EVENT = 'task-photo-added'

export function announceTaskPhotos(ids: ReadonlyArray<string>): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TASK_PHOTO_ADDED_EVENT, { detail: ids.length === 1 ? ids[0] : [...ids] }))
}
