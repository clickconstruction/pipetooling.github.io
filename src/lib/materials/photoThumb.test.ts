/**
 * The small copy a thumbnail draws from a shot the phone holds (`thumbOfPhoto`): sized for its square, the decoded shot
 * let go at once, one made at a time, and nothing handed back when the browser cannot decode. The browser's decoder
 * and canvas are stood in for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { thumbOfPhoto } from './photoShrink'

type Bitmap = { width: number; height: number; close: ReturnType<typeof vi.fn> }

let canvases: Array<{ width: number; height: number; drawn: unknown[] }>
let bitmaps: Bitmap[]
/** How many shots are decoded and not yet closed, and the most there ever were at once. */
let open: number
let mostOpen: number

beforeEach(() => {
  canvases = []
  bitmaps = []
  open = 0
  mostOpen = 0
  vi.stubGlobal('createImageBitmap', vi.fn(async () => {
    // A decode takes a turn, so two asked for together would overlap if nothing held the second back.
    await new Promise((r) => setTimeout(r, 0))
    open++
    mostOpen = Math.max(mostOpen, open)
    const b: Bitmap = { width: 1200, height: 1600, close: vi.fn(() => { open-- }) }
    bitmaps.push(b)
    return b
  }))
  vi.stubGlobal('document', {
    createElement: () => {
      const c = {
        width: 0,
        height: 0,
        drawn: [] as unknown[],
        getContext: () => ({ drawImage: (...a: unknown[]) => { c.drawn = a } }),
        toBlob: (cb: (b: Blob | null) => void, type: string) => { setTimeout(() => cb(new Blob([`${c.width}x${c.height}`], { type })), 0) },
      }
      canvases.push(c)
      return c
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('thumbOfPhoto', () => {
  it('draws the shot at twice the square, as a JPEG, and lets the decoded shot go', async () => {
    const small = await thumbOfPhoto(new Blob(['a whole shot'], { type: 'image/jpeg' }), 44)
    expect(small?.type).toBe('image/jpeg')
    expect(canvases).toHaveLength(1)
    expect({ width: canvases[0]!.width, height: canvases[0]!.height }).toEqual({ width: 88, height: 117 })
    expect(canvases[0]!.drawn.slice(1)).toEqual([0, 0, 88, 117])
    expect(bitmaps[0]!.close).toHaveBeenCalledTimes(1)
  })

  it('makes one at a time, however many squares ask together', async () => {
    const shot = new Blob(['a whole shot'], { type: 'image/jpeg' })
    const all = await Promise.all(Array.from({ length: 12 }, () => thumbOfPhoto(shot, 44)))
    expect(all.every((b) => b != null)).toBe(true)
    expect(bitmaps).toHaveLength(12)
    expect(mostOpen).toBe(1)
    expect(open).toBe(0)
  })

  it('hands back nothing when the browser cannot decode the shot, and the next one is still made', async () => {
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('no')).mockRejectedValueOnce(new Error('no'))
    expect(await thumbOfPhoto(new Blob(['not a picture']), 44)).toBeNull()
    expect(canvases).toHaveLength(0)
    expect(await thumbOfPhoto(new Blob(['a whole shot']), 44)).not.toBeNull()
  })

  it('hands back nothing when the canvas cannot draw, and still lets the decoded shot go', async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) })
    expect(await thumbOfPhoto(new Blob(['a whole shot']), 44)).toBeNull()
    expect(bitmaps[0]!.close).toHaveBeenCalledTimes(1)
  })
})
