import { describe, expect, it } from 'vitest'
import {
  BID_PHOTO_FOLDER_WORDS,
  BID_PHOTO_RETRY_MS,
  bidFolderHoldWords,
  bidPhotoDueATry,
  bidPhotoFailWords,
  bidPhotoPathWords,
  bidPhotosAskWrites,
  driveSafeName,
  fileStem,
  isQuotaRefusal,
  namedPhotoFileName,
  parseBidPhotosAsk,
  photoExt,
  strayPhotoRows,
  type ListedBidPhoto,
} from './bidPhotos'

const BID = '00000000-0000-0000-0000-00000306b001'
const FILE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'

describe('parseBidPhotosAsk', () => {
  it('reads the four asks', () => {
    expect(parseBidPhotosAsk({ action: 'list', bid_id: BID })).toEqual({ action: 'list', bidId: BID })
    expect(parseBidPhotosAsk({ action: 'make', bid_id: BID })).toEqual({ action: 'make', bidId: BID })
    expect(parseBidPhotosAsk({ action: 'thumb', bid_id: BID, file_id: FILE })).toEqual({ action: 'thumb', bidId: BID, fileId: FILE })
    expect(parseBidPhotosAsk({ action: 'full', bid_id: BID, file_id: FILE })).toEqual({ action: 'full', bidId: BID, fileId: FILE })
  })

  it('lowers the bid id, so one bid is one key', () => {
    expect(parseBidPhotosAsk({ action: 'list', bid_id: BID.toUpperCase() })).toEqual({ action: 'list', bidId: BID })
  })

  it('refuses what it does not know', () => {
    expect(parseBidPhotosAsk(null)).toBeNull()
    expect(parseBidPhotosAsk('list')).toBeNull()
    expect(parseBidPhotosAsk({ action: 'list' })).toBeNull()
    expect(parseBidPhotosAsk({ action: 'list', bid_id: 'b598' })).toBeNull()
    expect(parseBidPhotosAsk({ action: 'remove', bid_id: BID })).toBeNull()
    expect(parseBidPhotosAsk({ action: 'thumb', bid_id: BID })).toBeNull()
    expect(parseBidPhotosAsk({ action: 'full', bid_id: BID, file_id: '../etc' })).toBeNull()
  })

  it('names make as the one ask that writes', () => {
    expect(bidPhotosAskWrites({ action: 'make', bidId: BID })).toBe(true)
    expect(bidPhotosAskWrites({ action: 'list', bidId: BID })).toBe(false)
    expect(bidPhotosAskWrites({ action: 'thumb', bidId: BID, fileId: FILE })).toBe(false)
  })
})

describe('a filed photo’s name', () => {
  it('is the person’s name for it with the picture’s ending', () => {
    expect(namedPhotoFileName('Mechanical room north', 'image/jpeg')).toBe('Mechanical room north.jpg')
    expect(namedPhotoFileName('Riser at grid C4', 'image/png')).toBe('Riser at grid C4.png')
    expect(namedPhotoFileName('Gas meter', null)).toBe('Gas meter.jpg')
  })

  it('does not double an ending the name already carries', () => {
    expect(namedPhotoFileName('IMG_2041.JPG', 'image/jpeg')).toBe('IMG_2041.jpg')
  })

  it('takes the next free number when the folder holds the name, in any case', () => {
    const taken = new Set(['gas meter.jpg', 'Gas meter (2).jpg'])
    expect(namedPhotoFileName('Gas meter', 'image/jpeg', taken)).toBe('Gas meter (3).jpg')
  })

  it('is null for a photo nobody named, so the sweep names it by day and sender', () => {
    expect(namedPhotoFileName('', 'image/jpeg')).toBeNull()
    expect(namedPhotoFileName('  .  ', 'image/jpeg')).toBeNull()
  })

  it('keeps a name Drive can take', () => {
    expect(driveSafeName('  East wall / rough\\in \n day 2 ')).toBe('East wall rough in day 2')
    expect(driveSafeName('.hidden.')).toBe('hidden')
    expect(driveSafeName('x'.repeat(400))).toHaveLength(150)
  })

  it('reads a stem and an ending', () => {
    expect(fileStem('Riser at C4.jpg')).toBe('Riser at C4')
    expect(fileStem('Addendum 1.2 notes')).toBe('Addendum 1.2 notes')
    expect(fileStem('no-ending')).toBe('no-ending')
    expect(photoExt('image/webp')).toBe('webp')
    expect(photoExt('image/heic')).toBe('heic')
    expect(photoExt('image/gif')).toBe('gif')
    expect(photoExt('application/octet-stream')).toBe('jpg')
  })
})

describe('strayPhotoRows', () => {
  const NOW = '2026-11-10T20:00:00.000Z'
  const listed: ListedBidPhoto[] = [
    { id: 'drive-a', name: 'Back door.JPG', mime: 'image/jpeg', bytes: 412_000, created: '2026-11-06T15:04:05Z', by: 'Dana Whitfield' },
    { id: 'drive-b', name: '2026-11-03 Priya · Gas meter.jpg', mime: 'image/jpeg', bytes: null, created: null, by: null },
    { id: 'drive-c', name: 'Known.jpg', mime: 'image/jpeg', bytes: 10, created: '2026-11-01T00:00:00Z', by: 'Owen' },
  ]

  it('adopts each picture the bid has no row for, as added and filed when Drive first held it', () => {
    const rows = strayPhotoRows(BID, listed, new Set(['drive-c']), NOW)
    expect(rows).toEqual([
      { bid_id: BID, name: 'Back door', by_name: 'Dana Whitfield', taken_at: '2026-11-06T15:04:05.000Z', added_at: '2026-11-06T15:04:05.000Z', filed_at: '2026-11-06T15:04:05.000Z', bytes: 412_000, drive_file_id: 'drive-a' },
      { bid_id: BID, name: '2026-11-03 Priya · Gas meter', by_name: '', taken_at: NOW, added_at: NOW, filed_at: NOW, bytes: 0, drive_file_id: 'drive-b' },
    ])
  })

  it('adopts nothing when every picture has a row, and one row for a file listed twice', () => {
    expect(strayPhotoRows(BID, listed, new Set(['drive-a', 'drive-b', 'drive-c']), NOW)).toEqual([])
    expect(strayPhotoRows(BID, [listed[0]!, listed[0]!], new Set(), NOW)).toHaveLength(1)
  })

  it('keeps the sizes inside the column', () => {
    const [row] = strayPhotoRows(BID, [{ id: 'drive-d', name: 'Huge.png', mime: 'image/png', bytes: 9_000_000_000, created: null, by: null }], new Set(), NOW)
    expect(row!.bytes).toBe(2147483647)
  })
})

describe('the words for a folder the app cannot file into', () => {
  const APP = 'app@pipetooling.test'

  it('says nothing when the app can file there', () => {
    expect(bidFolderHoldWords('ok', APP, null, false)).toBeNull()
  })

  it('holds a folder in a personal Drive, unless the app may file as a person', () => {
    expect(bidFolderHoldWords('outside_drive', APP, 'Marisol Vega', false)).toBe(
      'This bid’s project folder is in Marisol Vega’s My Drive, where the app can make folders but cannot save a file. Move the folder into the company’s shared Drive. The photos are safe in the app and file themselves once it is fixed.',
    )
    expect(bidFolderHoldWords('outside_drive', APP, null, false)).toContain('a personal Drive')
    expect(bidFolderHoldWords('outside_drive', APP, 'Marisol Vega', true)).toBeNull()
  })

  it('names the app’s address when a share would fix it', () => {
    expect(bidFolderHoldWords('cannot_open', APP, null, true)).toContain(`Share it with ${APP} as an editor.`)
    expect(bidFolderHoldWords('cannot_write', APP, null, true)).toContain(`Share it with ${APP} as an editor.`)
  })

  it('sends a link that is not a folder back to the bid', () => {
    expect(bidFolderHoldWords('not_a_folder', APP, null, true)).toContain('Fix it on the bid, under Files & links.')
  })

  it('ends every reason by saying the photos are safe', () => {
    for (const seen of ['outside_drive', 'cannot_open', 'cannot_write', 'not_a_folder'] as const) {
      expect(bidFolderHoldWords(seen, APP, null, false)).toMatch(/The photos are safe in the app and file themselves once it is fixed\.$/)
    }
  })

  it('reads Drive’s quota refusal as a personal Drive, and passes any other reason through, cut to the column', () => {
    expect(isQuotaRefusal('Upload failed (403): Service Accounts do not have storage quota.')).toBe(true)
    expect(bidPhotoFailWords('Upload failed (403): Service Accounts do not have storage quota.')).toContain('a personal Drive')
    expect(bidPhotoFailWords('Upload failed (500): backend error')).toBe('Upload failed (500): backend error')
    expect(bidPhotoFailWords('x'.repeat(900))).toHaveLength(300)
  })
})

describe('when a held photo is tried again', () => {
  const NOW = Date.parse('2026-11-10T20:00:00Z')

  it('tries a photo never tried, and one tried an hour or more ago', () => {
    expect(bidPhotoDueATry(null, NOW)).toBe(true)
    expect(bidPhotoDueATry(new Date(NOW - BID_PHOTO_RETRY_MS).toISOString(), NOW)).toBe(true)
    expect(bidPhotoDueATry('not a date', NOW)).toBe(true)
  })

  it('leaves one tried inside the hour alone', () => {
    expect(bidPhotoDueATry(new Date(NOW - BID_PHOTO_RETRY_MS + 1000).toISOString(), NOW)).toBe(false)
  })
})

describe('where a bid’s photos go, in words', () => {
  it('names the project folder, then Team only, then Photos', () => {
    expect(BID_PHOTO_FOLDER_WORDS).toBe('Team only › Photos')
    expect(bidPhotoPathWords('Quarry Road Storage Bunker')).toBe('Quarry Road Storage Bunker › Team only › Photos')
  })
})
