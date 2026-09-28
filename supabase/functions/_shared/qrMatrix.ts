/**
 * A QR code's modules for a short piece of text — the code the bill email carries to the
 * customer's statement. Dependency-free so the Deno function and vitest share this file: an
 * email cannot run the browser's `qrcode.react`, and a bill must not wait on a package fetch.
 *
 * Byte mode, error correction level M, versions 1–10 (up to 213 bytes — a short address is
 * about 45, the long token address 98). Longer text answers null and the email goes without
 * a code. The construction follows ISO/IEC 18004 the way Project Nayuki's QR Code generator
 * (MIT) lays it out, which is the encoder inside `qrcode.react`; the parity test
 * (`src/lib/portal/qrMatrix.test.ts`) holds this file to that one, module for module.
 */

/** `[y][x]`, true = dark. No quiet zone — the renderer adds it. */
export type QrMatrix = boolean[][]

export const QR_MAX_VERSION = 10

const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const BLOCK_COUNT = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const ALIGNMENT: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]
/** Level M's two format bits. */
const FORMAT_BITS_M = 0

/** An element the caller knows is there — every index below is bounded by the table or the matrix it reads. */
function at<T>(list: ArrayLike<T>, i: number): T {
  return list[i] as T
}

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}

function dataCodewordCount(ver: number): number {
  return Math.floor(rawDataModules(ver) / 8) - at(ECC_PER_BLOCK, ver) * at(BLOCK_COUNT, ver)
}

/** How many bytes of text a version holds at level M (mode and length header taken off). */
export function qrByteCapacity(ver: number): number {
  const headerBits = 4 + (ver < 10 ? 8 : 16)
  return Math.floor((dataCodewordCount(ver) * 8 - headerBits) / 8)
}

/** The smallest version that holds `byteLength` bytes, or null past version 10. */
export function qrVersionFor(byteLength: number): number | null {
  for (let ver = 1; ver <= QR_MAX_VERSION; ver++) if (byteLength <= qrByteCapacity(ver)) return ver
  return null
}

function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function reedSolomonDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(at(result, j), root)
      if (j + 1 < degree) result[j] = at(result, j) ^ at(result, j + 1)
    }
    root = gfMultiply(root, 2)
  }
  return result
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = new Array(divisor.length).fill(0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    for (let i = 0; i < divisor.length; i++) result[i] = at(result, i) ^ gfMultiply(at(divisor, i), factor)
  }
  return result
}

function dataCodewords(bytes: Uint8Array, ver: number): number[] {
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, ver < 10 ? 8 : 16)
  for (const b of bytes) push(b, 8)
  const capacityBits = dataCodewordCount(ver) * 8
  push(0, Math.min(4, capacityBits - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8)
  const out: number[] = new Array(bits.length / 8).fill(0)
  bits.forEach((bit, i) => {
    out[i >>> 3] = at(out, i >>> 3) | (bit << (7 - (i & 7)))
  })
  return out
}

function withErrorCorrection(data: number[], ver: number): number[] {
  const numBlocks = at(BLOCK_COUNT, ver)
  const blockEccLen = at(ECC_PER_BLOCK, ver)
  const rawCodewords = Math.floor(rawDataModules(ver) / 8)
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)
  const divisor = reedSolomonDivisor(blockEccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1))
    k += dat.length
    const ecc = reedSolomonRemainder(dat, divisor)
    if (i < numShortBlocks) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const result: number[] = []
  for (let i = 0; i < at(blocks, 0).length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(at(block, i))
    })
  }
  return result
}

function maskInverts(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  }
}

const PENALTY_N1 = 3
const PENALTY_N2 = 3
const PENALTY_N3 = 40
const PENALTY_N4 = 10

function penaltyScore(modules: QrMatrix): number {
  const size = modules.length
  let result = 0
  const addHistory = (runLength: number, history: number[]) => {
    if (at(history, 0) === 0) runLength += size
    history.pop()
    history.unshift(runLength)
  }
  const countPatterns = (h: number[]): number => {
    const n = at(h, 1)
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n
    return (core && at(h, 0) >= n * 4 && at(h, 6) >= n ? 1 : 0) + (core && at(h, 6) >= n * 4 && at(h, 0) >= n ? 1 : 0)
  }
  const terminateAndCount = (runColor: boolean, runLength: number, history: number[]): number => {
    if (runColor) {
      addHistory(runLength, history)
      runLength = 0
    }
    runLength += size
    addHistory(runLength, history)
    return countPatterns(history)
  }
  const scanLine = (at: (i: number) => boolean) => {
    let runColor = false
    let run = 0
    const history = [0, 0, 0, 0, 0, 0, 0]
    for (let i = 0; i < size; i++) {
      if (at(i) === runColor) {
        run++
        if (run === 5) result += PENALTY_N1
        else if (run > 5) result++
      } else {
        addHistory(run, history)
        if (!runColor) result += countPatterns(history) * PENALTY_N3
        runColor = at(i)
        run = 1
      }
    }
    result += terminateAndCount(runColor, run, history) * PENALTY_N3
  }
  const dark = (x: number, y: number) => at(at(modules, y), x)
  for (let y = 0; y < size; y++) scanLine((x) => dark(x, y))
  for (let x = 0; x < size; x++) scanLine((y) => dark(x, y))
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = dark(x, y)
      if (color === dark(x + 1, y) && color === dark(x, y + 1) && color === dark(x + 1, y + 1)) result += PENALTY_N2
    }
  }
  let darkCount = 0
  for (const row of modules) for (const m of row) if (m) darkCount++
  const total = size * size
  result += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * PENALTY_N4
  return result
}

/** The modules for `text`, or null when it is empty or too long for version 10. */
export function qrMatrix(text: string): QrMatrix | null {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length === 0) return null
  const ver = qrVersionFor(bytes.length)
  if (ver == null) return null
  const size = ver * 4 + 17
  const modules: QrMatrix = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const setFunction = (x: number, y: number, dark: boolean) => {
    at(modules, y)[x] = dark
    at(isFunction, y)[x] = true
  }
  const drawFormatBits = (mask: number) => {
    const data = (FORMAT_BITS_M << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((bits >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) setFunction(8, i, bit(i))
    setFunction(8, 7, bit(6))
    setFunction(8, 8, bit(7))
    setFunction(7, 8, bit(8))
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, bit(i))
    setFunction(8, size - 8, true)
  }

  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0)
    setFunction(i, 6, i % 2 === 0)
  }
  const finders: Array<[number, number]> = [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]
  for (const [cx, cy] of finders) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const x = cx + dx
        const y = cy + dy
        if (x >= 0 && x < size && y >= 0 && y < size) setFunction(x, y, dist !== 2 && dist !== 4)
      }
    }
  }
  const align = at(ALIGNMENT, ver)
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      const corner = (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)
      if (corner) continue
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) setFunction(at(align, i) + dx, at(align, j) + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    }
  }
  drawFormatBits(0)
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      setFunction(a, b, dark)
      setFunction(b, a, dark)
    }
  }

  const codewords = withErrorCorrection(dataCodewords(bytes, ver), ver)
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!at(at(isFunction, y), x) && i < codewords.length * 8) {
          at(modules, y)[x] = ((at(codewords, i >>> 3) >>> (7 - (i & 7))) & 1) !== 0
          i++
        }
      }
    }
  }

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) {
      const row = at(modules, y)
      for (let x = 0; x < size; x++) if (!at(at(isFunction, y), x) && maskInverts(mask, x, y)) row[x] = !at(row, x)
    }
  }
  let best = 0
  let bestPenalty = Infinity
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask)
    drawFormatBits(mask)
    const penalty = penaltyScore(modules)
    if (penalty < bestPenalty) {
      best = mask
      bestPenalty = penalty
    }
    applyMask(mask)
  }
  applyMask(best)
  drawFormatBits(best)
  return modules
}
