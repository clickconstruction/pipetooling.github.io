/**
 * The app's own lasting link to a file it keeps (Messages cut 6): `/files/<source>/<id>`. The page at that path
 * (`src/pages/FileOpen.tsx`) opens the file for someone signed in who may read it, through a link that lasts a minute,
 * so the lasting link is the one the office files on a paper or shares within the team, and the file itself is never
 * public. One router, a source a kind of file: `messages` is a file that came on a line (our copy in the private
 * `message-attachments` bucket, or a link it carried), `drive` is a file in a job's Drive folder (cut 7d), opened
 * through `drive-link`'s office door, which checks the file is in that job's folder, and `bills` (punch list #179,
 * v2.6095) is our copy of a supply-house bill dropped on the Add invoice window, kept in the same bucket under the
 * house and named by the invoice row it became (`supply_house_invoices.bill_read.file.path`).
 */
import { appUrl } from '../appOrigin'
import { jobKey, jobRefOf, type JobRef } from '../messages/load'

export type FileSource = 'messages' | 'drive' | 'bills'

const SOURCES: ReadonlySet<string> = new Set<FileSource>(['messages', 'drive', 'bills'])

/** What the page says in place of a file it cannot open, in the same words for every source. */
export const FILE_OPEN_WORDS = {
  signIn: 'Sign in to open this file.',
  notYours: 'This file is not one you can open.',
  notHere: 'This file is not here.',
} as const

/** The route the app declares for the page. */
export const FILE_ROUTE_PATH = '/files/:source/:id'

/** The path to a kept file. */
export function fileHref(source: FileSource, id: string): string {
  return `/files/${source}/${encodeURIComponent(id)}`
}

/** The lasting link a record keeps (a paper filed from a line): the app's own address, wherever the page was opened. */
export function fileUrl(source: FileSource, id: string): string {
  return appUrl(fileHref(source, id))
}

/** A path read back to its source and id, or null when it is not a file's path or names a source not here yet. */
export function fileRouteOf(pathname: string): { source: FileSource; id: string } | null {
  const m = /^\/files\/([a-z]+)\/([^/]+)\/?$/.exec(pathname)
  if (!m || !SOURCES.has(m[1]!)) return null
  try {
    const id = decodeURIComponent(m[2]!)
    return id.trim() ? { source: m[1] as FileSource, id } : null
  } catch {
    return null
  }
}

/** A Drive file id as Drive writes it, the office door's own rule. */
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,200}$/

/**
 * A Drive file's id on the route: its job's key and the file together, `project:<uuid>:<driveFileId>`. `drive-link`'s
 * office door opens a file only with its job, to check the file is in that job's folder, and a Drive id has no colon,
 * so the last colon splits the two.
 */
export function driveFileRouteId(job: JobRef, driveFileId: string): string {
  return `${jobKey(job)}:${driveFileId}`
}

/** A Drive route id read back to its job and file, or null when it is not one. */
export function driveFileOfRouteId(id: string): { job: JobRef; driveFileId: string } | null {
  const at = id.lastIndexOf(':')
  if (at <= 0) return null
  const job = jobRefOf(id.slice(0, at))
  const driveFileId = id.slice(at + 1)
  return job && DRIVE_FILE_ID.test(driveFileId) ? { job, driveFileId } : null
}

/** The office's own link to a file in a job's Drive folder: what the Files chips and a preview's Open in a tab go to. */
export function driveFileHref(job: JobRef, driveFileId: string): string {
  return fileHref('drive', driveFileRouteId(job, driveFileId))
}
