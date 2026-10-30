import { describe, expect, it } from 'vitest'
import {
  REPORT_PHOTO_MAX_BYTES,
  REPORT_PHOTO_SIZES,
  REPORT_PHOTO_SIZE_DEFAULT,
  canShrinkInWorker,
  edgeFor,
  photoSizeFromSetting,
  shrinkPlan,
  shrinkReportPhoto,
  shrinkWords,
  withinCap,
} from './shrink'

describe('shrink: the sizes', () => {
  it('reads the office’s setting, Medium for anything else', () => {
    expect(photoSizeFromSetting('small')).toBe('small')
    expect(photoSizeFromSetting(' Large ')).toBe('large')
    expect(photoSizeFromSetting('medium')).toBe('medium')
    expect(photoSizeFromSetting('')).toBe(REPORT_PHOTO_SIZE_DEFAULT)
    expect(photoSizeFromSetting(null)).toBe('medium')
    expect(photoSizeFromSetting('huge')).toBe('medium')
    expect(edgeFor('small')).toBe(1200)
    expect(edgeFor('medium')).toBe(1600)
    expect(edgeFor('large')).toBe(2400)
    expect(REPORT_PHOTO_SIZES.medium.about).toBe('about 300 KB')
  })

  it('plans a 12 MP landscape shot at Medium as 1600 × 1200, and a portrait one as 1200 × 1600', () => {
    expect(shrinkPlan(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 })
    // The orientation is kept: a sideways shot decoded upright stays upright, taller than wide.
    expect(shrinkPlan(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(shrinkPlan(4032, 3024, 1200)).toEqual({ width: 1200, height: 900 })
    expect(shrinkPlan(4032, 3024, 2400)).toEqual({ width: 2400, height: 1800 })
  })

  it('never scales a small shot up, and keeps a square square', () => {
    expect(shrinkPlan(800, 600, 1600)).toEqual({ width: 800, height: 600 })
    expect(shrinkPlan(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 })
    expect(shrinkPlan(3000, 3000, 1600)).toEqual({ width: 1600, height: 1600 })
  })

  it('holds the bucket’s cap: 2 MB', () => {
    expect(REPORT_PHOTO_MAX_BYTES).toBe(2 * 1024 * 1024)
    expect(withinCap(310_000)).toBe(true)
    expect(withinCap(REPORT_PHOTO_MAX_BYTES)).toBe(true)
    expect(withinCap(REPORT_PHOTO_MAX_BYTES + 1)).toBe(false)
  })

  it('says what the shrink did on the tile', () => {
    expect(shrinkWords({ before: 4_200_000, after: 310_000, longEdge: 1600, shrunk: true })).toBe('4.2 MB → 310 KB · 1600 px')
    expect(shrinkWords({ before: 900_000, after: 900_000, longEdge: 1600, shrunk: false })).toBe('900 KB')
  })
})

describe('shrink: without a browser', () => {
  it('has no worker here, and a shot it cannot decode goes as it came', async () => {
    expect(canShrinkInWorker()).toBe(false)
    const file = new File([new Uint8Array([1, 2, 3])], 'IMG_0001.jpg', { type: 'image/jpeg' })
    const out = await shrinkReportPhoto(file, 'medium')
    expect(out.shrunk).toBe(false)
    expect(out.blob).toBe(file)
  })
})
