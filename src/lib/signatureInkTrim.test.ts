import { describe, expect, it } from 'vitest'
import { inkBounds, padInkBox, trimSignatureInk } from './signatureInkTrim'

/** A width×height white RGBA picture with dark pixels at the given points. */
function paper(width: number, height: number, ink: Array<[number, number]>, alpha = 255): Uint8ClampedArray {
  const d = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    d[i * 4] = 255
    d[i * 4 + 1] = 255
    d[i * 4 + 2] = 255
    d[i * 4 + 3] = alpha
  }
  for (const [x, y] of ink) {
    const i = (y * width + x) * 4
    d[i] = 17
    d[i + 1] = 24
    d[i + 2] = 39
    d[i + 3] = 255
  }
  return d
}

describe('inkBounds', () => {
  it('finds the box around the strokes on white paper (a signature drawn in the left half)', () => {
    expect(inkBounds(paper(40, 16, [[3, 5], [12, 9], [18, 4]]), 40, 16)).toEqual({ left: 3, top: 4, right: 18, bottom: 9 })
  })
  it('a blank pad has no ink', () => {
    expect(inkBounds(paper(40, 16, []), 40, 16)).toBeNull()
  })
  it('transparent paper is paper too', () => {
    expect(inkBounds(paper(10, 10, [[7, 2]], 0), 10, 10)).toEqual({ left: 7, top: 2, right: 7, bottom: 2 })
  })
  it('near-white anti-aliasing at the edges does not count as ink', () => {
    const d = paper(10, 10, [[5, 5]])
    const i = (1 * 10 + 1) * 4
    d[i] = 240
    d[i + 1] = 241
    d[i + 2] = 245
    expect(inkBounds(d, 10, 10)).toEqual({ left: 5, top: 5, right: 5, bottom: 5 })
  })
})

describe('padInkBox', () => {
  it('grows the box by the margin and keeps it inside the picture', () => {
    expect(padInkBox({ left: 3, top: 4, right: 18, bottom: 9 }, 40, 16, 5)).toEqual({ left: 0, top: 0, right: 23, bottom: 14 })
  })
})

describe('trimSignatureInk', () => {
  it('without a canvas to work with it hands the picture back unchanged', async () => {
    expect(await trimSignatureInk('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    expect(await trimSignatureInk('not a png')).toBe('not a png')
  })
})
