/**
 * The tape label's own letters for the link (Taunya's ask of 2026-11-15: "are we using a font for the link that is
 * easy to read in low pixel?"). It was not. The link was a screen font, bold Menlo, drawn smooth at 17 dots and then
 * forced to black or white: at twelve dots tall the bold strokes filled the insides, and 8, B and the slashed 0 came
 * out as near-identical blobs, which are the look-alikes of a code that is only 0 to 9 and A to F. Menlo is also a
 * Mac's font, so another computer printed other letters at another width.
 *
 * This is a font of whole dots, as the QR beside it is drawn (`tapeStrip.ts`): every letter five squares wide and
 * seven tall, each square a whole number of the printer's dots, so every edge lands on a dot, every stroke is the
 * same weight, and the strip is the same in every browser. Capitals, digits and the marks an address carries; a
 * line with any other character is drawn in the old face, so nothing is ever left blank. Pure.
 */

/** A glyph: seven rows of five squares, `1` where there is ink. */
type Glyph = readonly [string, string, string, string, string, string, string]

export const DOT_FONT_COLS = 5
export const DOT_FONT_ROWS = 7
/** The clear squares between two letters. */
export const DOT_FONT_GAP = 1

export const DOT_FONT: Readonly<Record<string, Glyph>> = {
  // The zero is slashed so it is never a D or an O; the 8 is round where the B is square.
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

/** Whether every character of the line is in the font. A line that is not is drawn in the old face. */
export function dotFontCovers(text: string): boolean {
  return text.length > 0 && [...text].every((ch) => ch in DOT_FONT)
}

/** The printer's dots to a square of the font for a tape that prints `dots` across: 2 on 18 and 24 mm tape, so capitals are 14 dots, 2 mm. */
export function dotFontSquare(dots: number): number {
  return Math.max(1, Math.round(dots / 64))
}

/** The line's height in dots at `square` dots a square: its capitals, which is all it has. */
export function dotTextHeight(square: number): number {
  return DOT_FONT_ROWS * square
}

/** The line's width in dots: its letters and the gaps between them, none after the last. */
export function dotTextWidth(text: string, square: number): number {
  const n = [...text].length
  return n === 0 ? 0 : (n * (DOT_FONT_COLS + DOT_FONT_GAP) - DOT_FONT_GAP) * square
}

/**
 * The line's ink as squares, in squares from its top left: what the canvas fills, each `square` dots a side. A
 * character the font does not have leaves its place empty; `dotFontCovers` is asked first.
 */
export function dotTextCells(text: string): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = []
  ;[...text].forEach((ch, at) => {
    const glyph = DOT_FONT[ch]
    if (!glyph) return
    glyph.forEach((row, y) => {
      for (let x = 0; x < DOT_FONT_COLS; x++) if (row[x] === '1') cells.push({ x: at * (DOT_FONT_COLS + DOT_FONT_GAP) + x, y })
    })
  })
  return cells
}
