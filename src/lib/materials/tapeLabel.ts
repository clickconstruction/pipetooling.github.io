/**
 * The tape label (punch list #294, v2.6801): one strip per cage or box for a Brother P-touch, printed through the
 * printer's own driver from the browser's print window. The app lays the strip out at the tape's size, the QR on the left
 * with a quiet zone of four modules, the stencil in the largest type that fits, and under it the address on two lines,
 * `PRTS.CO/B/` and then the code with its dash (`tapeStrip.ts`, Taunya's ask of 2026-11-15, which also took the line
 * of words off the strip); the print window hands it to the driver at the tape's paper size and the printer cuts
 * between strips. The strip is as long as its longest name needs, so a run of short names uses less tape.
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

/** The name length a strip is cut for when nobody says: a letter and three digits, or a sticker's four digits. */
export const TAPE_NAME_CHARS_DEFAULT = 4

/**
 * The strip's sizes for a tape width. `nameChars` is the longest name the run prints, in characters: the print window
 * cuts every strip of a run to one length, so the length is what that name needs beside the QR, and never less than
 * the address's first line. Printed straight to the P-touch each strip is trimmed to its own ink instead
 * (`tapeStripCanvas.ts`).
 */
export function tapeLayout(widthMm: TapeWidthMm, nameChars: number = TAPE_NAME_CHARS_DEFAULT): TapeLayout {
  const sizes = widthMm === 24
    ? { qrMm: 22, padMm: 1, stencilMm: 9, codeMm: 2.4, wordsMm: 2 }
    : { qrMm: 16.5, padMm: 0.75, stencilMm: 6.5, codeMm: 1.9, wordsMm: 1.6 }
  const chars = Math.max(1, Math.floor(Number(nameChars)) || TAPE_NAME_CHARS_DEFAULT)
  // Room for the widest heavy capitals, 0.8 of the type size each (a W or an M; a digit is narrower), and for the
  // address's first line, ten characters of the code's face. Measured in Chrome on 2026-11-15: G120, RM120 and MMM888 fit.
  const textMm = Math.max(chars * sizes.stencilMm * 0.8, 10 * sizes.codeMm * 0.65)
  // To a tenth before the whole millimetre, so 61.00000001 is 61.
  const lengthMm = Math.ceil(Math.round((sizes.padMm + sizes.qrMm + sizes.padMm + textMm + sizes.padMm) * 10) / 10)
  return { widthMm, lengthMm, ...sizes }
}

/** The longest name of a run, in characters, for `tapeLayout`; the default when the run is empty. */
export function longestNameChars(names: ReadonlyArray<string>): number {
  return names.reduce((most, name) => Math.max(most, name.length), 0) || TAPE_NAME_CHARS_DEFAULT
}

/**
 * The print rules for the tape: the page is one strip, no margins, and each strip breaks to its own page. Written after
 * `printRootCss`'s rules so its `@page` wins. `stripClass` is each strip; `nameChars` the run's longest name.
 */
export function tapePrintCss(widthMm: TapeWidthMm, stripClass: string, nameChars: number = TAPE_NAME_CHARS_DEFAULT): string {
  const l = tapeLayout(widthMm, nameChars)
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

/**
 * While the strips go out one at a time: `Printing 2 of 6…`. With the strip's box it says where the run is, so the
 * strip in the hand has a name: `Printing 7 of 455 · G2, strip 2 of 5`, or `Printing 7 of 91 · G7` at one strip each.
 */
export function tapeProgressWords(done: number, total: number, at?: { name: string; copy: number; copies: number } | null): string {
  const head = `Printing ${Math.min(done + 1, total)} of ${total}`
  if (!at) return `${head}\u2026`
  return at.copies > 1 ? `${head} \u00b7 ${at.name}, strip ${at.copy} of ${at.copies}` : `${head} \u00b7 ${at.name}`
}

/** After a run: every strip went, or how many did before the printer stopped, with its reason. */
export function tapeSentWords(done: number, total: number, reason?: string): string {
  if (!reason) return done === 1 ? '1 tape label printed.' : `${done} tape labels printed.`
  return `${done} of ${total} printed, then the printer stopped: ${reason}`
}

/** After **Stop printing**: how many strips went before the run was stopped. Nothing is wrong, so it names no reason. */
export function tapeStoppedWords(done: number, total: number): string {
  return `${done} of ${total} printed, then you stopped the run.`
}

/** The press that prints the first ticked box alone, so a wrong paper size costs one strip and not a run. */
export const TAPE_TEST_STRIP_LABEL = 'Print 1 test strip'

/** The line once this computer has printed tape: what it prints on, and the day it last did. `day` is that day as words. */
export function tapeReadyWords(widthMm: TapeWidthMm, day: string): { head: string; tail: string } {
  return { head: `Brother tape \u00b7 ${widthMm} mm.`, tail: `This computer printed tape last on ${day}.` }
}

/**
 * Strips of each box (v2.6878, the owner: a box has more than one side). Each box's strips come off the printer
 * together, 1 1 2 2 3 3, so a pair is stuck on one box before the next box's pair is in hand.
 */
export const TAPE_COPIES_MAX = 6
export const TAPE_COPIES_LABEL = 'Copies of each'

/** A whole number of copies from 1 to `TAPE_COPIES_MAX`; anything else is 1. */
export function clampTapeCopies(n: unknown): number {
  const v = Math.floor(Number(n))
  return Number.isFinite(v) ? Math.min(TAPE_COPIES_MAX, Math.max(1, v)) : 1
}

/** Each item `copies` times, its copies kept together: 1 1 2 2 3 3. */
export function repeatEach<T>(items: ReadonlyArray<T>, copies: number): T[] {
  const n = clampTapeCopies(copies)
  return items.flatMap((item) => Array.from({ length: n }, () => item))
}

/** The line under the window's title: what the press will print. `copies` is strips of each box, tape only. */
export function labelCountWords(format: LabelFormat, n: number, one: boolean, copies = 1): string {
  if (format === 'tape' && copies > 1) {
    return one ? `${copies} strips of this box: the QR, the stencil and the code.` : `${n} ${n === 1 ? 'box' : 'boxes'}, ${copies} strips each. ${n * copies} strips.`
  }
  if (format === 'tape') return one ? 'One strip: the QR, the stencil and the code.' : `${n} ${n === 1 ? 'box' : 'boxes'}, one strip each.`
  return one ? 'One sheet: the stencil, the code, and the lines to write on.' : `${n} ${n === 1 ? 'label' : 'labels'}, one a sheet. The camera opens the box from the code.`
}

/** The guide that holds the tape printer's setup, and the heading the window's link opens on. */
export const TAPE_LABEL_GUIDE = 'keep-track-of-the-material-in-the-cages-and-boxes-on-site'
export const TAPE_LABEL_GUIDE_HEADING = 'Print a tape label'
