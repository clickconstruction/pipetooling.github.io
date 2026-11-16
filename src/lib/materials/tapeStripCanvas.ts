/**
 * Draws one tape strip on a canvas at the printer's own dots (punch list #304) and hands back its raster lines. What
 * is on the canvas is exactly what prints: every pixel is forced to black or white before the lines are read, and the
 * strip is trimmed to its last dot of ink. The sizes are `tapeStrip.ts`; the lines are `ptouchRaster.ts`.
 */
import { inkWidth, rasterLinesFromRgba } from './ptouchRaster'
import { dotFontCovers, dotTextCells, dotTextHeight, dotTextWidth } from './tapeDotFont'
import { tapeStencilPx, tapeStripBlock, tapeStripLayout, tapeStripLines } from './tapeStrip'

export type TapeStripInput = {
  /** The dots the tape prints across. */
  dots: number
  /** The QR as a grid, true where dark. */
  squares: boolean[][]
  /** The name printed large; empty for a sticker with no name, whose code is drawn larger in its place. */
  stencil: string
  /** The address under the stencil: `PRTS.CO/B/4F2A-9C18`, printed on two lines, the code on the second. */
  address: string
  /** A line of words under the address; the test strip alone has one. */
  words?: string
  /** The stencil at the smaller size: a named sticker's name of five to seven characters. */
  stencilSmall?: boolean
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
  const bare = !input.stencil.trim()
  const stencilPx = bare ? 0 : tapeStencilPx(l, input.stencilSmall)
  const stencilFont = `900 ${stencilPx}px Helvetica, Arial, sans-serif`
  const fontOf = (kind: 'code' | 'words', px: number) => (kind === 'code' ? `700 ${px}px Menlo, Consolas, "Courier New", monospace` : `${px}px Helvetica, Arial, sans-serif`)
  // The stencil and the lines under it, as one block centred on the strip's height (`tapeStripBlock`).
  const block = tapeStripBlock(l, tapeStripLines(input.address, input.words, bare), stencilPx)
  // The address is drawn in the label's own dot font, every edge on a dot; a line with a character the font lacks keeps the old face.
  const inDots = (line: { kind: 'code' | 'words'; text: string }) => line.kind === 'code' && dotFontCovers(line.text)
  ctx.font = stencilFont
  let widest = bare ? 0 : ctx.measureText(input.stencil).width
  for (const line of block.lines) {
    if (inDots(line)) { widest = Math.max(widest, dotTextWidth(line.text, line.square)); continue }
    ctx.font = fontOf(line.kind, line.px)
    widest = Math.max(widest, ctx.measureText(line.text).width)
  }
  const width = Math.ceil(l.textLeft + widest + 20)
  canvas.width = width
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#000000'
  input.squares.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) ctx.fillRect(l.qrLeft + x * l.dotsPerSquare, l.qrTop + y * l.dotsPerSquare, l.dotsPerSquare, l.dotsPerSquare)
  }))
  ctx.textBaseline = 'alphabetic'
  ctx.font = stencilFont
  if (!bare) ctx.fillText(input.stencil, l.textLeft, block.stencilBaseline)
  for (const line of block.lines) {
    if (inDots(line)) {
      // The capitals stand on the line's baseline: seven squares up from it.
      const top = line.baseline - dotTextHeight(line.square)
      for (const cell of dotTextCells(line.text)) ctx.fillRect(l.textLeft + cell.x * line.square, top + cell.y * line.square, line.square, line.square)
      continue
    }
    ctx.font = fontOf(line.kind, line.px)
    ctx.fillText(line.text, l.textLeft, line.baseline)
  }
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
