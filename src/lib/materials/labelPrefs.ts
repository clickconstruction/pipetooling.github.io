/**
 * What the Labels window remembers on the device (punch list #294, v2.6801): the format last printed with, Sheet or
 * Tape, and the tape's width, so the office's pick holds from one print to the next; and since punch list #304 the
 * day this device last sent a strip to the print window, so the window opens on tape and folds the first-time steps
 * away. Keys in `localStorage`, nothing in the database; the browser itself remembers the printer and the paper for
 * the print window. The day says a print was asked for here, never that the printer answered: the app cannot see it.
 */
import { stoppedRunOf, type StoppedRun } from './labelPick'
import { TAPE_WIDTH_DEFAULT, clampTapeCopies, isTapeWidth, type LabelFormat, type TapeWidthMm } from './tapeLabel'

const FORMAT_KEY = 'pt.labels.format'
const WIDTH_KEY = 'pt.labels.tapeWidthMm'
const TAPE_DAY_KEY = 'pt.labels.tapePrintedYmd'
const COPIES_KEY = 'pt.labels.tapeCopies'

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

/** The day (`YYYY-MM-DD`) this device last sent tape to the print window, or null when it never has. */
export function readTapePrintedDay(): string | null {
  try {
    const v = window.localStorage.getItem(TAPE_DAY_KEY)
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  } catch {
    return null
  }
}

export function writeTapePrintedDay(ymd: string): void {
  try {
    window.localStorage.setItem(TAPE_DAY_KEY, ymd)
  } catch {
    /* the window works without the memory */
  }
}

/** Strips of each box, as last set on this device (v2.6878); 1 until it is set. The press always names the total. */
export function readTapeCopies(): number {
  try {
    return clampTapeCopies(window.localStorage.getItem(COPIES_KEY) ?? 1)
  } catch {
    return 1
  }
}

export function writeTapeCopies(copies: number): void {
  try {
    window.localStorage.setItem(COPIES_KEY, String(clampTapeCopies(copies)))
  } catch {
    /* the window works without the memory */
  }
}

const STOPPED_RUN_KEY = 'pt.labels.stoppedRun'

/** The run that stopped part way on this device, if one is kept (`labelPick.ts` decides whether it still counts). */
export function readStoppedRun(): StoppedRun | null {
  try {
    const raw = window.localStorage.getItem(STOPPED_RUN_KEY)
    return raw ? stoppedRunOf(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** Keeps a stopped run, or forgets it with null: a run that printed whole, or a person starting over. */
export function writeStoppedRun(run: StoppedRun | null): void {
  try {
    if (run) window.localStorage.setItem(STOPPED_RUN_KEY, JSON.stringify(run))
    else window.localStorage.removeItem(STOPPED_RUN_KEY)
  } catch {
    /* private mode, or storage full: the window still works, it only forgets when closed */
  }
}

const STICKER_PREVIEW_KEY = 'pt.stickers.previewOpen'

/** Whether the Print blank stickers window's *What the stickers will look like* fold was left open on this device (v2.7304); closed until it is. */
export function readStickerPreviewOpen(): boolean {
  try {
    return window.localStorage.getItem(STICKER_PREVIEW_KEY) === '1'
  } catch {
    return false
  }
}

export function writeStickerPreviewOpen(open: boolean): void {
  try {
    window.localStorage.setItem(STICKER_PREVIEW_KEY, open ? '1' : '0')
  } catch {
    /* the window works without the memory */
  }
}
