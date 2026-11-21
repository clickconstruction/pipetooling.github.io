import { describe, expect, it } from 'vitest'
import { FROM_THE_BID, fromBidFootWords, fromBidTileWords, isFromBid, withBidRows } from './jobPhotosFromBid'
import { gridBySource, gridChips, gridFootWords, gridItems, gridSearch, gridTileWords } from './jobPhotoNotes'
import { bidBoardPath, bidFiledParts, canSeeBidPhotos, captionWords, jobWords, sourceChips, sourceDoorWords, sourceWords, thumbSource, whoWords, type UploadedPhotoRow } from './uploadedPhotos'

const jobRow: UploadedPhotoRow = {
  source: 'job', id: 'n1', job_id: 'job-1', bid_id: null, project_id: null, report_id: null, container_id: null, question_id: null, message_id: null, contact_id: null,
  caption: 'Cracked flange under the second lav', stage_name: 'Rough In', by_user_id: 'u1', by_name: 'Carla Nguyen', direction: null, channel: null,
  taken_at: '2026-11-20T15:00:00.000Z', bytes: 310_000, original_bytes: 4_200_000, bucket: 'job-photo-notes', storage_path: null, drive_file_id: 'd-1', filed_at: '2026-11-20T15:05:00.000Z', fail_why: null, status: null,
  job_hcp_number: '1077', job_click_number: null, job_name: 'Cedar Ridge Townhomes Phase 2', customer_name: 'Ridgeway Builders', bid_number: null,
}
/** A photo a person added on the bid and named. */
const bidRow: UploadedPhotoRow = {
  ...jobRow, source: 'bid', id: 'b1', job_id: null, bid_id: 'bid-9', caption: 'Gas meter at the north wall', stage_name: '', by_user_id: 'u2', by_name: 'Dana Reyes',
  taken_at: '2026-10-02T16:00:00.000Z', bucket: 'bid-photos', drive_file_id: 'd-7', job_hcp_number: null, job_name: 'Cedar Ridge Townhomes', bid_number: '556',
}
/** A picture the app filed from a text, which the bid's window took on: nobody on the row, the sender in the name. */
const adopted: UploadedPhotoRow = { ...bidRow, id: 'b2', caption: '2026-10-01 Priya Raman · Mechanical room', by_user_id: null, by_name: '', drive_file_id: 'd-8' }
const textOnBid: UploadedPhotoRow = { ...bidRow, source: 'message', id: 'm1', caption: 'IMG_0042.jpg', by_name: 'Greg Paulk · 555-0142', direction: 'in', channel: 'text', bucket: 'message-attachments', storage_path: 'in/m1/0.jpg', drive_file_id: null, message_id: 'msg-1', contact_id: 'c-1' }
const job = { id: 'job-1', hcp_number: '1077', job_name: 'Cedar Ridge Townhomes Phase 2' }

describe('a bid photo on Documents → Photos', () => {
  it('has a chip for whoever can read a bid, and no chip for the rest', () => {
    expect(canSeeBidPhotos('estimator')).toBe(true)
    expect(canSeeBidPhotos('primary')).toBe(true)
    expect(canSeeBidPhotos('helpers')).toBe(false)
    expect(canSeeBidPhotos('subcontractor')).toBe(false)
    expect(canSeeBidPhotos('superintendent')).toBe(false)
    expect(sourceChips('dev').map((c) => c.label)).toEqual(['All', 'Reports', 'Tally boxes', 'Checklists', 'Job photos', 'Task cards', 'Bid photos', 'Texts & email'])
    expect(sourceChips('primary').map((c) => c.key)).toEqual(['all', 'report', 'box', 'checklist', 'job', 'task', 'bid'])
    expect(sourceChips('helpers').map((c) => c.key)).toEqual(['all', 'report', 'box', 'checklist', 'job', 'task'])
  })

  it('reads as the bid, never as a job', () => {
    expect(sourceWords(bidRow)).toBe('Bid photo')
    expect(jobWords(bidRow)).toBe('Bid 556 · Cedar Ridge Townhomes · Ridgeway Builders')
    expect(sourceDoorWords(bidRow)).toBe('Open the bid')
    expect(bidBoardPath('bid-9')).toBe('/bids?tab=bid-board&bidId=bid-9')
  })

  it('a picture the app filed reads as its caption and its sender, and a named photo keeps its name', () => {
    expect(bidFiledParts(adopted)).toEqual({ sender: 'Priya Raman', caption: 'Mechanical room' })
    expect(captionWords(adopted)).toBe('Mechanical room')
    expect(whoWords(adopted)).toBe('Priya Raman')
    expect(bidFiledParts({ ...adopted, by_name: 'Dana Reyes' })).toBeNull()
    expect(captionWords({ ...adopted, by_name: 'Dana Reyes' })).toBe('2026-10-01 Priya Raman · Mechanical room')
    // Only a bid's photo is read this way: a job photo named the same keeps its whole name.
    expect(captionWords({ ...adopted, source: 'job' })).toBe('2026-10-01 Priya Raman · Mechanical room')
    expect(whoWords({ ...bidRow, by_name: '', caption: 'Meter' })).toBe('someone')
  })

  it('draws its bytes through the bid, from Drive once filed and from its bucket while it waits', () => {
    expect(thumbSource(bidRow)).toEqual({ kind: 'bid-drive', bidId: 'bid-9', fileId: 'd-7' })
    expect(thumbSource({ ...bidRow, drive_file_id: null, storage_path: 'bid-9/b1.jpg' })).toEqual({ kind: 'bucket', bucket: 'bid-photos', path: 'bid-9/b1.jpg' })
    expect(thumbSource({ ...bidRow, drive_file_id: null, storage_path: null })).toEqual({ kind: 'none' })
    // A job's filed photo still reads through the job.
    expect(thumbSource(jobRow)).toEqual({ kind: 'drive', jobId: 'job-1', fileId: 'd-1' })
  })
})

describe('a won bid’s photos in the job’s window', () => {
  it('a row is the bid’s when it names a bid and not this job', () => {
    expect(isFromBid(bidRow, 'job-1')).toBe(true)
    expect(isFromBid(textOnBid, 'job-1')).toBe(true)
    expect(isFromBid(jobRow, 'job-1')).toBe(false)
    // A text's picture tied to the job and to its bid is the job's.
    expect(isFromBid({ job_id: 'job-1', bid_id: 'bid-9' }, 'job-1')).toBe(false)
  })

  it('the job’s rows come first and a row both reads hand back is kept once, as the job’s', () => {
    const both: UploadedPhotoRow = { ...textOnBid, job_id: 'job-1' }
    const out = withBidRows([jobRow, both], [bidRow, { ...both, job_id: null }, adopted])
    expect(out.map((r) => `${r.source}:${r.id}`)).toEqual(['job:n1', 'message:m1', 'bid:b1', 'bid:b2'])
    expect(out[1]!.job_id).toBe('job-1')
    expect(withBidRows([jobRow], [])).toEqual([jobRow])
  })

  it('the tile says From the bid ahead of who added it', () => {
    expect(fromBidTileWords(bidRow, 'No description')).toEqual({ text: 'Gas meter at the north wall', none: false, who: `${FROM_THE_BID} · Dana Reyes` })
    expect(fromBidTileWords(adopted, 'No description')).toEqual({ text: 'Mechanical room', none: false, who: 'From the bid · Priya Raman' })
    expect(fromBidTileWords({ ...bidRow, caption: '', by_name: '' }, 'No description')).toEqual({ text: 'No description', none: true, who: 'From the bid' })
    expect(fromBidTileWords(textOnBid, 'No description').who).toBe('From the bid · from Greg Paulk')
  })

  it('the foot counts them', () => {
    expect(fromBidFootWords(0)).toBe('')
    expect(fromBidFootWords(1)).toBe('1 is from the bid')
    expect(fromBidFootWords(6)).toBe('6 are from the bid')
    expect(gridFootWords({ count: 3, hand: 0, folderKind: 'photos', fromBid: 2 })).toBe('3 photos · In Drive: Team only › Photos · 2 are from the bid')
    expect(gridFootWords({ count: 3, hand: 0, folderKind: 'photos' })).toBe('3 photos · In Drive: Team only › Photos')
  })

  it('the grid marks them, never doubles a filed one from Drive’s list, and gives them a chip and the search', () => {
    // The job's photo folder is the bid's Team only › Photos, so Drive lists the bid's filed pictures too.
    const drive = [
      { id: 'd-7', name: '2026-10-02 Dana Reyes · Gas meter at the north wall.jpg', mime: 'image/jpeg', bytes: 1, modified: '2026-10-02T16:01:00.000Z' },
      { id: 'd-9', name: 'IMG_4471.jpg', mime: 'image/jpeg', bytes: 1, modified: '2026-11-01T13:48:00.000Z' },
    ] as unknown as Parameters<typeof gridItems>[0]['drive']
    const items = gridItems({ rows: withBidRows([jobRow], [bidRow, adopted]), drive, job })
    expect(items.map((it) => [it.row.id, it.hand, it.fromBid ?? false])).toEqual([
      ['n1', false, false],
      ['drive:d-9', true, false],
      ['b1', false, true],
      ['b2', false, true],
    ])
    expect(gridTileWords(items[2]!)).toEqual({ text: 'Gas meter at the north wall', none: false, who: 'From the bid · Dana Reyes' })
    expect(gridTileWords(items[0]!).who).toBe('Carla Nguyen')
    expect(gridChips(items, 'assistant').map((c) => c.label)).toEqual(['All · 4', 'Job photos · 2', 'Bid photos · 2'])
    expect(gridBySource(items, 'bid').map((it) => it.row.id)).toEqual(['b1', 'b2'])
    expect(gridSearch(items, 'from the bid').map((it) => it.row.id)).toEqual(['b1', 'b2'])
    expect(gridSearch(items, 'priya').map((it) => it.row.id)).toEqual(['b2'])
  })
})
