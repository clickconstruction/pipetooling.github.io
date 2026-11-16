/**
 * The tape strip as the printer's own dots (punch list #304): the QR at a whole number of dots a square, as tall as the
 * tape prints, then the stencil and under it the address on two lines, `PRTS.CO/B/` and then the code (Taunya's ask
 * of 2026-11-15: no line of words, and a link no wider than its code, so the strip ends sooner), in a font of whole
 * dots so the code reads at two millimetres (`tapeDotFont.ts`). Pure: the sizes for
 * a tape, the lines and where each sits, and the QR as a grid of squares read out of the QR library's drawing. The
 * canvas that draws it is `tapeStripCanvas.ts`.
 *
 * A whole number of dots a square is the point. A code shrunk to fit lands its squares on uneven dots and prints soft;
 * 25 squares at 5 dots each is 125 of the head's 128 dots, every edge on a dot. The tape's own unprinted edges, about
 * 3 mm each on 24 mm tape, are the code's quiet zone above and below.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { dotFontSquare, dotTextHeight } from './tapeDotFont'

export type TapeStripLayout = {
  /** The dots the tape prints across: the strip's height. */
  dots: number
  squares: number
  dotsPerSquare: number
  /** The code's side in dots. */
  qrSize: number
  qrLeft: number
  qrTop: number
  /** Where the words start, after a clear gap of four squares. */
  textLeft: number
  stencilPx: number
  /** The dots to a square of the address's dot font (`tapeDotFont.ts`): its capitals are seven squares tall. */
  codeSquare: number
  /** The address's line size: its capitals and the room under them. The old face is drawn at it when a line has a character the dot font lacks. */
  codePx: number
  wordsPx: number
}

/** The strip's sizes for a tape that prints `dots` across and a code of `squares` a side. */
export function tapeStripLayout(dots: number, squares: number): TapeStripLayout {
  const dotsPerSquare = Math.max(1, Math.floor(dots / squares))
  const qrSize = dotsPerSquare * squares
  const qrLeft = dotsPerSquare * 2
  return {
    dots,
    squares,
    dotsPerSquare,
    qrSize,
    qrLeft,
    qrTop: Math.floor((dots - qrSize) / 2),
    textLeft: qrLeft + qrSize + dotsPerSquare * 4,
    stencilPx: Math.round(dots * 0.58),
    codeSquare: dotFontSquare(dots),
    codePx: Math.round(dotTextHeight(dotFontSquare(dots)) * 1.2),
    wordsPx: Math.round(dots * 0.1),
  }
}

/**
 * The address as the strip prints it: broken after `/B/`, so `PRTS.CO/B/849F-DB0B` is `PRTS.CO/B/` and `849F-DB0B`.
 * The link reads the same and types the same; the line is as wide as its longer half. An address with no code after
 * `/B/` (the test strip's) stays one line.
 */
export function tapeAddressLines(address: string): string[] {
  const m = /^(.*\/B\/)(.+)$/i.exec(address)
  return m ? [m[1]!, m[2]!] : [address]
}

/** One line under the stencil: a piece of the address in the code's face, or the test strip's words. */
export type TapeStripLine = { text: string; kind: 'code' | 'words' }

/** The lines under the stencil: the address on its lines, then the words when a strip has any (the test strip alone). */
export function tapeStripLines(address: string, words?: string): TapeStripLine[] {
  const lines: TapeStripLine[] = tapeAddressLines(address).map((text) => ({ text, kind: 'code' }))
  return words ? [...lines, { text: words, kind: 'words' }] : lines
}

/** A line with its type size and its baseline, both in dots from the strip's top. */
export type TapeStripPlacedLine = TapeStripLine & { px: number; baseline: number }

/** The dots between the stencil and the first line under it. */
export const TAPE_STRIP_GAP = 6

/**
 * Where the stencil and its lines sit: one block centred on the strip's height, the stencil's baseline first, then
 * each line a line's height under the one before.
 */
export function tapeStripBlock(l: TapeStripLayout, lines: ReadonlyArray<TapeStripLine>): { stencilBaseline: number; lines: TapeStripPlacedLine[] } {
  const sized = lines.map((line) => ({ ...line, px: line.kind === 'code' ? l.codePx : l.wordsPx }))
  const block = l.stencilPx * 0.78 + TAPE_STRIP_GAP + sized.reduce((sum, line) => sum + line.px * 1.2, 0)
  const stencilBaseline = Math.round((l.dots - block) / 2 + l.stencilPx * 0.78)
  let y = stencilBaseline
  const placed = sized.map((line, i) => {
    y += i === 0 ? TAPE_STRIP_GAP + Math.round(line.px * 1.05) : Math.round(line.px * 1.25)
    return { ...line, baseline: y }
  })
  return { stencilBaseline, lines: placed }
}

/** The dark runs of a QR's drawing, as the library writes them (`M8 0h1v1H8z`, or `M18,0 h7v1H18z` at a row's end), as a grid. */
export function qrSquaresFromPath(d: string, squares: number): boolean[][] {
  const grid = Array.from({ length: squares }, () => new Array<boolean>(squares).fill(false))
  for (const m of d.matchAll(/M(\d+)[ ,](\d+) ?h(\d+)v1H\d+z/g)) {
    const x = Number(m[1])
    const y = Number(m[2])
    const w = Number(m[3])
    const row = grid[y]
    if (!row) continue
    for (let i = x; i < x + w && i < squares; i++) row[i] = true
  }
  return grid
}

/** The QR for `value` as a grid of squares, true where dark, with no quiet zone; null when the library's drawing cannot be read. */
export function qrSquares(value: string): boolean[][] | null {
  const markup = renderToStaticMarkup(createElement(QRCodeSVG, { value, size: 100, level: 'M', marginSize: 0 }))
  const squares = Number(/viewBox="0 0 (\d+) \d+"/.exec(markup)?.[1])
  const paths = [...markup.matchAll(/<path[^>]*\sd="([^"]*)"/g)].map((m) => m[1] ?? '')
  const dark = paths[paths.length - 1]
  if (!Number.isFinite(squares) || squares < 21 || !dark) return null
  const grid = qrSquaresFromPath(dark, squares)
  // Every QR opens with a finder pattern: a dark corner square. A grid without it was not read right.
  return grid[0]?.[0] && grid[0]?.[6] && grid[6]?.[0] ? grid : null
}
