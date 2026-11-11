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

/**
 * The window's first choice (punch list #304): what the labels print on, each named with what it is and what it
 * needs. Tape is named for the printer on the desk, since a chip that read *Tape* told nobody it meant the P-touch.
 */
export const LABEL_OUTPUTS: Record<LabelFormat, { name: string; words: string }> = {
  sheet: { name: 'Paper sheet', words: 'One Letter page a box, with lines to write on. Any printer.' },
  tape: { name: 'Brother tape', words: 'One strip a box for the P-touch, for boxes that sit in the sun.' },
}

/**
 * The three things to do the first time a computer prints tape, in order. `direct` is the app sending the dots itself
 * over USB (v2.6865), which needs no driver; the other way is the browser's print window, which needs Brother's
 * driver, and Brother makes one for Windows and none for a Mac.
 */
export function tapeSetupSteps(widthMm: TapeWidthMm, direct = false): string[] {
  if (direct) {
    return [
      'Plug the P-touch in with its USB cable and switch it on.',
      'Quit Brother\u2019s P-touch Editor if it is open. Only one program can hold the printer.',
      'Press Connect the P-touch and pick it in the browser\u2019s list. The browser remembers it.',
    ]
  }
  return [
    'Plug the P-touch in with its USB cable and switch it on.',
    'On Windows, add it as a printer with Brother\u2019s driver. Brother makes no driver for a Mac.',
    `In the print window, pick the P-touch and the ${widthMm} mm paper. The browser remembers both.`,
  ]
}

/** The quiet press from one way of printing tape to the other. */
export const TAPE_VIA_WINDOW_LABEL = 'Use the print window instead'
export const TAPE_VIA_USB_LABEL = 'Print straight to the P-touch'

/** While the strips go out one at a time: `Printing 2 of 6…`. */
export function tapeProgressWords(done: number, total: number): string {
  return `Printing ${Math.min(done + 1, total)} of ${total}\u2026`
}

/** After a run: every strip went, or how many did before the printer stopped, with its reason. */
export function tapeSentWords(done: number, total: number, reason?: string): string {
  if (!reason) return done === 1 ? '1 tape label printed.' : `${done} tape labels printed.`
  return `${done} of ${total} printed, then the printer stopped: ${reason}`
}

/** The press that prints the first ticked box alone, so a wrong paper size costs one strip and not a run. */
export const TAPE_TEST_STRIP_LABEL = 'Print 1 test strip'

/** The line once this computer has printed tape: what it prints on, and the day it last did. `day` is that day as words. */
export function tapeReadyWords(widthMm: TapeWidthMm, day: string): { head: string; tail: string } {
  return { head: `Brother tape \u00b7 ${widthMm} mm.`, tail: `This computer printed tape last on ${day}.` }
}

/** The line under the window's title: what the press will print. */
export function labelCountWords(format: LabelFormat, n: number, one: boolean): string {
  if (format === 'tape') return one ? 'One strip: the QR, the stencil and the code.' : `${n} ${n === 1 ? 'box' : 'boxes'}, one strip each.`
  return one ? 'One sheet: the stencil, the code, and the lines to write on.' : `${n} ${n === 1 ? 'label' : 'labels'}, one a sheet. The camera opens the box from the code.`
}

/** The guide that holds the tape printer's setup, and the heading the window's link opens on. */
export const TAPE_LABEL_GUIDE = 'keep-track-of-the-material-in-the-cages-and-boxes-on-site'
export const TAPE_LABEL_GUIDE_HEADING = 'Print a tape label'
