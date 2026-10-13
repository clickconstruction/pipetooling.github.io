/**
 * Messages, cut 10 (photos saved on arrival): the `photo-save` sweep's rows, read with their line, as the kernels take
 * them. One read gives each file on a line tied to a job, with the line's way, time, job, who and words; `photoRowOf` is
 * what `photosToSave` picks from, and `photoNameInputOf` what `photoDriveName` names.
 */
import type { PhotoNameInput } from './photoName'
import type { PhotoRow, PhotoSwitch } from './photoSave'

/** The read the sweep makes of `message_attachments`, each file with the line it came on. */
export const PHOTO_ROWS_SELECT =
  'id, sort_order, kind, name, mime, bucket_path, drive_file_id, sent_as, messages!inner(direction, at, bid_id, project_id, jobs_ledger_id, who_text, subject, body)'

/** The read the sweep makes of `photo_saves`: every tick that is on. */
export const PHOTO_SWITCHES_SELECT = 'bid_id, project_id, jobs_ledger_id, on_since'

/** A line, as the sweep reads it under its file. */
export interface PhotoLineRow {
  direction: string
  at: string
  bid_id: string | null
  project_id: string | null
  jobs_ledger_id: string | null
  who_text: string
  subject: string | null
  body: string
}

/** A file and its line, as the sweep reads them. */
export interface PhotoAttachmentRow {
  id: string
  sort_order: number
  kind: string
  name: string
  mime: string | null
  bucket_path: string | null
  drive_file_id: string | null
  sent_as: string | null
  messages: PhotoLineRow | PhotoLineRow[] | null
}

function lineOf(a: PhotoAttachmentRow): PhotoLineRow | null {
  return Array.isArray(a.messages) ? (a.messages[0] ?? null) : a.messages
}

/**
 * Who sent it, from the line's who: an email's *Greg Paulk <greg@…> to bids@* or *Greg Paulk · forwarded to bids@ by
 * Rosa* gives *Greg Paulk*; a text's who is the person or their number already.
 */
export function senderOf(whoText: string): string {
  return whoText
    .split(' · ')[0]!
    .replace(/\s+to\s+\S*@\S*$/i, '')
    .replace(/\s*<[^>]*>?\s*$/, '')
    .trim()
}

/** The row `photosToSave` reads, or null for a file read without its line. */
export function photoRowOf(a: PhotoAttachmentRow): PhotoRow | null {
  const line = lineOf(a)
  if (!line) return null
  const { id, kind, name, mime, bucket_path, drive_file_id, sent_as } = a
  return {
    id,
    kind,
    name,
    mime,
    bucket_path,
    drive_file_id,
    sent_as,
    line: { direction: line.direction, at: line.at, bid_id: line.bid_id, project_id: line.project_id, jobs_ledger_id: line.jobs_ledger_id },
  }
}

/** What `photoDriveName` names a file by: the line's day, its sender, the file's own name and the line's words. */
export function photoNameInputOf(a: PhotoAttachmentRow): PhotoNameInput | null {
  const line = lineOf(a)
  if (!line) return null
  return {
    at: line.at,
    sender: senderOf(line.who_text),
    fileName: a.name,
    mime: a.mime,
    // An email's subject names it better than its whole body; a text has only its words.
    words: line.subject?.trim() ? line.subject : line.body,
    place: a.sort_order + 1,
  }
}

/** The ticks as `photosToSave` takes them, the ones on alone. */
export function onSwitches(rows: readonly PhotoSwitch[]): PhotoSwitch[] {
  return rows.filter((r) => r.on_since !== null)
}
