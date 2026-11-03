import { describe, expect, it } from 'vitest'
import { exifBlock, exifDateTimeOriginal, readTakenAt, takenAtFromBytes, takenAtFromExif } from './photoTakenAt'

/**
 * A JPEG head with an Exif block as a camera writes it: SOI, an optional JFIF APP0 first, APP1 `Exif\0\0`, a TIFF
 * header in either byte order, IFD0 with the pointer to the Exif IFD, and there DateTimeOriginal, an optional
 * OffsetTimeOriginal and an optional DateTimeDigitized; then the start of scan so the parser knows to stop.
 */
function jpeg(opts: { le?: boolean; original?: string | null; digitized?: string | null; offset?: string | null; jfifFirst?: boolean; noExif?: boolean }): Uint8Array {
  const le = opts.le ?? false
  const strings: Array<{ tag: number; text: string }> = []
  if (opts.original) strings.push({ tag: 0x9003, text: `${opts.original}\0` })
  if (opts.digitized) strings.push({ tag: 0x9004, text: `${opts.digitized}\0` })
  if (opts.offset) strings.push({ tag: 0x9011, text: `${opts.offset}\0` })
  // TIFF layout: header 8 · IFD0 (2 + 12 + 4) · Exif IFD (2 + 12n + 4) · the strings.
  const ifd0At = 8
  const exifAt = ifd0At + 2 + 12 + 4
  const dataAt = exifAt + 2 + 12 * strings.length + 4
  const tiffLen = dataAt + strings.reduce((n, s) => n + s.text.length, 0)
  const tiff = new Uint8Array(tiffLen)
  const v = new DataView(tiff.buffer)
  const w16 = (at: number, n: number) => v.setUint16(at, n, le)
  const w32 = (at: number, n: number) => v.setUint32(at, n, le)
  tiff[0] = tiff[1] = le ? 0x49 : 0x4d
  w16(2, 42)
  w32(4, ifd0At)
  w16(ifd0At, 1)
  w16(ifd0At + 2, 0x8769)
  w16(ifd0At + 4, 4)
  w32(ifd0At + 6, 1)
  w32(ifd0At + 10, exifAt)
  w32(ifd0At + 14, 0)
  w16(exifAt, strings.length)
  let cursor = dataAt
  strings.forEach((s, k) => {
    const e = exifAt + 2 + k * 12
    w16(e, s.tag)
    w16(e + 2, 2)
    w32(e + 4, s.text.length)
    w32(e + 8, cursor)
    for (let i = 0; i < s.text.length; i += 1) tiff[cursor + i] = s.text.charCodeAt(i)
    cursor += s.text.length
  })
  const parts: number[] = [0xff, 0xd8]
  if (opts.jfifFirst) parts.push(0xff, 0xe0, 0x00, 0x10, ...'JFIF\0'.split('').map((c) => c.charCodeAt(0)), 1, 1, 0, 0, 1, 0, 1, 0, 0)
  if (!opts.noExif) {
    const len = 2 + 6 + tiff.length
    parts.push(0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...'Exif\0\0'.split('').map((c) => c.charCodeAt(0)), ...tiff)
  }
  parts.push(0xff, 0xda, 0x00, 0x02, 0x11, 0x22)
  return new Uint8Array(parts)
}

const UPLOAD = Date.parse('2026-11-02T15:00:00Z') // 9:00 AM Chicago, the morning after

describe('exifDateTimeOriginal — the camera’s moment from the file’s head', () => {
  it('reads DateTimeOriginal and the zone in both byte orders, past a JFIF segment', () => {
    expect(exifDateTimeOriginal(jpeg({ original: '2026:11:01 16:42:10', offset: '-05:00' }))).toEqual({ wall: '2026:11:01 16:42:10', offset: '-05:00' })
    expect(exifDateTimeOriginal(jpeg({ le: true, original: '2026:11:01 16:42:10', jfifFirst: true }))).toEqual({ wall: '2026:11:01 16:42:10', offset: null })
  })
  it('falls back to DateTimeDigitized, and gives null with no date, no Exif, or no JPEG', () => {
    expect(exifDateTimeOriginal(jpeg({ digitized: '2026:11:01 16:42:10' }))).toEqual({ wall: '2026:11:01 16:42:10', offset: null })
    expect(exifDateTimeOriginal(jpeg({}))).toBeNull()
    expect(exifDateTimeOriginal(jpeg({ noExif: true }))).toBeNull()
    expect(exifDateTimeOriginal(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
    expect(exifDateTimeOriginal(new Uint8Array(0))).toBeNull()
    expect(exifBlock(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull()
  })
  it('a torn file never throws', () => {
    const whole = jpeg({ original: '2026:11:01 16:42:10', offset: '-05:00' })
    for (let cut = 0; cut < whole.length; cut += 7) expect(() => exifDateTimeOriginal(whole.subarray(0, cut))).not.toThrow()
  })
})

describe('takenAtFromExif — the instant, sane against the upload', () => {
  it('the camera’s zone when it wrote one', () => {
    expect(takenAtFromExif({ wall: '2026:11:01 16:42:10', offset: '-05:00' }, UPLOAD)).toBe('2026-11-01T21:42:10.000Z')
    expect(takenAtFromExif({ wall: '2026:11:01 16:42:10', offset: '+01:00' }, UPLOAD)).toBe('2026-11-01T15:42:10.000Z')
  })
  it('no zone means the company’s calendar, across the fall change', () => {
    // Oct 31 2026 is still daylight time in Chicago (UTC-5); Nov 1 is standard (UTC-6).
    expect(takenAtFromExif({ wall: '2026:10:31 14:00:00', offset: null }, UPLOAD)).toBe('2026-10-31T19:00:00.000Z')
    expect(takenAtFromExif({ wall: '2026:11:01 14:00:00', offset: null }, UPLOAD)).toBe('2026-11-01T20:00:00.000Z')
  })
  it('ahead of the upload past five minutes, more than a year behind, or a dead clock: null', () => {
    expect(takenAtFromExif({ wall: '2026:11:02 09:04:00', offset: null }, UPLOAD)).toBe('2026-11-02T15:04:00.000Z')
    expect(takenAtFromExif({ wall: '2026:11:02 09:06:00', offset: null }, UPLOAD)).toBeNull()
    expect(takenAtFromExif({ wall: '2025:10:01 09:00:00', offset: null }, UPLOAD)).toBeNull()
    expect(takenAtFromExif({ wall: '2000:01:01 00:00:00', offset: null }, UPLOAD)).toBeNull()
    expect(takenAtFromExif({ wall: '0000:00:00 00:00:00', offset: null }, UPLOAD)).toBeNull()
    expect(takenAtFromExif({ wall: 'not a date', offset: null }, UPLOAD)).toBeNull()
  })
})

describe('takenAtFromBytes and readTakenAt — the file’s own time, else the upload’s', () => {
  it('a kept-overnight shot sits on the day it was shot; a file with no date sits on the upload', () => {
    expect(takenAtFromBytes(jpeg({ original: '2026:11:01 16:42:10', offset: '-05:00' }), UPLOAD)).toEqual({ iso: '2026-11-01T21:42:10.000Z', fromFile: true })
    expect(takenAtFromBytes(jpeg({}), UPLOAD)).toEqual({ iso: '2026-11-02T15:00:00.000Z', fromFile: false })
    expect(takenAtFromBytes(jpeg({ original: '2019:05:05 10:00:00' }), UPLOAD)).toEqual({ iso: '2026-11-02T15:00:00.000Z', fromFile: false })
  })
  it('reads the head of a Blob and never throws', async () => {
    const good = new Blob([jpeg({ original: '2026:11:01 16:42:10', offset: '-05:00' })], { type: 'image/jpeg' })
    expect(await readTakenAt(good, UPLOAD)).toBe('2026-11-01T21:42:10.000Z')
    const broken = { slice: () => ({ arrayBuffer: () => Promise.reject(new Error('gone')) }) } as unknown as Blob
    expect(await readTakenAt(broken, UPLOAD)).toBe('2026-11-02T15:00:00.000Z')
  })
})
