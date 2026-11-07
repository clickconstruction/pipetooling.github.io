/**
 * Task cards: the names a card's photos take in Drive (punch list #273, PR 4). One source for the sweep (`photo-save`)
 * and the app (`src/lib/taskPhotos.ts` re-exports it): the file's name by the day, the person and what the shot is for,
 * a one-off card's folder under the Tasks folder, and a roadmap card's folders under its roadmap and stage.
 *
 * No imports, so the app's tests import it as the functions do (the `whereFilesGo.ts` rule). The Drive-safe rule is
 * `driveSafeName`'s, written again here: a backslash and a control character out, whitespace folded.
 */

/** Drive takes longer names; the office reads them in a list (`whereFilesGo.ts`' FOLDER_NAME_MAX). */
export const TASK_NAME_MAX = 120
/** Between two pieces of a name, as the Materials desk labels a job. */
export const TASK_NAME_SEPARATOR = ' · '

function safeName(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/\\/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type TaskPhotoKind = 'progress' | 'finish' | 'line'

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
  if (a.kind === 'line') return safeName(a.lineBody).slice(0, 80) || 'line'
  const p = typeof a.percentAt === 'number' && Number.isFinite(a.percentAt) ? Math.round(a.percentAt) : null
  return p === null ? 'progress' : `${p}%`
}

/**
 * *2026-11-04 Mateo · 67%.jpg*, *2026-11-05 Mateo · finish.jpg*, *2026-11-04 Mateo · pipe racked.jpg*: the sweep's
 * name, a report photo's shape; `taken` above one adds *(2)* the way `freeName` asks.
 */
export function taskPhotoDriveName(a: TaskPhotoNameInput, taken = 1): string {
  const who = safeName(a.byName) || 'Someone'
  const what = safeName(taskPhotoCaption(a))
  const base = `${a.dayYmd} ${who}${TASK_NAME_SEPARATOR}${what}`.slice(0, TASK_NAME_MAX).trim()
  return `${base}${taken > 1 ? ` (${taken})` : ''}.jpg`
}

/** A one-off card's folder under the Tasks folder: *2026-11-04 · Put the plumbing tools in a neat home*. */
export function taskFolderName(a: { dayYmd: string; title: string }): string {
  const t = safeName(a.title) || 'Task'
  return `${a.dayYmd}${TASK_NAME_SEPARATOR}${t}`.slice(0, TASK_NAME_MAX).trim()
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
  const safe = (s: string, fallback: string) => (safeName(s) || fallback).slice(0, TASK_NAME_MAX).trim()
  const numbered = (n: string, title: string) => {
    const t = safeName(title)
    return t ? `${n}${TASK_NAME_SEPARATOR}${t}`.slice(0, TASK_NAME_MAX).trim() : n
  }
  return [safe(a.roadmapTitle, 'Roadmap'), numbered(String(a.stageNumber), a.stageTitle), numbered(a.taskNumber, a.taskTitle)]
}
