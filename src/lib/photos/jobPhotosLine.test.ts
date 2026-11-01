import { describe, expect, it } from 'vitest'
import type { JobPhoto } from './jobPhotos'
import { photosLineOpens, photosLineWords } from './jobPhotosLine'

const photo = (id: string, modified: string | null): JobPhoto => ({ id, name: `${id}.jpg`, mime: 'image/jpeg', bytes: 1, modified, from: 'pictures' })

describe('the Documents tab’s Photos line', () => {
  it('counts what is in Drive and on its way, and names the newest day', () => {
    expect(photosLineWords({ photos: [photo('a', '2026-10-24T20:00:00Z'), photo('b', '2026-11-01T20:00:00Z')], waiting: 1 })).toBe('2 in Drive · 1 on its way · the newest Nov 1')
    expect(photosLineWords({ photos: [photo('a', '2026-10-24T20:00:00Z')], waiting: 0 })).toBe('1 in Drive · the newest Oct 24')
    expect(photosLineWords({ photos: [photo('a', null)], waiting: 2 })).toBe('1 in Drive · 2 on its way')
  })

  it('says what fills an empty folder, counting what is on its way', () => {
    expect(photosLineWords({ photos: [], waiting: 0 })).toBe('No photos in the folder yet. A photo taken in the app saves there.')
    expect(photosLineWords({ photos: [], waiting: 3 })).toBe('3 on its way')
  })

  it('is a door only with something to open', () => {
    expect(photosLineOpens({ photos: [photo('a', null)] })).toBe(true)
    expect(photosLineOpens({ photos: [] })).toBe(false)
  })
})
