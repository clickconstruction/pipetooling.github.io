/**
 * A won bid's photos in the job's photo window (punch list #306, PR 9): the pure rules. A photo added to a bid stays
 * the bid's after the win: its row in the `uploaded_photos` view names the bid and no job. The Job photos window reads
 * the job's own rows, then the rows of the bid the job was won from, and lists the bid's as *from the bid*. Who reads
 * a bid's photo is the bid's own gate, so a reader who cannot read the bid is handed none and sees the window as it
 * was. The reads are `jobPhotoNotesIo.ts` (`loadJobBidPhotos`); the grid is `jobPhotoNotes.ts`.
 */
import { captionWords, whoWords, type UploadedPhotoRow } from './uploadedPhotos'

/** The words that mark a bid's photo in a job's window. */
export const FROM_THE_BID = 'From the bid'

/** Whether a row in one job's window is the bid's: it names a bid, and it is not on this job. */
export function isFromBid(row: Pick<UploadedPhotoRow, 'job_id' | 'bid_id'>, jobId: string): boolean {
  return Boolean(row.bid_id) && row.job_id !== jobId
}

/**
 * The window's rows: the job's own, then the bid's. The bid's rows are every source the view holds for the bid: its
 * photos, and a text's picture on the bid's thread. A row both reads hand back is kept once, as the job's; none does
 * today (a line names a bid or a job, never both, and a bid's photo names no job), so this only keeps a later change
 * to the view from drawing a photo twice.
 */
export function withBidRows(jobRows: ReadonlyArray<UploadedPhotoRow>, bidRows: ReadonlyArray<UploadedPhotoRow>): UploadedPhotoRow[] {
  const key = (r: Pick<UploadedPhotoRow, 'source' | 'id'>) => `${r.source}:${r.id}`
  const seen = new Set(jobRows.map(key))
  const out = [...jobRows]
  for (const r of bidRows) {
    if (seen.has(key(r))) continue
    seen.add(key(r))
    out.push(r)
  }
  return out
}

/**
 * The words under a bid's photo in the job's grid: its name, or *No description*, and *From the bid* ahead of who
 * added it, so the mark is the part a narrow tile never cuts off.
 */
export function fromBidTileWords(row: Pick<UploadedPhotoRow, 'source' | 'caption' | 'stage_name' | 'by_name' | 'direction'>, none: string): { text: string; none: boolean; who: string } {
  const name = captionWords(row)
  const unnamed = !row.caption.trim() && !row.stage_name.trim()
  const who = whoWords(row)
  return { text: unnamed ? none : name, none: unnamed, who: [FROM_THE_BID, who === 'someone' ? '' : who].filter(Boolean).join(' · ') }
}

/** The foot's part for the bid's photos: *1 is from the bid*, *6 are from the bid*, or '' with none. */
export function fromBidFootWords(count: number): string {
  if (count <= 0) return ''
  return count === 1 ? '1 is from the bid' : `${count} are from the bid`
}
