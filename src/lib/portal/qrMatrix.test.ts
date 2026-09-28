import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
// Deno edge module (supabase/functions/_shared) — the pure encoder, tested here.
import { QR_MAX_VERSION, qrByteCapacity, qrMatrix, qrVersionFor } from '../../../supabase/functions/_shared/qrMatrix'

/** The modules `qrcode.react` draws for the same text at level M — read back out of its one path. */
function referenceMatrix(text: string): boolean[][] {
  const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value: text, level: 'M', marginSize: 0, boostLevel: false, size: 100 }))
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1])
  const paths = [...svg.matchAll(/ d="([^"]*)"/g)].map((m) => m[1])
  const dark = paths[paths.length - 1] ?? ''
  const out = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  for (const m of dark.matchAll(/M(\d+)[ ,](\d+) ?h(\d+)v1H\d+z/g)) {
    const [x, y, len] = [Number(m[1]), Number(m[2]), Number(m[3])]
    for (let i = 0; i < len; i++) (out[y] as boolean[])[x + i] = true
  }
  return out
}

const SHORT = 'https://my.clickplumbing.com/hartwell-homes-k7x2'
const TOKEN = `https://clicktooling.com/portal?t=${'7c1e09ab34f25d60'.repeat(4)}`

describe('qrMatrix (the code the bill email carries)', () => {
  it('matches qrcode.react module for module on a short address', () => {
    expect(qrMatrix(SHORT)).toEqual(referenceMatrix(SHORT))
  })

  it('matches on the long token address (several blocks, alignment patterns)', () => {
    expect(qrMatrix(TOKEN)).toEqual(referenceMatrix(TOKEN))
  })

  it('matches at every version from 1 to 10, including the version-information versions', () => {
    const seen = new Set<number>()
    for (let ver = 1; ver <= QR_MAX_VERSION; ver++) {
      const text = 'https://my.clickplumbing.com/'.padEnd(qrByteCapacity(ver), 'abcdefghjkmnp-23456789').slice(0, qrByteCapacity(ver))
      const ours = qrMatrix(text)
      expect(ours, `version ${ver}`).toEqual(referenceMatrix(text))
      seen.add(((ours as boolean[][]).length - 17) / 4)
    }
    expect([...seen]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('matches on text that is not plain ASCII', () => {
    const text = 'https://my.clickplumbing.com/josé-peña-k7x2'
    expect(qrMatrix(text)).toEqual(referenceMatrix(text))
  })

  it('is a square of 17 + 4 × version modules', () => {
    expect(qrMatrix(SHORT)?.length).toBe(17 + 4 * (qrVersionFor(SHORT.length) as number))
    expect(qrMatrix(SHORT)?.every((row) => row.length === qrMatrix(SHORT)?.length)).toBe(true)
  })

  it('answers null for nothing and for text past version 10', () => {
    expect(qrMatrix('')).toBeNull()
    expect(qrVersionFor(qrByteCapacity(QR_MAX_VERSION) + 1)).toBeNull()
    expect(qrMatrix('x'.repeat(qrByteCapacity(QR_MAX_VERSION) + 1))).toBeNull()
  })
})
