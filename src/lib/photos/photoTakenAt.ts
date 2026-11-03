/**
 * The time a photo was taken, read from the file itself (punch list #247, PR 3). The app stamped `taken_at` when it
 * received the shot, so a photo a phone kept overnight and sent on the office Wi-Fi sat on the wrong day in a
 * site's History and in Drive's name. A camera writes the moment it fired into the JPEG's Exif block
 * (`DateTimeOriginal`, and on a newer phone `OffsetTimeOriginal`, the zone it was in). This reads that moment from
 * the first bytes of the file before the shrink drops the block, and keeps it as the photo's time when it is sane:
 * not ahead of the upload, not more than a year behind it. Anything else, and a file with no date at all, keeps the
 * upload's time as before. A time with no zone means the company's calendar, as an email's "4:02 PM" does.
 *
 * Pure: the bytes come in, the instant comes out. `readTakenAt` is the one browser io, reading the file's head.
 */
import { appTzWallTimeMs } from '../../utils/dateUtils'

/** How much of the file is read: Exif sits in the first segments, under 64 KB, but a maker's APP segments may come first. */
export const EXIF_HEAD_BYTES = 256 * 1024

/** A file date may run this far ahead of the upload (a phone's clock a little fast) and still count. */
export const TAKEN_AHEAD_MS = 5 * 60_000
/** A file date older than this against the upload is a camera with a dead clock, not a photo kept a while. */
export const TAKEN_BEHIND_MS = 366 * 86_400_000

export type ExifTaken = {
  /** `YYYY:MM:DD HH:MM:SS`, the camera's wall clock. */
  wall: string
  /** `+05:00` when the camera wrote the zone it was in; null otherwise. */
  offset: string | null
}

const TAG_EXIF_IFD = 0x8769
const TAG_DATE_TIME_ORIGINAL = 0x9003
const TAG_DATE_TIME_DIGITIZED = 0x9004
const TAG_OFFSET_TIME_ORIGINAL = 0x9011

function ascii(u8: Uint8Array, at: number, n: number): string {
  let s = ''
  for (let i = at; i < at + n && i < u8.length; i += 1) s += String.fromCharCode(u8[i]!)
  return s
}

/** The bytes after `Exif\0\0` in the JPEG's APP1 segment, or null for a file that is not a JPEG or carries none. */
export function exifBlock(u8: Uint8Array): Uint8Array | null {
  if (u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) return null
  let i = 2
  while (i + 4 <= u8.length) {
    if (u8[i] !== 0xff) return null
    const marker = u8[i + 1]!
    // A fill byte or a standalone marker has no length.
    if (marker === 0xff) {
      i += 1
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    // The image data or the end: no Exif came before it.
    if (marker === 0xda || marker === 0xd9) return null
    const len = (u8[i + 2]! << 8) | u8[i + 3]!
    if (len < 2) return null
    if (marker === 0xe1 && len >= 8 && ascii(u8, i + 4, 6) === 'Exif\0\0') return u8.subarray(i + 10, Math.min(u8.length, i + 2 + len))
    i += 2 + len
  }
  return null
}

/** `DateTimeOriginal` (else `DateTimeDigitized`) and `OffsetTimeOriginal` from a file's head, or null when it has none. */
export function exifDateTimeOriginal(bytes: ArrayBuffer | Uint8Array): ExifTaken | null {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const tiff = exifBlock(u8)
  if (!tiff || tiff.length < 8) return null
  const order = ascii(tiff, 0, 2)
  const le = order === 'II'
  if (!le && order !== 'MM') return null
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  const r16 = (at: number) => (at + 2 <= tiff.length ? view.getUint16(at, le) : -1)
  const r32 = (at: number) => (at + 4 <= tiff.length ? view.getUint32(at, le) : -1)
  if (r16(2) !== 42) return null
  const ifd0 = r32(4)
  if (ifd0 < 8) return null

  /** The entries of one IFD: tag → where its value sits and how long it is. */
  const entries = (at: number): Map<number, { type: number; count: number; valueAt: number }> => {
    const out = new Map<number, { type: number; count: number; valueAt: number }>()
    const n = r16(at)
    if (n < 0) return out
    for (let k = 0; k < n; k += 1) {
      const e = at + 2 + k * 12
      if (e + 12 > tiff.length) break
      const tag = r16(e)
      const type = r16(e + 2)
      const count = r32(e + 4)
      const size = count * (type === 3 ? 2 : type === 4 || type === 9 ? 4 : type === 5 || type === 10 ? 8 : 1)
      const valueAt = size <= 4 ? e + 8 : r32(e + 8)
      out.set(tag, { type, count, valueAt })
    }
    return out
  }
  const text = (e: { type: number; count: number; valueAt: number } | undefined): string | null => {
    if (!e || e.type !== 2 || e.valueAt < 0 || e.valueAt + e.count > tiff.length) return null
    return ascii(tiff, e.valueAt, e.count).replace(/\0+$/, '').trim()
  }

  const first = entries(ifd0)
  const pointer = first.get(TAG_EXIF_IFD)
  if (!pointer || (pointer.type !== 4 && pointer.type !== 3)) return null
  const exifAt = pointer.type === 4 ? r32(pointer.valueAt) : r16(pointer.valueAt)
  if (exifAt < 8) return null
  const exif = entries(exifAt)
  const wall = text(exif.get(TAG_DATE_TIME_ORIGINAL)) ?? text(exif.get(TAG_DATE_TIME_DIGITIZED))
  if (!wall) return null
  const offset = text(exif.get(TAG_OFFSET_TIME_ORIGINAL))
  return { wall, offset: offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : null }
}

/**
 * The instant a camera's wall clock names, ISO, or null when it does not parse or is not sane against the upload:
 * the zone the camera wrote when it wrote one, else the company's calendar.
 */
export function takenAtFromExif(exif: ExifTaken, uploadedMs: number): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(exif.wall)
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number]
  if (y < 2000 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null
  let ms: number
  if (exif.offset) {
    const o = /^([+-])(\d{2}):(\d{2})$/.exec(exif.offset)!
    const sign = o[1] === '-' ? -1 : 1
    ms = Date.UTC(y, mo - 1, d, h, mi, s) - sign * (Number(o[2]) * 60 + Number(o[3])) * 60_000
  } else {
    ms = appTzWallTimeMs(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, h, mi, s)
  }
  if (!Number.isFinite(ms)) return null
  if (ms > uploadedMs + TAKEN_AHEAD_MS) return null
  if (ms < uploadedMs - TAKEN_BEHIND_MS) return null
  return new Date(ms).toISOString()
}

/** The photo's time from its bytes: the file's own when sane, else the upload's. Pure. */
export function takenAtFromBytes(bytes: ArrayBuffer | Uint8Array, uploadedMs: number): { iso: string; fromFile: boolean } {
  const exif = exifDateTimeOriginal(bytes)
  const iso = exif ? takenAtFromExif(exif, uploadedMs) : null
  return iso ? { iso, fromFile: true } : { iso: new Date(uploadedMs).toISOString(), fromFile: false }
}

/**
 * The photo's time for a file the person just picked: the file's own when its head carries a sane one, else now.
 * Never throws; a file that cannot be read keeps now.
 */
export async function readTakenAt(file: Blob, uploadedMs: number = Date.now()): Promise<string> {
  try {
    const head = await file.slice(0, EXIF_HEAD_BYTES).arrayBuffer()
    return takenAtFromBytes(head, uploadedMs).iso
  } catch {
    return new Date(uploadedMs).toISOString()
  }
}
