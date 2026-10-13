/**
 * Messages, cut 7f: the files on a reply (the mock-up `files-out-mockups.html`, screens 1, 2 and 4, on branch
 * spike/gc-mode). A file is on the message once, by its key: a job's file from the one list (`jobFiles.ts`), or one
 * picked from this computer or a photo. How each goes is `outgoing.waysOut`; what the send window says is
 * `chipFacts`, `emailFileNote` and `textFileNote`; what the function takes is `emailFileAsk`. Pure: the bytes of a file
 * from this computer are read by the app and handed in.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { emailFileAsk, type DeviceBytes, type EmailFileAsk } from '../documents/emailFileAsks'
import { fileKindOf, type JobFile } from '../documents/jobFiles'
import { draftFromDevice, draftFromJob, waysOut, type Audience, type Channel, type DraftFile, type FileWay, type LinkMakers } from '../documents/outgoing'
import { driveFileRouteId, fileHref } from '../files/fileRoute'
import { jobRefOf } from './load'

/** A file picked from this computer or a photo, as the browser hands it over (a `File` is one). */
export interface DeviceFile {
  name: string
  size: number
  type: string
  lastModified?: number
  arrayBuffer(): Promise<ArrayBuffer>
}

/** A file on the reply: how it goes on a message, and where it came from. */
export interface ReplyFile {
  draft: DraftFile
  /** The one list's row, for a job's file. */
  job: JobFile | null
  /** The browser's file, for one from this computer or a photo. */
  device: DeviceFile | null
}

/** Who the reply goes to, as their portal knows them. */
export function audienceOf(kind: string): Audience {
  return kind === 'trade' ? 'trade' : kind === 'customer' ? 'customer' : kind === 'arch' ? 'arch' : 'unknown'
}

/**
 * The link makers the send window's words need: whether a link opens their portal, never the link itself, which the
 * function makes as the message goes.
 */
export function wordsMakers(hasPortal: boolean): LinkMakers {
  return { portal: hasPortal ? (page) => `their portal#${page}` : null, file: () => 'our link' }
}

export function replyFileFromJob(f: JobFile): ReplyFile {
  return { draft: draftFromJob(f), job: f, device: null }
}

/** A file from this computer or a photo, keyed by what it is, so picking it twice says it is on already. */
export function replyFileFromDevice(file: DeviceFile, from: 'computer' | 'photo'): ReplyFile {
  const key = `device:${from}:${file.name}:${file.size}:${file.lastModified ?? 0}`
  return { draft: draftFromDevice(key, file.name, file.size, fileKindOf(file.type, file.name), from), job: null, device: file }
}

/** How each file goes on this kind of message. */
export function replyWays(files: readonly ReplyFile[], channel: Channel): FileWay[] {
  return waysOut(
    files.map((f) => f.draft),
    channel,
  )
}

/**
 * The files as `messages-email` takes them, or the words for why one cannot go: a plan set with no Drive folder, or a
 * file from this computer whose bytes did not read.
 */
export function replyFileAsks(
  files: readonly ReplyFile[],
  audience: Audience,
  hasPortal: boolean,
  bytes: ReadonlyMap<string, DeviceBytes>,
): { ok: true; asks: EmailFileAsk[] } | { ok: false; words: string } {
  const ways = replyWays(files, 'email')
  const asks: EmailFileAsk[] = []
  for (const [i, w] of ways.entries()) {
    const f = files[i]!
    const ask = emailFileAsk(w, { audience, hasPortal, job: f.job, device: bytes.get(f.draft.key) ?? null })
    if (!ask) return { ok: false, words: `${f.draft.name} cannot go from here. Take it off the message and add it again.` }
    asks.push(ask)
  }
  return { ok: true, asks }
}

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric' })

/** The picker's small tag for where a job's file lives: *Drive · Plans*, *from their portal*, *came in Oct 6*. */
export function fileTag(f: JobFile): string {
  const day = f.at ? MONTH_DAY.format(new Date(f.at)) : null
  switch (f.source) {
    case 'plans':
      return 'plan set'
    case 'drive':
      return f.home === 'plans' ? 'Drive · Plans' : 'Drive · Team only'
    case 'trade':
      return 'from their portal'
    case 'sent':
      return day ? `we sent it ${day}` : 'we sent it'
    case 'arrived':
      return day ? `came in ${day}` : 'came in'
    default:
      return 'the app makes it'
  }
}

/**
 * Where a job's file opens in a tab from its preview: the office's own pages, `/files/drive/<job>:<file>` for a Drive
 * file and `/files/messages/<id>` for our copy of one that came in, or a plan set's Drive folder, which anyone with the
 * link reads. Null for a paper the app makes or a sent copy's file, which open from their own windows.
 */
export function previewHref(f: JobFile, jobKey: string | null): string | null {
  const [head, ...rest] = f.key.split(':')
  const tail = rest.join(':')
  const job = jobRefOf(jobKey)
  if (head === 'drive' && tail && job) return fileHref('drive', driveFileRouteId(job, tail))
  if (head === 'arrived' && tail) return fileHref('messages', tail)
  if (head === 'plans' && f.driveUrl) return f.driveUrl
  return null
}
