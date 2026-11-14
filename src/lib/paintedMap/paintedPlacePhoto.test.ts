import { describe, expect, it } from 'vitest'
import { isPaintedPlacePhotoPath, paintedPlacePhotoMap, paintedPlacePhotoPath } from './paintedPlacePhoto'

const MAP = '00000000-0000-4000-8000-00000345c001'

describe('a place photo\'s name in the bucket', () => {
  it('is the map and then the file', () => {
    expect(paintedPlacePhotoPath(MAP, 'abc_123')).toBe(`${MAP}/abc_123.jpg`)
    expect(paintedPlacePhotoMap(`${MAP}/abc_123.jpg`)).toBe(MAP)
    expect(isPaintedPlacePhotoPath(`${MAP}/gate.webp`)).toBe(true)
  })
  it('reads any other shape as no photo', () => {
    expect(isPaintedPlacePhotoPath(null)).toBe(false)
    expect(isPaintedPlacePhotoPath('')).toBe(false)
    expect(isPaintedPlacePhotoPath('not-a-map/gate.jpg')).toBe(false)
    expect(isPaintedPlacePhotoPath(`${MAP}/gate.gif`)).toBe(false)
    expect(isPaintedPlacePhotoPath(`${MAP}/a/b.jpg`)).toBe(false)
    expect(isPaintedPlacePhotoPath(`${MAP}/../secret.jpg`)).toBe(false)
    expect(isPaintedPlacePhotoPath(`item/${MAP}/gate.jpg`)).toBe(false)
  })
})
