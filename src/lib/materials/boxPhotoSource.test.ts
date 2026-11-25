import { describe, expect, it } from 'vitest'
import { boxPhotoIsFiled, boxPhotoMissingWords, boxPhotoOpenLabel, boxPhotoReasonWords, boxPhotoSource, phoneCopiesToDrop } from './boxPhotoSource'

describe('where a box photo is read from', () => {
  it('reads a filed shot from the job’s folder even on the phone that still holds it', () => {
    expect(boxPhotoSource({ driveFileId: 'd1', storagePath: 'j/p.jpg', status: 'filed' }, true)).toBe('drive')
  })

  it('reads this phone first while the shot waits: its bytes may be the only copy', () => {
    expect(boxPhotoSource({ driveFileId: null, storagePath: null, status: 'on-phone' }, true)).toBe('phone')
    expect(boxPhotoSource({ driveFileId: null, storagePath: 'j/p.jpg', status: 'sending' }, true)).toBe('phone')
    expect(boxPhotoSource({ driveFileId: null, storagePath: null, status: 'shared' }, true)).toBe('phone')
    // Filed in words with no Drive id is no file to read: the phone's bytes are still drawn.
    expect(boxPhotoSource({ driveFileId: null, storagePath: 'j/p.jpg', status: 'filed' }, true)).toBe('phone')
    // A Drive id on a row that is not filed yet does not take the phone's copy out of the draw.
    expect(boxPhotoSource({ driveFileId: 'd1', storagePath: 'j/p.jpg', status: 'sending' }, true)).toBe('phone')
  })

  it('reads the job’s folder once the sweep has filed it', () => {
    expect(boxPhotoSource({ driveFileId: 'd1', storagePath: 'j/p.jpg', status: 'filed' }, false)).toBe('drive')
  })

  it('reads the bucket only while the row waits for the sweep', () => {
    expect(boxPhotoSource({ driveFileId: null, storagePath: 'j/p.jpg', status: 'sending' }, false)).toBe('bucket')
    // A filed row keeps its path after the bucket's copy is deleted: the bucket is not asked for it.
    expect(boxPhotoSource({ driveFileId: null, storagePath: 'j/p.jpg', status: 'filed' }, false)).toBe('none')
  })

  it('has nowhere to read a shot that never left another phone', () => {
    expect(boxPhotoSource({ driveFileId: null, storagePath: null, status: 'on-phone' }, false)).toBe('none')
  })
})

describe('which of this phone’s copies may go', () => {
  const rows = [
    { id: 'filed-1', status: 'filed' as const, driveFileId: 'd1' },
    { id: 'filed-2', status: 'filed' as const, driveFileId: 'd2' },
    { id: 'filed-no-drive', status: 'filed' as const, driveFileId: null },
    { id: 'kept', status: 'on-phone' as const, driveFileId: null },
    { id: 'going', status: 'sending' as const, driveFileId: null },
    { id: 'going-with-id', status: 'sending' as const, driveFileId: 'd9' },
    { id: 'handed', status: 'shared' as const, driveFileId: null },
  ]

  it('says a shot is filed only with the status and a Drive id together', () => {
    expect(rows.filter(boxPhotoIsFiled).map((r) => r.id)).toEqual(['filed-1', 'filed-2'])
  })

  it('drops only an id matched to a filed row with a Drive id', () => {
    expect(phoneCopiesToDrop(['filed-1', 'filed-no-drive', 'kept', 'going', 'going-with-id', 'handed'], rows)).toEqual(['filed-1'])
  })

  it('leaves an id no row names alone', () => {
    expect(phoneCopiesToDrop(['another-job', 'filed-2', 'nobody'], rows)).toEqual(['filed-2'])
    expect(phoneCopiesToDrop(['another-job'], rows)).toEqual([])
  })

  it('has nothing to drop on a phone that holds nothing, or with no rows read', () => {
    expect(phoneCopiesToDrop([], rows)).toEqual([])
    expect(phoneCopiesToDrop(['filed-1'], [])).toEqual([])
  })
})

describe('the words on an empty square and on the press', () => {
  it('names why there is no picture', () => {
    expect(boxPhotoMissingWords({ status: 'on-phone', driveFileId: null })).toBe('The picture is still on the phone that took it.')
    expect(boxPhotoMissingWords({ status: 'shared', driveFileId: null })).toBe('The picture was shared from a phone. The app has no copy.')
    expect(boxPhotoMissingWords({ status: 'filed', driveFileId: 'd1' })).toBe('The picture did not open from the job’s folder.')
    expect(boxPhotoMissingWords({ status: 'sending', driveFileId: null })).toBe('The picture is not here yet.')
  })

  it('names the photo the press opens', () => {
    expect(boxPhotoOpenLabel({ words: 'A1 after Count', fileName: '2026-10-28 Jordan · A1 after Count.jpg' })).toBe('Open the photo of A1 after Count')
    expect(boxPhotoOpenLabel({ words: '', fileName: 'x.jpg' })).toBe('Open the photo of x.jpg')
  })
})

describe('the reason under a photo (punch list #398)', () => {
  const trashed = 'The file is in the folder’s trash.'

  it('a filed photo whose picture did not come says why, in the sweep’s own words when it left some', () => {
    expect(boxPhotoReasonWords({ status: 'filed', driveFileId: 'd1', failWhy: trashed }, true)).toBe(trashed)
    expect(boxPhotoReasonWords({ status: 'filed', driveFileId: 'd1', failWhy: null }, true)).toBe('The picture did not open from the job’s folder.')
    expect(boxPhotoReasonWords({ status: 'filed', driveFileId: 'd1', failWhy: '  ' }, true)).toBe('The picture did not open from the job’s folder.')
  })

  it('a filed photo whose picture draws has no line, whatever an old reason says', () => {
    expect(boxPhotoReasonWords({ status: 'filed', driveFileId: 'd1', failWhy: trashed }, false)).toBeNull()
    expect(boxPhotoReasonWords({ status: 'filed', driveFileId: 'd1', failWhy: null }, false)).toBeNull()
  })

  it('a shot that still waits says its reason with or without its picture, as before', () => {
    expect(boxPhotoReasonWords({ status: 'sending', driveFileId: null, failWhy: 'The folder refused it.' }, false)).toBe('The folder refused it.')
    expect(boxPhotoReasonWords({ status: 'on-phone', driveFileId: null, failWhy: null }, false)).toBeNull()
    expect(boxPhotoReasonWords({ status: 'on-phone', driveFileId: null, failWhy: null }, true)).toBe('The picture is still on the phone that took it.')
  })
})
