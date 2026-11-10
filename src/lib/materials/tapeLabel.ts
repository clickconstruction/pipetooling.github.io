/**
 * The tape label (punch list #294, v2.6801): one strip per cage or box for a Brother P-touch, printed through the
 * printer's own driver from the browser's print window. The app lays the strip out at the tape's size, the QR on the left
 * with a quiet zone of four modules, the stencil in the largest type that fits, the code with its dash and one line of
 * words underneath; the print window hands it to the driver at the tape's paper size and the printer cuts between strips.
 * Pure: the sizes in millimetres, the page rule and the press's words. The window is `LabelsPrintModal.tsx`.
 */
import { countedLabel } from '../batchWords'

/** The two label formats the window prints: a Letter sheet per box, or a strip of tape per box. */
export type LabelFormat = 'sheet' | 'tape'

/** The tape widths both printers take; the widest is the recommendation. */
export const TAPE_WIDTHS_MM = [18, 24] as const
export type TapeWidthMm = (typeof TAPE_WIDTHS_MM)[number]
export const TAPE_WIDTH_DEFAULT: TapeWidthMm = 24

export function isTapeWidth(n: unknown): n is TapeWidthMm {
  return (TAPE_WIDTHS_MM as readonly number[]).includes(n as number)
}

/** The strip's sizes in millimetres for a tape width: the whole strip, the QR's square and the type. */
export type TapeLayout = {
  widthMm: TapeWidthMm
  /** The strip's length along the tape. */
  lengthMm: number
  /** The QR's square, the quiet zone inside it. */
  qrMm: number
  /** The strip's padding on every side. */
  padMm: number
  stencilMm: number
  codeMm: number
  wordsMm: number
}

export function tapeLayout(widthMm: TapeWidthMm): TapeLayout {
  return widthMm === 24
    ? { widthMm, lengthMm: 72, qrMm: 22, padMm: 1, stencilMm: 9, codeMm: 2.4, wordsMm: 2 }
    : { widthMm, lengthMm: 60, qrMm: 16.5, padMm: 0.75, stencilMm: 6.5, codeMm: 1.9, wordsMm: 1.6 }
}

/** The words under the code on the strip. */
export const TAPE_WORDS = 'Scan for what is inside'

/**
 * The print rules for the tape: the page is one strip, no margins, and each strip breaks to its own page. Written after
 * `printRootCss`'s rules so its `@page` wins. `rootClass` is the window's root, `stripClass` each strip.
 */
export function tapePrintCss(widthMm: TapeWidthMm, stripClass: string): string {
  const l = tapeLayout(widthMm)
  return [
    '@media print {',
    `@page { size: ${l.lengthMm}mm ${l.widthMm}mm; margin: 0; }`,
    `.${stripClass} { width: ${l.lengthMm}mm !important; height: ${l.widthMm}mm !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; }`,
    `.${stripClass} + .${stripClass} { break-before: page; page-break-before: always; }`,
    '}',
  ].join(' ')
}

/** The press: *Print 3 tape labels*, *Print 1 tape label*; dead at zero. */
export function tapePressLabel(n: number): string {
  return countedLabel('Print', n, ['tape label', 'tape labels'])
}

/** The sheet's press, the same shape: *Print 3 labels*. */
export function sheetPressLabel(n: number): string {
  return countedLabel('Print', n, 'label')
}

/** The line under the chips when Tape is on. */
export function tapeHintWords(widthMm: TapeWidthMm): string {
  return `Tape prints one strip per box on your P-touch, ${widthMm} mm wide. The first time, pick the printer and the ${widthMm} mm paper in the print window. After that it is remembered.`
}
