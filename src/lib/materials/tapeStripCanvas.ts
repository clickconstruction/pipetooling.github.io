/**
 * Draws one tape strip on a canvas at the printer's own dots (punch list #304) and hands back its raster lines. What
 * is on the canvas is exactly what prints: every pixel is forced to black or white before the lines are read, and the
 * strip is trimmed to its last dot of ink. The sizes are `tapeStrip.ts`; the lines are `ptouchRaster.ts`.
 */
import { inkWidth, rasterLinesFromRgba } from './ptouchRaster'
import { tapeStripLayout } from './tapeStrip'

export type TapeStripInput = {
  /** The dots the tape prints across. */
  dots: number
  /** The QR as a grid, true where dark. */
  squares: boolean[][]
  stencil: string
  /** The address under the stencil, as it prints: `PRTS.CO/B/4F2A-9C18`. */
  address: string
  words: string
}

export type TapeStripDrawn = { width: number; height: number; lines: Uint8Array[] }

/** Null where there is no canvas to draw on (a test's DOM). */
export function drawTapeStrip(canvas: HTMLCanvasElement, input: TapeStripInput): TapeStripDrawn | null {
  const l = tapeStripLayout(input.dots, input.squares.length)
  const height = l.dots
  canvas.height = height
  canvas.width = 1200
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const stencilFont = `900 ${l.stencilPx}px Helvetica, Arial, sans-serif`
  const codeFont = `700 ${l.codePx}px Menlo, Consolas, "Courier New", monospace`
  const wordsFont = `${l.wordsPx}px Helvetica, Arial, sans-serif`
  ctx.font = stencilFont
  const stencilWidth = ctx.measureText(input.stencil).width
  ctx.font = codeFont
  const codeWidth = ctx.measureText(input.address).width
  ctx.font = wordsFont
  const wordsWidth = ctx.measureText(input.words).width
  const width = Math.ceil(l.textLeft + Math.max(stencilWidth, codeWidth, wordsWidth) + 20)
  canvas.width = width
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#000000'
  input.squares.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) ctx.fillRect(l.qrLeft + x * l.dotsPerSquare, l.qrTop + y * l.dotsPerSquare, l.dotsPerSquare, l.dotsPerSquare)
  }))
  // The three lines of words, as one block centred on the strip's height.
  const gap = 6
  const block = l.stencilPx * 0.78 + gap + l.codePx * 1.2 + l.wordsPx * 1.2
  let y = Math.round((height - block) / 2 + l.stencilPx * 0.78)
  ctx.textBaseline = 'alphabetic'
  ctx.font = stencilFont
  ctx.fillText(input.stencil, l.textLeft, y)
  y += gap + Math.round(l.codePx * 1.05)
  ctx.font = codeFont
  ctx.fillText(input.address, l.textLeft, y)
  y += Math.round(l.wordsPx * 1.25)
  ctx.font = wordsFont
  ctx.fillText(input.words, l.textLeft, y)
  // Black or white, nothing between: the printer has no grey, and the screen should show what it prints.
  const whole = ctx.getImageData(0, 0, width, height)
  const px = whole.data
  for (let i = 0; i < px.length; i += 4) {
    const ink = (px[i]! * 299 + px[i + 1]! * 587 + px[i + 2]! * 114) / 1000 < 128
    px[i] = px[i + 1] = px[i + 2] = ink ? 0 : 255
    px[i + 3] = 255
  }
  ctx.putImageData(whole, 0, 0)
  const keep = Math.max(1, inkWidth(px, width, height))
  const trimmed = ctx.getImageData(0, 0, keep, height)
  canvas.width = keep
  const again = canvas.getContext('2d')
  again?.putImageData(trimmed, 0, 0)
  return { width: keep, height, lines: rasterLinesFromRgba(trimmed.data, keep, height) }
}
