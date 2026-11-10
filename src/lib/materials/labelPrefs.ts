/**
 * What the Labels window remembers on the device (punch list #294, v2.6801): the format last printed with, Sheet or
 * Tape, and the tape's width, so the office's pick holds from one print to the next. Two keys in `localStorage`,
 * nothing in the database; the browser itself remembers the printer and the paper for the print window.
 */
import { TAPE_WIDTH_DEFAULT, isTapeWidth, type LabelFormat, type TapeWidthMm } from './tapeLabel'

const FORMAT_KEY = 'pt.labels.format'
const WIDTH_KEY = 'pt.labels.tapeWidthMm'

export function readLabelFormat(): LabelFormat {
  try {
    return window.localStorage.getItem(FORMAT_KEY) === 'tape' ? 'tape' : 'sheet'
  } catch {
    return 'sheet'
  }
}

export function writeLabelFormat(format: LabelFormat): void {
  try {
    window.localStorage.setItem(FORMAT_KEY, format)
  } catch {
    /* the window works without the memory */
  }
}

export function readTapeWidth(): TapeWidthMm {
  try {
    const n = Number(window.localStorage.getItem(WIDTH_KEY))
    return isTapeWidth(n) ? n : TAPE_WIDTH_DEFAULT
  } catch {
    return TAPE_WIDTH_DEFAULT
  }
}

export function writeTapeWidth(width: TapeWidthMm): void {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(width))
  } catch {
    /* the window works without the memory */
  }
}
