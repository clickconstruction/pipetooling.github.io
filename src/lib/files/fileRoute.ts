/**
 * The app's own lasting link to a file it keeps (Messages cut 6): `/files/<source>/<id>`. The page at that path
 * (`src/pages/FileOpen.tsx`) opens the file for someone signed in who may read it, through a link that lasts a minute,
 * so the lasting link is the one the office files on a paper or shares within the team, and the file itself is never
 * public. One router, a source a kind of file: `messages` is a file that came on a line (our copy in the private
 * `message-attachments` bucket, or a link it carried). Cut 7's Drive files are meant to be a second source.
 */
import { appUrl } from '../appOrigin'

export type FileSource = 'messages'

const SOURCES: ReadonlySet<string> = new Set<FileSource>(['messages'])

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
