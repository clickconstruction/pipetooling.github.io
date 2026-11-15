/**
 * What the stickers will look like (punch list #329, v2.7304): the fold at the foot of the Print blank stickers window
 * that draws the strips of a run before the press, as the owner asked on 2026-11-14 while looking at the window on
 * job 224. The numbers of a run are known ahead: the next after the last run's end, as the window's foot line reads
 * it. A sticker's code is not: it is cut from the sticker's own id when the run is minted. So the preview draws the
 * numbers for real and the QR and the dashed code from one sample code, and says so in one line. The strips go through
 * the printer's own drawing (`TapeStripBitmap`, `tapeStripCanvas.ts`), so the preview and the tape agree. Pure: the
 * rows, the words and the sample. The fold is in `PrintStickersModal.tsx`.
 */
import { stickerNumberWords, stickerRangeWords } from './stickers'
import { stickerAddressWords, stickerUrl, type StickerStrip } from './stickerRun'
import { clampTapeCopies } from './tapeLabel'

/** The fold's summary. */
export const STICKER_PREVIEW_TITLE = 'What the stickers will look like'

/** Under the strips: what is real and what is a sample. */
export const STICKER_PREVIEW_CODE_WORDS = 'The numbers are the run’s. Each sticker’s code is given when the run prints.'

/** Over the test strip's drawing. */
export const STICKER_PREVIEW_TEST_WORDS = 'Print 1 test strip prints this strip. It is not a sticker.'

/** When the ask has no count the database would take. */
export const STICKER_PREVIEW_NO_COUNT_WORDS = 'Pick how many, and the strips are drawn here.'

/** While the last run is still being read. */
export const STICKER_PREVIEW_READING_WORDS = 'Reading where the last run ended…'

/** The strips drawn at the tape's size before Show all. */
export const STICKER_PREVIEW_FIRST_STRIPS = 6

/** The most stickers Show all draws; a run past it says how many are drawn. */
export const STICKER_PREVIEW_MAX_STICKERS = 200

/**
 * The code every preview strip carries: eight zeros, dashed `0000-0000` under the number. Eight characters, as a
 * sticker's code is, so the QR has the same squares and the address the same width as the one that prints.
 */
export const STICKER_SAMPLE_CODE = '00000000'

/** One strip of the preview: the number as it will print, the QR and the address from the sample code. */
export function previewStrip(number: number): StickerStrip {
  return { id: `preview-${stickerNumberWords(number)}`, stencil: stickerNumberWords(number), address: stickerAddressWords(STICKER_SAMPLE_CODE), value: stickerUrl(STICKER_SAMPLE_CODE) }
}

/** The run's numbers from where the last run ended and how many: 0003 to 0202 after a last of 2; 0001 on for the first run. */
export function previewNumbers(lastNumber: number | null, count: number): number[] {
  const n = Math.max(0, Math.floor(count))
  const first = (lastNumber ?? 0) + 1
  return Array.from({ length: n }, (_, i) => first + i)
}

/** One strip to draw: its number, which copy it is (0 first) and the strip itself. */
export type PreviewRow = { number: number; copy: number; strip: StickerStrip }

export type StickerPreview = {
  first: number
  last: number
  /** The strips at the tape's size, in the order they print: 1 1 2 2 with two copies. */
  head: PreviewRow[]
  /** The stickers after the head, once each, drawn smaller when Show all is pressed. */
  rest: PreviewRow[]
  /** The stickers not drawn. */
  more: number
  /** *and 194 more, to 0202*, or null when every sticker is drawn. */
  moreWords: string | null
  /** The press that draws the rest: *Show all 200*; null when the head holds the whole run or the rest is drawn. */
  showAllLabel: string | null
  /** Said once Show all is pressed on a run past the cap; null otherwise. */
  cappedWords: string | null
}

/** *and 194 more, to 0202*; *and 1 more, 0202*. */
export function previewMoreWords(more: number, last: number): string {
  return more === 1 ? `and 1 more, ${stickerNumberWords(last)}` : `and ${more} more, to ${stickerNumberWords(last)}`
}

/** *Show all 200*: a view press, so *all* is honest with its count beside it. */
export function showAllLabel(count: number): string {
  return `Show all ${count}`
}

/** *The first 200 of 500 are drawn. The rest print the same way.* */
export function previewCappedWords(drawn: number, count: number): string {
  return `The first ${drawn} of ${count} are drawn. The rest print the same way.`
}

/** *6 strips of 200 stickers, 0003 to 0008.*: the head's line. */
export function previewHeadWords(head: ReadonlyArray<PreviewRow>, count: number): string {
  if (head.length === 0) return ''
  const first = head[0]!.number
  const last = head[head.length - 1]!.number
  const strips = head.length === 1 ? '1 strip' : `${head.length} strips`
  const of = count === 1 ? '1 sticker' : `${count} stickers`
  return `${strips} of ${of}, ${stickerRangeWords(first, last)}.`
}

/**
 * The preview's rows for a run: the first six strips in the order they print, each sticker's copies together, and
 * with `all` the stickers after them once each up to the cap. A count of zero draws nothing.
 */
export function stickerPreview(input: { lastNumber: number | null; count: number; copies: number; all: boolean }): StickerPreview {
  const numbers = previewNumbers(input.lastNumber, input.count)
  const copies = clampTapeCopies(input.copies)
  const first = numbers[0] ?? 0
  const last = numbers[numbers.length - 1] ?? 0
  const head: PreviewRow[] = []
  for (const number of numbers) {
    if (head.length >= STICKER_PREVIEW_FIRST_STRIPS) break
    const strip = previewStrip(number)
    for (let copy = 0; copy < copies && head.length < STICKER_PREVIEW_FIRST_STRIPS; copy++) head.push({ number, copy, strip })
  }
  const headStickers = head.length === 0 ? 0 : head[head.length - 1]!.number - first + 1
  const restNumbers = input.all ? numbers.slice(headStickers, Math.max(headStickers, STICKER_PREVIEW_MAX_STICKERS)) : []
  const rest = restNumbers.map((number) => ({ number, copy: 0, strip: previewStrip(number) }))
  const drawn = headStickers + rest.length
  const more = numbers.length - drawn
  const capped = input.all && more > 0
  return {
    first,
    last,
    head,
    rest,
    more,
    moreWords: more > 0 && !capped ? previewMoreWords(more, last) : null,
    showAllLabel: more > 0 && !input.all ? showAllLabel(numbers.length) : null,
    cappedWords: capped ? previewCappedWords(drawn, numbers.length) : null,
  }
}
