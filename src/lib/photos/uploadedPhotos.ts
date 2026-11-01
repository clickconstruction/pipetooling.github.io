/**
 * Every photo uploaded, one list (punch list #232): the rules of Documents → Photos, pure. The `uploaded_photos` view
 * (`20261101084330_uploaded_photos_view.sql`) reads the four photo tables as one shape, newest first; this file says
 * which chips a role sees, what the server is asked, how a row reads (its source, who took it, its job, where it is),
 * how the rows group by day, and where a thumbnail's bytes come from. The reads are `uploadedPhotosIo.ts`; the screen
 * is `components/documents/DocumentsPhotosTab.tsx`.
 */
import { calendarYmdInAppTzFromIso, formatDenverTimeOnly, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'
import { bytesWords } from './shrink'
import { senderOf } from './photoRows'

export type UploadedPhotoSource = 'report' | 'box' | 'checklist' | 'message'

/** One row of the view. */
export interface UploadedPhotoRow {
  source: UploadedPhotoSource
  id: string
  job_id: string | null
  bid_id: string | null
  project_id: string | null
  report_id: string | null
  container_id: string | null
  question_id: string | null
  message_id: string | null
  /** A message line's contact, the thread's door. */
  contact_id: string | null
  caption: string
  stage_name: string
  by_user_id: string | null
  by_name: string
  /** A message line's `in`, `out` or `team`; null on the app's own sources. */
  direction: string | null
  /** A message line's channel (`text`, `email`, …); null on the app's own sources. */
  channel: string | null
  taken_at: string
  bytes: number
  original_bytes: number
  bucket: string
  storage_path: string | null
  drive_file_id: string | null
  filed_at: string | null
  fail_why: string | null
  /** A box photo's `sending` · `on-phone` · `filed` · `shared`; a message picture's `too_big` · `not_copied` · `quo_not_copied`. */
  status: string | null
  job_hcp_number: string | null
  job_click_number: string | null
  job_name: string | null
  customer_name: string | null
  bid_number: string | null
}

export const UPLOADED_PHOTOS_SELECT =
  'source, id, job_id, bid_id, project_id, report_id, container_id, question_id, message_id, contact_id, caption, stage_name, by_user_id, by_name, direction, channel, taken_at, bytes, original_bytes, bucket, storage_path, drive_file_id, filed_at, fail_why, status, job_hcp_number, job_click_number, job_name, customer_name, bid_number'

/** Rows read per step; Show more reads the next step. */
export const PHOTOS_PAGE = 100

export type SourcePick = 'all' | UploadedPhotoSource
export type WherePick = 'everywhere' | 'drive' | 'waiting'

/** Who reads a text's or an email's picture: the office team and the estimator, as `message_attachments`' policy says. */
export function canSeeMessagePhotos(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller' || role === 'estimator'
}

/** The source chips a role sees, in order. */
export function sourceChips(role: string | null | undefined): ReadonlyArray<{ key: SourcePick; label: string }> {
  const base: Array<{ key: SourcePick; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'report', label: 'Reports' },
    { key: 'box', label: 'Tally boxes' },
    { key: 'checklist', label: 'Checklists' },
  ]
  if (canSeeMessagePhotos(role)) base.push({ key: 'message', label: 'Texts & email' })
  return base
}

/** The where chips: *Not in Drive yet* carries its count when known. */
export function whereChips(waiting: number | null): ReadonlyArray<{ key: WherePick; label: string }> {
  return [
    { key: 'everywhere', label: 'Everywhere' },
    { key: 'drive', label: 'In Drive' },
    { key: 'waiting', label: waiting == null || waiting <= 0 ? 'Not in Drive yet' : `Not in Drive yet · ${waiting}` },
  ]
}

/** What the server is asked: PostgREST's filters, as strings the io applies. */
export type UploadedPhotosQuery = {
  source: SourcePick
  where: WherePick
  typed: string
  limit: number
}

/** The search as PostgREST's `or`, or null for fewer than two characters: the caption, the person, the job, the customer, the stage. */
export function photoSearchFilter(typed: string): string | null {
  const q = typed.replace(/[^A-Za-z0-9 @._#'&-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (q.length < 2) return null
  const like = `*${q}*`
  return ['caption', 'by_name', 'job_name', 'customer_name', 'job_hcp_number', 'job_click_number', 'stage_name'].map((col) => `${col}.ilike.${like}`).join(',')
}

/** Whether a filter narrows the list, for the empty state's words. */
export function photosNarrowed(q: Pick<UploadedPhotosQuery, 'source' | 'where' | 'typed'>): boolean {
  return q.source !== 'all' || q.where !== 'everywhere' || q.typed.trim().length >= 2
}

/** The source chip's words on a row. */
export function sourceWords(row: Pick<UploadedPhotoRow, 'source' | 'channel' | 'direction'>): string {
  switch (row.source) {
    case 'report':
      return 'Report'
    case 'box':
      return 'Tally box'
    case 'checklist':
      return 'Checklist'
    case 'message':
      return row.channel === 'email' ? 'Email' : row.channel === 'text' || row.channel === 'sms' ? 'Text' : 'Message'
  }
}

/** The first name of *Mateo Ruiz*; the whole name when it is one word. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

/**
 * Who took it, as the row says: the user's name as kept at the time; for a picture on a line, the sender on the line
 * (*from Greg Paulk*) or, on a line we sent, *sent by Carla Nguyen*.
 */
export function whoWords(row: Pick<UploadedPhotoRow, 'source' | 'by_name' | 'direction'>): string {
  const name = row.source === 'message' ? senderOf(row.by_name) : row.by_name.trim()
  if (!name) return row.source === 'message' ? 'from a number with no name' : 'someone'
  if (row.source !== 'message') return name
  return row.direction === 'out' ? `sent by ${name}` : `from ${name}`
}

/** *J1042 · Oak Hollow Apartments Building C · Ridgeway Builders*; a bid's *Bid 556 · Gun Dog Trail · Ridgeway*; or *No job tied* for a line on no job. */
export function jobWords(row: Pick<UploadedPhotoRow, 'job_id' | 'bid_id' | 'job_hcp_number' | 'job_click_number' | 'job_name' | 'customer_name' | 'bid_number'>): string {
  const number = (row.job_hcp_number ?? '').trim() || (row.job_click_number ?? '').trim()
  const parts: string[] = []
  if (row.job_id) {
    if (number) parts.push(`J${number}`)
  } else if (row.bid_id) {
    parts.push(row.bid_number ? `Bid ${row.bid_number}` : 'A bid')
  }
  if ((row.job_name ?? '').trim()) parts.push(row.job_name!.trim())
  if ((row.customer_name ?? '').trim()) parts.push(row.customer_name!.trim())
  return parts.length ? parts.join(' · ') : 'No job tied'
}

/** The caption in bold on the row: the stage, the box's words, the question, the file's own name, else *Photo*. */
export function captionWords(row: Pick<UploadedPhotoRow, 'source' | 'caption' | 'stage_name'>): string {
  const caption = row.caption.trim()
  if (caption) return caption
  const stage = row.stage_name.trim()
  if (stage) return stage
  return 'Photo'
}

export type WhereTone = 'filed' | 'waiting' | 'held'
export type WherePress = 'drive' | 'folders' | 'thread' | null

/** Where the photo is, in the row's own words, with the press that goes with it. */
export function whereWords(row: Pick<UploadedPhotoRow, 'source' | 'by_name' | 'storage_path' | 'drive_file_id' | 'filed_at' | 'fail_why' | 'status'>): { text: string; sub: string; tone: WhereTone; press: WherePress } {
  if (row.drive_file_id) {
    const when = row.filed_at ? `filed ${timeWords(row.filed_at)}` : ''
    return { text: 'In Drive', sub: when, tone: 'filed', press: 'drive' }
  }
  if (row.source === 'box') {
    if (row.status === 'on-phone') return { text: `Still on ${firstName(row.by_name) || 'the'}’s phone`, sub: 'kept for want of signal; it sends when the phone has it', tone: 'held', press: null }
    if (row.status === 'shared') return { text: 'Shared from the phone', sub: 'sent by hand from the phone; no copy here', tone: 'held', press: null }
  }
  if (row.source === 'message') {
    if (row.status) {
      const where = row.status === 'quo_not_copied' ? 'Quo' : 'Gmail'
      return { text: `No copy here · still in ${where}`, sub: 'the thread opens it there', tone: 'held', press: 'thread' }
    }
    return { text: 'Our copy, not in Drive', sub: 'Save to Drive on the thread files it', tone: 'waiting', press: 'thread' }
  }
  if (row.fail_why) {
    const noFolder = /no drive folder/i.test(row.fail_why)
    return { text: 'Not in Drive yet', sub: row.fail_why, tone: 'held', press: noFolder ? 'folders' : null }
  }
  if (row.storage_path) return { text: 'On its way to Drive', sub: 'the sweep runs every 5 minutes', tone: 'waiting', press: null }
  return { text: 'Not in Drive yet', sub: '', tone: 'held', press: null }
}

/** *2:14 PM* in the company's calendar; '' for a time that does not parse. */
export function timeWords(iso: string): string {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDenverTimeOnly(ms) : ''
}

/** *4.2 MB → 310 KB*, *310 KB*, or '' with no size. */
export function sizeWords(row: Pick<UploadedPhotoRow, 'bytes' | 'original_bytes'>): string {
  const after = row.bytes > 0 ? bytesWords(row.bytes) : ''
  const before = row.original_bytes > 0 && row.original_bytes !== row.bytes ? bytesWords(row.original_bytes) : ''
  if (before && after) return `${before} → ${after}`
  return after
}

export type DayGroup = { ymd: string; label: string; rows: UploadedPhotoRow[] }

/** The rows by day in the company's calendar, in the order given: *Today · Sat, Nov 1*, *Yesterday · Fri, Oct 31*, then the day alone. */
export function dayGroups(rows: ReadonlyArray<UploadedPhotoRow>, todayYmd: string): DayGroup[] {
  const yesterday = ymdBefore(todayYmd)
  const out: DayGroup[] = []
  for (const row of rows) {
    const ymd = Number.isFinite(Date.parse(row.taken_at)) ? calendarYmdInAppTzFromIso(row.taken_at) : ''
    const last = out[out.length - 1]
    if (last && last.ymd === ymd) {
      last.rows.push(row)
      continue
    }
    const day = ymd ? formatWorkDateYmdWeekdayShortFriendly(ymd) : 'No date'
    const label = ymd === todayYmd ? `Today · ${day}` : ymd === yesterday ? `Yesterday · ${day}` : day
    out.push({ ymd, label, rows: [row] })
  }
  return out
}

function ymdBefore(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(Date.UTC(y, m - 1, d - 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export type ThumbSource = { kind: 'bucket'; bucket: string; path: string } | { kind: 'drive'; jobId: string; fileId: string } | { kind: 'none' }

/**
 * Where a thumbnail's bytes come from: a shot still in a bucket through a signed URL on it; a filed one through the
 * `job-photos` function on its Drive id, which answers only for a file inside a Pipeline job's two photo folders; a
 * text's picture whose copy we keep from its bucket even once filed, since a bid's or a project's folder is outside
 * the function's reach; nothing for a photo with no copy anywhere we can read.
 */
export function thumbSource(row: Pick<UploadedPhotoRow, 'source' | 'job_id' | 'bucket' | 'storage_path' | 'drive_file_id'>): ThumbSource {
  if (row.source === 'message') {
    return row.storage_path ? { kind: 'bucket', bucket: row.bucket, path: row.storage_path } : { kind: 'none' }
  }
  if (row.drive_file_id && row.job_id) return { kind: 'drive', jobId: row.job_id, fileId: row.drive_file_id }
  if (row.storage_path) return { kind: 'bucket', bucket: row.bucket, path: row.storage_path }
  return { kind: 'none' }
}

/** The viewer's title: the caption, then the job. */
export function viewerTitle(row: UploadedPhotoRow): string {
  const job = jobWords(row)
  return job === 'No job tied' ? captionWords(row) : `${captionWords(row)} · ${job}`
}

/** The source press's words on the viewer: what the photo came with. */
export function sourceDoorWords(row: Pick<UploadedPhotoRow, 'source'>): string {
  switch (row.source) {
    case 'report':
      return 'Open the report'
    case 'box':
      return 'Open the box'
    case 'checklist':
      return 'Open the job'
    case 'message':
      return 'Open the thread'
  }
}

/** The thread's address for a message picture's line, opened at that line. */
export function threadPath(row: Pick<UploadedPhotoRow, 'contact_id' | 'message_id'>): string | null {
  if (!row.contact_id) return null
  const at = row.message_id ? `&at=${encodeURIComponent(row.message_id)}` : ''
  return `/messages?thread=${encodeURIComponent(row.contact_id)}${at}`
}

/** The job window's address, for a press outside the window's own opener. */
export function jobWindowPath(jobId: string): string {
  return `/jobs?jobDetail=${encodeURIComponent(jobId)}`
}

/** The empty state's words. */
export function photosEmptyWords(narrowed: boolean): { main: string; tail: string } {
  return narrowed
    ? { main: 'No photo matches.', tail: 'Try another source, another place or fewer words.' }
    : { main: 'Nothing uploaded yet.', tail: 'A photo taken on a report, a box or a checklist shows here within a minute.' }
}

/** The line under the list. */
export const PHOTOS_FOOT = 'A photo put in a Drive folder by hand is in the job’s own strip, not here. Open the job to see the whole folder.'
