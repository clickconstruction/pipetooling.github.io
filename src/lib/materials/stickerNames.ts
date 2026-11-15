/**
 * A run that names its boxes (punch list #329, design section 10, v2.7312): what a typed range of box names means.
 * The owner, 2026-11-15: print stickers that already say G1 to G200, or G78 to G300, so the sticker on the cage is
 * the name painted on it. A name is the box rule's (#351, `boxName.ts`): one to three letters, 1 to 999 with no zero
 * in front, one letter after or none, seven characters at most. On the paint the plain name is the first cage at a
 * spot and B the second (G24 and G24B, never G24A).
 *
 * A range is two names with a dash between, or one name and the count. The parts of the two ends that differ step,
 * the parts that match stay: `G78-300` steps the number; `A1-D50` the letter and the number, four rows of fifty, row
 * by row; `G78B-D` the letter after, twins at one spot; `G1-100C` reads plain, B, C for every spot, the letter after
 * the innermost step so a spot's cages print together. All three parts stepping, a range running downward, a name off
 * the rule, a name past 999 and a run over 500 are refused in words. The end may be a whole name, a number, a number
 * with a letter after, or a bare letter after; ` to ` and the long dashes read as the dash; the case does not matter.
 *
 * Pure. The list it makes goes to `mint_sticker_run` as `p_names` (`20261115050000_sticker_run_names.sql`), where the
 * database holds what it can check on the list itself: each name under the rule, as many as the stickers, each once.
 * The database reads no range, so the shorthand has one home. The window's field is PR 8; the mock-up's rule table in
 * `to-dos/stickers-before-boxes/mockup-named-runs.html` is this file's test list.
 */
import { BOX_NAME_RULE, BOX_NAME_RULE_WORDS, boxNameWords, parseBoxName, type BoxName, type SiteBox } from './boxName'
import { STICKER_RUN_MAX } from './stickerRun'
import { BOX_NUMBER_MAX } from './boxName'

export type StickerRange =
  /** Nothing typed: the run carries numbers only, as before. */
  | { kind: 'numbered' }
  | {
      kind: 'names'
      /** In print order. */
      names: string[]
      first: string
      last: string
      /** More than one when the letters step: the rows of a grid. */
      rows: number
      /** Why it reads so: *The number steps.*, *4 rows of 50, A to D, row by row.* */
      why: string
    }
  | { kind: 'refused'; words: string }

/** The letters of a name step on the last letter only, upward: A to D, GA to GD. Null when they cannot. */
function stepLetters(from: string, to: string): string[] | null {
  if (from.length !== to.length || from.slice(0, -1) !== to.slice(0, -1)) return null
  const a = from.charCodeAt(from.length - 1)
  const b = to.charCodeAt(to.length - 1)
  if (b < a) return null
  const out: string[] = []
  for (let c = a; c <= b; c++) out.push(from.slice(0, -1) + String.fromCharCode(c))
  return out
}

/** The letters after the number from a start to an end: from a plain start, plain then B on; from a letter, that letter on. */
function stepTails(from: string, to: string): string[] | null {
  if (from === to) return [from]
  if (from && !to) return null
  if (!from) return [''].concat(to > 'A' ? (stepLetters('B', to) ?? []) : [])
  return stepLetters(from, to)
}

/** A range that runs downward, in words. */
function upwardWords(a: BoxName, b: BoxName): string {
  return `The range runs upward: ${boxNameWords(b)} to ${boxNameWords(a)}.`
}

export const STICKER_RANGE_SHAPE_WORDS = 'A range is two names with one dash between, like G78-300.'
export const STICKER_RANGE_AXES_WORDS = 'A range steps the number, the letter or both. Not all three.'
export const STICKER_RANGE_LETTERS_WORDS = 'The letters step on the last letter only, A to D or GA to GD, upward.'

/** A run is 1 to 500 stickers, with the range's own count. */
export function stickerRangeTooLongWords(a: BoxName, b: BoxName, count: number): string {
  return `A run is 1 to ${STICKER_RUN_MAX} stickers. ${boxNameWords(a)} to ${boxNameWords(b)} is ${count}.`
}

/** The typed text as the parser reads it: capitals, no spaces, ` to ` and the long dashes as the dash. */
export function normalizeStickerRange(typed: string): string {
  return String(typed ?? '')
    .toUpperCase()
    .replace(/\s+TO\s+/g, '-')
    .replace(/\s+/g, '')
    .replace(/[–—]/g, '-')
}

/**
 * What a typed range means. `howMany` is the count when one name is typed alone: the names start there and stop at
 * 999 with its words.
 */
export function readStickerRange(typed: string, howMany: number): StickerRange {
  const t = normalizeStickerRange(typed)
  if (!t) return { kind: 'numbered' }
  const parts = t.split('-')
  if (parts.length > 2) return { kind: 'refused', words: STICKER_RANGE_SHAPE_WORDS }
  const a = parseBoxName(parts[0]!)
  if (!a) return { kind: 'refused', words: BOX_NAME_RULE_WORDS }
  if (parts.length === 1) {
    const count = Math.max(1, Math.min(STICKER_RUN_MAX, Math.floor(Number(howMany)) || 1))
    let last = a.number + count - 1
    const cut = last > BOX_NUMBER_MAX
    if (cut) last = BOX_NUMBER_MAX
    const names: string[] = []
    for (let n = a.number; n <= last; n++) names.push(`${a.letters}${n}${a.tail}`)
    return {
      kind: 'names',
      names,
      first: names[0]!,
      last: names[names.length - 1]!,
      rows: 1,
      why: cut ? `Names stop at ${a.letters}${BOX_NUMBER_MAX}${a.tail}, so the run is ${names.length}.` : `From ${boxNameWords(a)}, How many says how far.`,
    }
  }
  const short = /^([1-9][0-9]{0,2})([A-Z])?$/.exec(parts[1]!)
  const b: BoxName | null = short
    ? { letters: a.letters, number: Number(short[1]), tail: short[2] ?? a.tail }
    : /^[A-Z]$/.test(parts[1]!)
      ? { letters: a.letters, number: a.number, tail: parts[1]! }
      : parseBoxName(parts[1]!)
  if (!b) return { kind: 'refused', words: BOX_NAME_RULE_WORDS }
  const lettersStep = a.letters !== b.letters
  const numberStep = a.number !== b.number
  const tailStep = a.tail !== b.tail
  if (lettersStep && numberStep && tailStep) return { kind: 'refused', words: STICKER_RANGE_AXES_WORDS }
  const letters = lettersStep ? stepLetters(a.letters, b.letters) : [a.letters]
  if (!letters) return { kind: 'refused', words: STICKER_RANGE_LETTERS_WORDS }
  if (b.number < a.number) return { kind: 'refused', words: upwardWords(a, b) }
  const tails = stepTails(a.tail, b.tail)
  if (!tails) return { kind: 'refused', words: upwardWords(a, b) }
  const names: string[] = []
  for (const L of letters) for (let n = a.number; n <= b.number; n++) for (const T of tails) names.push(`${L}${n}${T}`)
  if (names.length > STICKER_RUN_MAX) return { kind: 'refused', words: stickerRangeTooLongWords(a, b, names.length) }
  const rows = letters.length
  const why =
    rows > 1
      ? `${rows} rows of ${names.length / rows}, ${letters[0]} to ${letters[letters.length - 1]}, row by row.`
      : tails.length > 1 && !a.tail
        ? `Each spot gets the plain name, then ${tails.length > 2 ? `B to ${b.tail}` : 'B'}: the twins behind it.`
        : tails.length > 1
          ? 'The letter after the number steps: a set of twins at one spot.'
          : 'The number steps.'
  return { kind: 'names', names, first: names[0]!, last: names[names.length - 1]!, rows, why }
}

/** The read line under the field: *G78 to G300 · 223 stickers. The number steps.*; the refusal's words; the numbered line. */
export function stickerRangeWords(range: StickerRange): string {
  if (range.kind === 'refused') return range.words
  if (range.kind === 'numbered') return 'Nothing typed: the stickers carry their number only. A leftover works on any site.'
  const n = range.names.length
  return `${range.first} to ${range.last} · ${n} ${n === 1 ? 'sticker' : 'stickers'}. ${range.why}`
}

/** Whether a typed text set the end itself, so How many follows it rather than the other way. */
export function stickerRangeSetsCount(typed: string): boolean {
  return normalizeStickerRange(typed).includes('-')
}

/**
 * The next twin at a spot, for a sticker whose name the site already carries and a person who says it is a different
 * box (PR 9): G78B when G78 is live and no G78B, G78C when G78B stands. Null when the name is off the rule, when its
 * plain name is not a live box, or past Z.
 */
export function nextTwinName(boxes: ReadonlyArray<SiteBox>, name: string): string | null {
  const n = parseBoxName(name)
  if (!n) return null
  const live = new Set(boxes.filter((b) => !b.retiredAt).map((b) => b.label.trim().toUpperCase()))
  const plain = `${n.letters}${n.number}`
  if (!live.has(plain) && !live.has(name.trim().toUpperCase())) return null
  for (let c = 'B'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
    const twin = `${plain}${String.fromCharCode(c)}`
    if (!live.has(twin)) return twin
  }
  return null
}

/** The rule as a name is held on a sticker: `BOX_NAME_RULE`, for a reader that has only this file. */
export const STICKER_NAME_RULE = BOX_NAME_RULE
