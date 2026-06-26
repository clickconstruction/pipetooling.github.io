/**
 * Generates public/icons/add-task-180.png — the iOS home-screen icon for the "Add Task"
 * shortcut. iOS ignores SVG apple-touch-icons and renders transparency as black, so this
 * emits a 180x180 OPAQUE PNG: solid brand orange (#f97316) with a white plus glyph.
 *
 * Dependency-free (built-in zlib only), matching the scripts/*.mjs convention. Re-run with:
 *   node scripts/generate-add-task-icon.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const W = 180
const H = 180
const BG = [249, 115, 22] // #f97316 (theme_color)
const FG = [255, 255, 255] // white plus

// Plus geometry: centered, arms 40..140, bar half-thickness 14 (28px thick).
const CENTER = 90
const HALF = 14
const ARM_MIN = 40
const ARM_MAX = 140

function isPlusPixel(x, y) {
  const vertical = x >= CENTER - HALF && x <= CENTER + HALF && y >= ARM_MIN && y <= ARM_MAX
  const horizontal = y >= CENTER - HALF && y <= CENTER + HALF && x >= ARM_MIN && x <= ARM_MAX
  return vertical || horizontal
}

// Raw RGB scanlines, each prefixed with a filter byte (0 = none).
const raw = Buffer.alloc((W * 3 + 1) * H)
for (let y = 0; y < H; y++) {
  const rowStart = y * (W * 3 + 1)
  raw[rowStart] = 0
  for (let x = 0; x < W; x++) {
    const [r, g, b] = isPlusPixel(x, y) ? FG : BG
    const idx = rowStart + 1 + x * 3
    raw[idx] = r
    raw[idx + 1] = g
    raw[idx + 2] = b
  }
}

// --- CRC32 (PNG chunk checksums) ---
const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 2 // color type 2 = truecolor RGB (opaque)
ihdr[10] = 0 // compression
ihdr[11] = 0 // filter
ihdr[12] = 0 // interlace

const idat = deflateSync(raw, { level: 9 })

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
])

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'public', 'icons', 'add-task-180.png')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, png)
console.log(`Wrote ${outPath} (${png.length} bytes, ${W}x${H} opaque PNG)`)
