import { describe, expect, it } from 'vitest'
import { boxPhotoMissingWords, boxPhotoOpenLabel, boxPhotoSource } from './boxPhotoSource'

describe('where a box photo is read from', () => {
  it('reads this phone first, whatever the row says', () => {
    expect(boxPhotoSource({ driveFileId: 'd1', storagePath: 'j/p.jpg', status: 'filed' }, true)).toBe('phone')
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
