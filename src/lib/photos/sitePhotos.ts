/**
 * A development's photos (punch list #247, PR 1): the rules of the Development page's sixth look, pure. The owner,
 * 2026-11-02, reading a site's History: *a one row multiple column photo gallery we can scroll through at the bottom
 * of developments would be highly productive*. The rows are the `uploaded_photos` view's (punch list #232), scoped to
 * the site's jobs and bids and read newest first; this file says how the site is asked for, what the census of its
 * photos counts (the strip's words, the job picker's counts), how the row of tiles is cut with a day tick where the
 * day changes, and what the look says when it is empty. The reads are `sitePhotosIo.ts`; the screen is
 * `components/developments/DevelopmentPhotosLook.tsx`.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort, ymdAddDays } from '../../utils/dateUtils'
import { firstName, sourceChips, sourceWords, type SourcePick, type UploadedPhotoRow } from './uploadedPhotos'
import type { DevelopmentDoor } from '../developments/readDoor'

/** Tiles read per step; Show more at the right end reads the next step. */
export const SITE_PHOTOS_PAGE = 60

/** The census reads at most this many rows, three columns each; a site past it reads as *5000+*. */
export const SITE_PHOTOS_CENSUS_CAP = 5000

export const SITE_PHOTOS_CENSUS_SELECT = 'id, job_id, bid_id, taken_at'

/** One row of the census: what the strip and the job picker count, three columns of the view. */
export type SitePhotoCensusRow = Pick<UploadedPhotoRow, 'id' | 'job_id' | 'bid_id' | 'taken_at'>

/** A uuid as PostgREST may read it inside an `in` list: anything else is left out, never sent. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * PostgREST's `or` for the site's pieces: a photo on one of its jobs, or a text's picture on one of its bids. Null
 * for a site with no piece, which reads nothing. The ids are the page's own, already read.
 */
export function siteFilter(jobIds: ReadonlyArray<string>, bidIds: ReadonlyArray<string>): string | null {
  const jobs = [...new Set(jobIds.filter((id) => UUID.test(id)))]
  const bids = [...new Set(bidIds.filter((id) => UUID.test(id)))]
  const parts: string[] = []
  if (jobs.length) parts.push(`job_id.in.(${jobs.join(',')})`)
  if (bids.length) parts.push(`bid_id.in.(${bids.join(',')})`)
  return parts.length ? parts.join(',') : null
}

/** What the server is asked for the row: the site, one of its jobs or every job, one source or every source, how many. */
export type SitePhotosQuery = {
  jobIds: ReadonlyArray<string>
  bidIds: ReadonlyArray<string>
  jobId: string | null
  source: SourcePick
  limit: number
}

export type SitePhotoCensus = {
  /** Every photo the reader may see on the site, up to the cap. */
  total: number
  /** Taken in the last seven days. */
  thisWeek: number
  /** The census hit its cap: the total reads *5000+*. */
  capped: boolean
  /** How many on each job, by the job's id; a picture on a bid alone counts under its bid's id. */
  byPiece: ReadonlyMap<string, number>
}

/** The moment seven days before now, ISO: the edge of *this week*. */
export function weekFromIso(nowMs: number): string {
  return new Date(nowMs - 7 * 86_400_000).toISOString()
}

/** The census of the site's photos from the light read. */
export function censusOf(rows: ReadonlyArray<SitePhotoCensusRow>, weekFrom: string, cap = SITE_PHOTOS_CENSUS_CAP): SitePhotoCensus {
  const byPiece = new Map<string, number>()
  let thisWeek = 0
  for (const r of rows) {
    if (r.taken_at >= weekFrom) thisWeek += 1
    const piece = r.job_id ?? r.bid_id
    if (piece) byPiece.set(piece, (byPiece.get(piece) ?? 0) + 1)
  }
  return { total: rows.length, thisWeek, capped: rows.length >= cap, byPiece }
}

/** *312*, *5000+*. */
export function totalWords(census: Pick<SitePhotoCensus, 'total' | 'capped'>): string {
  return census.capped ? `${census.total}+` : String(census.total)
}

/**
 * An estimator reads the page through the overview door, with no `jobs_ledger` read, and `uploaded_photos` joins every
 * job photo to its job under the reader's own rules: the view hands an estimator only the pictures sent by text or email.
 * The look says so instead of reading *Nothing filed yet* on a site full of crew photos (the live walk of 2026-11-03).
 */
export const CREWS_PHOTOS_FOR_THE_OFFICE = 'the crews’ photos are for the office'

/**
 * The source chips the look offers: the Photos tab's for the office, less the task cards' (a task card's photo is on no
 * job, so a site never holds one; v2.6635); none for an estimator, whose only source is a text or an email.
 */
export function siteSourceChips(role: string | null | undefined, door: DevelopmentDoor = 'office'): ReadonlyArray<{ key: SourcePick; label: string }> {
  return door === 'office' ? sourceChips(role).filter((c) => c.key !== 'task') : []
}

/** The strip's sixth look: *312 · 9 this week*, *312*, *none yet*, or *…* while the census reads; an estimator with none reads *the office reads them*. Nothing in it needs the leader, so no amber. */
export function photosLookWords(census: SitePhotoCensus | null, door: DevelopmentDoor = 'office'): { n: number; count: string; need: null } {
  if (!census) return { n: 0, count: '…', need: null }
  if (census.total === 0) return { n: 0, count: door === 'office' ? 'none yet' : 'the office reads them', need: null }
  const total = totalWords(census)
  return { n: census.total, count: census.thisWeek > 0 ? `${total} · ${census.thisWeek} this week` : total, need: null }
}

/** The card's meta line: *312 on this site · 9 this week · newest first*; *nothing filed yet* with none; for an estimator, *3 sent by text or email · the crews’ photos are for the office*. */
export function photosCardMeta(census: SitePhotoCensus | null, door: DevelopmentDoor = 'office'): string {
  if (door !== 'office') return census && census.total > 0 ? `${totalWords(census)} sent by text or email · ${CREWS_PHOTOS_FOR_THE_OFFICE}` : CREWS_PHOTOS_FOR_THE_OFFICE
  if (!census) return 'reading the site’s photos…'
  if (census.total === 0) return 'nothing filed yet'
  const week = census.thisWeek > 0 ? ` · ${census.thisWeek} this week` : ''
  return `${totalWords(census)} on this site${week} · newest first`
}

export type JobPick = { key: string; label: string; count: number }

/**
 * The job picker's chips: *All jobs · 312* first, then one chip per piece with photos, the most photographed first and
 * the label as its tie-break. A piece the page no longer lists (a job taken out of the development since the read)
 * is left out, so a chip never names a job the table cannot show.
 */
export function jobPicks(census: SitePhotoCensus | null, pieces: ReadonlyArray<{ id: string; label: string }>): JobPick[] {
  if (!census) return []
  const picks: JobPick[] = []
  for (const p of pieces) {
    const n = census.byPiece.get(p.id) ?? 0
    if (n > 0) picks.push({ key: p.id, label: p.label, count: n })
  }
  picks.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return [{ key: 'all', label: 'All jobs', count: census.total }, ...picks]
}

/** How many job chips show before *+ N more jobs*; the picked one always shows. */
export const JOB_PICKS_SHOWN = 6

/** The chips to draw: the first few by count, the picked one among them whatever its rank, and how many fold. */
export function jobPicksShown(picks: ReadonlyArray<JobPick>, picked: string | null, open: boolean, shown = JOB_PICKS_SHOWN): { picks: JobPick[]; folded: number } {
  if (open || picks.length <= shown + 1) return { picks: [...picks], folded: 0 }
  const head = picks.slice(0, shown + 1)
  const pickedRow = picked && picked !== 'all' ? picks.find((p) => p.key === picked) : null
  if (pickedRow && !head.includes(pickedRow)) head.push(pickedRow)
  return { picks: head, folded: picks.length - head.length }
}

/** *+ 20 more jobs* / *+ 1 more job*. */
export function moreJobsWords(folded: number): string {
  return `+ ${folded} more ${folded === 1 ? 'job' : 'jobs'}`
}

/** A chip's words: *JP629 Lot 14 · 38*. */
export function jobPickWords(pick: JobPick): string {
  return `${pick.label} · ${pick.count}`
}

export type GalleryTile =
  | { kind: 'photo'; row: UploadedPhotoRow; index: number; /** The tick over the tile where the day changes: *Today*, *Yesterday*, *Oct 29*; null inside a day. */ tick: string | null }
  | { kind: 'more'; left: number | null }

/** The tick's words for a day: *Today*, *Yesterday*, else *Oct 29*; *No date* for a time that does not parse. */
export function dayTickWords(ymd: string, todayYmd: string): string {
  if (!ymd) return 'No date'
  if (ymd === todayYmd) return 'Today'
  if (ymd === ymdAddDays(todayYmd, -1)) return 'Yesterday'
  return formatWorkDateYmdMonthDayShort(ymd)
}

/**
 * The row of tiles, in the order given (newest first): a tick over the first tile of each day in the company's
 * calendar, and a *Show more* tile at the right end while another page may follow, saying how many are left when the
 * census knows.
 */
export function galleryTiles(rows: ReadonlyArray<UploadedPhotoRow>, todayYmd: string, more: boolean, total: number | null): GalleryTile[] {
  const out: GalleryTile[] = []
  let lastYmd: string | null = null
  rows.forEach((row, index) => {
    const ymd = Number.isFinite(Date.parse(row.taken_at)) ? calendarYmdInAppTzFromIso(row.taken_at) : ''
    const tick = ymd !== lastYmd ? dayTickWords(ymd, todayYmd) : null
    lastYmd = ymd
    out.push({ kind: 'photo', row, index, tick })
  })
  if (more && rows.length > 0) out.push({ kind: 'more', left: total != null ? Math.max(0, total - rows.length) : null })
  return out
}

/** The *Show more* tile's second line: *252 older*, or '' when the census is unknown. */
export function moreTileWords(left: number | null): string {
  return left == null || left <= 0 ? '' : `${left} older`
}

/** The words on a tile: the job's number and the first name, *JP629 · Malachi*; a text's picture reads its source, *JP598 · text*. */
export function tileWords(row: Pick<UploadedPhotoRow, 'source' | 'by_name' | 'job_hcp_number' | 'job_click_number' | 'bid_number' | 'job_id' | 'bid_id' | 'direction' | 'channel'>, jobLabel: string | null): string {
  const piece = jobLabel ?? (row.job_id ? `J${(row.job_hcp_number ?? '').trim() || (row.job_click_number ?? '').trim()}` : row.bid_id && row.bid_number ? `Bid ${row.bid_number}` : '')
  const who = row.source === 'message' ? sourceWords(row).toLowerCase() : firstName(row.by_name)
  return [piece, who].filter(Boolean).join(' · ')
}

/** The line under the row: *60 of 312 · scroll sideways · a tile opens the photo*; *312 photos · …* once every one is on the row. */
export function photosFootWords(shown: number, census: SitePhotoCensus | null, narrowed: boolean): string {
  const how = 'scroll sideways · a tile opens the photo'
  if (!census || narrowed) return `${shown} ${shown === 1 ? 'photo' : 'photos'} · ${how}`
  if (shown >= census.total && !census.capped) return `${shown} ${shown === 1 ? 'photo' : 'photos'} · ${how}`
  return `${shown} of ${totalWords(census)} · ${how}`
}

/** Whether a chip narrows the row, for the empty state's words. */
export function sitePhotosNarrowed(q: Pick<SitePhotosQuery, 'jobId' | 'source'>, person: string | null): boolean {
  return q.jobId !== null || q.source !== 'all' || !!person
}

/** The empty state's words: what fills the row and where its door is (the empty-state rule); for an estimator, what fills it and where the crews' photos are. */
export function sitePhotosEmptyWords(narrowed: boolean, siteName: string, door: DevelopmentDoor = 'office'): { main: string; tail: string } {
  if (door !== 'office') {
    return narrowed
      ? { main: 'No picture matches.', tail: 'Pick another job.' }
      : { main: `No picture sent by text or email on ${siteName} yet.`, tail: 'The crews’ photos on the jobs are for the office.' }
  }
  return narrowed
    ? { main: 'No photo matches.', tail: 'Pick another job or another source.' }
    : { main: `Nothing filed yet on ${siteName}.`, tail: 'lists its jobs. A photo on a report, a box or a checklist on one of them shows here within a minute.' }
}

/** The rows one person took, for the viewer's *Only Malachi's photos*; every row with no person picked. */
export function rowsByPerson(rows: ReadonlyArray<UploadedPhotoRow>, person: string | null): UploadedPhotoRow[] {
  if (!person) return [...rows]
  return rows.filter((r) => r.by_name.trim() === person.trim())
}

/** The person chip's words: *Only Malachi's photos*. */
export function personChipWords(person: string): string {
  return `Only ${firstName(person) || person}’s photos`
}
