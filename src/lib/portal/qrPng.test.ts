import { describe, expect, it } from 'vitest'
import { inflateSync } from 'node:zlib'
// Deno edge module (supabase/functions/_shared) — the pure encoder, tested here.
import { bytesToBase64, qrPngBytes, qrPngSide } from '../../../supabase/functions/_shared/qrPng'
import { qrMatrix } from '../../../supabase/functions/_shared/qrMatrix'

type Png = { width: number; height: number; bitDepth: number; colorType: number; rows: Uint8Array[]; chunkTypes: string[] }

/** A reader that trusts nothing: it checks every chunk's CRC with its own arithmetic and inflates with Node's zlib. */
function readPng(bytes: Uint8Array): Png {
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const crc = (data: Uint8Array) => {
    let c = 0xffffffff
    for (const b of data) {
      c ^= b
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    }
    return (c ^ 0xffffffff) >>> 0
  }
  const chunkTypes: string[] = []
  const idat: Uint8Array[] = []
  let header: DataView | null = null
  for (let at = 8; at < bytes.length; ) {
    const length = view.getUint32(at)
    const typed = bytes.subarray(at + 4, at + 8 + length)
    const type = String.fromCharCode(...typed.subarray(0, 4))
    expect(view.getUint32(at + 8 + length), `${type} crc`).toBe(crc(typed))
    chunkTypes.push(type)
    if (type === 'IHDR') header = new DataView(typed.buffer, typed.byteOffset + 4, length)
    if (type === 'IDAT') idat.push(typed.subarray(4))
    at += 12 + length
  }
  if (!header) throw new Error('no IHDR')
  const width = header.getUint32(0)
  const height = header.getUint32(4)
  const raw = inflateSync(Buffer.concat(idat))
  const rowBytes = Math.ceil(width / 8)
  expect(raw.length).toBe((rowBytes + 1) * height)
  const rows: Uint8Array[] = []
  for (let y = 0; y < height; y++) {
    expect(raw[y * (rowBytes + 1)], 'filter byte').toBe(0)
    rows.push(raw.subarray(y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1)))
  }
  return { width, height, bitDepth: header.getUint8(8), colorType: header.getUint8(9), rows, chunkTypes }
}

const isDark = (png: Png, x: number, y: number) => (((png.rows[y] as Uint8Array)[x >>> 3] as number) & (0x80 >>> (x & 7))) === 0

describe('qrPngBytes (the image the bill email embeds)', () => {
  const tiny = [
    [true, false],
    [false, true],
  ]

  it('is a valid one-bit greyscale PNG of the expected size', () => {
    const png = readPng(qrPngBytes(tiny, { scale: 3, quiet: 1 }))
    expect(png.chunkTypes).toEqual(['IHDR', 'IDAT', 'IEND'])
    expect([png.width, png.height, png.bitDepth, png.colorType]).toEqual([12, 12, 1, 0])
    expect(qrPngSide(2, 3, 1)).toBe(12)
  })

  it('draws each module as a square of pixels inside a white quiet zone', () => {
    const png = readPng(qrPngBytes(tiny, { scale: 3, quiet: 1 }))
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        const mx = Math.floor(x / 3) - 1
        const my = Math.floor(y / 3) - 1
        const expected = mx >= 0 && mx < 2 && my >= 0 && my < 2 && tiny[my]?.[mx] === true
        expect(isDark(png, x, y), `pixel ${x},${y}`).toBe(expected)
      }
    }
  })

  it('carries a real code pixel for pixel, at the default scale and quiet zone', () => {
    const modules = qrMatrix('https://my.clickplumbing.com/hartwell-homes-k7x2') as boolean[][]
    const bytes = qrPngBytes(modules)
    const png = readPng(bytes)
    expect(png.width).toBe((modules.length + 8) * 8)
    for (let my = 0; my < modules.length; my++) {
      for (let mx = 0; mx < modules.length; mx++) {
        expect(isDark(png, (mx + 4) * 8 + 3, (my + 4) * 8 + 3)).toBe(modules[my]?.[mx])
      }
    }
    expect(isDark(png, 0, 0)).toBe(false)
    expect(bytes.length).toBeLessThan(40_000)
  })

  it('splits a large image across stored blocks and still inflates', () => {
    const big = Array.from({ length: 177 }, (_, y) => Array.from({ length: 177 }, (_, x) => (x + y) % 2 === 0))
    const png = readPng(qrPngBytes(big, { scale: 8, quiet: 4 }))
    expect(png.width).toBe(1480)
    expect(isDark(png, 4 * 8, 4 * 8)).toBe(true)
    expect(isDark(png, 5 * 8, 4 * 8)).toBe(false)
  })

  it('base64 round-trips the bytes', () => {
    const bytes = qrPngBytes(tiny, { scale: 40, quiet: 4 })
    expect(Uint8Array.from(atob(bytesToBase64(bytes)), (c) => c.charCodeAt(0))).toEqual(bytes)
  })
})
