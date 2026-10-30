import { describe, expect, it } from 'vitest'
import { emptyFolderWords, newestFirst, photoDayWords, photosDoorWords, stripTiles, viewerTitle, waitingWords, type JobPhoto } from './jobPhotos'

const p = (id: string, modified: string | null, name = `${id}.jpg`): JobPhoto => ({ id, name, mime: 'image/jpeg', bytes: 240000, modified, from: 'pictures' })

describe('the strip’s tiles', () => {
  it('shows every photo when four or fewer', () => {
    expect(stripTiles([p('a', '2026-10-24T20:00:00Z'), p('b', '2026-10-22T20:00:00Z')]).map((t) => (t.kind === 'photo' ? t.photo.id : 'more'))).toEqual(['a', 'b'])
  })
  it('shows the three newest and a + N tile past four', () => {
    const photos = [p('old', '2026-10-01T20:00:00Z'), p('a', '2026-10-24T20:00:00Z'), p('b', '2026-10-24T19:00:00Z'), p('c', '2026-10-22T20:00:00Z'), p('d', '2026-10-21T20:00:00Z'), p('e', null)]
    const tiles = stripTiles(photos)
    expect(tiles.map((t) => (t.kind === 'photo' ? t.photo.id : `+${t.count}`))).toEqual(['a', 'b', 'c', '+3'])
  })
  it('orders newest first with the name as the tie-break', () => {
    expect(newestFirst([p('b', '2026-10-24T20:00:00Z', 'slab-rough-east.jpg'), p('a', '2026-10-24T20:00:00Z', 'IMG_4021.jpg')]).map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('the words', () => {
  it('the door, the day, the waiting, the empty folder, the title', () => {
    expect(photosDoorWords(null)).toBe('Photos')
    expect(photosDoorWords(15)).toBe('Photos · 15')
    expect(photoDayWords('2026-10-25T03:30:00Z')).toBe('Oct 24')
    expect(photoDayWords(null)).toBe('')
    expect(waitingWords(0)).toBe('')
    expect(waitingWords(1)).toBe('1 photo on its way to the folder.')
    expect(waitingWords(3)).toBe('3 photos on their way to the folder.')
    expect(emptyFolderWords(0)).toBe('No photos in the folder yet. A photo taken in the app saves there.')
    expect(emptyFolderWords(2)).toBe('2 photos on their way to the folder. Nothing is in the folder yet.')
    expect(viewerTitle(1)).toBe('1 photo')
    expect(viewerTitle(15)).toBe('15 photos')
  })
})
