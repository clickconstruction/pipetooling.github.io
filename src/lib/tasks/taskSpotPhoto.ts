/**
 * The giver's photo of the spot (punch list #328, PR 6): one optional picture on the task as
 * written, taken by whoever wrote it, so the person doing the task sees what the spot looks like
 * beside where it is. Pure: the object's name in the bucket and nothing else.
 *
 * It is not a task photo (`taskPhotos.ts`). Those are the doer's: shots on a day's card that prove
 * the work, count toward the finishing photo a task can ask for and are filed to Drive. A giver's
 * picture among them would read as proof of work, and would let a task that asks for a finishing
 * photo close on a photo taken before it began. So this photo has its own bucket and its own
 * column, and none of the doer's rules see it.
 */
export const TASK_SPOT_PHOTOS_BUCKET = 'task-spot-photos'

/** What the photo belongs to: a task as written, or a roadmap task (whose card reads it through the link). */
export type TaskSpotPhotoOwner = { kind: 'item' | 'roadmap'; id: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE = /^[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$/

/** `item/<task id>/<photo id>.jpg`: the bucket's gate reads the task from the name, so the name has one shape. */
export function taskSpotPhotoPath(owner: TaskSpotPhotoOwner, photoId: string): string {
  return `${owner.kind}/${owner.id}/${photoId}.jpg`
}

/** The task a path belongs to, or null for a name of any other shape. The database refuses those too. */
export function taskSpotPhotoOwner(path: string | null | undefined): TaskSpotPhotoOwner | null {
  const parts = (path ?? '').split('/')
  if (parts.length !== 3) return null
  const [kind, id, file] = parts as [string, string, string]
  if (kind !== 'item' && kind !== 'roadmap') return null
  if (!UUID.test(id) || !FILE.test(file)) return null
  return { kind, id }
}

/** A path worth reading: non-empty and of the one shape. A stale or mangled column reads as no photo. */
export function isTaskSpotPhotoPath(path: string | null | undefined): path is string {
  return taskSpotPhotoOwner(path) !== null
}

/** The table and column a photo's path is written to. */
export function taskSpotPhotoTable(owner: TaskSpotPhotoOwner): 'checklist_items' | 'checklist_tech_tree_group_tasks' {
  return owner.kind === 'item' ? 'checklist_items' : 'checklist_tech_tree_group_tasks'
}
