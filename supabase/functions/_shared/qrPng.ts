/**
 * A QR code as a PNG — the image the bill email embeds. Mail clients do not draw SVG and
 * strip data URLs, so the code rides as an inline attachment, and an attachment is bytes.
 *
 * One bit per pixel, greyscale, stored (uncompressed) deflate blocks: a short address's
 * 33-module code at 8 px a module is about 14 KB, and nothing here needs a compressor. Dependency-free; tested
 * from `src/lib/portal/qrPng.test.ts`, which reads the pixels back out of the file.
 */
import type { QrMatrix } from './qrMatrix.ts'

/** Pixels per module: 8 keeps a 120 px image sharp on a high-density screen and on paper. */
export const QR_PNG_SCALE = 8
/** Quiet zone in modules — the spec's four, since an email's background is not ours to pick. */
export const QR_PNG_QUIET_MODULES = 4

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const STORED_BLOCK_MAX = 0xffff

let crcTable: Uint32Array | null = null

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (const b of bytes) crc = (crcTable[(crc ^ b) & 0xff] as number) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function uint32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

function chunk(type: string, data: Uint8Array): number[] {
  const body = new Uint8Array(4 + data.length)
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i)
  body.set(data, 4)
  return [...uint32(data.length), ...body, ...uint32(crc32(body))]
}

/** A zlib stream of stored blocks — valid deflate, no compression. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const out: number[] = [0x78, 0x01]
  for (let at = 0; at < raw.length || at === 0; at += STORED_BLOCK_MAX) {
    const part = raw.subarray(at, at + STORED_BLOCK_MAX)
    const last = at + STORED_BLOCK_MAX >= raw.length
    out.push(last ? 1 : 0, part.length & 0xff, part.length >>> 8, ~part.length & 0xff, (~part.length >>> 8) & 0xff)
    for (const b of part) out.push(b)
    if (last) break
  }
  out.push(...uint32(adler32(raw)))
  return Uint8Array.from(out)
}

/** The side of the image in pixels for a code of `moduleCount` modules. */
export function qrPngSide(moduleCount: number, scale: number = QR_PNG_SCALE, quiet: number = QR_PNG_QUIET_MODULES): number {
  return (moduleCount + quiet * 2) * scale
}

/** The PNG file's bytes: dark modules black, everything else (the quiet zone too) white. */
export function qrPngBytes(modules: QrMatrix, opts: { scale?: number; quiet?: number } = {}): Uint8Array {
  const scale = Math.max(1, Math.round(opts.scale ?? QR_PNG_SCALE))
  const quiet = Math.max(0, Math.round(opts.quiet ?? QR_PNG_QUIET_MODULES))
  const side = qrPngSide(modules.length, scale, quiet)
  const rowBytes = Math.ceil(side / 8)
  const raw = new Uint8Array((rowBytes + 1) * side)
  for (let py = 0; py < side; py++) {
    const rowStart = py * (rowBytes + 1)
    // Filter byte 0 (none) is already there; a set bit is white in 1-bit greyscale.
    for (let b = 0; b < rowBytes; b++) raw[rowStart + 1 + b] = 0xff
    const my = Math.floor(py / scale) - quiet
    const row = my >= 0 && my < modules.length ? (modules[my] ?? null) : null
    if (!row) continue
    for (let px = 0; px < side; px++) {
      const mx = Math.floor(px / scale) - quiet
      if (mx >= 0 && mx < row.length && row[mx]) raw[rowStart + 1 + (px >>> 3)] = (raw[rowStart + 1 + (px >>> 3)] as number) & ~(0x80 >>> (px & 7))
    }
  }
  // Bits past the image's width in the last byte of a row are padding; leave them set.
  const header = Uint8Array.from([...uint32(side), ...uint32(side), 1, 0, 0, 0, 0])
  return Uint8Array.from([...PNG_SIGNATURE, ...chunk('IHDR', header), ...chunk('IDAT', zlibStored(raw)), ...chunk('IEND', new Uint8Array(0))])
}

/** Base64 of bytes, in pieces small enough for `String.fromCharCode` on any runtime. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  return btoa(binary)
}
