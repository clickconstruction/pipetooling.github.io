/**
 * The Brother P-touch's own raster language, as the labels window speaks it straight over USB (punch list #304).
 * Brother makes no Mac printer driver for the PT-D610BT, so a Mac's print window cannot reach it; the browser can,
 * through WebUSB, by sending the dots itself. Pure: the commands as bytes, a drawing turned into raster lines, and a
 * status reply read back. The USB side is `ptouchUsb.ts`; the strip's drawing is `tapeStrip.ts`.
 *
 * The facts come from Brother's Raster Command Reference (the PT-E550W / P750W / P710BT edition) and were proven on a
 * PT-D610BT on 2026-11-10: one label is one whole job, cut and fed out, and nothing may be sent while it prints.
 */

/** Brother's USB vendor id, the filter the browser's device chooser is opened with. */
export const BROTHER_USB_VENDOR_ID = 0x04f9

/** The print head: 128 dots at 180 dots an inch, so 16 bytes a raster line. */
export const PTOUCH_HEAD_DOTS = 128
export const PTOUCH_LINE_BYTES = PTOUCH_HEAD_DOTS / 8
export const PTOUCH_DPI = 180

/** How many of the head's dots each tape width can print (the reference's print area); the rest of the tape stays blank. */
export const PTOUCH_TAPE_DOTS: Readonly<Record<number, number>> = { 12: 70, 18: 112, 24: 128 }

/** The dots a tape prints across, or null for a width the labels are not laid out for. */
export function ptouchTapeDots(tapeMm: number): number | null {
  return PTOUCH_TAPE_DOTS[tapeMm] ?? null
}

export function dotsToMm(dots: number): number {
  return (dots / PTOUCH_DPI) * 25.4
}

// ── the commands ─────────────────────────────────────────────────────────────────────────────

/** Invalidate (100 zero bytes), then initialize (ESC @): once at the start of a job. */
export function cmdInit(): Uint8Array {
  const b = new Uint8Array(102)
  b[100] = 0x1b
  b[101] = 0x40
  return b
}

/** ESC i S: ask for the 32-byte status. Never while a label is printing. */
export function cmdStatusRequest(): Uint8Array {
  return Uint8Array.of(0x1b, 0x69, 0x53)
}

/** ESC i a 1: switch to raster mode. */
export function cmdRasterMode(): Uint8Array {
  return Uint8Array.of(0x1b, 0x69, 0x61, 0x01)
}

/**
 * ESC i z: the print information. The tape's width in millimetres, the count of raster lines little-endian, and the
 * page flag, which is 2 on this model for a label that is a whole job (what the PT-D610BT printed with).
 */
export function cmdPrintInfo(tapeMm: number, lines: number): Uint8Array {
  return Uint8Array.of(0x1b, 0x69, 0x7a, 0x00, 0x00, tapeMm & 255, 0x00, lines & 255, (lines >> 8) & 255, (lines >> 16) & 255, (lines >> 24) & 255, 0x02, 0x00)
}

/** ESC i d: the margin, in dots, before and after the print (the reference's least is 14, about 2 mm). Then M 0: the lines are sent uncompressed. */
export function cmdMarginAndPlainLines(marginDots = 1): Uint8Array {
  return Uint8Array.of(0x1b, 0x69, 0x64, marginDots & 255, (marginDots >> 8) & 255, 0x4d, 0x00)
}

/** ESC i M with bit 6: cut each label. */
export function cmdAutoCut(): Uint8Array {
  return Uint8Array.of(0x1b, 0x69, 0x4d, 0x40)
}

/** ESC i K with bit 3: no chain printing, so the label is fed out and cut when it is printed. */
export function cmdFeedAndCutAfter(): Uint8Array {
  return Uint8Array.of(0x1b, 0x69, 0x4b, 0x08)
}

/** G, the length, then the line's dots. */
export function cmdRasterLine(line: Uint8Array): Uint8Array {
  const b = new Uint8Array(3 + line.length)
  b[0] = 0x47
  b[1] = line.length & 255
  b[2] = (line.length >> 8) & 255
  b.set(line, 3)
  return b
}

/** Control-Z: print, feed and cut. The end of a job. */
export function cmdPrintAndFeed(): Uint8Array {
  return Uint8Array.of(0x1a)
}

/** One label as one whole job, in the order the printer takes it. Sent after a status reply says the printer is ready. */
export function ptouchLabelJob(lines: ReadonlyArray<Uint8Array>, tapeMm: number): Uint8Array[] {
  return [cmdRasterMode(), cmdPrintInfo(tapeMm, lines.length), cmdMarginAndPlainLines(), cmdAutoCut(), cmdFeedAndCutAfter(), ...lines.map(cmdRasterLine), cmdPrintAndFeed()]
}

// ── a drawing as raster lines ────────────────────────────────────────────────────────────────

/** Whether the pixel at `at` in an RGBA buffer prints as a dot: opaque and darker than mid grey. */
function isInk(rgba: Uint8ClampedArray | Uint8Array, at: number): boolean {
  return (rgba[at + 3] ?? 0) > 127 && ((rgba[at] ?? 0) * 299 + (rgba[at + 1] ?? 0) * 587 + (rgba[at + 2] ?? 0) * 114) / 1000 < 128
}

/**
 * A drawing as raster lines. The drawing's x runs along the tape, one line a column; its height runs across the head,
 * centred on it, with the bottom row on pin 0. Each line is 16 bytes, pin 0 the lowest bit of the last byte.
 */
export function rasterLinesFromRgba(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Uint8Array[] {
  const offset = Math.floor(PTOUCH_HEAD_DOTS / 2) - Math.floor(height / 2)
  const lines: Uint8Array[] = []
  for (let x = 0; x < width; x++) {
    const line = new Uint8Array(PTOUCH_LINE_BYTES)
    for (let i = 0; i < height; i++) {
      const y = height - 1 - i
      if (!isInk(rgba, (y * width + x) * 4)) continue
      const pin = offset + i
      if (pin < 0 || pin >= PTOUCH_HEAD_DOTS) continue
      const byte = PTOUCH_LINE_BYTES - 1 - (pin >> 3)
      line[byte] = (line[byte] ?? 0) | (1 << (pin & 7))
    }
    lines.push(line)
  }
  return lines
}

/** The drawing's width trimmed to its last column of ink plus `pad` dots: blank tape after the print is waste. */
export function inkWidth(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, pad = 14): number {
  for (let x = width - 1; x >= 0; x--) {
    for (let y = 0; y < height; y++) {
      if (isInk(rgba, (y * width + x) * 4)) return Math.min(width, x + 1 + pad)
    }
  }
  return 0
}

// ── the status reply ─────────────────────────────────────────────────────────────────────────

export type PtouchStatus = {
  /** The tape's width in millimetres; 0 with no tape in. */
  tapeMm: number
  /** 0 a reply to a request, 1 printing completed, 2 an error, 6 a phase change. */
  statusType: number
  /** 0 ready to receive, 1 printing. */
  phase: number
  /** What is wrong, in words; empty when nothing is. */
  errors: string[]
}

const ERROR_1: ReadonlyArray<[number, string]> = [
  [0x01, 'There is no tape in the printer.'],
  [0x04, 'The cutter is jammed.'],
  [0x08, 'The printer’s batteries are weak.'],
  [0x40, 'The wrong power adapter is plugged in.'],
]
const ERROR_2: ReadonlyArray<[number, string]> = [
  [0x01, 'The tape was changed. Check the cassette.'],
  [0x10, 'The printer’s cover is open.'],
  [0x20, 'The printer is too hot. Let it cool.'],
]

/** A 32-byte status as the printer sends it, or null when the bytes are not one. */
export function parsePtouchStatus(bytes: Uint8Array): PtouchStatus | null {
  if (bytes.length < 32 || bytes[0] !== 0x80 || bytes[1] !== 0x20) return null
  const e1 = bytes[8] ?? 0
  const e2 = bytes[9] ?? 0
  const errors = [...ERROR_1.filter(([mask]) => e1 & mask), ...ERROR_2.filter(([mask]) => e2 & mask)].map(([, words]) => words)
  const known = ERROR_1.reduce((m, [mask]) => m | mask, 0)
  const known2 = ERROR_2.reduce((m, [mask]) => m | mask, 0)
  if ((e1 & ~known) || (e2 & ~known2) || ((bytes[18] ?? 0) === 0x02 && errors.length === 0)) errors.push('The printer reported an error.')
  return { tapeMm: bytes[10] ?? 0, statusType: bytes[18] ?? 0, phase: bytes[19] ?? 0, errors }
}

/** How long a label takes at the least, in milliseconds: the lead-in, the print at about 20 mm a second, and the cut. */
export function labelPrintMs(lines: number): number {
  return Math.round(((dotsToMm(lines) + 25) / 20) * 1000) + 1500
}

// ── words ────────────────────────────────────────────────────────────────────────────────────

/** The line beside the press once the printer has answered: `PT-D610BT · 24 mm tape · ready`. */
export function ptouchReadyLine(model: string, status: PtouchStatus): string {
  if (status.errors.length > 0) return `${model} · ${status.errors.join(' ')}`
  if (status.tapeMm === 0) return `${model} · no tape`
  if (ptouchTapeDots(status.tapeMm) == null || status.tapeMm < 18) return `${model} · ${status.tapeMm} mm tape · load 18 or 24 mm tape for box labels`
  return `${model} · ${status.tapeMm} mm tape · ready`
}

/** Whether the tape in the printer is one the box label is laid out for. */
export function ptouchTapeFits(status: PtouchStatus): boolean {
  return status.errors.length === 0 && (status.tapeMm === 18 || status.tapeMm === 24)
}

export const PTOUCH_NOT_ANSWERING = 'The printer is not answering. Switch it off, wait five seconds, switch it on, then press Connect the P-touch again.'
export const PTOUCH_BUSY = 'Another program is holding the printer. Quit Brother’s P-touch Editor, then press Connect the P-touch again.'
/**
 * A browser with no USB reach (Safari, Firefox, any phone). The app asks the browser what it can do, never its name,
 * so a browser built on Chrome's engine that offers USB gets Connect the P-touch like Chrome does.
 */
export const PTOUCH_NO_USB = 'This browser cannot print straight to the P-touch. Open this page in Chrome or Edge on a computer.'
export const PTOUCH_NO_USB_WHY = 'Safari and Firefox cannot reach a USB printer. On a Mac the print window cannot print tape either, since Brother makes no Mac driver.'
/** The chip on the Brother tape choice where the browser has no USB reach, so it is read before the choice is made. */
export const PTOUCH_NEEDS_BROWSER = 'Needs Chrome or Edge'
export const PTOUCH_COPY_LINK_LABEL = 'Copy the link to this page'
export const PTOUCH_LINK_COPIED = 'Link copied. Paste it into Chrome or Edge.'
export const PTOUCH_LINK_NOT_COPIED = 'Could not copy. Copy the address from the bar at the top.'
export const PTOUCH_CONNECT_LABEL = 'Connect the P-touch'
