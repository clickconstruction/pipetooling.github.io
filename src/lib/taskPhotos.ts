/**
 * Task cards: the photos (punch list #273, PR 1, v2.6592). The pure rules over `task_photos`: where a shot waits in the
 * `task-photos` bucket, what the sweep names it in Drive, and the folder a card's photos go under in the Tasks folder
 * (*PipeTooling Tasks › 2026-11-04 · Put the plumbing tools in a neat home*, a roadmap card's under its roadmap and
 * stage). The sweep (`photo-save`, PR 4) and the screens read the same words from here.
 */
import { FOLDER_NAME_MAX, FOLDER_NAME_SEPARATOR, driveSafeName } from './documents/folderName'

export const TASK_PHOTOS_BUCKET = 'task-photos'

export type TaskPhotoKind = 'progress' | 'finish' | 'line'

/** `<instance_id>/<photo_id>.jpg`: the bucket's gate reads the day row from the first segment. */
export function taskPhotoPath(instanceId: string, photoId: string): string {
  return `${instanceId}/${photoId}.jpg`
}

/** The day row's id off a bucket path, or null for a path that is not one. */
export function instanceIdFromPath(path: string): string | null {
  const first = path.split('/')[0] ?? ''
  return /^[0-9a-f-]{36}$/i.test(first) ? first : null
}

export type TaskPhotoNameInput = {
  /** The day the shot was taken, YYYY-MM-DD in the app's zone. */
  dayYmd: string
  byName: string
  kind: TaskPhotoKind
  percentAt?: number | null
  /** The Done when… line the shot proves, for a `line` shot. */
  lineBody?: string | null
}

/** What a shot is for, as the card and the file say it: *67%*, *finish*, or the line's words. */
export function taskPhotoCaption(a: Pick<TaskPhotoNameInput, 'kind' | 'percentAt' | 'lineBody'>): string {
  if (a.kind === 'finish') return 'finish'
  if (a.kind === 'line') return (a.lineBody ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'line'
  const p = typeof a.percentAt === 'number' && Number.isFinite(a.percentAt) ? Math.round(a.percentAt) : null
  return p === null ? 'progress' : `${p}%`
}

/** *2026-11-04 Mateo · 67%.jpg*, *2026-11-05 Mateo · finish.jpg*, *2026-11-04 Mateo · pipe racked.jpg*: the sweep's name, a report photo's shape. */
export function taskPhotoDriveName(a: TaskPhotoNameInput): string {
  const who = driveSafeName(a.byName).trim() || 'Someone'
  const what = driveSafeName(taskPhotoCaption(a)).trim()
  return `${a.dayYmd} ${who}${FOLDER_NAME_SEPARATOR}${what}`.slice(0, FOLDER_NAME_MAX).trim() + '.jpg'
}

/** A one-off card's folder under the Tasks folder: *2026-11-04 · Put the plumbing tools in a neat home*. */
export function taskFolderName(a: { dayYmd: string; title: string }): string {
  const t = driveSafeName(a.title).replace(/\s+/g, ' ').trim() || 'Task'
  return `${a.dayYmd}${FOLDER_NAME_SEPARATOR}${t}`.slice(0, FOLDER_NAME_MAX).trim()
}

export type RoadmapTaskFolderInput = {
  roadmapTitle: string
  stageNumber: number | string
  stageTitle: string
  taskNumber: string
  taskTitle: string
}

/** A roadmap card's folders under the Tasks folder: *Farm 1 › 31 · Shelve the containers › 31.5 · Weld up the second set of shelves*. */
export function roadmapTaskFolderPath(a: RoadmapTaskFolderInput): string[] {
  const safe = (s: string, fallback: string) => (driveSafeName(s).replace(/\s+/g, ' ').trim() || fallback).slice(0, FOLDER_NAME_MAX).trim()
  const numbered = (n: string, title: string) => {
    const t = safe(title, '')
    return t ? `${n}${FOLDER_NAME_SEPARATOR}${t}`.slice(0, FOLDER_NAME_MAX).trim() : n
  }
  return [safe(a.roadmapTitle, 'Roadmap'), numbered(String(a.stageNumber), a.stageTitle), numbered(a.taskNumber, a.taskTitle)]
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
