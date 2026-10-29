import { describe, expect, it } from 'vitest'
import { bytesWords, fitWithin, nextPassEdge, PHOTO_HEAVY_BYTES, PHOTO_MAX_EDGE, PHOTO_SECOND_PASS_EDGE } from './photoShrink'

describe('fitWithin', () => {
  it('brings a phone shot down to the long edge and keeps its shape', () => {
    expect(fitWithin(4032, 3024, PHOTO_MAX_EDGE)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3024, 4032, PHOTO_MAX_EDGE)).toEqual({ width: 1200, height: 1600 })
  })

  it('never scales a small picture up', () => {
    expect(fitWithin(800, 600, PHOTO_MAX_EDGE)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(0, 0, PHOTO_MAX_EDGE)).toEqual({ width: 0, height: 0 })
  })
})

describe('the second pass', () => {
  it('runs only on a shot still over the heavy mark after the first', () => {
    expect(nextPassEdge(PHOTO_HEAVY_BYTES + 1, PHOTO_MAX_EDGE)).toBe(PHOTO_SECOND_PASS_EDGE)
    expect(nextPassEdge(PHOTO_HEAVY_BYTES, PHOTO_MAX_EDGE)).toBeNull()
    // and never a third
    expect(nextPassEdge(PHOTO_HEAVY_BYTES + 1, PHOTO_SECOND_PASS_EDGE)).toBeNull()
  })
})

describe('bytesWords', () => {
  it('reads kilobytes under a megabyte and one decimal above', () => {
    expect(bytesWords(312_400)).toBe('312 KB')
    expect(bytesWords(2_400_000)).toBe('2.4 MB')
    expect(bytesWords(70)).toBe('1 KB')
  })
})
