import { describe, expect, it } from 'vitest'
import { newPress, type OutboxPress } from '../offline/outbox'
import type { BidPhotoFolderState } from './bidPhotos'
import {
  addPress,
  addWrites,
  addedWords,
  appFiledNameParts,
  bidPhotoNameTrimmed,
  bidPhotoStoragePath,
  driveSilentWords,
  folderIsMade,
  gridHeadWords,
  gridTileWords,
  heldFilesWords,
  keptCount,
  keptNextWords,
  keptPlace,
  landedBidPhotos,
  newestFirst,
  onThisPhoneWords,
  photosOnThisPhone,
  queuedBidPhotos,
  queuedWords,
  shotIsReady,
  photoDayWords,
  photosSlot,
  sortPickedFiles,
  tileStatusWords,
  whereWords,
  type BidPhotoTile,
} from './bidPhotoWindow'

function tile(over: Partial<BidPhotoTile> = {}): BidPhotoTile {
  return { id: 't1', status: 'sent', previewUrl: 'blob:1', originalBytes: 4_000_000, bytes: 300_000, width: 1600, height: 1200, longEdge: 1600, shrunk: true, fixtureId: null, stageName: null, storagePath: 'bid/t1.jpg', takenAt: '2026-11-10T15:00:00.000Z', failWhy: null, name: '', ...over }
}

const folder = (kind: BidPhotoFolderState['kind'], projectName = 'Quarry Road Storage Bunker'): BidPhotoFolderState => ({ kind, projectName, projectUrl: kind === 'none' ? null : 'https://drive.google.com/drive/folders/p', photosUrl: kind === 'ready' ? 'https://drive.google.com/drive/folders/ph' : null, hold: null })

describe('the photos slot on the Bid Board', () => {
  it('is grey with nothing and says what a press does', () => {
    expect(photosSlot(0)).toEqual({ state: 'grey', count: null, title: 'No photos yet · Add photos' })
  })

  it('is blue with the count', () => {
    expect(photosSlot(1)).toEqual({ state: 'blue', count: '1', title: '1 photo' })
    expect(photosSlot(12)).toEqual({ state: 'blue', count: '12', title: '12 photos' })
    expect(photosSlot(140)).toEqual({ state: 'blue', count: '99+', title: '140 photos' })
  })

  it('claims no count while the count has not read', () => {
    expect(photosSlot(null)).toEqual({ state: 'grey', count: null, title: 'Photos' })
    expect(photosSlot(undefined).state).toBe('grey')
  })
})

describe('a pick or a drop', () => {
  it('takes the pictures and holds the rest with a reason', () => {
    const out = sortPickedFiles([
      { name: 'mechanical-room.jpg', type: 'image/jpeg' },
      { name: 'site-walk.mov', type: 'video/quicktime' },
      { name: 'IMG_2041.HEIC', type: '' },
      { name: 'notes.pdf', type: 'application/pdf' },
    ])
    expect(out.photos.map((f) => f.name)).toEqual(['mechanical-room.jpg', 'IMG_2041.HEIC'])
    expect(out.held).toEqual([
      { name: 'site-walk.mov', why: 'A video. Photos only for now.' },
      { name: 'notes.pdf', why: 'Not a picture.' },
    ])
  })

  it('says what was left out', () => {
    expect(heldFilesWords([])).toBeNull()
    expect(heldFilesWords([{ name: 'site-walk.mov', why: 'A video. Photos only for now.' }])).toBe('1 file was left out: site-walk.mov. A video. Photos only for now.')
    expect(heldFilesWords([{ name: 'site-walk.mov', why: 'A video. Photos only for now.' }, { name: 'notes.pdf', why: 'Not a picture.' }])).toBe('2 files were left out. The first is site-walk.mov. A video. Photos only for now.')
  })
})

describe('the press', () => {
  it('names the folder it makes the first time on a bid', () => {
    expect(addPress({ tiles: [tile(), tile({ id: 't2' }), tile({ id: 't3' })], adding: false, folder: folder('project') })).toEqual({ label: 'Make the folder and add 3 photos', dead: false })
    expect(addPress({ tiles: [tile()], adding: false, folder: folder('none') })).toEqual({ label: 'Make the folder and add 1 photo', dead: false })
  })

  it('reads Add once the folder is there, or when the folder did not read', () => {
    expect(addPress({ tiles: [tile(), tile({ id: 't2' })], adding: false, folder: folder('ready') })).toEqual({ label: 'Add 2 photos', dead: false })
    expect(addPress({ tiles: [tile()], adding: false, folder: null })).toEqual({ label: 'Add 1 photo', dead: false })
    expect(folderIsMade(null)).toBe(true)
    expect(folderIsMade(folder('project'))).toBe(false)
  })

  it('counts only the shots that are ready, and waits for one on its way', () => {
    expect(addPress({ tiles: [tile(), tile({ id: 't2', status: 'failed', failWhy: 'Too big.' })], adding: false, folder: folder('ready') })).toEqual({ label: 'Add 1 photo', dead: false })
    expect(addPress({ tiles: [tile(), tile({ id: 't2', status: 'sending' })], adding: false, folder: folder('ready') })).toEqual({ label: 'Add 1 photo', dead: true })
    expect(addPress({ tiles: [tile({ status: 'failed' })], adding: false, folder: folder('ready') })).toEqual({ label: 'Add photos', dead: true })
    expect(addPress({ tiles: [tile()], adding: true, folder: folder('ready') })).toEqual({ label: 'Adding…', dead: true })
  })

  // PR 8: a shot kept on the phone with no signal is ready, and the press takes it through the outbox.
  it('counts a shot kept on the phone as ready, so the press is live with no signal', () => {
    expect(addPress({ tiles: [tile({ status: 'kept', storagePath: null })], adding: false, folder: null })).toEqual({ label: 'Add 1 photo', dead: false })
    expect(addPress({ tiles: [tile(), tile({ id: 't2', status: 'kept', storagePath: null })], adding: false, folder: folder('project') })).toEqual({ label: 'Make the folder and add 2 photos', dead: false })
    expect(shotIsReady(tile({ status: 'kept' }))).toBe(true)
    expect(shotIsReady(tile({ status: 'failed' }))).toBe(false)
    expect(keptCount([tile(), tile({ id: 't2', status: 'kept' }), tile({ id: 't3', status: 'failed' })])).toBe(1)
    // The direct press still writes only what is in the bucket.
    expect(addWrites([tile(), tile({ id: 't2', status: 'kept' })])).toEqual([{ id: 't1', name: '' }])
  })

  it('hands a kept press its shots: a kept one unsent, a sent one with only the landing left, a failed one left out', () => {
    const queued = queuedBidPhotos(
      [tile({ id: 'k1', status: 'kept', storagePath: null, name: '  Meter   bank ', bytes: 290_000 }), tile({ id: 's1', name: 'Riser' }), tile({ id: 'f1', status: 'failed' }), tile({ id: 'g1', status: 'sending' })],
      'Dana Whitfield',
    )
    expect(queued).toEqual([
      { id: 'k1', sent: false, name: 'Meter bank', takenAt: '2026-11-10T15:00:00.000Z', bytes: 290_000, originalBytes: 4_000_000, width: 1600, height: 1200, byName: 'Dana Whitfield' },
      { id: 's1', sent: true, name: 'Riser', takenAt: '2026-11-10T15:00:00.000Z', bytes: 300_000, originalBytes: 4_000_000, width: 1600, height: 1200, byName: 'Dana Whitfield' },
    ])
  })

  it('says what the press does with no signal, by the press’s own name, and nothing when no shot is kept', () => {
    expect(keptNextWords({ tiles: [tile()], pressLabel: 'Add 1 photo', phone: true })).toBeNull()
    expect(keptNextWords({ tiles: [tile({ status: 'kept' })], pressLabel: 'Add 1 photo', phone: true })).toBe('There is no signal. Add 1 photo keeps it on this phone. It goes to the bid when the signal is back.')
    expect(keptNextWords({ tiles: [tile(), tile({ id: 't2', status: 'kept' })], pressLabel: 'Add 2 photos', phone: false })).toBe('There is no signal. Add 2 photos keeps them on this device. They go to the bid when the signal is back.')
  })

  it('names the device by its width, in the tile, the toast and the window’s line', () => {
    expect(keptPlace(true)).toBe('this phone')
    expect(keptPlace(false)).toBe('this device')
    expect(tileStatusWords(tile({ status: 'kept' }), false)).toEqual({ text: 'Kept on this device.', tone: 'warn' })
    expect(queuedWords(1, true)).toBe('Kept on this phone. The photo goes to the bid when the signal is back.')
    expect(queuedWords(3, false)).toBe('Kept on this device. The photos go to the bid when the signal is back.')
    expect(onThisPhoneWords(0, true)).toBeNull()
    expect(onThisPhoneWords(1, true)).toBe('1 photo waits on this phone. It goes to the bid when the signal is back.')
    expect(onThisPhoneWords(2, false)).toBe('2 photos wait on this device. They go to the bid when the signal is back.')
  })

  it('counts this bid’s photos still on the phone: waiting or in flight, never another bid’s, a landed press’s or a refused one’s', () => {
    const shot = (id: string) => ({ id, sent: false, name: '', takenAt: '2026-11-12T13:00:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: '' })
    const bidPress = (id: string, bidId: string, n: number, state: OutboxPress['state'] = 'waiting'): OutboxPress => ({ ...newPress({ id, seq: 1, kind: 'bid-photos', userId: 'u1', pressedAt: 1_780_000_000_000, payload: { bidId, photos: Array.from({ length: n }, (_, i) => shot(`${id}-${i}`)) } }), state })
    const note = newPress({ id: 'n', seq: 9, kind: 'job-note', userId: 'u1', pressedAt: 1_780_000_000_000, payload: { jobId: 'b1', body: 'x' } })
    const presses = [bidPress('a', 'b1', 2), bidPress('b', 'b1', 1, 'sending'), bidPress('c', 'b2', 4), bidPress('d', 'b1', 3, 'sent'), bidPress('e', 'b1', 5, 'refused'), note]
    expect(photosOnThisPhone(presses, 'b1')).toBe(3)
    expect(photosOnThisPhone(presses, 'b2')).toBe(4)
    expect(photosOnThisPhone(presses, 'b3')).toBe(0)
  })

  it('reads whose photos a landed press was, and nothing for any other kind', () => {
    expect(landedBidPhotos({ kind: 'bid-photos', result: { bid_id: 'b1', added: 2 } })).toBe('b1')
    expect(landedBidPhotos({ kind: 'job-photos', result: { bid_id: 'b1' } })).toBeNull()
    expect(landedBidPhotos({ kind: 'bid-photos', result: {} })).toBeNull()
    expect(landedBidPhotos(null)).toBeNull()
  })

  it('writes each ready shot with its name trimmed', () => {
    expect(addWrites([tile({ name: '  Mechanical   room north ' }), tile({ id: 't2', status: 'failed' }), tile({ id: 't3' })])).toEqual([
      { id: 't1', name: 'Mechanical room north' },
      { id: 't3', name: '' },
    ])
    expect(bidPhotoNameTrimmed('x'.repeat(300))).toHaveLength(120)
  })

  it('says what was added and what was not', () => {
    expect(addedWords({ added: 3, failed: [] })).toEqual({ text: 'Added 3 photos.', tone: 'success' })
    expect(addedWords({ added: 2, failed: ['The bid is not one you can change.'] })).toEqual({ text: 'Added 2 photos. 1 did not add: The bid is not one you can change.', tone: 'warning' })
    expect(addedWords({ added: 0, failed: ['No signal.', 'No signal.'] })).toEqual({ text: '2 did not add: No signal.', tone: 'warning' })
  })
})

describe('where the photos go, before the press', () => {
  it('says what the press makes, by what the bid has', () => {
    expect(whereWords(folder('ready'), 3)).toEqual({ lead: 'This puts the photos in the bid’s photo folder:', path: 'Quarry Road Storage Bunker › Team only › Photos' })
    expect(whereWords(folder('project'), 1)).toEqual({ lead: 'This makes the bid’s photo folder and puts the photo in it:', path: 'Quarry Road Storage Bunker › Team only › Photos' })
    expect(whereWords(folder('none'), 2)?.lead).toBe('This bid has no project folder yet. This makes one in the company’s shared Drive, with the photo folder inside, and puts the photos in it:')
  })

  it('says nothing when the folder did not read', () => {
    expect(whereWords(null, 2)).toBeNull()
    expect(whereWords(folder('project', ''), 2)).toBeNull()
  })
})

describe('a tile and the grid', () => {
  it('reads each step of a shot', () => {
    expect(tileStatusWords(tile({ status: 'shrinking' })).text).toBe('Making it smaller…')
    expect(tileStatusWords(tile({ status: 'sending' })).tone).toBe('busy')
    expect(tileStatusWords(tile({ status: 'sent' }))).toEqual({ text: 'Ready', tone: 'good' })
    expect(tileStatusWords(tile({ status: 'failed', failWhy: 'The photo is over 2 MB even after the shrink.' }))).toEqual({ text: 'The photo is over 2 MB even after the shrink.', tone: 'warn' })
  })

  it('names a photo, who added it and the day, and whether Drive holds it', () => {
    const row = { name: 'Gas meter', by_name: 'Priya Raman', taken_at: '2026-11-03T18:00:00.000Z', filed_at: '2026-11-03T18:05:00.000Z', fail_why: null }
    expect(gridTileWords(row, '2026-11-10')).toEqual({ name: 'Gas meter', unnamed: false, who: 'Priya Raman · Nov 3', waiting: null })
    expect(gridTileWords({ ...row, name: ' ', filed_at: null }, '2026-11-10')).toEqual({ name: 'Photo', unnamed: true, who: 'Priya Raman · Nov 3', waiting: 'Not in Drive yet' })
  })

  it('reads a picture the app filed by its caption and its sender, not its long file name', () => {
    expect(appFiledNameParts('2026-11-01 Priya Raman · Gas meter (2)')).toEqual({ sender: 'Priya Raman', caption: 'Gas meter (2)' })
    expect(appFiledNameParts('Gas meter')).toBeNull()
    expect(appFiledNameParts('2026-11-01 notes')).toBeNull()
    const filed = { name: '2026-11-01 Priya Raman · Gas meter (2)', by_name: '', taken_at: '2026-11-01T18:00:00.000Z', filed_at: '2026-11-01T18:00:00.000Z', fail_why: null }
    expect(gridTileWords(filed, '2026-11-10')).toEqual({ name: 'Gas meter (2)', unnamed: false, who: 'Priya Raman · Nov 1', waiting: null })
    // A photo a person named keeps their name for it, whatever it looks like.
    expect(gridTileWords({ ...filed, by_name: 'Dana Whitfield' }, '2026-11-10').name).toBe('2026-11-01 Priya Raman · Gas meter (2)')
  })

  it('says in plain words when Drive could not be reached, and passes a real reason through', () => {
    expect(driveSilentWords('Failed to send a request to the Edge Function')).toBe('Drive could not be reached just now. The bid’s photos still show. Its folder does not.')
    expect(driveSilentWords('Drive is not set up here yet.')).toBe('Drive did not answer, so the folder is not shown. Drive is not set up here yet.')
  })

  it('reads a day in the company’s zone', () => {
    expect(photoDayWords('2026-11-10T18:00:00.000Z', '2026-11-10')).toBe('today')
    expect(photoDayWords('2026-11-06T18:00:00.000Z', '2026-11-10')).toBe('Nov 6')
    expect(photoDayWords('2025-12-30T18:00:00.000Z', '2026-11-10')).toBe('Dec 30, 2025')
    // 03:30 UTC on the 7th is still the 6th in the company's zone.
    expect(photoDayWords('2026-11-07T03:30:00.000Z', '2026-11-10')).toBe('Nov 6')
  })

  it('heads the grid with the count and what still waits on Drive', () => {
    expect(gridHeadWords([{ filed_at: 'x' }, { filed_at: 'x' }])).toBe('2 photos')
    expect(gridHeadWords([{ filed_at: 'x' }])).toBe('1 photo')
    expect(gridHeadWords([{ filed_at: 'x' }, { filed_at: null }, { filed_at: null }])).toBe('3 photos · 2 not in Drive yet')
  })

  it('draws the newest first', () => {
    expect(newestFirst([{ id: 'a', taken_at: '2026-11-03T00:00:00Z' }, { id: 'b', taken_at: '2026-11-06T00:00:00Z' }, { id: 'c', taken_at: '2026-11-06T00:00:00Z' }]).map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('names where a shot waits in the bucket', () => {
    expect(bidPhotoStoragePath('bid-1', 'photo-9')).toBe('bid-1/photo-9.jpg')
  })
})
