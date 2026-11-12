import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_SUPPLIED_FOLDER,
  DRIVE_PIECE_BYTES,
  LOOK_UNSENT_MINUTES,
  driveFolderUrl,
  driveOffsetOf,
  drivePiece,
  lookCountsAsSent,
  lookDriveLine,
  lookFileDriveName,
  lookFileDue,
  lookFolderName,
} from './drive'

const NOW = Date.parse('2026-11-12T18:00:00.000Z')
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()

describe('a First look in Google Drive (punch list #319 PR 2)', () => {
  it('the folder is the owner’s words', () => {
    expect(CUSTOMER_SUPPLIED_FOLDER).toBe('Customer supplied photos')
  })

  it('a look’s folder is its day and place, or the day alone', () => {
    expect(lookFolderName('2026-11-11', 'Kitchen')).toBe('2026-11-11 · Kitchen')
    expect(lookFolderName('2026-11-11', null)).toBe('2026-11-11')
    expect(lookFolderName('2026-11-11', '  ')).toBe('2026-11-11')
    expect(lookFolderName('2026-11-11', 'Back / side\nyard')).toBe('2026-11-11 · Back side yard')
  })

  it('a file is named by its kind and its number, and again when the name is taken', () => {
    expect(lookFileDriveName('photo', 1, 'image/jpeg')).toBe('Photo 1.jpg')
    expect(lookFileDriveName('photo', 3, 'image/heic')).toBe('Photo 3.heic')
    expect(lookFileDriveName('video', 2, 'video/quicktime')).toBe('Video 2.mov')
    expect(lookFileDriveName('video', 1, null)).toBe('Video 1.mp4')
    expect(lookFileDriveName('photo', 1, 'image/jpeg', 2)).toBe('Photo 1 (2).jpg')
  })

  it('a file is due once the look was sent, or half an hour after it finished with no Send', () => {
    expect(LOOK_UNSENT_MINUTES).toBe(30)
    expect(lookFileDue({ finished_at: ago(1) }, { sent_at: ago(0) }, NOW)).toBe(true)
    expect(lookFileDue({ finished_at: ago(29) }, { sent_at: null }, NOW)).toBe(false)
    expect(lookFileDue({ finished_at: ago(30) }, { sent_at: null }, NOW)).toBe(true)
    expect(lookFileDue({ finished_at: null }, { sent_at: ago(0) }, NOW)).toBe(false)
  })

  it('a look with files in and no Send counts as sent when its newest file is half an hour old', () => {
    expect(lookCountsAsSent({ sent_at: null }, [ago(90), ago(31)], NOW)).toBe(true)
    expect(lookCountsAsSent({ sent_at: null }, [ago(90), ago(5)], NOW)).toBe(false)
    expect(lookCountsAsSent({ sent_at: null }, [], NOW)).toBe(false)
    expect(lookCountsAsSent({ sent_at: null }, [null], NOW)).toBe(false)
    expect(lookCountsAsSent({ sent_at: ago(1) }, [ago(90)], NOW)).toBe(false)
  })

  it('a video goes in pieces of 8 MiB, the last one short', () => {
    expect(DRIVE_PIECE_BYTES % (256 * 1024)).toBe(0)
    const total = DRIVE_PIECE_BYTES * 2 + 100
    expect(drivePiece(0, total)).toEqual({ start: 0, end: DRIVE_PIECE_BYTES - 1, contentRange: `bytes 0-${DRIVE_PIECE_BYTES - 1}/${total}` })
    expect(drivePiece(DRIVE_PIECE_BYTES * 2, total)).toEqual({ start: DRIVE_PIECE_BYTES * 2, end: total - 1, contentRange: `bytes ${DRIVE_PIECE_BYTES * 2}-${total - 1}/${total}` })
    expect(drivePiece(total, total)).toBeNull()
    expect(drivePiece(0, 0)).toBeNull()
  })

  it('reads how far Drive has got from its Range header', () => {
    expect(driveOffsetOf('bytes=0-8388607')).toBe(8388608)
    expect(driveOffsetOf(null)).toBe(0)
    expect(driveOffsetOf('')).toBe(0)
  })

  it('the card’s Drive line says where the files are, or why they are not there', () => {
    const url = driveFolderUrl('abc123')
    expect(url).toBe('https://drive.google.com/drive/folders/abc123')
    expect(lookDriveLine({ total: 0, filed: 0, folderUrl: null, hasCustomer: true, failWhy: null })).toBeNull()
    expect(lookDriveLine({ total: 2, filed: 0, folderUrl: null, hasCustomer: false, failWhy: null })).toEqual({ words: 'Files to Drive once this number has a customer.', href: null })
    expect(lookDriveLine({ total: 2, filed: 0, folderUrl: null, hasCustomer: true, failWhy: null })).toEqual({ words: 'Files to Drive within a few minutes of their Send.', href: null })
    expect(lookDriveLine({ total: 3, filed: 1, folderUrl: url, hasCustomer: true, failWhy: null })).toEqual({ words: '1 of 3 in Drive so far.', href: url })
    expect(lookDriveLine({ total: 3, filed: 3, folderUrl: url, hasCustomer: true, failWhy: null })).toEqual({ words: 'Open in Drive', href: url })
    expect(lookDriveLine({ total: 3, filed: 1, folderUrl: url, hasCustomer: true, failWhy: 'The jobs root is not set yet.' })).toEqual({ words: 'Not in Drive yet: The jobs root is not set yet.', href: url })
  })
})
