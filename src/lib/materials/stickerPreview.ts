/**
 * What the stickers will look like (punch list #329, v2.7304): the fold at the foot of the Reserve stickers window
 * that draws the strips of a run before the press. A named run's names are known ahead, each sticker taking its name
 * in print order. A sticker's code is not: it is cut from the sticker's own id when the run is minted. So the preview
 * draws the names for real and the QR and the dashed code from one sample code, and says so in one line. The strips
 * go through the printer's own drawing (`TapeStripBitmap`, `tapeStripCanvas.ts`), so the preview and the tape agree.
 * Pure: the rows, the words and the sample. The fold is in `PrintStickersModal.tsx`.
 *
 * Since v2.7438 (Taunya's call of 2026-11-16) no strip carries a running number, so a run with no names previews as
 * the one strip every sticker of it will be but for its code, the code drawn larger in the name's place.
 */
import { nameSpanWords, stickerStrip, type StickerStrip } from './stickerRun'
import { clampTapeCopies } from './tapeLabel'

/** The fold's summary. */
export const STICKER_PREVIEW_TITLE = 'What the stickers will look like'

/** Under the strips of a run with no names: every strip is the sample but for its code. */
export const STICKER_PREVIEW_CODE_WORDS = 'Each sticker’s code is given when the run prints. The code drawn here is a sample.'

/** The same line for a run that names its boxes (section 10, v2.7391). */
export const STICKER_PREVIEW_NAMED_CODE_WORDS = 'The names are the run’s. Each sticker’s code is given when the run prints.'

/** Over the test strip's drawing. */
export const STICKER_PREVIEW_TEST_WORDS = 'Print 1 test strip prints this strip. It is not a sticker.'

/** When the ask has no count the database would take. */
export const STICKER_PREVIEW_NO_COUNT_WORDS = 'Pick how many, and the strips are drawn here.'

/** The strips drawn at the tape's size before Show all. */
export const STICKER_PREVIEW_FIRST_STRIPS = 6

/** The most stickers Show all draws; a run past it says how many are drawn. */
export const STICKER_PREVIEW_MAX_STICKERS = 200

/**
 * The code every preview strip carries: eight zeros, dashed `0000-0000`. Eight characters, as a sticker's code is, so
 * the QR has the same squares and the address the same width as the one that prints.
 */
export const STICKER_SAMPLE_CODE = '00000000'

/** One strip of the preview, through the run's own `stickerStrip`: the name large when the run has names, and the QR and the address from the sample code. `at` is the sticker's place in the run, from 0. */
export function previewStrip(at: number, name?: string | null): StickerStrip {
  return stickerStrip({ id: `preview-${at}`, number: at + 1, code: STICKER_SAMPLE_CODE, boxName: name ?? null })
}

/** One strip to draw: the sticker's place in the run (0 first), which copy it is (0 first) and the strip itself. */
export type PreviewRow = { at: number; copy: number; strip: StickerStrip }

export type StickerPreview = {
  /** The strips at the tape's size, in the order they print: 1 1 2 2 with two copies. */
  head: PreviewRow[]
  /** The stickers after the head, once each, drawn smaller when Show all is pressed. */
  rest: PreviewRow[]
  /** The stickers not drawn. */
  more: number
  /** *and 217 more, to G300*, *and 194 more*, or null when every sticker is drawn. */
  moreWords: string | null
  /** The press that draws the rest: *Show all 200*; null when the head holds the whole run or the rest is drawn. */
  showAllLabel: string | null
  /** Said once Show all is pressed on a run past the cap; null otherwise. */
  cappedWords: string | null
}

/** *and 217 more, to G300*; *and 1 more, G300*; with no names, *and 199 more, each with its own code*. `last` is the last sticker's name, or empty. */
export function previewMoreWords(more: number, last: string): string {
  if (!last) return `and ${more} more, each with its own code`
  return more === 1 ? `and 1 more, ${last}` : `and ${more} more, to ${last}`
}

/** *Show all 200*: a view press, so *all* is honest with its count beside it. */
export function showAllLabel(count: number): string {
  return `Show all ${count}`
}

/** *The first 200 of 500 are drawn. The rest print the same way.* */
export function previewCappedWords(drawn: number, count: number): string {
  return `The first ${drawn} of ${count} are drawn. The rest print the same way.`
}

/** *6 strips of 223 stickers, G78 to G83.*: the head's line; a run with no names, *1 sticker of 200, with a sample code.* */
export function previewHeadWords(head: ReadonlyArray<PreviewRow>, count: number): string {
  if (head.length === 0) return ''
  const first = head[0]!.strip.stencil
  const last = head[head.length - 1]!.strip.stencil
  if (!first || !last) return count === 1 ? '1 sticker, with a sample code.' : `1 sticker of ${count}, with a sample code.`
  const strips = head.length === 1 ? '1 strip' : `${head.length} strips`
  const of = count === 1 ? '1 sticker' : `${count} stickers`
  return `${strips} of ${of}, ${nameSpanWords(first, last)}.`
}

/**
 * The preview's rows for a run. A named run: the first six strips in the order they print, each sticker's copies
 * together, and with `all` the stickers after them once each up to the cap; it is as many stickers as it has names.
 * A run with no names: one sticker, its copies together, since every other strip differs only by its code. A count of
 * zero draws nothing.
 */
export function stickerPreview(input: { count: number; copies: number; all: boolean; names?: ReadonlyArray<string> | null }): StickerPreview {
  const names = input.names && input.names.length > 0 ? input.names : null
  const total = names ? names.length : Math.max(0, Math.floor(input.count))
  const copies = clampTapeCopies(input.copies)
  const nameOf = (at: number) => (names ? names[at] ?? null : null)
  const head: PreviewRow[] = []
  let headStickers = 0
  // With no names every strip is the sample: one sticker stands for the run, and there is nothing more to show.
  const headMost = names ? total : Math.min(total, 1)
  for (let at = 0; at < headMost && head.length < STICKER_PREVIEW_FIRST_STRIPS; at++) {
    const strip = previewStrip(at, nameOf(at))
    for (let copy = 0; copy < copies && head.length < STICKER_PREVIEW_FIRST_STRIPS; copy++) head.push({ at, copy, strip })
    headStickers = at + 1
  }
  const restEnd = input.all && names ? Math.min(total, Math.max(headStickers, STICKER_PREVIEW_MAX_STICKERS)) : headStickers
  const rest: PreviewRow[] = []
  for (let at = headStickers; at < restEnd; at++) rest.push({ at, copy: 0, strip: previewStrip(at, nameOf(at)) })
  const drawn = headStickers + rest.length
  const more = total - drawn
  const capped = input.all && more > 0 && names != null
  return {
    head,
    rest,
    more,
    moreWords: more > 0 && !capped ? previewMoreWords(more, nameOf(total - 1) ?? '') : null,
    showAllLabel: more > 0 && !input.all && names ? showAllLabel(total) : null,
    cappedWords: capped ? previewCappedWords(drawn, total) : null,
  }
}
