/**
 * The tape strip as the printer's own dots (punch list #304): the QR at a whole number of dots a square, as tall as the
 * tape prints, then the stencil, the address and one line of words. Pure: the sizes for a tape, and the QR as a grid of
 * squares read out of the QR library's drawing. The canvas that draws it is `tapeStripCanvas.ts`.
 *
 * A whole number of dots a square is the point. A code shrunk to fit lands its squares on uneven dots and prints soft;
 * 25 squares at 5 dots each is 125 of the head's 128 dots, every edge on a dot. The tape's own unprinted edges, about
 * 3 mm each on 24 mm tape, are the code's quiet zone above and below.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'

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
    codePx: Math.round(dots * 0.133),
    wordsPx: Math.round(dots * 0.1),
  }
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
